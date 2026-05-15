import { expect, test, type Page } from "@playwright/test";

test.describe("Exchange Tables", () => {
  // BLS catalog is large — give pages time to load
  test.setTimeout(60_000);

  async function waitForExchangeRows(page: Page) {
    const rows = page.locator("table tbody tr");
    await expect(async () => {
      expect(await rows.count()).toBeGreaterThan(10);
      await expect(rows.first()).not.toContainText("Keine passenden Lebensmittel gefunden.");
    }).toPass({ timeout: 30_000 });
    return rows;
  }

  test("displays exchange table with food data", async ({ page }) => {
    await page.goto("/austauschtabellen");
    await expect(page.getByRole("heading", { name: "Austauschtabellen" })).toBeVisible();
    await expect(page.getByText("Original-Lebensmittel")).toBeVisible();
    await expect(page.getByText("Äquiv. Menge")).toBeVisible();

    // Wait for table rows to render (BLS has thousands of foods)
    const rows = await waitForExchangeRows(page);
    const count = await rows.count();
    expect(count).toBeGreaterThan(10);
  });

  test("searches for specific food", async ({ page }) => {
    await page.goto("/austauschtabellen");
    const rows = await waitForExchangeRows(page);
    const initialCount = await rows.count();

    // BLS name: "Lachs …" — search should filter
    await page.getByPlaceholder("Austauschoptionen suchen...").fill("Lachs");
    await expect(async () => {
      const filtered = await rows.count();
      expect(filtered).toBeLessThan(initialCount);
      expect(filtered).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });
    await expect(rows.first()).toContainText(/Lachs/i);
  });

  test("filters by category", async ({ page }) => {
    await page.goto("/austauschtabellen");
    const rows = await waitForExchangeRows(page);
    const initialCount = await rows.count();

    // Open category filter — use "Gemüse" which has BLS data
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Gemüse" }).click();

    // Should filter to only vegetable items
    await expect(async () => {
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 10_000 });
  });

  test("selects an original food and shows exchange metrics", async ({ page }) => {
    await page.goto("/austauschtabellen");
    await waitForExchangeRows(page);

    await page.getByPlaceholder("Original-Lebensmittel suchen...").fill("Lachs");
    await page.getByRole("button", { name: /Lachs/i }).first().click();

    await expect(page.getByText(/Austauschoptionen für 100 g/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/g für gleichen/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Kopieren" }).first()).toBeEnabled();
  });
});
