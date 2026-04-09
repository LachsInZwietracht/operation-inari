import { expect, test } from "@playwright/test";

test.describe("Nutrition Protocols", () => {
  test("views existing protocol with analysis", async ({ page }) => {
    await page.goto("/patienten");
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();

    // Go to protocols tab
    await page.getByRole("tab", { name: "Protokolle" }).click();

    // Click on existing protocol
    await page.getByRole("link", { name: /3-Tage-Ernährungsprotokoll/ }).click();

    // Should show protocol title and details
    await expect(page.getByRole("heading", { name: /3-Tage-Ernährungsprotokoll/ })).toBeVisible();

    // Should show day views
    await expect(page.getByText("Tagesübersicht")).toBeVisible();

    // Should show nutrient analysis section
    await expect(page.getByText("Nährstoffanalyse")).toBeVisible();
    await expect(page.getByText("Durchschnittliche Nährstoffzufuhr")).toBeVisible();
  });

  test("navigates to create protocol page", async ({ page }) => {
    await page.goto("/patienten");
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();

    await page.getByRole("tab", { name: "Protokolle" }).click();
    await page.getByRole("link", { name: "Neues Protokoll" }).click();

    await expect(page.getByRole("heading", { name: "Neues Ernährungsprotokoll" })).toBeVisible();
    await expect(page.getByPlaceholder("z.B. 3-Tage-Ernährungsprotokoll")).toBeVisible();
  });
});
