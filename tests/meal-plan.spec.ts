import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function createPatientFixture(firstName: string, lastName: string) {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: `${lastName} ${suffix}`,
      date_of_birth: "1990-01-01",
      gender: "w",
      indications: ["Adipositas"],
      insurance_number: `PLAN-${suffix}`,
    })
    .select("id, first_name, last_name")
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
  };
}

async function deletePatientFixture(patientId: string) {
  await admin.from("patients").delete().eq("id", patientId);
}

function uniquePlannerDate(offset = 0) {
  const seed = Date.now() + offset;
  const year = 2040 + (seed % 40);
  const month = String((Math.floor(seed / 40) % 12) + 1).padStart(2, "0");
  const day = String((Math.floor(seed / 480) % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The planner only renders meal slots once a patient is selected, so every
 * test opens the page with an explicit patientId and a fresh plan date.
 */
async function openPlannerWithFreshPlan(page: Page, patientId: string, planDate: string) {
  await page.goto(`/ernaehrungsplan?patientId=${patientId}&date=${planDate}`);
  await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
  await page.reload();
}

async function addFoodEntry(page: Page, query = "Hafer") {
  // First add-row in the day workspace table belongs to Frühstück.
  await page
    .getByRole("button", { name: /Lebensmittel oder Rezept hinzufügen/i })
    .first()
    .click();
  const searchInput = page.locator("[cmdk-input]");
  await expect(searchInput).toBeVisible();
  await searchInput.fill(query);

  const option = page.getByRole("option").filter({ hasText: new RegExp(query, "i") }).first();
  await option.click();
  try {
    // Selecting hydrates the food from Supabase before the dialog closes.
    await expect(searchInput).toBeHidden({ timeout: 10_000 });
  } catch {
    // The result list can re-render mid-click and swallow the selection — retry once.
    await option.click();
    await expect(searchInput).toBeHidden({ timeout: 15_000 });
  }

  // The entry must land in the Frühstück section of the day table.
  await expect(
    page
      .locator("tbody")
      .filter({ hasText: "Frühstück" })
      .first()
      .getByText(new RegExp(query, "i"))
      .first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Ernährungsplan", () => {
  test.setTimeout(60_000);

  test("displays meal slots and allows date navigation", async ({ page }) => {
    const patient = await createPatientFixture("Plan", "Slots");

    try {
      await page.goto(`/ernaehrungsplan?patientId=${patient.id}`);

      await expect(page.locator("main").getByRole("heading", { name: "Ernährungsplan" })).toBeVisible();

      // Should show the meal sections of the day workspace table
      await expect(page.getByRole("cell", { name: /Frühstück/ }).first()).toBeVisible();
      await expect(page.getByRole("cell", { name: /Mittagessen/ }).first()).toBeVisible();
      await expect(page.getByRole("cell", { name: /Abendessen/ }).first()).toBeVisible();

      // Just verify date is displayed (any German date format)
      await expect(page.locator("text=/\\d{1,2}\\./").first()).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("switches patient context from the Planakte patient selector", async ({ page }) => {
    const planDate = uniquePlannerDate(500);
    const firstPatient = await createPatientFixture("Plan", "SelectorA");
    const secondPatient = await createPatientFixture("Plan", "SelectorB");

    try {
      await page.goto(`/ernaehrungsplan?patientId=${firstPatient.id}&date=${planDate}`);

      const planRecord = page.locator("[data-slot='card']").filter({ hasText: "Planakte" }).first();
      await expect(planRecord.getByText(`${firstPatient.firstName} ${firstPatient.lastName}`).first()).toBeVisible();

      await planRecord.getByRole("combobox", { name: "Patient" }).click();
      await page.getByRole("option", { name: new RegExp(secondPatient.lastName) }).click();

      await expect(page).toHaveURL(new RegExp(`/ernaehrungsplan\\?date=${planDate}&patientId=${secondPatient.id}`));
      await expect(planRecord.getByText(`${secondPatient.firstName} ${secondPatient.lastName}`).first()).toBeVisible();
    } finally {
      await deletePatientFixture(firstPatient.id);
      await deletePatientFixture(secondPatient.id);
    }
  });

  test("adds food entry to a meal slot", async ({ page }) => {
    const planDate = uniquePlannerDate(1000);
    const patient = await createPatientFixture("Plan", "Entry");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      await addFoodEntry(page);

      // The Supabase sync runs in the background — wait for the plan row
      // before wiping localStorage, otherwise the reload races the write.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from("daily_meal_plans")
              .select("id")
              .eq("patient_id", patient.id)
              .eq("date", planDate);
            return (data ?? []).length;
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThan(0);

      await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
      await page.reload();

      await expect(page.getByText(/Hafer/i).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("exports the current plan as a clinical PDF", async ({ page }) => {
    const planDate = uniquePlannerDate(2000);
    const patient = await createPatientFixture("Plan", "Export");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      await addFoodEntry(page);

      await page.getByRole("button", { name: "Export" }).click();
      const pdfDownload = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: /Klinischer Bericht/ }).click();
      const pdf = await pdfDownload;

      expect(await pdf.suggestedFilename()).toMatch(/ernaehrungsplan-klinik-.*\.pdf/);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("stores a manual checkpoint in the version history", async ({ page }) => {
    const planDate = uniquePlannerDate(3000);
    const patient = await createPatientFixture("Plan", "Checkpoint");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      await addFoodEntry(page);

      const planRecord = page.locator("[data-slot='card']").filter({ hasText: "Planakte" }).first();
      await planRecord.getByRole("button", { name: "Checkpoint speichern" }).click();

      await expect(planRecord.getByText("Version 1")).toBeVisible({ timeout: 30_000 });
      await expect(planRecord.getByText(/Einträge · Checkpoint/)).toBeVisible();
      await expect(planRecord.getByRole("button", { name: "Wiederherstellen" }).first()).toBeEnabled();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("applies a nutrient optimization suggestion", async ({ page }) => {
    const planDate = uniquePlannerDate(3500);
    const patient = await createPatientFixture("Plan", "Optimize");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      await addFoodEntry(page);

      const assistant = page.locator("[data-slot='card']").filter({ hasText: "Vorschläge zum Auffüllen" }).first();
      await expect(assistant).toBeVisible();
      await expect(assistant.getByRole("button", { name: "Übernehmen" }).first()).toBeVisible({ timeout: 30_000 });
      await assistant.getByRole("button", { name: "Übernehmen" }).first().click();

      await expect(page.getByText(/vorgemerkt/)).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("creates an immutable version when a plan is approved", async ({ page }) => {
    const planDate = uniquePlannerDate(4000);
    const patient = await createPatientFixture("Plan", "Approve");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      await addFoodEntry(page);

      const planRecord = page.locator("[data-slot='card']").filter({ hasText: "Planakte" }).first();
      await planRecord.getByRole("button", { name: "Freigeben" }).click();

      await expect(planRecord.getByText("Bearbeitung gesperrt")).toBeVisible({ timeout: 15_000 });
      await expect(planRecord.getByText("Version 1")).toBeVisible({ timeout: 30_000 });
      await expect(planRecord.getByRole("button", { name: "Wiederherstellen" }).first()).toBeDisabled();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });
});
