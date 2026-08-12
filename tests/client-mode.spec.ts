import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * End-to-end walk through client mode: a counselor invites, the client
 * redeems, logs a meal, and the counselor sees it.
 *
 * One account plays both roles. That is not a shortcut — self-linking is
 * supported on purpose, and it keeps the test to a single browser context.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "test@prodi.local";
const FOOD_NAME = "Smoketest Haferflocken";

let patientId: string;
let foodId: string;
let userId: string;

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

test.beforeAll(async () => {
  userId = await getTestUserId();

  const { data: patient, error: patientError } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: "Klientin",
      last_name: `Smoketest ${Math.random().toString(36).slice(2, 6)}`,
      date_of_birth: "1992-03-11",
      gender: "w",
    })
    .select("id")
    .single();
  if (patientError) throw new Error(patientError.message);
  patientId = patient.id;

  // The local stack has no catalog (no ETL), so the diary needs one food to
  // find. Nutrients are per 100 g, matching foods.baseAmount.
  const { data: food, error: foodError } = await admin
    .from("foods")
    .insert({
      name: FOOD_NAME,
      data_source_id: "bls",
      source_food_id: `smoketest-${Date.now()}`,
      category_id: "cat_getreide",
    })
    .select("id")
    .single();
  if (foodError) throw new Error(foodError.message);
  foodId = food.id;

  const { error: nutrientError } = await admin.from("food_nutrients").insert([
    { food_id: foodId, nutrient_id: "energie", amount: 350 },
    { food_id: foodId, nutrient_id: "eiweiss", amount: 13 },
    { food_id: foodId, nutrient_id: "fett", amount: 7 },
    { food_id: foodId, nutrient_id: "kohlenhydrate", amount: 59 },
  ]);
  if (nutrientError) throw new Error(nutrientError.message);
});

test.afterAll(async () => {
  await admin.from("client_food_log_days").delete().eq("client_user_id", userId);
  await admin.from("client_links").delete().eq("patient_id", patientId);
  await admin.from("patients").delete().eq("id", patientId);
  await admin.from("foods").delete().eq("id", foodId);
});

test("counselor invites, client redeems, logs a meal, counselor sees it", async ({ page }) => {
  // The flow crosses four routes; against the dev server each one compiles on
  // first hit, which alone can eat the default 30s budget.
  test.setTimeout(180_000)

  // ── Counselor: create the invite ──────────────────────────────────────────
  await page.goto(`/patienten/${patientId}?tab=klienten-app`);

  await page.getByRole("button", { name: "Klienten-Zugang einladen" }).click();

  const codeField = page.locator("p.font-mono").first();
  await expect(codeField).toBeVisible({ timeout: 15_000 });
  const inviteCode = (await codeField.innerText()).trim();
  expect(inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(page.getByText("Einladung offen")).toBeVisible();

  // ── Client: redeem it ─────────────────────────────────────────────────────
  await page.goto(`/klient/einladung/${inviteCode}`);
  await expect(page.getByText(/Einladung von/)).toBeVisible();

  await page.getByRole("button", { name: "Einladung annehmen" }).click();
  await page.waitForURL("**/klient");

  // ── Client: log a breakfast entry ─────────────────────────────────────────
  const breakfast = page.locator("div").filter({ hasText: /^Frühstück/ }).first();
  await breakfast.getByRole("button", { name: "Hinzufügen" }).click();

  const dialog = page.getByRole("dialog");
  // The dialog opens on "Zuletzt" whenever this account has any history, which
  // depends on what ran before. This test is about searching, so it says so
  // rather than relying on which tab happens to be the default.
  const searchTab = dialog.getByRole("button", { name: "Suche", exact: true });
  if (await searchTab.isVisible().catch(() => false)) await searchTab.click();
  await dialog.getByPlaceholder("Lebensmittel, Rezept oder Mahlzeit").fill("Smoketest Hafer");
  await dialog.getByRole("button", { name: FOOD_NAME }).click({ timeout: 15_000 });

  await dialog.getByLabel("Menge in Gramm").fill("200");
  await dialog.getByRole("button", { name: "Eintragen" }).click();

  await expect(page.getByText(FOOD_NAME)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("200 g")).toBeVisible();

  // 350 kcal per 100 g at 200 g = 700
  await expect(page.getByText("700", { exact: true })).toBeVisible();

  // ── Back to the counselor surface ─────────────────────────────────────────
  await page.getByRole("button", { name: "Zur Beratungs-Ansicht" }).click();
  await page.waitForURL("**/dashboard");

  // ── Counselor: the client's entry is visible ──────────────────────────────
  await page.goto(`/patienten/${patientId}?tab=klienten-app`);
  // Exact, otherwise this also matches the "Verbunden seit …" line.
  await expect(page.getByText("Verbunden", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("1 Eintrag")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("700 kcal")).toBeVisible();
});
