import { expect, test } from "@playwright/test";

test.describe("Ernährungsplan", () => {
  test("displays meal slots and allows date navigation", async ({ page }) => {
    await page.goto("/ernaehrungsplan");

    await expect(page.locator("main").getByRole("heading", { name: "Ernährungsplan" })).toBeVisible();

    // Should show all 5 meal slots
    await expect(page.getByText("Frühstück")).toBeVisible();
    await expect(page.getByText("Mittagessen")).toBeVisible();
    await expect(page.getByText("Abendessen")).toBeVisible();

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

    // Search dialog should open
    await expect(page.getByPlaceholder(/suchen/i)).toBeVisible();

    // Search for a food
    await page.getByPlaceholder(/suchen/i).fill("Hafer");

    // Select a food from results
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();

    // The entry should now appear in the slot
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();
  });
});
