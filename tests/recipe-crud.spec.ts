import { expect, test } from "@playwright/test";

test.describe("Rezepte", () => {
  test("displays recipe list with mock recipes", async ({ page }) => {
    await page.goto("/rezepte");

    await expect(page.getByRole("heading", { name: "Rezepte" })).toBeVisible();

    // Should show mock recipes
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();
    await expect(page.getByText("Haferbrei").first()).toBeVisible();
  });

  test("navigates to recipe detail and shows ingredients", async ({ page }) => {
    await page.goto("/rezepte");

    // Click on first recipe card
    await page.getByRole("link", { name: /Kartoffelsuppe/i }).click();
    await expect(page).toHaveURL(/\/rezepte\/.+/);

    // Should show recipe details
    await expect(page.getByRole("heading", { name: /Kartoffelsuppe/i })).toBeVisible();

    // Should show nutrition information
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test("creates a new recipe", async ({ page }) => {
    await page.goto("/rezepte/neu");

    await expect(page.getByRole("heading", { name: /Neues Rezept/i })).toBeVisible();

    // Fill in the recipe form
    await page.getByLabel("Name").fill("Test-Rezept");
    await page.getByLabel("Beschreibung").fill("Ein einfaches Testrezept");

    // Select category
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Hauptgericht", exact: true }).click();

    // Set servings
    await page.getByLabel("Portionen").fill("2");

    // Set prep time
    await page.getByLabel("Vorbereitung (Min.)").fill("15");

    // Add an ingredient via search dialog
    await page.getByRole("button", { name: /Zutat hinzufügen/i }).click();
    await expect(page.getByPlaceholder(/suchen/i)).toBeVisible();
    // Type a food name to search
    await page.getByPlaceholder(/suchen/i).fill("Reis");
    // Select the food from results
    await page.getByRole("option").filter({ hasText: /Reis/i }).first().click();

    // Fill the first instruction step (already present by default)
    await page.getByRole("textbox", { name: "Schritt 1" }).fill("Reis kochen und servieren");

    // Submit the form
    await page.getByRole("button", { name: /Rezept erstellen/i }).click();

    // Should redirect to the new recipe's detail page or show success
    await expect(page.getByText(/erfolgreich/i).or(page.getByRole("heading", { name: /Test-Rezept/i }))).toBeVisible({ timeout: 5000 });
  });
});
