import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestPatientInput = {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: "m" | "w" | "d";
  indication?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
};

type CreatedPatient = {
  id: string;
  firstName: string;
  lastName: string;
  indication?: string;
  insuranceProvider?: string;
};

type CreatedCounselingSession = {
  id: string;
  patientId: string;
  sessionDate: string;
};

type WorkflowFixture = {
  linkId: string;
  submissionId: string;
  protocolId: string;
  appointmentId: string;
};

type PatientReportFixture = {
  id: string;
  versionId: string;
};

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function createPatientFixture(input: TestPatientInput): Promise<CreatedPatient> {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const payload = {
    user_id: userId,
    first_name: input.firstName,
    last_name: `${input.lastName} ${suffix}`,
    date_of_birth: input.dateOfBirth ?? "1990-01-01",
    gender: input.gender ?? "w",
    indication: input.indication ?? null,
    insurance_provider: input.insuranceProvider ?? "AOK Test",
    insurance_number: input.insuranceNumber ?? `TEST-${suffix}`,
  };

  const { data, error } = await admin
    .from("patients")
    .insert(payload)
    .select("id, first_name, last_name, indication, insurance_provider")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    indication: data.indication ?? undefined,
    insuranceProvider: data.insurance_provider ?? undefined,
  };
}

async function deletePatientFixture(patientId: string) {
  await admin.from("patient_report_versions").delete().eq("patient_ref", patientId);
  await admin.from("patient_reports").delete().eq("patient_ref", patientId);
  const { error } = await admin.from("patients").delete().eq("id", patientId);
  if (error) {
    throw new Error(error.message);
  }
}

async function deleteClinicalRows(table: string, patientId: string) {
  const { error } = await admin.from(table).delete().eq("patient_id", patientId);
  if (error) {
    throw new Error(error.message);
  }
}

