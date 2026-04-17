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
  const { error } = await admin.from("patients").delete().eq("id", patientId);
  if (error) {
    throw new Error(error.message);
  }
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

  test("creates a new patient", async ({ page }) => {
    await page.goto("/patienten/neu");
    await expect(page.getByRole("heading", { name: "Neuer Patient" })).toBeVisible();

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

  test("views patient detail with tabs", async ({ page }) => {
    const patient = await createPatientFixture({
      firstName: "Detail",
      lastName: "Patient",
      indication: "Adipositas",
      insuranceProvider: "AOK Bayern",
    });

    try {
      await openPatientDetail(page, patient);

      await expect(page.getByRole("tab", { name: "Stammdaten" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Anthropometrie" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Protokolle" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Beratungen" })).toBeVisible();
      await expect(page.getByText(patient.insuranceProvider ?? "")).toBeVisible();
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
    } finally {
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
