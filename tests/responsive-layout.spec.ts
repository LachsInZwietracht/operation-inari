import { expect, test } from "@playwright/test";

const MOBILE_ROUTES = [
  "/dashboard",
  "/lebensmittel",
  "/rezepte",
  "/patienten",
  "/institution/krankenhaus",
  "/api-export",
];

test.describe("Responsive layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of MOBILE_ROUTES) {
    test(`${route} does not create document-level horizontal overflow`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      const width = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));

      expect(width.document, JSON.stringify(width)).toBeLessThanOrEqual(width.viewport + 2);
      expect(width.body, JSON.stringify(width)).toBeLessThanOrEqual(width.viewport + 2);
    });
  }
});
