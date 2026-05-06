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

  test("shows the admin integration operations surface", async ({ page }) => {
    await page.goto("/admin/integrationen");

    await expect(page.getByRole("heading", { name: "Integrationen" })).toBeVisible();
    await expect(page.getByText("HL7 Import-Jobs")).toBeVisible();
    await expect(page.getByText("Review-Ergebnisse", { exact: true })).toBeVisible();
    await expect(page.getByText("HL7 Labormappings")).toBeVisible();
  });

  test("creates and disables an HL7 lab mapping from integration admin", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceSystem = `ops-lab-${suffix}`;
    const hl7Identifier = `4548-${suffix}`;

    await page.goto("/admin/integrationen");
    await page.getByLabel("Quelle").fill(sourceSystem);
    await page.getByLabel("HL7-ID").fill(hl7Identifier);
    await page.getByLabel("Text").fill("HbA1c Test");
    await page.getByLabel("Coding").fill("LN");
    await page.getByLabel("Parameter").fill("lab_hba1c");
    await page.getByLabel("Einheit").fill("%");
    await page.getByRole("button", { name: "Mapping speichern" }).click();

    await expect(page.getByText("HL7-Labormapping wurde gespeichert.")).toBeVisible();
    const mappingRow = page.getByRole("row", { name: new RegExp(`${sourceSystem} ${hl7Identifier}`) }).first();
    await expect(mappingRow).toBeVisible();

    await mappingRow.getByRole("button", { name: "Deaktivieren" }).click();
    await expect(page.getByText("HL7-Labormapping wurde deaktiviert.")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(`${sourceSystem} ${hl7Identifier}.*Deaktiviert`) }).first()).toBeVisible();
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