async function createCounselingSessionFixture(patientId: string, sessionDate: string): Promise<CreatedCounselingSession> {
  const userId = await getTestUserId();
  const sessionId = crypto.randomUUID();

  const { error } = await admin.from("counseling_sessions").insert({
    id: sessionId,
    user_id: userId,
    patient_id: patientId,
    session_date: sessionDate,
    duration_minutes: 60,
    session_type: "Folgeberatung",
    indication: "Adipositas",
    content: `Beratung vom ${sessionDate}`,
    timeline: [],
    materials: [],
    progress: [],
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: sessionId,
    patientId,
    sessionDate,
  };
}

async function deleteCounselingSessionFixture(sessionId: string) {
  const { error } = await admin.from("counseling_sessions").delete().eq("id", sessionId);
  if (error) {
    throw new Error(error.message);
  }
}

async function createWorkflowFixture(patientId: string): Promise<WorkflowFixture> {
  const userId = await getTestUserId();

  const linkId = crypto.randomUUID();
  const submissionId = crypto.randomUUID();
  const protocolId = crypto.randomUUID();
  const appointmentId = crypto.randomUUID();

  const { error: linkError } = await admin.from("patient_digital_protocol_links").insert({
    id: linkId,
    user_id: userId,
    patient_id: patientId,
    method: "Digitales 24h Recall",
    status: "received",
    url: `https://demo.prodi.local/protokoll/${linkId}`,
    qr_code: "data:image/png;base64,demo",
    expires_at: "2026-12-31",
  });
  if (linkError) throw new Error(linkError.message);

  const { error: protocolError } = await admin.from("nutrition_protocols").insert({
    id: protocolId,
    user_id: userId,
    patient_id: patientId,
    title: "3-Tage-Ernährungsprotokoll",
    type: "ernaehrungsprotokoll",
    start_date: "2026-04-19",
    end_date: "2026-04-21",
    notes: "Aus digitaler Einreichung übernommen",
    metadata: { source: "digital_protocol_submission", sourceSubmissionId: submissionId },
  });
  if (protocolError) throw new Error(protocolError.message);

  const { error: submissionError } = await admin.from("digital_protocol_submissions").insert({
    id: submissionId,
    link_id: linkId,
    patient_id: patientId,
    submitted_at: "2026-04-20T08:00:00.000Z",
    days: [{ date: "2026-04-19", entries: [{ mealSlot: "Frühstück", freeText: "2 Scheiben Vollkornbrot", time: "08:00" }] }],
    notes: "Patient hat App genutzt",
    status: "converted",
    converted_protocol_id: protocolId,
  });
  if (submissionError) throw new Error(submissionError.message);

  const { error: appointmentError } = await admin.from("appointments").insert({
    id: appointmentId,
    user_id: userId,
    title: "Follow-up Ernährung",
    date: "2026-05-05",
    start_time: "09:00:00",
    end_time: "09:30:00",
    patient_id: patientId,
    location: "Raum 2",
    type: "kontrolle",
    reminder: "24 Stunden",
  });
  if (appointmentError) throw new Error(appointmentError.message);

  return { linkId, submissionId, protocolId, appointmentId };
}

async function deleteWorkflowFixture(patientId: string, fixture: WorkflowFixture) {
  await admin.from("appointments").delete().eq("id", fixture.appointmentId);
  await admin.from("nutrition_protocol_entries").delete().eq("protocol_id", fixture.protocolId);
  await admin.from("nutrition_protocols").delete().eq("id", fixture.protocolId);
  await admin.from("digital_protocol_submissions").delete().eq("id", fixture.submissionId);
  await admin.from("patient_digital_protocol_links").delete().eq("id", fixture.linkId);
  await deleteClinicalRows("appointments", patientId);
}

async function createPatientReportFixture(patient: CreatedPatient): Promise<PatientReportFixture> {
  const userId = await getTestUserId();
  const reportId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  const { error } = await admin.from("patient_reports").insert({
    id: reportId,
    user_id: userId,
    patient_ref: patient.id,
    patient_name: `${patient.firstName} ${patient.lastName}`,
    patient_indication: patient.indication ?? null,
    title: "Operation Prodi Bericht",
    plan_id: "fixture_plan_ref",
    protocol_id: null,
    plan_date_label: "15.06.2026",
    report_length: "full",
    selected_sections: {
      summary: true,
      table: true,
      charts: true,
      meals: true,
      notes: true,
    },
    active_section_labels: ["Kurzfazit & Indikatoren", "Nährstofftabellen", "Diagramme", "Speiseplanübersicht", "Individuelle Hinweise"],
    notes: "Verlauf stabil, Fokus auf Ballaststoffe.",
    last_format: "PDF",
    last_file_name: "prodi-bericht-2026-06-15.pdf",
    latest_version_number: 0,
  });

  if (error) throw new Error(error.message);

  const { error: versionError } = await admin.from("patient_report_versions").insert({
    id: versionId,
    patient_report_id: reportId,
    user_id: userId,
    patient_ref: patient.id,
    patient_name: `${patient.firstName} ${patient.lastName}`,
    patient_indication: patient.indication ?? null,
    title: "Operation Prodi Bericht",
    plan_id: "fixture_plan_ref",
    protocol_id: null,
    version_number: 1,
    format: "PDF",
    file_name: "prodi-bericht-2026-06-15.pdf",
    file_size: 1024,
    content_type: "application/pdf",
    storage_bucket: "patient-report-files",
    storage_path: `${userId}/${patient.id}/${reportId}/${versionId}.pdf`,
    snapshot: {
      format: "PDF",
      title: "Operation Prodi Bericht",
      fileBaseName: "prodi-bericht-2026-06-15",
      reportId,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientIndication: patient.indication ?? undefined,
      planId: "fixture_plan_ref",
      planDateLabel: "15.06.2026",
      reportLength: "full",
      selectedSections: {
        summary: true,
        table: true,
        charts: true,
        meals: true,
        notes: true,
      },
      activeSectionLabels: ["Kurzfazit & Indikatoren", "Nährstofftabellen", "Diagramme", "Speiseplanübersicht", "Individuelle Hinweise"],
      summaryMetrics: [
        { label: "Energieabdeckung", value: "1800 kcal", reference: "2000 kcal", coverage: "90%" },
      ],
      nutrientRows: [
        { label: "Eiweiß", value: "80 g", reference: "60 g", coverage: "133%" },
      ],
      vitaminRows: [
        { label: "Vitamin C", value: "110 mg", reference: "95 mg", coverage: "116%" },
      ],
      mineralRows: [
        { label: "Calcium", value: "950 mg", reference: "1000 mg", coverage: "95%" },
      ],
      mealRows: [
        { slot: "Frühstück", summary: "Porridge mit Obst" },
      ],
      notes: "Verlauf stabil, Fokus auf Ballaststoffe.",
      narrative: "Archivierte Patientenfassung.",
      badges: ["Plan 15.06.2026", "Vollversion"],
      specialNotes: ["PRODIscore 82"],
    },
  });

  if (versionError) throw new Error(versionError.message);

  const { error: updateError } = await admin
    .from("patient_reports")
    .update({
      latest_version_id: versionId,
      latest_version_number: 1,
    })
    .eq("id", reportId);

  if (updateError) throw new Error(updateError.message);

  return { id: reportId, versionId };
}

async function fetchClinicalRows<T extends Record<string, unknown>>(
  table: string,
  patientId: string,
): Promise<T[]> {
  const { data, error } = await admin.from(table).select("*").eq("patient_id", patientId);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as T[];
}

function patientLabel(patient: CreatedPatient) {
  return `${patient.lastName}, ${patient.firstName}`;
}

function patientHeading(patient: CreatedPatient) {
  return `${patient.firstName} ${patient.lastName}`;
}

function patientCard(page: Page, patient: CreatedPatient) {
  return page.locator(`[data-patient-id="${patient.id}"]`).first();
}

async function openPatientList(page: Page) {
  await page.goto("/patienten", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Patienten" })).toBeVisible({ timeout: 30_000 });
}

async function openPatientDetail(page: Page, patient: CreatedPatient) {
  await page.goto(`/patienten/${patient.id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: patientHeading(patient) })).toBeVisible({ timeout: 30_000 });
}

test.describe("Patient Management", () => {
  test("displays patient list with backend data", async ({ page }) => {
    const primary = await createPatientFixture({ firstName: "Maria", lastName: "Schneider", indication: "Adipositas" });
    const secondary = await createPatientFixture({ firstName: "Thomas", lastName: "Weber", indication: "Diabetes mellitus Typ 2" });
    const tertiary = await createPatientFixture({ firstName: "Lisa", lastName: "Hoffmann", indication: "Zöliakie" });

    try {
      await openPatientList(page);
      await expect(patientCard(page, primary)).toBeVisible();
      await expect(patientCard(page, secondary)).toBeVisible();
      await expect(patientCard(page, tertiary)).toBeVisible();
    } finally {
      await deletePatientFixture(primary.id);
      await deletePatientFixture(secondary.id);
      await deletePatientFixture(tertiary.id);
    }
  });

  test("searches patients by name", async ({ page }) => {
    const primary = await createPatientFixture({ firstName: "Search", lastName: "Alpha", indication: "Adipositas" });
    const secondary = await createPatientFixture({ firstName: "Search", lastName: "Beta", indication: "Zöliakie" });

    try {
      await openPatientList(page);
      const searchInput = page.getByPlaceholder("Patient suchen...");
      await expect(searchInput).toBeVisible();
      await searchInput.fill(primary.lastName);
      await expect(patientCard(page, primary)).toBeVisible();
      await expect(patientCard(page, secondary)).toHaveCount(0);
    } finally {
      await deletePatientFixture(primary.id);
      await deletePatientFixture(secondary.id);
    }
  });

  test("filters patients by indication", async ({ page }) => {
    const primary = await createPatientFixture({ firstName: "Filter", lastName: "Adipositas", indication: "Adipositas" });
    const secondary = await createPatientFixture({ firstName: "Filter", lastName: "Zoeliakie", indication: "Zöliakie" });

    try {
      await openPatientList(page);
      const indicationFilter = page.getByRole("combobox", { name: /Indikationen/i });
      await indicationFilter.click();
      await page.getByRole("option", { name: "Adipositas" }).click();

      await expect(patientCard(page, primary)).toBeVisible();
      await expect(patientCard(page, secondary)).toHaveCount(0);
    } finally {
      await deletePatientFixture(primary.id);
      await deletePatientFixture(secondary.id);
    }
  });

  test("shows the latest counseling date from backend sessions on the patient card", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Counseling",
      lastName: "Latest",
      indication: "Adipositas",
    });
    const olderSession = await createCounselingSessionFixture(patient.id, "2026-04-10");
    const newerSession = await createCounselingSessionFixture(patient.id, "2026-05-15");

    try {
      await openPatientList(page);
      await expect(patientCard(page, patient)).toContainText("Letzte Beratung: 15.05.2026");
    } finally {
      await deleteCounselingSessionFixture(olderSession.id);
      await deleteCounselingSessionFixture(newerSession.id);
      await deletePatientFixture(patient.id);
    }
  });

  test("does not show a counseling row on the patient card when no session exists", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Counseling",
      lastName: "None",
      indication: "Adipositas",
    });

    try {
      await openPatientList(page);
      await expect(patientCard(page, patient)).not.toContainText("Letzte Beratung:");
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("renders mail-merge defaults and inserts placeholders", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Mailing",
      lastName: "Defaults",
      indication: "Adipositas",
    });

    try {
      await openPatientList(page);

      const mailMergeCard = page.locator("[data-slot='card']").filter({ hasText: "Serienbriefe & Mailings" }).first();
      const templateSelect = mailMergeCard.getByRole("combobox").first();
      await expect(templateSelect).toContainText("Termin-Nachverfolgung");
      await templateSelect.click();
      await expect(page.getByRole("option", { name: "Protokoll-Auswertung" })).toBeVisible();
      await page.keyboard.press("Escape");

      const bodyTextarea = mailMergeCard.locator("textarea").first();
      await bodyTextarea.fill("Hallo ");
      await page.getByRole("button", { name: "{{patient.firstName}}" }).click();
      await expect(bodyTextarea).toHaveValue("Hallo {{patient.firstName}}");
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("creates a new patient", async ({ page }) => {
    await page.goto("/patienten/neu");
    await expect(page.getByRole("heading", { name: "Neuer Patient" })).toBeVisible();
    await expect(page.getByText("eGK-Demo")).toBeVisible();

    const firstNameInput = page.locator('input[name="firstName"]');
    const lastNameInput = page.locator('input[name="lastName"]');
    const uniqueLastName = `UITest${Date.now().toString().slice(-6)}`;

    await page.getByRole("button", { name: "Demo-Karte nutzen" }).click();
    await expect(firstNameInput).not.toHaveValue("");
    const firstName = await firstNameInput.inputValue();

    await lastNameInput.fill(uniqueLastName);
    await expect(lastNameInput).toHaveValue(uniqueLastName);

    await page.getByRole("button", { name: "Patient erstellen" }).click();

    await expect(page).toHaveURL(/\/patienten/);
    await expect(page.getByRole("link", { name: new RegExp(`${uniqueLastName}, ${firstName}`) }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("labels the patient list egk area as demo mode", async ({ page }) => {
    await openPatientList(page);
    await expect(page.getByText("eGK-Demo")).toBeVisible();
    await expect(page.getByText("Simulierte eGK-Daten für Tests und Produktdemos.")).toBeVisible();
  });

  test("views patient detail with tabs", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Detail",
      lastName: "Patient",
      indication: "Adipositas",
      insuranceProvider: "AOK Bayern",
    });

    try {
      await openPatientDetail(page, patient);

      await expect(page.getByRole("tab", { name: "Workflow" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Stammdaten" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Anthropometrie" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Protokolle" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Beratungen" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Workflow" })).toHaveAttribute("data-state", "active");
      await expect(page.getByText("Patient Journey")).toBeVisible();
      await page.getByRole("tab", { name: "Stammdaten" }).click();
      await expect(page.getByText(patient.insuranceProvider ?? "")).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("shows derived workflow progress for a patient journey", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Workflow",
      lastName: "Journey",
      indication: "Adipositas",
    });
    const fixture = await createWorkflowFixture(patient.id);

    try {
      await openPatientDetail(page, patient);

      await expect(page.getByRole("tab", { name: "Workflow" })).toHaveAttribute("data-state", "active");
      await expect(page.getByText("3/5 Schritte abgeschlossen")).toBeVisible();
      await expect(page.getByRole("link", { name: "Protokoll öffnen" }).first()).toBeVisible();
      await expect(page.getByText("Ein patientenbezogener Kontrolltermin ist bereits im Kalender hinterlegt.")).toBeVisible();
      await expect(page.getByText("Digitale Einreichung", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Kontrolltermin planen" }).first()).toHaveAttribute("href", `/termine?patientId=${patient.id}`);
    } finally {
      await deleteWorkflowFixture(patient.id, fixture);
      await deletePatientFixture(patient.id);
    }
  });

  test("shows patient report history in workflow", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Report",
      lastName: "Workflow",
      indication: "Adipositas",
    });
    const report = await createPatientReportFixture(patient);

    try {
      await openPatientDetail(page, patient);

      await expect(page.getByRole("tab", { name: "Workflow" })).toHaveAttribute("data-state", "active");
      await expect(page.getByText("Berichtshistorie")).toBeVisible();
      await expect(page.getByText("Operation Prodi Bericht").first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Historie öffnen" }).first()).toHaveAttribute("href", `/berichte?reportVersionId=${report.versionId}`);
      await expect(page.getByRole("link", { name: "PDF herunterladen" }).first()).toHaveAttribute("href", `/api/patient-report-versions/${report.versionId}/download`);
      await expect(page.getByText("Eine archivierte Berichtsversion liegt vor und kann unverändert erneut geöffnet oder heruntergeladen werden.")).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("views anthropometric data tab", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Anthro", lastName: "Viewer" });

    try {
      await openPatientDetail(page, patient);
      const anthropometryTab = page.getByRole("tab", { name: "Anthropometrie" });
      await expect(anthropometryTab).toBeVisible();
      await anthropometryTab.click();

      await expect(page.getByRole("button", { name: "Neue Messung" })).toBeVisible();
      await expect(page.getByText("Noch keine Messwerte vorhanden.")).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("adds anthropometric entry", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Anthro", lastName: "Editor" });

    try {
      await openPatientDetail(page, patient);
      const anthropometryTab = page.getByRole("tab", { name: "Anthropometrie" });
      await anthropometryTab.click();

      await page.getByRole("button", { name: "Neue Messung" }).click();
      await page.locator('input[type="number"][placeholder="kg"]').fill("84");
      await page.locator('input[type="number"][placeholder="cm"]').fill("168");
      await page.getByRole("button", { name: "Messung speichern" }).click();

      await expect(page.getByRole("cell", { name: "84,0" })).toBeVisible();
      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ weight: string }>("patient_anthropometrics", patient.id);
          return rows.some((row) => Number(row.weight) === 84);
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Anthropometrie" }).click();
      await expect(page.getByRole("cell", { name: "84,0" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("persists diagnoses across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Diagnosis", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Diagnosen & Medikamente" }).click();

      await page.getByRole("button", { name: "Diagnose erfassen" }).click();
      await page.locator("#diagnosis-name").fill("Diabetes mellitus Typ 2");
      await page.getByLabel("ICD-Code").fill("E11.9");
      await page.getByRole("button", { name: "Speichern" }).click();

      await expect(page.getByRole("cell", { name: "Diabetes mellitus Typ 2" })).toBeVisible();
      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ diagnosis: string }>("patient_diagnoses", patient.id);
          return rows.some((row) => row.diagnosis === "Diabetes mellitus Typ 2");
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Diagnosen & Medikamente" }).click();
      await expect(page.getByRole("cell", { name: "Diabetes mellitus Typ 2" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("persists medications across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Medication", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Diagnosen & Medikamente" }).click();

      await page.getByRole("button", { name: "Medikation erfassen" }).click();
      await page.getByLabel("Name").fill("Metformin");
      await page.getByLabel("Dosierung").fill("1000 mg");
      await page.getByLabel("Schema").fill("2× täglich");
      await page.getByRole("button", { name: "Speichern" }).click();

      await expect(page.getByRole("cell", { name: "Metformin" })).toBeVisible();
      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ name: string }>("patient_medications", patient.id);
          return rows.some((row) => row.name === "Metformin");
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Diagnosen & Medikamente" }).click();
      await expect(page.getByRole("cell", { name: "Metformin" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("persists screenings across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Screening", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Therapien" }).click();

      const mustCard = page.locator("div.rounded-lg.border.p-3").filter({ hasText: "MUST" }).first();
      await mustCard.getByRole("button", { name: "Ergebnis speichern" }).click();

      await expect(page.getByText(/MUST · Score/i)).toBeVisible();
      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ tool: string }>("patient_screenings", patient.id);
          return rows.some((row) => row.tool === "MUST");
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Therapien" }).click();
      await expect(page.getByText(/MUST · Score/i)).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("creates lab values via UI and persists to Supabase", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Lab", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Laborwerte" }).click();

      await page.getByPlaceholder("z. B. 5.6").fill("6.4");
      await page.locator('input[type="date"]').fill("2026-04-18");
      await page.getByPlaceholder("z. B. nüchtern, Labor Praxis X").fill("nüchtern");
      await page.getByRole("button", { name: "Messung speichern" }).click();

      await expect(page.getByRole("cell", { name: /6.4 %/i })).toBeVisible();
      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ parameter_id: string; value: string }>(
            "patient_lab_values",
            patient.id,
          );
          return rows.some((row) => row.parameter_id === "lab_hba1c" && Number(row.value) === 6.4);
        })
        .toBe(true);
    } finally {
      await deleteClinicalRows("patient_lab_values", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("renders remote lab values from Supabase", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "LabRemote", lastName: "Viewer" });
    const userId = await getTestUserId();

    try {
      const { error } = await admin.from("patient_lab_values").insert({
        user_id: userId,
        patient_id: patient.id,
        parameter_id: "lab_glucose",
        date: "2026-04-10",
        value: 98,
        notes: "Praxislabor",
      });

      if (error) {
        throw new Error(error.message);
      }

      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Laborwerte" }).click();

      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Nüchternglucose" }).click();

      await expect(page.getByRole("cell", { name: /98 mg\/dl/i })).toBeVisible();
      await expect(page.getByText("Praxislabor")).toBeVisible();

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Laborwerte" }).click();
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Nüchternglucose" }).click();
      await expect(page.getByRole("cell", { name: /98 mg\/dl/i })).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_lab_values", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("persists activities across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Activity", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Aktivität & Energie" }).click();
      const activityTab = page.locator('[role="tabpanel"][data-state="active"]').first();

      await activityTab.getByPlaceholder("Spaziergang").fill("Nordic Walking");
      await activityTab.locator('input[type="number"]').first().fill("50");
      await activityTab.locator('input[type="date"]').first().fill("2026-04-18");
      await page.getByRole("button", { name: "Aktivität speichern" }).click();

      await expect(page.getByText(/Nordic Walking/i)).toBeVisible();
      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ type: string; duration_minutes: string }>(
            "patient_activities",
            patient.id,
          );
          return rows.some((row) => row.type === "Nordic Walking" && Number(row.duration_minutes) === 50);
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Aktivität & Energie" }).click();
      await expect(page.getByText(/Nordic Walking/i)).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_activities", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("persists therapy modules and status changes across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Therapy", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Therapien" }).click();

      await page.getByRole("button", { name: "Modul hinzufügen" }).click();
      await expect(page.getByText("Diabetes-Modul")).toBeVisible();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ module: string; status: string }>(
            "patient_therapy_settings",
            patient.id,
          );
          return rows.some((row) => row.module === "diabetes" && row.status === "active");
        })
        .toBe(true);

      await page.getByRole("switch").first().click();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ module: string; status: string }>(
            "patient_therapy_settings",
            patient.id,
          );
          return rows.some((row) => row.module === "diabetes" && row.status === "paused");
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Therapien" }).click();
      await expect(page.getByText("Diabetes-Modul")).toBeVisible();
      await expect(page.getByText("Pausiert")).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_therapy_settings", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("persists therapy integrations and sync updates across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Integration", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Therapien" }).click();

      await page.getByRole("button", { name: "CGM koppeln" }).click();
      await expect(page.getByText(/^LibreLink$/).first()).toBeVisible();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ vendor: string; status: string }>(
            "patient_therapy_integrations",
            patient.id,
          );
          return rows.some((row) => row.vendor === "LibreLink" && row.status === "pending");
        })
        .toBe(true);

      await page.getByRole("button", { name: "Sync anstoßen" }).click();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ vendor: string; status: string; last_sync: string | null }>(
            "patient_therapy_integrations",
            patient.id,
          );
          return rows.some(
            (row) => row.vendor === "LibreLink" && row.status === "connected" && Boolean(row.last_sync),
          );
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Therapien" }).click();
      await expect(page.getByText("LibreLink")).toBeVisible();
      await expect(page.getByText("Verbunden")).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_therapy_integrations", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("persists PROCAM results across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Procam", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Therapien" }).click();

      await page.getByRole("button", { name: "PROCAM speichern" }).click();
      await expect(page.getByRole("table")).toBeVisible();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ score: string }>("patient_procam_results", patient.id);
          return rows.length > 0 && Number(rows[0].score) > 0;
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Therapien" }).click();
      await expect(page.getByRole("table")).toContainText(/low|moderate|high/i);
    } finally {
      await deleteClinicalRows("patient_procam_results", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("persists digital protocol links and status updates across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Digital", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await page.getByRole("tab", { name: "Protokolle" }).click();

      await page.getByRole("button", { name: "Link erstellen" }).click();
      await expect(page.getByText("Digitales 24h Recall", { exact: true }).last()).toBeVisible();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ method: string; status: string }>(
            "patient_digital_protocol_links",
            patient.id,
          );
          return rows.some((row) => row.method === "Digitales 24h Recall" && row.status === "pending");
        })
        .toBe(true);

      await page.getByRole("button", { name: "Status toggeln" }).click();

      await expect
        .poll(async () => {
          const rows = await fetchClinicalRows<{ method: string; status: string }>(
            "patient_digital_protocol_links",
            patient.id,
          );
          return rows.some((row) => row.method === "Digitales 24h Recall" && row.status === "received");
        })
        .toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Protokolle" }).click();
      await expect(page.getByText("Digitales 24h Recall", { exact: true }).last()).toBeVisible();
      await expect(page.getByText("eingetroffen")).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_digital_protocol_links", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("creates mail merge PDF for selected patients", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Export", lastName: "Patient", indication: "Adipositas" });

    try {
      await openPatientList(page);
      await expect(patientCard(page, patient)).toBeVisible();

      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Alle" }).click();
      await page.getByRole("button", { name: /Dokumente erzeugen/i }).click();
      const file = await download;
      expect(await file.suggestedFilename()).toMatch(/Serienbrief-.*\.pdf/);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });
});
