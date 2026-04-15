import { expect, test, type Page } from "@playwright/test";

async function waitForFoodSearchInput(page: Page) {
  const input = page.getByPlaceholder(/Lebensmittel suchen/);
  await expect(input).toBeVisible({ timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  return input;
}

// BLS 4.0 food names differ from mock data.
// Real names: "Karotte/Möhre, roh", "Broccoli roh", "Hähnchen Brustfilet, roh"

test.describe("Lebensmittel", () => {
  // The BLS catalog has 7,140 foods — give pages time to load under multi-worker pressure
  test.setTimeout(90_000);

  test("searches and filters foods with fuzzy matching", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Wait for foods to load from Supabase
    const initialRows = page.locator("table tbody tr");
    await expect(initialRows.first()).toBeVisible({ timeout: 30_000 });
    const initialCount = await initialRows.count();
    expect(initialCount).toBeGreaterThan(10);

    // Exact substring search — "Karotte" should match "Karotte/Möhre, roh" etc.
    const searchInput = await waitForFoodSearchInput(page);
    await searchInput.fill("Karotte");
    // Wait for the search to filter — row count should decrease
    await expect(page.locator("table tbody tr")).not.toHaveCount(initialCount, {
      timeout: 10_000,
    });
    const filteredRows = page.locator("table tbody tr");
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
    await expect(filteredRows.first()).toContainText(/Karotte/);

    // Clear search restores all results
    await searchInput.fill("");
    // Just verify row count went back up (don't assert exact count — DOM with 7k rows is slow)
    await expect(async () => {
      const count = await page.locator("table tbody tr").count();
      expect(count).toBeGreaterThan(filteredCount);
    }).toPass({ timeout: 30_000 });
  });

  test("fuzzy search finds foods with typos", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // "Brokoli" should fuzzy-match "Broccoli roh" (BLS spells it "Broccoli")
    const typoInput = await waitForFoodSearchInput(page);
    await typoInput.fill("Brokoli");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    await expect(rows.filter({ hasText: "Broccoli" }).first()).toBeVisible();
  });

  test("fuzzy search finds foods with partial words", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // "Hähnchen" should match "Hähnchen Brustfilet, roh" etc.
    const partialInput = await waitForFoodSearchInput(page);
    await partialInput.fill("Hähnchen");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    await expect(rows.filter({ hasText: /hähnchen/i }).first()).toBeVisible();
  });

  test("allows adding and removing custom synonyms", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    const aliasInput = await waitForFoodSearchInput(page);
    await aliasInput.fill("Karotte");
    await expect(page.locator("table tbody tr").first()).toContainText(
      /Karotte/,
      { timeout: 10_000 }
    );
    const row = page.locator("table tbody tr").first();
    await row.getByRole("button", { name: "Aliase verwalten" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("z.B. Nudeln").fill("Moehre");
    await dialog.getByRole("button", { name: "Alias hinzufügen" }).click();
    await expect(dialog.getByText("Moehre").first()).toBeVisible();

    // Close dialog via the X button
    await dialog.locator("[data-slot='dialog-close']").click();
    await expect(dialog).toBeHidden();

    await expect(row).toContainText("Moehre");

    // cleanup so other tests are unaffected
    await row.getByRole("button", { name: "Aliase verwalten" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Alias Moehre löschen" }).click();
    await dialog.locator("[data-slot='dialog-close']").click();
    await expect(dialog).toBeHidden();
  });

  test("search mode selector switches between modes", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // Default mode is Name
    const nameButton = page.getByRole("button", { name: /Name/ });
    await expect(nameButton).toBeVisible();

    // Switch to Code mode
    await page.getByRole("button", { name: /^Code$/ }).click();
    await expect(
      page.getByPlaceholder(/BLS-Code eingeben/)
    ).toBeVisible({ timeout: 5_000 });

    // BLS code column should be visible in code mode
    await expect(page.locator("th", { hasText: "BLS-Code" })).toBeVisible();

    // Search by BLS code prefix "G62" (Karotte/Möhre, roh has code G620100)
    await page.getByPlaceholder(/BLS-Code eingeben/).fill("G62");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(rows.first()).toContainText(/Karotte/);
  });

  test("food group navigation filters correctly", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // Switch to Group mode
    await page.getByRole("button", { name: /Gruppe/ }).click();

    // Should show the food group tree
    await expect(
      page.getByText("Lebensmittelgruppen (BLS)")
    ).toBeVisible({ timeout: 5_000 });

    // Click on the fish food group — may need scroll in the max-h-64 container
    const fishButton = page.getByRole("button", { name: "Fisch und Meeresfrüchte" });
    await fishButton.scrollIntoViewIfNeeded();
    await fishButton.click();

    // Should filter to show fish items
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    await expect(
      rows.filter({ hasText: /Lachs|Thunfisch|Kabeljau|Hering|Forelle/ }).first()
    ).toBeVisible();
  });

  test("navigates to food detail and shows nutrient tabs", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Wait for data to load
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });

    // Click on a non-interactive cell (category column) to trigger row navigation
    await firstRow.locator("td").nth(1).click();

    // Wait for navigation to the detail page
    await page.waitForURL(/\/lebensmittel\/.+/, { timeout: 15_000 });

    // Check detail cards render
    await expect(page.getByText("Quelle & Version")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Produktinfos")).toBeVisible({
      timeout: 10_000,
    });

    // Switch to Vitamine tab
    await page.getByRole("tab", { name: /Vitamine/i }).click();
    await expect(page.getByText("Vitamin C")).toBeVisible();

    // Switch to Mineralstoffe tab
    await page.getByRole("tab", { name: /Mineralstoffe/i }).click();
    await expect(page.getByText("Calcium")).toBeVisible();
  });

  test("command palette search jumps to food detail", async ({ page }) => {
    await page.goto("/dashboard");

    const searchButton = page.getByRole("button", {
      name: /Lebensmittel suchen/,
    });
    await expect(searchButton).toBeVisible({ timeout: 15_000 });
    await searchButton.click();

    const searchInput = page.getByPlaceholder(/Tippfehler werden erkannt/);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Karotte");

    // Wait for RPC search results to appear (debounce 200ms + network)
    const result = page.getByRole("option", { name: /Karotte/ }).first();
    await expect(result).toBeVisible({ timeout: 15_000 });
    await result.click();

    await expect(page).toHaveURL(/\/lebensmittel\//, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /Karotte/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Makronährstoffe", { exact: false })
    ).toBeVisible();
  });

  test("branded food detail resolves through the shared food data layer", async ({
    page,
  }) => {
    await page.goto("/lebensmittel/brand_quick_oats");

    await expect(
      page.getByRole("heading", { name: /VitalFit Protein Porridge Vanille/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Produktinfos")).toBeVisible();
    await expect(page.getByText(/VitalFit GmbH/i)).toBeVisible();
  });
});
