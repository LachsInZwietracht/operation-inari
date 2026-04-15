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
});
