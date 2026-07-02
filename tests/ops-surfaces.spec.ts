import { expect, test } from "@playwright/test";

test.describe("Ops Surfaces", () => {
  test.describe.configure({ mode: "serial" });

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
    await expect(page.getByText("Verbundene Datenbanken")).toBeVisible();
    await expect(page.getByText("Naehrstoffvergleich")).toBeVisible();
    await expect(page.getByText("BLS (Bundeslebensmittelschlüssel)")).toBeVisible();

    // Source cards open a detail dialog with catalog metadata and an
    // activate/deactivate control for the organization.
    await page.getByRole("button", { name: /BLS \(Bundeslebensmittelschlüssel\)/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Lizenz")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("In der Lebensmittelsuche verwenden")).toBeVisible();
  });

  test("distinguishes bundled knowledge cards from live analytics", async ({ page }) => {
    await page.goto("/wissen");

    await expect(page.getByRole("heading", { name: "Wissensbibliothek" })).toBeVisible();
    await expect(page.getByText("Bundled Defaults")).toBeVisible();
    await expect(page.getByText("Live-Analyse").first()).toBeVisible();
    await expect(page.getByText("Makronaehrstoffe kompakt")).toBeVisible();
  });
});
