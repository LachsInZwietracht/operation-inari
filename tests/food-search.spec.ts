import { expect, test } from "@playwright/test";

test.describe("Lebensmittel", () => {
  test("searches and filters foods with fuzzy matching", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Should show all foods initially
    await expect(
      page.getByRole("heading", { name: "Lebensmittel", exact: true })
    ).toBeVisible();
    const initialRows = page.locator("table tbody tr");
    const initialCount = await initialRows.count();
    expect(initialCount).toBeGreaterThan(10);

    // Exact substring search still works
    await page.getByPlaceholder(/Lebensmittel suchen/).fill("Karotte");
    const filteredRows = page.locator("table tbody tr");
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeLessThan(initialCount);
    await expect(filteredRows.first()).toContainText("Karotte");

    // Clear search restores all results
    await page.getByPlaceholder(/Lebensmittel suchen/).fill("");
    await expect(page.locator("table tbody tr")).toHaveCount(initialCount);
  });

  test("fuzzy search finds foods with typos", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Type a misspelled food name — "Brokoli" should match "Brokkoli"
    await page.getByPlaceholder(/Lebensmittel suchen/).fill("Brokoli");
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(rows.first()).toContainText("Brokkoli");
  });

  test("fuzzy search finds foods with partial words", async ({ page }) => {
    await page.goto("/lebensmittel");

    // "brust" should match "Haehnchenbrust" and "Putenbrust"
    await page.getByPlaceholder(/Lebensmittel suchen/).fill("brust");
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    const allText = await rows.allTextContents();
    const hasBrust = allText.some(
      (t) => t.includes("Haehnchenbrust") || t.includes("Putenbrust")
    );
    expect(hasBrust).toBe(true);
  });

  test("matches configured food synonyms", async ({ page }) => {
    await page.goto("/lebensmittel");

    await page.getByPlaceholder(/Lebensmittel suchen/).fill("Pasta");
    const row = page.locator("table tbody tr").first();
    await expect(row).toContainText("Pasta");
    await expect(row).toContainText("Alias „Pasta“");
  });

  test("allows adding and removing custom synonyms", async ({ page }) => {
    await page.goto("/lebensmittel");

    await page.getByPlaceholder(/Lebensmittel suchen/).fill("Karotte");
    const row = page.locator("table tbody tr").first();
    await row.getByRole("button", { name: "Aliase verwalten" }).click();
    const dialog = page.getByRole("dialog");

    await page.getByPlaceholder("z.B. Nudeln").fill("Moehre");
    await page.getByRole("button", { name: "Alias hinzufügen" }).click();
    await expect(dialog.getByText("Moehre").first()).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await expect(row).toContainText("Moehre");

    // cleanup so other tests are unaffected
    await row.getByRole("button", { name: "Aliase verwalten" }).click();
    await page.getByRole("button", { name: "Alias Moehre löschen" }).click();
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("search mode selector switches between modes", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Default mode is Name
    const nameButton = page.getByRole("button", { name: /Name/ });
    await expect(nameButton).toBeVisible();

    // Switch to Code mode
    await page.getByRole("button", { name: /Code/ }).click();
    await expect(
      page.getByPlaceholder(/BLS-Code eingeben/)
    ).toBeVisible();

    // BLS code column should be visible in code mode
    await expect(page.locator("th", { hasText: "BLS-Code" })).toBeVisible();

    // Search by BLS code prefix "G41" (should find Karotte with code G410100)
    await page.getByPlaceholder(/BLS-Code eingeben/).fill("G41");
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(rows.first()).toContainText("Karotte");
  });

  test("food group navigation filters correctly", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Switch to Group mode
    await page.getByRole("button", { name: /Gruppe/ }).click();

    // Should show the food group tree
    await expect(
      page.getByText("Lebensmittelgruppen (BLS)")
    ).toBeVisible();

    // Click on a food group
    await page.getByRole("button", { name: "Fisch und Meeresfrüchte" }).click();

    // Should filter to show fish items
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    const allText = await rows.allTextContents();
    const hasFish = allText.some(
      (t) => t.includes("Lachs") || t.includes("Thunfisch") || t.includes("Kabeljau")
    );
    expect(hasFish).toBe(true);
  });

  test("navigates to food detail and shows nutrient tabs", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Click on first food link in the table
    const firstRow = page.locator("table tbody tr").first();
    const foodName = await firstRow
      .locator("td")
      .first()
      .locator("span")
      .first()
      .textContent();
    await firstRow.click();

    // Should be on the detail page
    await expect(page).toHaveURL(/\/lebensmittel\/.+/);

    // Check detail cards render
    await expect(page.getByText("Quelle & Version")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Produktinfos")).toBeVisible({ timeout: 10000 });

    // Switch to Vitamine tab
    await page.getByRole("tab", { name: /Vitamine/i }).click();
    await expect(page.getByText("Vitamin C")).toBeVisible();

    // Switch to Mineralstoffe tab
    await page.getByRole("tab", { name: /Mineralstoffe/i }).click();
    await expect(page.getByText("Calcium")).toBeVisible();
  });
});
