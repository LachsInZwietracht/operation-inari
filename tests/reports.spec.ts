import { expect, test } from "@playwright/test";

test.describe("Berichte", () => {
  test("displays report tabs with charts and tables", async ({ page }) => {
    await page.goto("/berichte");

    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();

    // Check tabs exist
    await expect(page.getByRole("tab", { name: /Makronährstoffe/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Vitamine/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Mineralstoffe/i })).toBeVisible();

    // Macro tab should show energy info
    await expect(page.getByText(/kcal/i).first()).toBeVisible();

    // Switch to Vitamine tab
    await page.getByRole("tab", { name: /Vitamine/i }).click();
    await expect(page.getByText(/Vitamin/i).first()).toBeVisible();

    // Switch to Mineralstoffe tab
    await page.getByRole("tab", { name: /Mineralstoffe/i }).click();
    await expect(page.getByText(/Calcium/i).or(page.getByText(/Eisen/i)).first()).toBeVisible();
  });
});
