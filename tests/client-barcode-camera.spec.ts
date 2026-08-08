import { expect, test } from "@playwright/test";
import { readBarcodes } from "zxing-wasm/reader";

/**
 * The camera path of the barcode scanner.
 *
 * Chromium's fake device produces a synthetic pattern, not a barcode, so this
 * does not assert a successful decode — that needs a real lens and is the one
 * part only a device test can answer. What it does cover is everything that
 * breaks silently: permission handling, the scanner starting at all, and the
 * camera actually being released on close. A stream left running keeps the
 * phone's camera indicator lit, which reads as the app still watching.
 */

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
  permissions: ["camera"],
});

// ============================================================================
// Decoder
// ============================================================================

const EAN13_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EAN13_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const EAN13_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const EAN13_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

/** The bar pattern of an EAN-13, per the symbology's own encoding tables. */
function ean13Bits(code: string): string {
  const digits = [...code].map(Number);
  const parity = EAN13_PARITY[digits[0]];

  let bits = "101";
  for (let i = 1; i <= 6; i++) {
    bits += (parity[i - 1] === "L" ? EAN13_L : EAN13_G)[digits[i]];
  }
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += EAN13_R[digits[i]];
  return `${bits}101`;
}

/**
 * Renders the pattern as black-on-white pixels.
 *
 * Generated rather than committed as an image fixture: this way the test pins
 * the actual symbology instead of a binary nobody can review, and a change to
 * the scanner's format list shows up here as a failure.
 */
function renderBarcode(code: string) {
  const bits = ean13Bits(code);
  const moduleWidth = 4;
  const quietZone = 20;
  const width = bits.length * moduleWidth + quietZone * 2;
  const height = 120;

  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== "1") continue;
      for (let x = quietZone + i * moduleWidth; x < quietZone + (i + 1) * moduleWidth; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
      }
    }
  }
  // `colorSpace` only exists to satisfy the ImageData shape; Node has no
  // ImageData constructor to build this with.
  return { data, width, height, colorSpace: "srgb" } satisfies ImageData;
}

test.describe("barcode decoder", () => {
  test("decodes an EAN-13 with the formats the scanner asks for", async () => {
    const results = await readBarcodes(renderBarcode("4008400401027"), {
      formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"],
      tryHarder: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("4008400401027");
    expect(results[0].format).toBe("EAN13");
  });
});

test.describe("barcode camera", () => {
  test.beforeEach(async ({ page }) => {
    // Keep every stream handed out so the release can be verified afterwards.
    await page.addInitScript(() => {
      const streams: MediaStream[] = [];
      (window as unknown as { __streams: MediaStream[] }).__streams = streams;

      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        streams.push(stream);
        return stream;
      };
    });
  });

  async function openScanner(page: import("@playwright/test").Page) {
    await page.goto("/klient");
    await page.getByRole("button", { name: "Hinzufügen" }).first().click();
    await page.getByRole("button", { name: "Barcode", exact: true }).click();
    await page.getByRole("button", { name: "Barcode scannen" }).click();
  }

  test("opens the camera and releases it again", async ({ page }) => {
    const wasmRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(".wasm")) wasmRequests.push(request.url());
    });

    await openScanner(page);

    const video = page.locator("video");
    await expect(video).toBeVisible();
    // The overlay clears once the stream plays, which is the scanner's own
    // signal that it got past permission and autoplay.
    await expect(page.getByText("Kamera wird geöffnet")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText("Halte den Barcode in den Rahmen.")).toBeVisible();

    const streamsBefore = await page.evaluate(
      () => (window as unknown as { __streams: MediaStream[] }).__streams.length,
    );
    expect(streamsBefore).toBeGreaterThan(0);

    // Where the browser has no native BarcodeDetector — Safari, and therefore
    // every iPhone — the wasm decoder must come from our own origin, never the
    // CDN zxing-wasm would reach for by default.
    const hasNativeDetector = await page.evaluate(() => "BarcodeDetector" in window);
    if (!hasNativeDetector) {
      await expect.poll(() => wasmRequests).not.toHaveLength(0);
      expect(wasmRequests.every((url) => url.startsWith("http://localhost:3000/zxing/"))).toBe(
        true,
      );
    }

    await page.getByRole("button", { name: "Kamera schließen" }).click();
    await expect(video).toBeHidden();

    const allEnded = await page.evaluate(() =>
      (window as unknown as { __streams: MediaStream[] }).__streams
        .flatMap((stream) => stream.getTracks())
        .every((track) => track.readyState === "ended"),
    );
    expect(allEnded).toBe(true);
  });

  test("keeps the typed code as a way out", async ({ page }) => {
    await openScanner(page);
    await page.getByRole("button", { name: "Kamera schließen" }).click();

    await expect(page.getByLabel("oder eintippen")).toBeVisible();
  });

  test("releases the camera when the dialog is closed mid-scan", async ({ page }) => {
    await openScanner(page);
    await expect(page.getByText("Kamera wird geöffnet")).toBeHidden({ timeout: 15_000 });

    // Closing the dialog unmounts the scanner without its own close button
    // ever being clicked — the cleanup has to hang off unmount, not the button.
    await page.getByRole("button", { name: "Abbrechen" }).click();

    await expect
      .poll(async () =>
        page.evaluate(() =>
          (window as unknown as { __streams: MediaStream[] }).__streams
            .flatMap((stream) => stream.getTracks())
            .every((track) => track.readyState === "ended"),
        ),
      )
      .toBe(true);
  });
});
