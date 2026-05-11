import { expect, test } from "@playwright/test";
import {
  admin,
  createClinicDemoPatient,
  createClinicDemoReportPlanFixture,
  deleteClinicDemoPatient,
  deleteClinicDemoReportPlanFixture,
  fetchLatestAccessAuditLog,
  fetchPatientReportsForPatient,
  fetchPatientReportVersionsForPatient,
  removeStoredReportFiles,
} from "./fixtures/clinic-demo";

test.describe("Berichte", () => {
  test("shows patient context and preselects a requested plan", async ({ page }) => {
    const patient = await createClinicDemoPatient({
      firstName: "Maria",
      lastName: "Schneider",
      indications: ["Adipositas"],
    });
    const fixture = await createClinicDemoReportPlanFixture();

    try {
      await page.goto(`/berichte?patientId=${patient.id}&planId=${fixture.planId}&protocolId=protocol_demo`);

      await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();
      await expect(page.getByText(`Bericht für ${patient.fullName}`)).toBeVisible();
      await expect(page.getByText(/Adipositas/)).toBeVisible();
      await expect(page.getByText(/Geöffnet aus Protokoll-Kontext\./)).toBeVisible();
      await expect(page.getByRole("combobox").first()).toContainText(fixture.planDate.split("-").reverse().join("."));
    } finally {
      await deleteClinicDemoReportPlanFixture(fixture.planId);
      await deleteClinicDemoPatient(patient.id);
    }
  });

  test("ignores unknown patient context without breaking reports", async ({ page }) => {
    await page.goto("/berichte?patientId=unknown-patient");

    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();
    await expect(page.getByText(/Bericht für/)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Makronährstoffe/i })).toBeVisible();
  });

  test("displays report tabs with charts and tables", async ({ page }) => {
    await page.goto("/berichte");

    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();

    // Check tabs exist
    await expect(page.getByRole("tab", { name: /Makronährstoffe/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Vitamine/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Mineralstoffe/i })).toBeVisible();

    // Macro tab should show energy info
    await expect(page.getByText(/kcal/i).first()).toBeVisible();

    // Switch to Vitamine tab
    await page.getByRole("tab", { name: /Vitamine/i }).click();
    await expect(page.getByText(/Vitamin/i).first()).toBeVisible();

    // Switch to Mineralstoffe tab
    await page.getByRole("tab", { name: /Mineralstoffe/i }).click();
    await expect(page.getByText(/Calcium/i).or(page.getByText(/Eisen/i)).first()).toBeVisible();
  });

  test("shows bundled report templates in the report sidebar", async ({ page }) => {
    await page.goto("/berichte");
    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();

    const templateCard = page.locator("[data-slot='card']").filter({ hasText: "Textvorlagen & Platzhalter" }).first();
    await templateCard.scrollIntoViewIfNeeded();

    await expect(templateCard.getByText("Kurzbericht Standard")).toBeVisible();
    await expect(templateCard.getByText("Follow-up Coaching")).toBeVisible();
    await expect(templateCard.getByText("Institution – Wochenreport")).toBeVisible();
  });

  test("exports reports as PDF and CSV", async ({ page }) => {
    await page.goto("/berichte");
    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();

    const pdfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF erstellen" }).click();
    const pdf = await pdfDownload;
    expect(await pdf.suggestedFilename()).toMatch(/inari-bericht-.*\.pdf/);

    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV/Nährstoffdaten" }).click();
    const csv = await csvDownload;
    expect(await csv.suggestedFilename()).toMatch(/inari-bericht-.*\.csv/);
  });

  test("creates an immutable patient report version on export and reopens it from history", async ({ page }) => {
    const patient = await createClinicDemoPatient({ firstName: "Report", lastName: "History", indications: ["Adipositas"] });
    const fixture = await createClinicDemoReportPlanFixture();

    try {
      await page.goto(`/berichte?patientId=${patient.id}&planId=${fixture.planId}`);
      await expect(page.getByText(`Bericht für ${patient.firstName} ${patient.lastName}`)).toBeVisible();

      await page.getByRole("button", { name: "Vollversion" }).click();
      await page.getByPlaceholder("z. B. Fokus auf Ballaststoffe, Laborkontrolle in 4 Wochen, ...").fill("Follow-up Fokus");

      const pdfDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "PDF erstellen" }).click();
      await pdfDownload;

      const reports = await fetchPatientReportsForPatient(patient.id);
      expect(reports.length).toBeGreaterThan(0);
      const versions = await fetchPatientReportVersionsForPatient(patient.id);
      expect(versions.length).toBeGreaterThan(0);

      const report = reports[0];
      const version = versions[0];
      expect(report.plan_id).toBe(fixture.planId);
      expect(report.report_length).toBe("full");
      expect(report.notes).toContain("Follow-up Fokus");
      expect(report.latest_version_id).toBe(version.id);
      expect(version.snapshot.notes).toContain("Follow-up Fokus");
      expect(version.file_name).toMatch(/\.pdf$/);

      await expect.poll(async () => fetchLatestAccessAuditLog("report_export_created", version.id)).toMatchObject({
        action: "report_export_created",
        target_type: "patient_report_version",
        target_id: version.id,
        metadata: expect.objectContaining({
          format: "PDF",
          patientId: patient.id,
          reportVersionId: version.id,
        }),
      });

      await page.goto(`/berichte?reportVersionId=${version.id}`);
      await expect(page.getByText("Archivierte Berichtsversion")).toBeVisible();
      await expect(page.getByText(`Bericht für ${patient.firstName} ${patient.lastName}`)).toBeVisible();
      await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
      await expect(page.getByText("Follow-up Fokus")).toBeVisible();

      const archivedDownload = page.waitForEvent("download");
      await page.getByRole("link", { name: "PDF herunterladen" }).click();
      const archivedFile = await archivedDownload;
      expect(await archivedFile.suggestedFilename()).toMatch(/inari-bericht-.*\.pdf/);

      await expect.poll(async () => fetchLatestAccessAuditLog("patient_report_version_downloaded", version.id)).toMatchObject({
        action: "patient_report_version_downloaded",
        target_type: "patient_report_version",
        target_id: version.id,
        metadata: expect.objectContaining({
          format: "PDF",
          patientId: patient.id,
          patientReportId: report.id,
        }),
      });
    } finally {
      await deleteClinicDemoReportPlanFixture(fixture.planId);
      await deleteClinicDemoPatient(patient.id);
    }
  });

  test("reopens an archived report version after the source plan changes", async ({ page }) => {
    const patient = await createClinicDemoPatient({ firstName: "Report", lastName: "History", indications: ["Adipositas"] });
    const fixture = await createClinicDemoReportPlanFixture();

    try {
      await page.goto(`/berichte?patientId=${patient.id}&planId=${fixture.planId}`);
      const pdfDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "PDF erstellen" }).click();
      await pdfDownload;

      const versions = await fetchPatientReportVersionsForPatient(patient.id);
      const version = versions[0];
      expect(version).toBeTruthy();

      await admin.from("meal_entries").delete().eq("meal_plan_id", fixture.planId);
      await admin.from("daily_meal_plans").delete().eq("id", fixture.planId);

      await page.goto(`/berichte?reportVersionId=${version.id}`);
      await expect(page.getByText("Archivierte Berichtsversion")).toBeVisible();
      await expect(page.getByText(`Bericht für ${patient.firstName} ${patient.lastName}`)).toBeVisible();
      await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
    } finally {
      await deleteClinicDemoPatient(patient.id);
    }
  });

  test("shows a non-blocking warning when an archived export file is missing", async ({ page }) => {
    const patient = await createClinicDemoPatient({ firstName: "Report", lastName: "History", indications: ["Adipositas"] });
    const fixture = await createClinicDemoReportPlanFixture();

    try {
      await page.goto(`/berichte?patientId=${patient.id}&planId=${fixture.planId}`);
      const csvDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "CSV/Nährstoffdaten" }).click();
      await csvDownload;

      const versions = await fetchPatientReportVersionsForPatient(patient.id);
      const version = versions[0];
      await removeStoredReportFiles([version.storage_path]);

      await page.goto(`/berichte?reportVersionId=${version.id}`);
      await expect(page.getByText("Archivierte Berichtsversion")).toBeVisible();
      await expect(page.getByText("Exportdatei nicht verfügbar")).toBeVisible();
    } finally {
      await deleteClinicDemoReportPlanFixture(fixture.planId);
      await deleteClinicDemoPatient(patient.id);
    }
  });
});
