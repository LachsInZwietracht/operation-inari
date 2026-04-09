import { expect, test } from "@playwright/test";

test.describe("Exchange Tables", () => {
  test("displays exchange table with food data", async ({ page }) => {
    await page.goto("/austauschtabellen");
    await expect(page.getByRole("heading", { name: "Austauschtabellen" })).toBeVisible();

    // Table should have foods
    await expect(page.getByText("Karotte")).toBeVisible();
    await expect(page.getByText("Brokkoli")).toBeVisible();
  });

  test("searches for specific food", async ({ page }) => {
    await page.goto("/austauschtabellen");

    await page.getByPlaceholder("Lebensmittel suchen...").fill("Lachs");
    await expect(page.getByText("Lachs")).toBeVisible();
    await expect(page.getByText("Karotte")).not.toBeVisible();
  });

  test("filters by category", async ({ page }) => {
    await page.goto("/austauschtabellen");

    // Open category filter (third select)
    await page.locator('[role="combobox"]').last().click();
    await page.getByRole("option", { name: "Obst" }).click();

    await expect(page.getByText("Apfel")).toBeVisible();
    await expect(page.getByText("Karotte")).not.toBeVisible();
  });
});
