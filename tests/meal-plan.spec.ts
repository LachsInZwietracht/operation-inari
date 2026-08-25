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

function addIsoDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
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

  test("keeps the mobile meal workspace primary and tools one action away", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const planDate = uniquePlannerDate(125);
    const patient = await createPatientFixture("Plan", "Mobile");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);

      await expect(page.getByRole("cell", { name: /Frühstück/ }).first()).toBeInViewport();
      await expect(page.getByRole("button", { name: "Bibliothek", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Bilanz öffnen" })).toBeVisible();

      await page.getByRole("button", { name: "Bibliothek", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Bibliothek" })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Bilanz öffnen" }).click();
      await expect(page.getByRole("dialog", { name: "Tagesbilanz" })).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("opens a selected week day in the day view", async ({ page }) => {
    const planDate = uniquePlannerDate(250);
    const patient = await createPatientFixture("Plan", "WeekToDay");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      await page.getByRole("tab", { name: "Woche" }).click();

      const dayHeaders = page.getByRole("button", { name: /mit Doppelklick in Tagesansicht öffnen$/ });
      await expect(dayHeaders).toHaveCount(7);
      const targetDay = dayHeaders.nth(1);
      const targetLabel = (await targetDay.getAttribute("aria-label"))?.replace(
        " mit Doppelklick in Tagesansicht öffnen",
        "",
      );
      if (!targetLabel) throw new Error("Weekday header is missing its accessible date label");

      // A single click must not unexpectedly leave the week. The deliberate
      // double click opens the contextual day workspace.
      await targetDay.click();
      await expect(page.getByRole("tab", { name: "Woche" })).toHaveAttribute("data-state", "active");
      await targetDay.dblclick();

      await expect(page.getByRole("tab", { name: "Tag" })).toHaveAttribute("data-state", "active");
      await expect(page.getByRole("button", { name: targetLabel, exact: true })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("switches patient context from the header patient selector", async ({ page }) => {
    const planDate = uniquePlannerDate(500);
    const firstPatient = await createPatientFixture("Plan", "SelectorA");
    const secondPatient = await createPatientFixture("Plan", "SelectorB");

    try {
      await page.goto(`/ernaehrungsplan?patientId=${firstPatient.id}&date=${planDate}`);

      const selector = page.getByRole("combobox", { name: "Patient" });
      await expect(selector).toContainText(firstPatient.lastName);

      await selector.click();
      await page.getByRole("option", { name: new RegExp(secondPatient.lastName) }).click();

      await expect(page).toHaveURL(new RegExp(`/ernaehrungsplan\\?date=${planDate}&patientId=${secondPatient.id}`));
      await expect(selector).toContainText(secondPatient.lastName);
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
      const exportDialog = page.getByRole("dialog", { name: "Ernährungsplan exportieren" });
      await exportDialog.getByRole("radio", { name: /Klinischer Bericht/ }).click();
      const pdfDownload = page.waitForEvent("download");
      await exportDialog.getByRole("button", { name: "PDF exportieren" }).click();
      const pdf = await pdfDownload;

      expect(await pdf.suggestedFilename()).toMatch(/ernaehrungsplan-klinik-.*\.pdf/);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("keeps JSON exchange behind export and the template library", async ({ page }) => {
    const planDate = uniquePlannerDate(2250);
    const patient = await createPatientFixture("Plan", "JsonExchange");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);

      await expect(page.getByRole("button", { name: "Aus Vorlage" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Plan-Datei", exact: true })).toHaveCount(0);

      await page.getByRole("button", { name: "Export" }).click();
      const exportDialog = page.getByRole("dialog", { name: "Ernährungsplan exportieren" });
      await exportDialog.getByRole("radio", { name: /Inari-Plan-Datei/ }).click();
      const jsonDownload = page.waitForEvent("download");
      await exportDialog.getByRole("button", { name: "JSON exportieren" }).click();
      const json = await jsonDownload;
      expect(await json.suggestedFilename()).toBe(`inari-plan-${planDate}.json`);

      await page.getByRole("button", { name: "Vorlagen", exact: true }).click();
      await page.getByRole("button", { name: "Plan-Datei importieren" }).click();
      await expect(page.getByRole("dialog", { name: "Plan-Datei importieren" })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("releases a plan and starts later changes as a separate draft", async ({ page }) => {
    const planDate = uniquePlannerDate(2750);
    const patient = await createPatientFixture("Plan", "Release");
    const title = `Freigabe ${Math.random().toString(36).slice(2, 8)}`;
    let foodId: string | null = null;

    try {
      const userId = await getTestUserId();
      const { data: food, error: foodError } = await admin
        .from("foods")
        .insert({
          name: "Freigabe Testlebensmittel",
          data_source_id: "bls",
          source_food_id: `release-${Math.random().toString(36).slice(2, 10)}`,
        })
        .select("id")
        .single();
      if (foodError) throw new Error(foodError.message);
      foodId = food.id;

      const { data: plan, error: planError } = await admin
        .from("daily_meal_plans")
        .insert({
          user_id: userId,
          patient_id: patient.id,
          date: planDate,
          title,
          status: "draft",
        })
        .select("id")
        .single();
      if (planError) throw new Error(planError.message);

      const { error: entryError } = await admin.from("meal_entries").insert({
        meal_plan_id: plan.id,
        slot_type: "fruehstueck",
        entry_type: "food",
        reference_id: food.id,
        amount: 100,
        sort_order: 0,
      });
      if (entryError) throw new Error(entryError.message);

      await page.goto(`/patienten/${patient.id}?tab=ernaehrungsplan`);
      await page.getByRole("button", { name: "Aktuellen Plan öffnen" }).click();
      await page.getByRole("tab", { name: "Planstände" }).click();

      const draftCard = page.locator("[data-slot='card']").filter({ hasText: title }).first();
      await draftCard.getByRole("button", { name: "Tag freigeben" }).click();
      const releaseDialog = page.getByRole("alertdialog");
      await releaseDialog.getByRole("button", { name: "Verbindlich freigeben" }).click();

      await expect(draftCard.getByText("Freigegeben", { exact: true })).toBeVisible();
      await draftCard.getByRole("button", { name: "Änderung beginnen" }).click();
      await expect(page.getByRole("tab", { name: "Woche" })).toHaveAttribute("data-state", "active");

      await page.getByRole("tab", { name: "Planstände" }).click();
      await expect(page.getByText("Änderungsentwurf", { exact: true })).toBeVisible();
      await expect(page.getByText("Freigegeben", { exact: true })).toBeVisible();
    } finally {
      await deletePatientFixture(patient.id);
      if (foodId) await admin.from("foods").delete().eq("id", foodId);
    }
  });

  test("fortschreibt the visible patient week as independent future drafts", async ({ page }) => {
    const patient = await createPatientFixture("Plan", "Fortschreiben");
    const userId = await getTestUserId();
    const sourceDate = uniquePlannerDate(2875);
    const title = `Wochenfortschreibung ${Math.random().toString(36).slice(2, 8)}`;

    try {
      const { error: planError } = await admin.from("daily_meal_plans").insert({
        user_id: userId,
        patient_id: patient.id,
        date: sourceDate,
        title,
        status: "draft",
      });
      if (planError) throw new Error(planError.message);

      await page.goto(`/patienten/${patient.id}?tab=ernaehrungsplan`);
      await page.getByRole("button", { name: "Aktuellen Plan öffnen" }).click();
      await page.getByRole("tab", { name: "Planstände" }).click();
      await page.locator("[data-slot='card']").filter({ hasText: title }).first().getByRole("button", { name: "Öffnen" }).click();

      await page.getByRole("button", { name: "Woche fortschreiben" }).click();
      const dialog = page.getByRole("dialog", { name: "Woche fortschreiben" });
      const targetWeekStart = await dialog.getByLabel("Zielwoche").inputValue();
      await dialog.getByRole("button", { name: "Woche fortschreiben" }).click();
      await expect(page.getByText("7 Tagesentwürfe fortgeschrieben.")).toBeVisible({ timeout: 20_000 });

      await expect.poll(async () => {
        const { data, error } = await admin
          .from("daily_meal_plans")
          .select("date")
          .eq("patient_id", patient.id)
          .gte("date", targetWeekStart)
          .lte("date", addIsoDays(targetWeekStart, 6));
        if (error) throw new Error(error.message);
        return data ?? [];
      }, { timeout: 20_000 }).toHaveLength(7);

      const { data: copiedPlans, error: copiedPlansError } = await admin
        .from("daily_meal_plans")
        .select("status,approved_at,approved_by,revision_number,supersedes_plan_id,replaced_at")
        .eq("patient_id", patient.id)
        .gte("date", targetWeekStart)
        .lte("date", addIsoDays(targetWeekStart, 6));
      if (copiedPlansError) throw new Error(copiedPlansError.message);
      expect(copiedPlans).toHaveLength(7);
      for (const copiedPlan of copiedPlans ?? []) {
        expect(copiedPlan).toMatchObject({
          status: "draft",
          approved_at: null,
          approved_by: null,
          revision_number: 1,
          supersedes_plan_id: null,
          replaced_at: null,
        });
      }
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("does not describe an empty day as being within all targets", async ({ page }) => {
    const planDate = uniquePlannerDate(3000);
    const patient = await createPatientFixture("Plan", "EmptyTargets");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);

      const assistant = page
        .locator("[data-slot='card']")
        .filter({ hasText: "Vorschläge zum Auffüllen" })
        .first();
      await expect(assistant).toBeVisible();
      await expect(assistant).not.toContainText("Alle Zielwerte im Bereich");
      await expect(assistant).toContainText(/Offene Zielwerte erkannt|Noch keine Zielwerte hinterlegt/);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  /**
   * Held open on purpose: the feature itself cannot currently produce a
   * suggestion. `usePlanAnalysis` ranks candidates out of the planner's `foods`
   * array, but `app/(app)/ernaehrungsplan/page.tsx` only hydrates the foods the
   * active day already references — and those are excluded as duplicates. The
   * card therefore always reads "Alle Zielwerte im Bereich". Deleting this test
   * would bury that; it stays until the optimizer gets a real catalog source,
   * the way the Nährstoff-Lückenfüller queries `/api/foods/browser`.
   */
  test.fixme("applies a nutrient optimization suggestion", async ({ page }) => {
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
});
