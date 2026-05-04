import { expect, test } from "@playwright/test";

test.describe("Ops Surfaces", () => {
  test("shows live admin team and retention controls", async ({ page }) => {
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Admin & Sicherheit" })).toBeVisible();
    await expect(page.getByText("Teammitglied einladen")).toBeVisible();
    await expect(page.getByText("Teammitglieder")).toBeVisible();
    await expect(page.getByRole("button", { name: "SSO-Konfiguration speichern" })).toBeVisible();
    await expect(page.getByText("Berichtsaufbewahrung")).toBeVisible();
  });

  test("loads live data source catalog on datenbank page", async ({ page }) => {
    await page.goto("/datenbank");

    await expect(page.getByRole("heading", { name: "Datenbankstatus" })).toBeVisible();
    await expect(page.getByText("Katalogstatus")).toBeVisible();
    await expect(page.getByText("Datenbankhistorie")).toBeVisible();
    await expect(page.getByText("Lebensmittelreferenzen ersetzen")).toBeVisible();
    await expect(page.getByText("Ersetzungsprotokoll")).toBeVisible();
    await expect(page.getByText("BLS (Bundeslebensmittelschlüssel)")).toBeVisible();
  });

  test("distinguishes bundled knowledge cards from live analytics", async ({ page }) => {
    await page.goto("/wissen");

    await expect(page.getByRole("heading", { name: "Wissensbibliothek" })).toBeVisible();
    await expect(page.getByText("Bundled Defaults")).toBeVisible();
    await expect(page.getByText("Live-Analyse").first()).toBeVisible();
    await expect(page.getByText("Makronaehrstoffe kompakt")).toBeVisible();
  });
});
