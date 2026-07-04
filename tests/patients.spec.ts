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
  indications?: string[];
  insuranceProvider?: string;
  insuranceNumber?: string;
};

type CreatedPatient = {
  id: string;
  firstName: string;
  lastName: string;
  indications?: string[];
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
    indications: input.indications ?? [],
    insurance_provider: input.insuranceProvider ?? "AOK Test",
    insurance_number: input.insuranceNumber ?? `TEST-${suffix}`,
  };

  const { data, error } = await admin
    .from("patients")
    .insert(payload)
    .select("id, first_name, last_name, indications, insurance_provider")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    indications: data.indications ?? undefined,
    insuranceProvider: data.insurance_provider ?? undefined,
  };
}

async function deletePatientFixture(patientId: string) {
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

async function openAssessmentSection(page: Page, section: string) {
  // Assessment sections now live as sub-tabs under the "Profil" tab.
  await page.getByRole("tab", { name: "Profil" }).first().click();
  await page.getByRole("tab", { name: section }).click();
}

async function openNutritionSection(page: Page, section: string) {
  await page.getByRole("tab", { name: "Ernährung" }).click();
  await page.getByRole("tab", { name: section }).click();
}

test.describe("Patient Management", () => {
  // Parallel workers share one dev server; cold compiles push slower runs past
  // the default 30s budget (same override as meal-plan.spec.ts).
  test.setTimeout(60_000);

  test("displays patient list with backend data", async ({ page }) => {
    const primary = await createPatientFixture({ firstName: "Maria", lastName: "Schneider", indications: ["Adipositas"] });
    const secondary = await createPatientFixture({ firstName: "Thomas", lastName: "Weber", indications: ["Diabetes mellitus Typ 2"] });
    const tertiary = await createPatientFixture({ firstName: "Lisa", lastName: "Hoffmann", indications: ["Zöliakie"] });

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
    const primary = await createPatientFixture({ firstName: "Search", lastName: "Alpha", indications: ["Adipositas"] });
    const secondary = await createPatientFixture({ firstName: "Search", lastName: "Beta", indications: ["Zöliakie"] });

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
    const primary = await createPatientFixture({ firstName: "Filter", lastName: "Adipositas", indications: ["Adipositas"] });
    const secondary = await createPatientFixture({ firstName: "Filter", lastName: "Zoeliakie", indications: ["Zöliakie"] });

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
      indications: ["Adipositas"],
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
      indications: ["Adipositas"],
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
      indications: ["Adipositas"],
    });

    try {
      await openPatientList(page);

      // The mail-merge card lives on the "Workflows" tab of the patient list.
      await page.getByRole("tab", { name: "Workflows" }).click();
      const mailMergeCard = page.locator("[data-slot='card']").filter({ hasText: "Serienbriefe & Mailings" }).first();
      await mailMergeCard.getByRole("button", { name: /Öffnen/i }).click();
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

    const firstNameInput = page.locator('input[name="firstName"]');
    const lastNameInput = page.locator('input[name="lastName"]');
    const dateOfBirthInput = page.locator('input[name="dateOfBirth"]');
    const uniqueLastName = `UITest${Date.now().toString().slice(-6)}`;

    await firstNameInput.fill("Neu");
    await lastNameInput.fill(uniqueLastName);
    await dateOfBirthInput.fill("1991-04-12");
    await expect(firstNameInput).toHaveValue("Neu");
    await expect(lastNameInput).toHaveValue(uniqueLastName);

    await page.getByRole("button", { name: "Speichern & Liste" }).click();

    await expect(page).toHaveURL(/\/patienten/);
    await expect(page.getByRole("link", { name: new RegExp(`${uniqueLastName}, Neu`) }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("views patient detail with tabs", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Detail",
      lastName: "Patient",
      indications: ["Adipositas"],
      insuranceProvider: "AOK Bayern",
    });

    try {
      await openPatientDetail(page, patient);

      await expect(page.getByRole("tab", { name: "Workflow" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Profil" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Ernährung" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Beratung" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Statistiken" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Workflow" })).toHaveAttribute("data-state", "active");
      await expect(page.getByText("Behandlungspfad")).toBeVisible();
      await page.getByRole("button", { name: "Löschen" }).click();
      await expect(page.getByRole("alertdialog", { name: "Patient löschen?" })).toBeVisible();
      await page.getByRole("button", { name: "Abbrechen" }).click();
      await page.getByRole("tab", { name: "Profil" }).click();
      await expect(page.getByText(patient.insuranceProvider ?? "")).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("shows derived workflow progress for a patient journey", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Workflow",
      lastName: "Journey",
      indications: ["Adipositas"],
    });
    const fixture = await createWorkflowFixture(patient.id);

    try {
      await openPatientDetail(page, patient);

      await expect(page.getByRole("tab", { name: "Workflow" })).toHaveAttribute("data-state", "active");
      await expect(page.getByText("3/4 Schritte abgeschlossen")).toBeVisible();
      await expect(page.getByText("Ein patientenbezogener Kontrolltermin ist bereits im Kalender hinterlegt.")).toBeVisible();
      await expect(page.getByText("Digitale Einreichung wurde in ein internes Protokoll übernommen.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Plan anlegen" }).first()).toHaveAttribute("href", `/ernaehrungsplan?patientId=${patient.id}`);
      await expect(page.getByText("Quick Links")).toHaveCount(0);
    } finally {
      await deleteWorkflowFixture(patient.id, fixture);
      await deletePatientFixture(patient.id);
    }
  });

  test("views anthropometric data tab", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Anthro", lastName: "Viewer" });

    try {
      await openPatientDetail(page, patient);
      await openAssessmentSection(page, "Anthropometrie");

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
      await openAssessmentSection(page, "Anthropometrie");

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
      await openAssessmentSection(page, "Anthropometrie");
      await expect(page.getByRole("cell", { name: "84,0" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("persists diagnoses across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Diagnosis", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await openAssessmentSection(page, "Diagnosen & Medikamente");

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
      await openAssessmentSection(page, "Diagnosen & Medikamente");
      await expect(page.getByRole("cell", { name: "Diabetes mellitus Typ 2" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("persists medications across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Medication", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await openAssessmentSection(page, "Diagnosen & Medikamente");

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
      await openAssessmentSection(page, "Diagnosen & Medikamente");
      await expect(page.getByRole("cell", { name: "Metformin" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("creates lab values via UI and persists to Supabase", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Lab", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await openAssessmentSection(page, "Laborwerte");

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
      await openAssessmentSection(page, "Laborwerte");

      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Nüchternglucose" }).click();

      await expect(page.getByRole("cell", { name: /98 mg\/dl/i })).toBeVisible();
      await expect(page.getByText("Praxislabor")).toBeVisible();

      await page.reload({ waitUntil: "networkidle" });
      await openAssessmentSection(page, "Laborwerte");
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
      await openAssessmentSection(page, "Aktivität & Energie");
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
      await openAssessmentSection(page, "Aktivität & Energie");
      await expect(page.getByText(/Nordic Walking/i)).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_activities", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("persists digital protocol links and status updates across reload", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Digital", lastName: "Persist" });

    try {
      await openPatientDetail(page, patient);
      await openNutritionSection(page, "Protokolle");

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
      await openNutritionSection(page, "Protokolle");
      await expect(page.getByText("Digitales 24h Recall", { exact: true }).last()).toBeVisible();
      await expect(page.getByText("eingetroffen")).toBeVisible();
    } finally {
      await deleteClinicalRows("patient_digital_protocol_links", patient.id).catch(() => {});
      await deletePatientFixture(patient.id);
    }
  });

  test("creates mail merge PDF for selected patients", async ({ page }) => {
    const patient = await createPatientFixture({ firstName: "Export", lastName: "Patient", indications: ["Adipositas"] });

    try {
      await openPatientList(page);
      await expect(patientCard(page, patient)).toBeVisible();

      // The mail-merge card lives on the "Workflows" tab of the patient list.
      await page.getByRole("tab", { name: "Workflows" }).click();
      const mailMergeCard = page.locator("[data-slot='card']").filter({ hasText: "Serienbriefe & Mailings" }).first();
      await mailMergeCard.getByRole("button", { name: /Öffnen/i }).click();
      const download = page.waitForEvent("download");
      await mailMergeCard.getByRole("button", { name: "Alle" }).click();
      await mailMergeCard.getByRole("button", { name: /Dokumente erzeugen/i }).click();
      const file = await download;
      expect(await file.suggestedFilename()).toMatch(/Serienbrief-.*\.pdf/);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });
});
