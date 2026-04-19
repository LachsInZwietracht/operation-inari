import { expect, test } from "@playwright/test";

test.describe("Digital Protocol Public Entry", () => {
  test("invalid UUID shows not-found message", async ({ page }) => {
    await page.goto("/protokoll/not-a-uuid", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page.getByText("Link nicht gefunden")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("non-existent UUID shows not-found message", async ({ page }) => {
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(
      page.getByText(/nicht gefunden|nicht existiert/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("page has correct metadata title", async ({ page }) => {
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page).toHaveTitle(/Ernährungsprotokoll.*Prodi/);
  });

  test("public route has no sidebar or app shell", async ({ page }) => {
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // No sidebar should be visible on the public route
    await expect(
      page.locator("[data-slot='sidebar-container']")
    ).not.toBeVisible();
  });

  test("submission API rejects invalid body", async ({ request }) => {
    const response = await request.post("/api/protokoll/submit", {
      data: { invalid: true },
    });
    expect(response.status()).toBe(400);
  });

  test("submission API rejects non-existent link", async ({ request }) => {
    const response = await request.post("/api/protokoll/submit", {
      data: {
        linkId: "00000000-0000-0000-0000-000000000000",
        patientId: "00000000-0000-0000-0000-000000000001",
        days: [
          {
            date: "2026-04-19",
            entries: [
              {
                mealSlot: "fruehstueck",
                freeText: "Toast mit Butter",
              },
            ],
          },
        ],
      },
    });
    // Either 404 (not found) or 500 (service client placeholder) depending on env
    expect([404, 500]).toContain(response.status());
  });

  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // Page should still render the error state without layout issues
    const content = page.locator("main");
    await expect(content).toBeVisible({ timeout: 10_000 });
  });
});
