import { expect, test } from "@playwright/test";

test.describe("Exchange Tables", () => {
  // BLS catalog is large — give pages time to load
  test.setTimeout(60_000);

  test("displays exchange table with food data", async ({ page }) => {
    await page.goto("/austauschtabellen");
    await expect(page.getByRole("heading", { name: "Austauschtabellen" })).toBeVisible();

    // Wait for table rows to render (BLS has thousands of foods)
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(10);
  });

  test("searches for specific food", async ({ page }) => {
    await page.goto("/austauschtabellen");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const initialCount = await rows.count();

    // BLS name: "Lachs …" — search should filter
    await page.getByPlaceholder("Lebensmittel suchen...").fill("Lachs");
    await expect(async () => {
      const filtered = await rows.count();
      expect(filtered).toBeLessThan(initialCount);
      expect(filtered).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });
    await expect(rows.first()).toContainText(/Lachs/i);
  });

  test("filters by category", async ({ page }) => {
    await page.goto("/austauschtabellen");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const initialCount = await rows.count();

    // Open category filter (last combobox) — use "Gemüse" which has BLS data
    await page.locator('[role="combobox"]').last().click();
    await page.getByRole("option", { name: "Gemüse" }).click();

    // Should filter to only vegetable items
    await expect(async () => {
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 10_000 });
  });
});
