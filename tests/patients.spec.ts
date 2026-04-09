import { expect, test } from "@playwright/test";

test.describe("Patient Management", () => {
  test("displays patient list with mock data", async ({ page }) => {
    await page.goto("/patienten");
    await expect(page.getByRole("heading", { name: "Patienten" })).toBeVisible();

    // Check that mock patients are visible
    await expect(page.getByRole("link", { name: /Schneider, Maria/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Weber, Thomas/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Hoffmann, Lisa/ })).toBeVisible();
  });

  test("searches patients by name", async ({ page }) => {
    await page.goto("/patienten");

    await page.getByPlaceholder("Patient suchen...").fill("Schneider");
    await expect(page.getByRole("link", { name: /Schneider, Maria/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Weber, Thomas/ })).not.toBeVisible();
  });

  test("filters patients by indication", async ({ page }) => {
    await page.goto("/patienten");

    // The indication filter is the second combobox
    await page.locator("main").getByRole("combobox").click();
    await page.getByRole("option", { name: "Adipositas" }).click();

    await expect(page.getByRole("link", { name: /Schneider, Maria/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Weber, Thomas/ })).not.toBeVisible();
  });

  test("creates a new patient", async ({ page }) => {
    await page.goto("/patienten/neu");
    await expect(page.getByRole("heading", { name: "Neuer Patient" })).toBeVisible();

    // Fill required fields
    await page.getByPlaceholder("Vorname").fill("Test");
    await page.getByPlaceholder("Nachname").fill("Patient");
    await page.locator('input[type="date"]').first().fill("1990-06-15");

    // Submit
    await page.getByRole("button", { name: "Patient erstellen" }).click();

    // Should redirect to patient list
    await expect(page).toHaveURL(/\/patienten/);
  });

  test("views patient detail with tabs", async ({ page }) => {
    await page.goto("/patienten");

    // Click on patient card link
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();
    await expect(page.getByRole("heading", { name: "Maria Schneider" })).toBeVisible();

    // Check tabs are present
    await expect(page.getByRole("tab", { name: "Stammdaten" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Anthropometrie" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Protokolle" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Beratungen" })).toBeVisible();

    // Check stammdaten content
    await expect(page.getByText("AOK Bayern")).toBeVisible();
  });

  test("views anthropometric data tab", async ({ page }) => {
    await page.goto("/patienten");
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();

    // Switch to Anthropometrie tab
    await page.getByRole("tab", { name: "Anthropometrie" }).click();

    // Should see measurement table
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Gewicht (kg)" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "BMI" })).toBeVisible();
  });

  test("adds anthropometric entry", async ({ page }) => {
    await page.goto("/patienten");
    await page.getByRole("link", { name: /Schneider, Maria/ }).click();

    await page.getByRole("tab", { name: "Anthropometrie" }).click();

    // Click add new measurement
    await page.getByRole("button", { name: "Neue Messung" }).click();

    // Fill form
    await page.locator('input[type="number"][placeholder="kg"]').fill("84");
    await page.locator('input[type="number"][placeholder="cm"]').fill("168");

    // Submit
    await page.getByRole("button", { name: "Messung speichern" }).click();

    // The new weight value should appear in the table
    await expect(page.getByRole("cell", { name: "84,0" })).toBeVisible();
  });
});
