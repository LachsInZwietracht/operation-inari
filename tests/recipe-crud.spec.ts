import { expect, test } from "@playwright/test";

test.describe("Rezepte", () => {
  test("displays recipe list with mock recipes", async ({ page }) => {
    await page.goto("/rezepte");

    await expect(page.getByRole("heading", { name: "Rezepte" })).toBeVisible();

    // Should show mock recipes
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();
    await expect(page.getByText("Linseneintopf").first()).toBeVisible();
  });

  test("navigates to recipe detail and shows ingredients", async ({ page }) => {
    await page.goto("/rezepte");

    // Click on first recipe card
    const recipeLink = page.getByRole("link", { name: /Kartoffelsuppe/i }).first();
    await expect(recipeLink).toBeVisible({ timeout: 30_000 });
    await recipeLink.click();
    await expect(page).toHaveURL(/\/rezepte\/.+/, { timeout: 30_000 });

    // Should show recipe details
    await expect(page.getByRole("heading", { name: /Kartoffelsuppe/i })).toBeVisible();

    // Should show nutrition information
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test("creates a new recipe", async ({ page }) => {
    const recipeName = `Test-Rezept ${Date.now()}`;

    await page.goto("/rezepte/neu");

    await expect(page.getByRole("heading", { name: /Neues Rezept/i })).toBeVisible();

    // Fill in the recipe form
    await page.getByLabel("Name").fill(recipeName);
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
    const ingredientSearch = page.getByRole("dialog").locator("[cmdk-input]").first();
    await expect(ingredientSearch).toBeVisible();
    // Type a food name to search
    await ingredientSearch.fill("Reis");
    // Select the food from results
    await page.getByRole("option").filter({ hasText: /Reis/i }).first().click();

    // Fill the first instruction step (already present by default)
    await page.getByRole("textbox", { name: "Schritt 1" }).fill("Reis kochen und servieren");

    // Submit the form
    await page.getByRole("button", { name: /Rezept erstellen/i }).click();

    await expect(page.getByRole("heading", { name: recipeName })).toBeVisible({ timeout: 30_000 });

    const detailUrl = page.url();
    await page.evaluate(() => {
      window.localStorage.removeItem("prodi_custom_recipes");
    });

    await page.goto(detailUrl);
    await expect(page.getByRole("heading", { name: recipeName })).toBeVisible({ timeout: 30_000 });
  });

  test("normalizes legacy ingredient ids for custom recipe detail", async ({ page }) => {
    await page.addInitScript(() => {
      const recipe = {
        id: "custom_legacy_recipe",
        name: "Legacy Kartoffelsuppe",
        description: "Altes Rezept mit mock food ids",
        category: "Suppen",
        servings: 2,
        prepTime: 10,
        cookTime: 20,
        ingredients: [{ foodId: "food_kartoffel", amount: 300 }],
        instructions: ["Kochen"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        sourceType: "personal",
      };
      window.localStorage.setItem("prodi_custom_recipes", JSON.stringify([recipe]));
    });

    await page.goto("/rezepte/custom_legacy_recipe");

    await expect(
      page.getByRole("heading", { name: /Legacy Kartoffelsuppe/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Kartoffel/i).first()).toBeVisible();
  });
});
