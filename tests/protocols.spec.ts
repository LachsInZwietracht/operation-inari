import { expect, test, type Page } from "@playwright/test";
import { PATIENTS } from "@/lib/mock-data";

const PROTOCOL_PATIENT = PATIENTS.find((patient) => patient.id === "patient_1")!;

async function openProtocolsTab(page: Page) {
  await page.goto(`/patienten/${PROTOCOL_PATIENT.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: `${PROTOCOL_PATIENT.firstName} ${PROTOCOL_PATIENT.lastName}` })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Ernährung" }).click();
  const protocolsTab = page.getByRole("tab", { name: "Protokolle" });
  await expect(protocolsTab).toBeVisible({ timeout: 30_000 });
  await protocolsTab.click();
}

test.describe("Nutrition Protocols", () => {
  test("views existing protocol with analysis", async ({ page }) => {
    await openProtocolsTab(page);

    // Click on existing protocol
    const protocolLink = page.getByRole("link", { name: /3-Tage-Ernährungsprotokoll/ });
    await expect(protocolLink).toBeVisible({ timeout: 30_000 });
    await protocolLink.click();

    // Should show protocol title and details
    await expect(page.getByRole("heading", { name: /3-Tage-Ernährungsprotokoll/ })).toBeVisible();

    // Should show day views
    await expect(page.getByText("Tagesübersicht")).toBeVisible();

    // Should show nutrient analysis section
    await expect(page.getByText("Nährstoffanalyse")).toBeVisible();
    await expect(page.getByText("Durchschnittliche Nährstoffzufuhr")).toBeVisible();
  });

  test("navigates to create protocol page", async ({ page }) => {
    await openProtocolsTab(page);
    await page.getByRole("link", { name: "Neues Protokoll" }).click();

    await expect(page.getByRole("heading", { name: "Neues Ernährungsprotokoll" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByPlaceholder("z.B. 3-Tage-Ernährungsprotokoll")).toBeVisible();
  });

  test("creates protocol and reloads it from persisted storage", async ({ page }) => {
    const protocolTitle = `Persisted Protocol ${Date.now()}`;

    await page.goto(`/patienten/${PROTOCOL_PATIENT.id}/protokolle/neu`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await expect(page.getByRole("heading", { name: "Neues Ernährungsprotokoll" })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Titel").fill(protocolTitle);
    await page.getByLabel("Datum").fill("2026-04-01");

    await page.getByRole("button", { name: /Lebensmittel hinzufügen/i }).click();
    const searchInput = page.locator("[cmdk-input]").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Hafer");
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();

    await page.getByRole("button", { name: "Protokoll erstellen" }).click();

    await expect(page).toHaveURL(new RegExp(`/patienten/${PROTOCOL_PATIENT.id}$`), { timeout: 30_000 });
    await page.getByRole("tab", { name: "Ernährung" }).click();
    const protocolsTab = page.getByRole("tab", { name: "Protokolle" });
    await protocolsTab.click();
    await expect(page.getByRole("link", { name: new RegExp(protocolTitle) })).toBeVisible({ timeout: 30_000 });

    await page.evaluate(() => localStorage.removeItem("prodi_protocols"));
    await page.reload();
    await page.getByRole("tab", { name: "Ernährung" }).click();
    await page.getByRole("tab", { name: "Protokolle" }).click();
    await expect(page.getByRole("link", { name: new RegExp(protocolTitle) })).toBeVisible({ timeout: 30_000 });
  });
});
