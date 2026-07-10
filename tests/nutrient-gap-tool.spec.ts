import { expect, test, type Locator, type Page } from "@playwright/test";
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
      insurance_number: `GAP-${suffix}`,
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

async function openPlannerWithFreshPlan(page: Page, patientId: string, planDate: string) {
  await page.goto(`/ernaehrungsplan?patientId=${patientId}&date=${planDate}`);
  await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
  await page.reload();
}

async function openGapTool(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /Nährstoff-Lückenfüller/ }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Nährstoff-Lückenfüller" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function searchCalciumGap(page: Page, dialog: Locator, amount = "400") {
  await dialog.getByRole("combobox", { name: "Nährstoff" }).click();
  await page.getByRole("option", { name: "Calcium (mg)" }).click();
  await dialog.getByLabel("Fehlmenge").fill(amount);
  await expect(dialog.getByTestId("gap-suggestion").first()).toBeVisible({ timeout: 30_000 });
}

test.describe("Nährstoff-Lückenfüller", () => {
  test.setTimeout(60_000);

  test("ranks foods with the portion that closes the gap", async ({ page }) => {
    const planDate = uniquePlannerDate(6000);
    const patient = await createPatientFixture("Gap", "Ranking");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      const dialog = await openGapTool(page);
      await searchCalciumGap(page, dialog);

      // Every hit shows either the exact gap-closing portion or the capped
      // partial coverage, plus a kcal side-effect chip and an add button.
      await expect(dialog.getByText(/decken die Lücke|deckt \d+ %/).first()).toBeVisible();
      await expect(dialog.getByText(/\+\d+ kcal/).first()).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Übernehmen" }).first()).toBeEnabled();
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("prefills the gap from the daily targets chips", async ({ page }) => {
    const planDate = uniquePlannerDate(6500);
    const patient = await createPatientFixture("Gap", "Chips");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      const dialog = await openGapTool(page);

      // An empty day leaves every micronutrient target open, so the chip
      // section must offer real remaining gaps.
      const calciumChip = dialog.getByRole("button", { name: /Calcium · noch/ }).first();
      await expect(calciumChip).toBeVisible({ timeout: 15_000 });
      await calciumChip.click();

      await expect(dialog.getByLabel("Fehlmenge")).not.toHaveValue("");
      await expect(dialog.getByTestId("gap-suggestion").first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("hard constraint narrows the result list", async ({ page }) => {
    const planDate = uniquePlannerDate(7000);
    const patient = await createPatientFixture("Gap", "Constraint");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      const dialog = await openGapTool(page);
      await searchCalciumGap(page, dialog);

      const firstName = await dialog.getByTestId("gap-suggestion-name").first().innerText();

      // Default constraint row is "Kohlenhydrate ≤ … (hart)" — a near-zero
      // bound must reshuffle or empty the calcium ranking.
      await dialog.getByRole("button", { name: "Bedingung hinzufügen" }).click();
      await dialog.getByPlaceholder("Menge").fill("0,1");

      const emptyState = dialog.getByText("Keine passenden Lebensmittel gefunden", {
        exact: false,
      });
      const changedFirst = dialog
        .getByTestId("gap-suggestion-name")
        .first()
        .filter({ hasNotText: firstName });
      await expect(emptyState.or(changedFirst).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("sorts results by fewest added calories", async ({ page }) => {
    const planDate = uniquePlannerDate(8000);
    const patient = await createPatientFixture("Gap", "Sort");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      const dialog = await openGapTool(page);
      await searchCalciumGap(page, dialog);

      await dialog.getByRole("combobox", { name: "Sortierung" }).click();
      await page.getByRole("option", { name: "Wenigste kcal" }).click();

      await expect(async () => {
        const chips = await dialog.getByTestId("gap-suggestion-kcal").allInnerTexts();
        const kcal = chips
          .slice(0, 5)
          .map((text) => Number(text.replace(/[^\d]/g, "")));
        expect(kcal.length).toBeGreaterThan(1);
        for (let i = 1; i < kcal.length; i++) {
          expect(kcal[i]).toBeGreaterThanOrEqual(kcal[i - 1]);
        }
      }).toPass({ timeout: 15_000 });
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("type filter limits results to foods", async ({ page }) => {
    const planDate = uniquePlannerDate(8500);
    const patient = await createPatientFixture("Gap", "Filter");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      const dialog = await openGapTool(page);
      await searchCalciumGap(page, dialog);

      await dialog.getByRole("radio", { name: "Lebensmittel" }).click();

      await expect(dialog.getByTestId("gap-suggestion").first()).toBeVisible();
      await expect(
        dialog.getByTestId("gap-suggestion-name").filter({ hasText: "Rezept" }),
      ).toHaveCount(0);
    } finally {
      await deletePatientFixture(patient.id);
    }
  });

  test("adds the suggested portion to a meal slot", async ({ page }) => {
    const planDate = uniquePlannerDate(7500);
    const patient = await createPatientFixture("Gap", "Add");

    try {
      await openPlannerWithFreshPlan(page, patient.id, planDate);
      const dialog = await openGapTool(page);
      await searchCalciumGap(page, dialog);

      const foodName = await dialog.getByTestId("gap-suggestion-name").first().innerText();
      await dialog.getByRole("button", { name: "Übernehmen" }).first().click();

      await expect(page.getByText(/vorgemerkt/).first()).toBeVisible({ timeout: 15_000 });

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(
        page
          .locator("tbody")
          .getByText(foodName.slice(0, 20), { exact: false })
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await deletePatientFixture(patient.id);
    }
  });
});
