import { expect, test } from "@playwright/test";

test.describe("Ernährungsplan", () => {
  test.setTimeout(60_000);

  test("displays meal slots and allows date navigation", async ({ page }) => {
    await page.goto("/ernaehrungsplan");

    await expect(page.locator("main").getByRole("heading", { name: "Ernährungsplan" })).toBeVisible();

    // Should show meal slot card titles (use data-slot to avoid strict mode violations)
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Frühstück" })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Mittagessen" })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Abendessen" })).toBeVisible();

    // Just verify date is displayed (any German date format)
    await expect(page.locator("text=/\\d{1,2}\\./").first()).toBeVisible();
  });

  test("adds food entry to a meal slot", async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto("/ernaehrungsplan");
    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    // Click "Hinzufügen" on the first slot (Frühstück)
    const addButtons = page.getByRole("button", { name: /Hinzufügen/i });
    await addButtons.first().click();

    // Search dialog should open — use the cmdk search input specifically
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible();

    // Search for a food
    await searchInput.fill("Hafer");

    // Select a food from results
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();

    // The entry should now appear in the slot
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();

    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    await expect(page.getByText(/Hafer/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
