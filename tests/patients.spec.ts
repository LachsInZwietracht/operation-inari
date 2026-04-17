import { expect, test, type Page } from "@playwright/test";
import { PATIENTS } from "@/lib/mock-data";

const PATIENT_RECORDS = PATIENTS.slice(0, 3);
const PRIMARY_PATIENT = PATIENT_RECORDS[0]!;
const SECONDARY_PATIENT = PATIENT_RECORDS[1]!;
const TERTIARY_PATIENT = PATIENT_RECORDS[2]!;
const patientLabel = (patient: (typeof PATIENTS)[number]) => `${patient.lastName}, ${patient.firstName}`;
const patientHeading = (patient: (typeof PATIENTS)[number]) => `${patient.firstName} ${patient.lastName}`;
const patientCard = (page: Page, patient = PRIMARY_PATIENT) =>
  page.locator(`[data-patient-id="${patient.id}"]`).first();

async function openPatientList(page: Page) {
  await page.goto("/patienten", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Patienten" })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
}

async function openPatientDetail(page: Page, patient = PRIMARY_PATIENT) {
  await page.goto(`/patienten/${patient.id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: patientHeading(patient) })).toBeVisible({ timeout: 30_000 });
}

test.describe("Patient Management", () => {
  test("displays patient list with mock data", async ({ page }) => {
    await openPatientList(page);

    // Check that mock patients are visible
    await expect(patientCard(page, PRIMARY_PATIENT)).toBeVisible();
    await expect(patientCard(page, SECONDARY_PATIENT)).toBeVisible();
    await expect(patientCard(page, TERTIARY_PATIENT)).toBeVisible();
  });

  test("searches patients by name", async ({ page }) => {
    await openPatientList(page);

    const searchInput = page.getByPlaceholder("Patient suchen...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill(PRIMARY_PATIENT.lastName);
    await expect(patientCard(page, PRIMARY_PATIENT)).toBeVisible();
    await expect(patientCard(page, SECONDARY_PATIENT)).toHaveCount(0);
  });

  test("filters patients by indication", async ({ page }) => {
    await openPatientList(page);

    const indicationFilter = page.getByRole("combobox", { name: /Indikationen/i });
    await indicationFilter.click();
    await page.getByRole("option", { name: PRIMARY_PATIENT.indication ?? "Adipositas" }).click();

    await expect(patientCard(page, PRIMARY_PATIENT)).toBeVisible();
    await expect(patientCard(page, SECONDARY_PATIENT)).toHaveCount(0);
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
    await openPatientDetail(page);

    // Check tabs are present
    await expect(page.getByRole("tab", { name: "Stammdaten" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Anthropometrie" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Protokolle" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Beratungen" })).toBeVisible();

    // Check stammdaten content
    await expect(page.getByText(PRIMARY_PATIENT.insuranceProvider ?? "")).toBeVisible();
  });

  test("views anthropometric data tab", async ({ page }) => {
    await openPatientDetail(page);

    // Switch to Anthropometrie tab
    const anthropometryTab = page.getByRole("tab", { name: "Anthropometrie" });
    await expect(anthropometryTab).toBeVisible();
    await anthropometryTab.click();

    // Should see measurement table
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Gewicht (kg)" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "BMI" })).toBeVisible();
  });

  test("adds anthropometric entry", async ({ page }) => {
    await openPatientDetail(page);

    const anthropometryTab = page.getByRole("tab", { name: "Anthropometrie" });
    await anthropometryTab.click();

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

  test("creates mail merge PDF for selected patients", async ({ page }) => {
    await page.goto("/patienten/neu");
    await page.getByPlaceholder("Vorname").fill("Export");
    await page.getByPlaceholder("Nachname").fill("Patient");
    await page.locator('input[type="date"]').first().fill("1992-03-10");
    await page.getByRole("button", { name: "Patient erstellen" }).click();
    await expect(page).toHaveURL(/\/patienten/);
    await page.getByRole("button", { name: "Alle" }).click();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Dokumente erzeugen/i }).click();
    const file = await download;
    expect(await file.suggestedFilename()).toMatch(/Serienbrief-.*\.pdf/);
  });
});
