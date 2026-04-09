import { expect, test } from "@playwright/test";

test.describe("Counseling Sessions", () => {
  test("views existing counseling session", async ({ page }) => {
    await page.goto("/patienten");
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();

    // Go to Beratungen tab
    await page.getByRole("tab", { name: "Beratungen" }).click();

    // Should see existing sessions
    await expect(page.getByText(/Erstberatung – Adipositas/)).toBeVisible();

    // Click on session
    await page.getByRole("link", { name: /Erstberatung – Adipositas/ }).first().click();

    // Should show session detail
    await expect(page.getByText("Dokumentation")).toBeVisible();
    await expect(page.getByText("Anamnese")).toBeVisible();
  });

  test("creates counseling session with template", async ({ page }) => {
    await page.goto("/patienten");
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();

    await page.getByRole("tab", { name: "Beratungen" }).click();
    await page.getByRole("link", { name: "Neue Beratung" }).click();

    await expect(page.getByRole("heading", { name: "Neue Beratungssitzung" })).toBeVisible();

    // Click template button
    await page.getByRole("button", { name: "Vorlage einfügen" }).click();

    // Select a template from the dialog
    await expect(page.getByRole("heading", { name: "Vorlage auswählen" })).toBeVisible();
    await page.locator("[data-slot=card]").filter({ hasText: "Erstberatung Adipositas" }).first().click();

    // Template content should be inserted into the textarea
    const textarea = page.locator('textarea[placeholder="Beratungsdokumentation..."]');
    await expect(textarea).not.toBeEmpty();
  });
});
