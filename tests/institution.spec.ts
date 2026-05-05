import { expect, test, type Page } from "@playwright/test";
import {
  clearClinicDemoInstitutionData,
  cleanupClinicDemoInstitutionFixture,
  createClinicDemoInstitutionFixture,
  fetchLatestAccessAuditLog,
  getTestUserId,
} from "./fixtures/clinic-demo";

async function visitInstitutionPage(page: Page, path: string, heading: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
}

test.describe("Institution Features", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await cleanupClinicDemoInstitutionFixture();
  });

  test("shows an explicit empty state for menu planning without runtime mock data", async ({ page }) => {
    const userId = await getTestUserId();
    await clearClinicDemoInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    await expect(page.getByText("Noch keine Menüpläne vorhanden.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Neuer Menüplan/i })).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toHaveCount(0);
  });

  test("creates the first menu plan from the empty state", async ({ page }) => {
    const userId = await getTestUserId();
    await clearClinicDemoInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");
    await expect(page.getByText("Noch keine Menüpläne vorhanden.")).toBeVisible();

    await page.getByRole("button", { name: /Neuer Menüplan/i }).click();
    await page.getByLabel("Name").fill("Testplan Woche 42");
    await page.getByLabel("Zykluslänge").click();
    await page.getByRole("option", { name: "2 Wochen" }).click();
    await page.getByRole("button", { name: "Erstellen" }).click();

    await expect(page.getByText("Testplan Woche 42").first()).toBeVisible();
    await expect(page.getByText("2-Wochen-Zyklus").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /Wochenplan/i })).toBeVisible();
  });

  test("renders populated menu planning and production views from explicit fixtures", async ({ page }) => {
    const fixture = await createClinicDemoInstitutionFixture({ includeDraftMenu: true });

    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    await expect(page.getByText(fixture.activeMenuName).first()).toBeVisible();
    await expect(page.getByText(fixture.draftMenuName!)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Vollkost", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Diabeteskost" })).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    await page.getByRole("tab", { name: "Diabeteskost" }).click();
    await expect(page.getByText("Linseneintopf").first()).toBeVisible();

    await page.getByRole("tab", { name: /Produktion/i }).click();
    await expect(page.getByText(/Mo \(Tag 1\)/)).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    await page.getByRole("tab", { name: /Einkauf/i }).click();
    await expect(page.getByText(/Positionen/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /CSV exportieren/i })).toBeVisible();

    await visitInstitutionPage(page, "/institution/produktion", "Produktionsmanagement");
    await expect(page.getByText("Chargenstatus")).toBeVisible();
    await expect(page.getByText("Geplant").first()).toBeVisible();
    await page.getByRole("button", { name: /^Start$/ }).first().click();
    await expect(page.getByText("In Vorbereitung").first()).toBeVisible();
  });

  test("shows empty analytics states when no institution data exists", async ({ page }) => {
    const userId = await getTestUserId();
    await clearClinicDemoInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/compliance", "Nährstoff-Compliance");
    await expect(page.getByText("Es gibt noch keinen aktiven Menüzyklus mit berechenbaren Nährstoffdaten.")).toBeVisible();

    await visitInstitutionPage(page, "/institution/statistiken", "Einrichtungsstatistiken");
    await expect(page.getByText("Es gibt noch keinen aktiven Menüzyklus für institutionelle Kennzahlen.")).toBeVisible();
  });

  test("renders compliance and statistics from real institution fixtures", async ({ page }) => {
    const fixture = await createClinicDemoInstitutionFixture({ includePendingOrder: true });

    await visitInstitutionPage(page, "/institution/compliance", "Nährstoff-Compliance");
    await expect(page.getByText(fixture.activeMenuName)).toBeVisible();
    await expect(page.getByText("Energie").first()).toBeVisible();
    await expect(page.getByText("Eiweiß").first()).toBeVisible();

    await visitInstitutionPage(page, "/institution/statistiken", "Einrichtungsstatistiken");
    await expect(page.getByText("Belegungsrate").first()).toBeVisible();
    await expect(page.getByText("Compliance-Rate").first()).toBeVisible();
    await page.getByRole("tab", { name: "Menüwahl" }).click();
    await expect(page.getByText("Auftragsstatus im Zyklus")).toBeVisible();
    await expect(page.getByText("Ausstehend").first()).toBeVisible();
  });

  test("shows empty hospital and production states without active institution data", async ({ page }) => {
    const userId = await getTestUserId();
    await clearClinicDemoInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");
    await expect(page.getByText("Kein aktiver Menüplan verfügbar. Bitte zuerst einen Menüplan aktivieren.")).toBeVisible();
    await expect(page.getByText("Keine aktiven Belegungen für den aktuellen Filter.")).toBeVisible();

    await visitInstitutionPage(page, "/institution/produktion", "Produktionsmanagement");
    await expect(page.getByText("Kein aktiver Menüplan vorhanden. Erstellen und aktivieren Sie einen Menüplan unter Menüplanung.")).toBeVisible();
  });

  test("runs the hospital meal workflow from explicit fixtures", async ({ page }) => {
    const fixture = await createClinicDemoInstitutionFixture();

    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");

    const mariaCard = page.locator("[data-slot='card']").filter({ hasText: fixture.mariaName }).first();
    await expect(mariaCard).toBeVisible();
    await mariaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();

    await expect(page.getByRole("dialog")).toContainText("Sichere Menüauswahl");
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText("Sicher auswählbar")).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: /Kartoffelsuppe/i }).click();
    await page.getByLabel("Besondere Hinweise").fill("Bitte ohne Petersilie anrichten");
    await page.getByRole("button", { name: /Bestellung speichern/i }).click();

    await page.getByRole("tab", { name: /Bestellungen/i }).click();
    await expect(page.getByText(fixture.mariaName)).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();

    await page.getByRole("button", { name: /Bestätigen/i }).click();
    await expect(page.getByText("Bestätigt").first()).toBeVisible();

    await page.goto(`/institution/krankenhaus/tablettenkarten?date=2026-04-06&mealSlot=mittagessen&station=${encodeURIComponent(fixture.station)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Tablettenkarten" })).toBeVisible();
    await expect(page.getByText(fixture.mariaName)).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText("Zimmer 101-A")).toBeVisible();
    await expect(page.getByText("Bestätigt")).toBeVisible();
    await expect(page.getByText("VK")).toBeVisible();
    await expect(page.getByText("Bitte ohne Petersilie anrichten")).toBeVisible();
  });

  test("blocks unsafe hospital meal options without falling back to canned recipes", async ({ page }) => {
    const fixture = await createClinicDemoInstitutionFixture();

    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");

    const annaCard = page.locator("[data-slot='card']").filter({ hasText: fixture.annaName }).first();
    await expect(annaCard).toBeVisible();
    await annaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();

    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText(/Allergenkonflikt: Sellerie/i)).toBeVisible();
    await expect(page.getByText("Geblockt").first()).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: /Kartoffelsuppe/i }).click();
    await expect(page.getByText("Unsichere Auswahl dokumentieren")).toBeVisible();
    await page.getByLabel("Override-Grund").fill("Ärztlich freigegeben und Allergenwarnung mit Küche geprüft");
    await page.getByRole("button", { name: /Bestellung speichern/i }).click();

    await page.getByRole("tab", { name: /Bestellungen/i }).click();
    await expect(page.getByText(fixture.annaName)).toBeVisible();
    await expect(page.getByText("Override: Ärztlich freigegeben")).toBeVisible();

    await expect.poll(async () => fetchLatestAccessAuditLog("diet_order_override_logged")).toMatchObject({
      action: "diet_order_override_logged",
      target_type: "meal_order",
      metadata: expect.objectContaining({
        patientName: fixture.annaName,
        recipeName: "Kartoffelsuppe",
        overrideReason: "Ärztlich freigegeben und Allergenwarnung mit Küche geprüft",
        blockedReasons: expect.arrayContaining([expect.stringMatching(/Allergenkonflikt: Sellerie/)]),
      }),
    });
  });
});
