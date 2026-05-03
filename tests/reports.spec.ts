import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";
const PATIENT_REPORT_FILES_BUCKET = "patient-report-files";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type CreatedPatient = {
  id: string;
  firstName: string;
  lastName: string;
};

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function createPatientFixture(): Promise<CreatedPatient> {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);

  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: "Report",
      last_name: `History ${suffix}`,
      date_of_birth: "1990-01-01",
      gender: "w",
      indication: "Adipositas",
    })
    .select("id, first_name, last_name")
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}

async function deletePatientFixture(patientId: string) {
  const versions = await fetchPatientReportVersionsForPatient(patientId);
  await removeStoredReportFiles(versions.map((version) => version.storage_path));
  await admin.from("patient_reports").delete().eq("patient_ref", patientId);
  await admin.from("patients").delete().eq("id", patientId);
}

async function createReportPlanFixture() {
  const userId = await getTestUserId();
  const planId = crypto.randomUUID();
  const { data: food, error: foodError } = await admin.from("foods").select("id").limit(1).single();
  if (foodError) throw new Error(foodError.message);
  let planDate = "";
  let inserted = false;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const startOfYear = Date.UTC(2026, 0, 1);
    const randomOffsetDays = Math.floor(Math.random() * 365);
    planDate = new Date(startOfYear + randomOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { error: planError } = await admin.from("daily_meal_plans").insert({
      id: planId,
      user_id: userId,
      date: planDate,
      legacy_id: `fixture_${planId}`,
    });

    if (!planError) {
      inserted = true;
      break;
    }

    if (!planError.message.includes("daily_meal_plans_user_id_date_key")) {
      throw new Error(planError.message);
    }
  }

  if (!inserted) {
    throw new Error("Unable to create unique meal plan fixture");
  }

  const { error: entryError } = await admin.from("meal_entries").insert([
    {
      meal_plan_id: planId,
      slot_type: "fruehstueck",
      entry_type: "food",
      reference_id: food.id,
      amount: 180,
      sort_order: 0,
    },
  ]);
  if (entryError) throw new Error(entryError.message);

  return { planId, planDate };
}

async function deleteReportPlanFixture(planId: string) {
  const { data: versions } = await admin
    .from("patient_report_versions")
    .select("storage_path")
    .eq("plan_id", planId);
  await removeStoredReportFiles((versions ?? []).map((version) => version.storage_path as string));
  await admin.from("patient_reports").delete().eq("plan_id", planId);
  await admin.from("meal_entries").delete().eq("meal_plan_id", planId);
  await admin.from("daily_meal_plans").delete().eq("id", planId);
}

async function fetchPatientReportsForPatient(patientId: string) {
  const { data, error } = await admin
    .from("patient_reports")
    .select("*")
    .eq("patient_ref", patientId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPatientReportVersionsForPatient(patientId: string) {
  const { data, error } = await admin
    .from("patient_report_versions")
    .select("*")
    .eq("patient_ref", patientId)
    .order("exported_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function removeStoredReportFiles(paths: string[]) {
  if (paths.length === 0) return;
  const uniquePaths = Array.from(new Set(paths));
  const { error } = await admin.storage.from(PATIENT_REPORT_FILES_BUCKET).remove(uniquePaths);
  if (error) throw new Error(error.message);
}

async function fetchLatestAccessAuditLog(action: string, targetId: string) {
  const { data, error } = await admin
    .from("access_audit_logs")
    .select("action,target_type,target_id,metadata")
    .eq("action", action)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

test.describe("Berichte", () => {
  test("shows patient context and preselects a requested plan", async ({ page }) => {
    const fixture = await createReportPlanFixture();

    try {
      await page.goto(`/berichte?patientId=patient_1&planId=${fixture.planId}&protocolId=protocol_demo`);

      await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();
      await expect(page.getByText("Bericht für Maria Schneider")).toBeVisible();
      await expect(page.getByText(/Adipositas/)).toBeVisible();
      await expect(page.getByText(/Geöffnet aus Protokoll-Kontext\./)).toBeVisible();
      await expect(page.getByRole("combobox").first()).toContainText(fixture.planDate.split("-").reverse().join("."));
    } finally {
      await deleteReportPlanFixture(fixture.planId);
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
    expect(await pdf.suggestedFilename()).toMatch(/prodi-bericht-.*\.pdf/);

    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV/Nährstoffdaten" }).click();
    const csv = await csvDownload;
    expect(await csv.suggestedFilename()).toMatch(/prodi-bericht-.*\.csv/);
  });

  test("creates an immutable patient report version on export and reopens it from history", async ({ page }) => {
    const patient = await createPatientFixture();
    const fixture = await createReportPlanFixture();

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
      expect(await archivedFile.suggestedFilename()).toMatch(/prodi-bericht-.*\.pdf/);

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
      await deleteReportPlanFixture(fixture.planId);
      await deletePatientFixture(patient.id);
    }
  });

  test("reopens an archived report version after the source plan changes", async ({ page }) => {
    const patient = await createPatientFixture();
    const fixture = await createReportPlanFixture();

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
      await deletePatientFixture(patient.id);
    }
  });

  test("shows a non-blocking warning when an archived export file is missing", async ({ page }) => {
    const patient = await createPatientFixture();
    const fixture = await createReportPlanFixture();

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
      await deleteReportPlanFixture(fixture.planId);
      await deletePatientFixture(patient.id);
    }
  });
});
