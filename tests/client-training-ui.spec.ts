import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The logging path through the training module.
 *
 * The arithmetic is covered by client-training.spec.ts; what this walks is the
 * part that decides whether the module gets used at all — how many taps a set
 * costs when you are standing in a gym holding a phone.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "test@prodi.local";
const TITLE = "Oberkörper UI";

// One set of fixtures, and the first test writes to it. Keep them in order.
test.describe.configure({ mode: "serial" });

let userId: string;
let pastSessionId: string;
let todaySessionId: string;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function createSession(date: string, durationMinutes: number | null) {
  const { data, error } = await admin
    .from("client_workout_sessions")
    .insert({
      client_user_id: userId,
      session_date: date,
      title: TITLE,
      duration_minutes: durationMinutes,
      activity_kind: durationMinutes ? "kraft" : null,
      intensity: durationMinutes ? "moderat" : null,
      body_weight_kg: durationMinutes ? 80 : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  userId = user.id;

  pastSessionId = await createSession(isoDaysAgo(7), 55);
  const { error: setError } = await admin.from("client_workout_sets").insert(
    [1, 2, 3].map((index) => ({
      session_id: pastSessionId,
      client_user_id: userId,
      exercise_name: "Bankdrücken UI",
      set_index: index,
      reps: 8,
      weight_kg: 60,
    })),
  );
  if (setError) throw new Error(setError.message);

  todaySessionId = await createSession(isoDaysAgo(0), null);
});

test.afterAll(async () => {
  await admin
    .from("client_workout_sessions")
    .delete()
    .in("id", [pastSessionId, todaySessionId]);
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "prodi_mode", value: "client", domain: "localhost", path: "/" },
  ]);
});

test("a repeated session offers last time's exercises and prefills them", async ({ page }) => {
  await page.goto("/klient/training");

  const today = page.locator("[data-slot=card]").filter({ hasText: TITLE }).first();
  await expect(today.getByText("Noch keine Sätze.")).toBeVisible();

  // Nothing is stored for this: the chip is read back out of the last session
  // that carried the same title.
  await today.getByRole("button", { name: "Bankdrücken UI" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Bankdrücken UI · Satz 1/ })).toBeVisible();
  await expect(dialog.getByLabel("Wiederholungen")).toHaveValue("8");
  await expect(dialog.getByLabel("Gewicht (kg)")).toHaveValue("60");
  await expect(dialog.getByText("3 × 8 × 60 kg")).toBeVisible();

  // The gym path: the numbers are already right, so the set is one tap.
  await dialog.getByRole("button", { name: "Speichern & weiter" }).click();

  await expect(dialog.getByRole("heading", { name: /Satz 2/ })).toBeVisible();
  await expect(dialog.getByLabel("Gewicht (kg)")).toHaveValue("60");

  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(today.getByText("8 × 60 kg")).toBeVisible();
  // The rest timer lives behind the dialog's overlay, so it only becomes
  // reachable — to a screen reader as much as to this test — once it closes.
  await expect(page.getByRole("status")).toContainText("Pause");
});

test("a session with a duration shows what it cost", async ({ page }) => {
  await page.goto("/klient/training");

  const past = page
    .locator("[data-slot=card]")
    .filter({ hasText: TITLE })
    .filter({ hasText: "55 min" })
    .first();

  // 80 kg, 55 min, moderate resistance work at 3.5 MET, net of resting
  // metabolism: (3.5 − 1) × 3.5 × 80 × 55 / 200 ≈ 193 kcal.
  await expect(past.getByText(/≈ 193 kcal/)).toBeVisible();
  await expect(past.getByText("Krafttraining")).toBeVisible();
});

test("an exercise opens its own history", async ({ page }) => {
  await page.goto("/klient/training");

  await page.getByRole("button", { name: /Bankdrücken UI/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Bankdrücken UI" })).toBeVisible();
  await expect(dialog.getByText(/Sätze in .* Einheit/)).toBeVisible();
  // The measure toggle is a single-choice group, so its items are radios.
  await expect(dialog.getByRole("radio", { name: "Volumen" })).toBeVisible();
});
