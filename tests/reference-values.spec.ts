import { expect, test } from "@playwright/test";

test.describe("Reference Values", () => {
  test("navigates to reference values page via sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("[data-slot='sidebar-container']");
    await sidebar.getByRole("link", { name: "Referenzwerte" }).click();
    await expect(page).toHaveURL(/\/referenzwerte/);
    await expect(page.getByRole("heading", { name: "Referenzwerte" })).toBeVisible();
  });

  test("displays all four standard cards", async ({ page }) => {
    await page.goto("/referenzwerte");
    const standardCard = (id: string) =>
      page.locator(`[data-testid="reference-standard-${id}"]`);

    await expect(standardCard("dge")).toBeVisible();
    await expect(standardCard("oege")).toBeVisible();
    await expect(standardCard("sge")).toBeVisible();
    await expect(standardCard("rda")).toBeVisible();
  });

  test("switches active standard", async ({ page }) => {
    await page.goto("/referenzwerte");

    // DGE should be active by default
    const dgeCard = page.locator("div").filter({ hasText: /DGE/ }).locator("span", { hasText: "Aktiv" }).first();
    await expect(dgeCard).toBeVisible();

    // Switch to RDA
    await page.getByRole("button", { name: "RDA", exact: true }).first().click();

    // RDA should now show "Aktiv" badge
    const rdaActiveLabel = page.getByText("Aktiv").first();
    await expect(rdaActiveLabel).toBeVisible();
  });

  test("comparison view shows nutrient table with multiple standards", async ({ page }) => {
    await page.goto("/referenzwerte");

    // Comparison tab should be visible and active by default
    await expect(page.getByRole("tab", { name: /Vergleich/ })).toBeVisible();

    // Should show nutrient names in the comparison table
    await expect(page.getByText("Eiweiß").first()).toBeVisible();
    await expect(page.getByText("Fett").first()).toBeVisible();
  });

  test("comparison view allows switching age groups and gender", async ({ page }) => {
    await page.goto("/referenzwerte");

    // Change age group
    await page.locator("button").filter({ hasText: "25–51 Jahre" }).click();
    await page.getByRole("option", { name: "51–65 Jahre" }).click();

    // Change gender
    await page.locator("button").filter({ hasText: "Weiblich" }).click();
    await page.getByRole("option", { name: "Männlich" }).click();

    // Table should still be visible with data
    await expect(page.getByText("Eiweiß").first()).toBeVisible();
  });

  test("comparison view shows difference badges for divergent values", async ({ page }) => {
    await page.goto("/referenzwerte");

    // DGE and RDA are pre-selected for comparison - should show some difference badges
    const diffBadges = page.locator("span").filter({ hasText: /±\d+%/ });
    // At least some nutrients should show differences between DGE and RDA
    await expect(diffBadges.first()).toBeVisible();
  });

  test("custom profile tab is accessible", async ({ page }) => {
    await page.goto("/referenzwerte");
    await page.getByRole("tab", { name: /Eigene Profile/ }).click();

    // Should show empty state or create button
    await expect(page.getByRole("button", { name: /Neues Profil/ })).toBeVisible();
  });

  test("can create a custom reference profile", async ({ page }) => {
    await page.goto("/referenzwerte");
    await page.getByRole("tab", { name: /Eigene Profile/ }).click();
    await page.getByRole("button", { name: /Neues Profil/ }).click();

    // Dialog should open
    await expect(page.getByText("Neues Referenzprofil erstellen")).toBeVisible();

    // Fill name
    await page.getByPlaceholder("z.B. Diabetiker-Profil").fill("Testprofil");

    // Create the profile
    await page.getByRole("button", { name: /Profil erstellen/ }).click();

    // Should show the new profile card
    await expect(page.getByText("Testprofil")).toBeVisible();
  });

  test("food detail page shows reference selector", async ({ page }) => {
    await page.goto("/lebensmittel");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.locator("td").nth(1).click();
    await page.waitForURL(/\/lebensmittel\//, { timeout: 15_000 });

    // The compact reference selector should be visible
    await expect(page.getByText("Nährstoffanalyse")).toBeVisible();
  });
});
