import { expect, test } from "@playwright/test";

test.describe("Food Comparison", () => {
  test.setTimeout(60_000);

  test("searches foods through the browser API", async ({ page }) => {
    await page.goto("/lebensmittel/vergleichen");
    await expect(page.getByRole("heading", { name: "Lebensmittel vergleichen" })).toBeVisible();

    await page.getByPlaceholder("Lebensmittel suchen").first().fill("Lachs");

    await expect(page.getByRole("button", { name: /Lachs/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
