import { expect, test } from "@playwright/test";

test.describe("Lebensmittel", () => {
  test("searches and filters foods", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Should show all foods initially
    await expect(page.getByRole("heading", { name: "Lebensmittel", exact: true })).toBeVisible();
    const initialRows = page.locator("table tbody tr");
    const initialCount = await initialRows.count();
    expect(initialCount).toBeGreaterThan(10);

    // Search for a specific food
    await page.getByPlaceholder("Lebensmittel suchen").fill("Karotte");
    const filteredRows = page.locator("table tbody tr");
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeLessThan(initialCount);
    await expect(filteredRows.first()).toContainText("Karotte");

    // Clear search
    await page.getByPlaceholder("Lebensmittel suchen").fill("");
    await expect(page.locator("table tbody tr")).toHaveCount(initialCount);
  });

  test("navigates to food detail and shows nutrient tabs", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Click on first food link in the table
    const firstRow = page.locator("table tbody tr").first();
    const foodName = await firstRow.locator("td").first().textContent();
    await firstRow.click();

    // Should be on the detail page
    await expect(page).toHaveURL(/\/lebensmittel\/.+/);
    await expect(page.getByRole("heading", { name: foodName!.trim() })).toBeVisible();

    // Check nutrient tabs exist
    await expect(page.getByRole("tab", { name: /Makronährstoffe/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Vitamine/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Mineralstoffe/i })).toBeVisible();

    // Switch to Vitamine tab
    await page.getByRole("tab", { name: /Vitamine/i }).click();
    await expect(page.getByText("Vitamin C")).toBeVisible();

    // Switch to Mineralstoffe tab
    await page.getByRole("tab", { name: /Mineralstoffe/i }).click();
    await expect(page.getByText("Calcium")).toBeVisible();
  });
});
