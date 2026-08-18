import { expect, test } from "@playwright/test";
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

/**
 * A patient whose strategy is fully specified, so the view has something to
 * show in every section: goal text, target numbers, and a frame.
 */
async function createStrategyPatient() {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: "Strategie",
      last_name: `Test ${suffix}`,
      date_of_birth: "1985-04-12",
      gender: "w",
      indications: ["Adipositas"],
      insurance_number: `STRAT-${suffix}`,
      daily_calorie_goal: 2000,
      goal_weight: 72,
      macro_preset: "balanced",
      diet_style: "vegetarisch",
      nutrition_preferences: ["no_alcohol"],
      patient_goals: "Ziel: Abnehmen bis zur Reha im Frühjahr.",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function deletePatient(patientId: string) {
  await admin.from("patients").delete().eq("id", patientId);
}

test.describe("Ernährungsplan strategy view", () => {
  let patientId: string;

  test.beforeEach(async () => {
    patientId = await createStrategyPatient();
  });

  test.afterEach(async () => {
    if (patientId) await deletePatient(patientId);
  });

  test("shows goal, targets and frame, and derives macro grams", async ({ page }) => {
    await page.goto(`/ernaehrungsplan?patientId=${patientId}`);
    await page.getByRole("tab", { name: "Strategie" }).click();

    await expect(
      page.getByText("Ziel: Abnehmen bis zur Reha im Frühjahr."),
    ).toBeVisible();
    await expect(page.getByText("72 kg")).toBeVisible();
    await expect(page.getByText("Adipositas").first()).toBeVisible();

    await expect(page.locator("#strategy-kcal")).toHaveValue("2000");

    // 2000 kcal on the balanced split: 20 % protein, 50 % carbs, 30 % fat.
    await expect(page.getByTestId("strategy-macro-Eiweiß")).toContainText("100 g");
    await expect(page.getByTestId("strategy-macro-Kohlenhydrate")).toContainText("250 g");
    await expect(page.getByTestId("strategy-macro-Fett")).toContainText("67 g");

    await expect(page.getByText("Vegetarisch", { exact: true })).toBeVisible();
    await expect(page.getByText("Kein Alkohol", { exact: true })).toBeVisible();
  });

  test("saves an edited calorie target to the patient record", async ({ page }) => {
    await page.goto(`/ernaehrungsplan?patientId=${patientId}`);
    await page.getByRole("tab", { name: "Strategie" }).click();

    const input = page.locator("#strategy-kcal");
    await expect(input).toHaveValue("2000");
    await input.fill("1800");
    await input.blur();

    await expect(page.getByText("Strategie gespeichert.")).toBeVisible();
    // The derived protein target follows the new energy budget immediately.
    await expect(page.getByTestId("strategy-macro-Eiweiß")).toContainText("90 g");

    const { data } = await admin
      .from("patients")
      .select("daily_calorie_goal")
      .eq("id", patientId)
      .single();
    expect(data?.daily_calorie_goal).toBe(1800);
  });

  test("clamps an implausible calorie target into the allowed range", async ({ page }) => {
    await page.goto(`/ernaehrungsplan?patientId=${patientId}`);
    await page.getByRole("tab", { name: "Strategie" }).click();

    const input = page.locator("#strategy-kcal");
    await input.fill("99999");
    await input.blur();

    await expect(input).toHaveValue("6000");
  });

  test("leads from the strategy into the day plan", async ({ page }) => {
    await page.goto(`/ernaehrungsplan?patientId=${patientId}`);
    await page.getByRole("tab", { name: "Strategie" }).click();

    await page.getByRole("button", { name: "Zum Tagesplan" }).click();

    await expect(page.getByRole("tab", { name: "Tag" })).toHaveAttribute(
      "data-state",
      "active",
    );
    // The day view keeps the strategy in sight rather than floating free of it.
    await expect(page.getByRole("button", { name: /Strategie: 2\.000 kcal/ })).toBeVisible();
  });
});
