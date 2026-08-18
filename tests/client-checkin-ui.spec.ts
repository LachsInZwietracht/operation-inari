import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The path that decides whether any of this is ever filled in.
 *
 * The arithmetic lives in client-checkin.spec.ts and the permissions in
 * client-checkin-rls.spec.ts. What is walked here is the ten seconds a person
 * actually spends on it: tap a score, have it still be there tomorrow, fill in
 * a day that was missed, and switch off a field that does not apply to them
 * without losing what they already answered.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "test@prodi.local";

test.describe.configure({ mode: "serial" });

let userId: string;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const TODAY = isoDaysAgo(0);
const BACKFILL_DATE = isoDaysAgo(6);

/** The save is debounced, so the assertion waits for the write, not a clock. */
async function scoreAndWait(page: Page, label: string, step: number, max: number) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/client_daily_checkins") && response.request().method() === "POST",
    ),
    page.getByRole("button", { name: `${label}: ${step} von ${max}` }).click(),
  ]);
}

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  userId = user.id;

  await admin.from("client_daily_checkins").delete().eq("client_user_id", userId);
  await admin.from("client_metric_preferences").delete().eq("client_user_id", userId);
});

test.afterAll(async () => {
  await admin.from("client_daily_checkins").delete().eq("client_user_id", userId);
  await admin.from("client_metric_preferences").delete().eq("client_user_id", userId);
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "prodi_mode", value: "client", domain: "localhost", path: "/" },
  ]);
});

test("a tapped score is still there after a reload", async ({ page }) => {
  await page.goto("/klient");

  const question = page.getByText("Wie ging es dir heute?");
  await expect(question).toBeVisible();

  await scoreAndWait(page, "Wie ging es dir heute?", 7, 10);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Wie ging es dir heute?: 7 von 10" }),
  ).toHaveAttribute("aria-pressed", "true");

  const { data } = await admin
    .from("client_daily_checkins")
    .select("wellbeing")
    .eq("client_user_id", userId)
    .eq("checkin_date", TODAY)
    .single();
  expect(data!.wellbeing).toBe(7);
});

test("the question is asked before the day's numbers, not next to them", async ({ page }) => {
  await page.goto("/klient");

  const question = page.getByText("Wie ging es dir heute?");
  const totals = page.getByText("Tagesbilanz").or(page.getByText("kcal").first());
  await expect(question).toBeVisible();
  await expect(totals.first()).toBeVisible();

  const questionBox = await question.boundingBox();
  const totalsBox = await totals.first().boundingBox();

  // Someone who reads their kcal balance first ends up rating the balance
  // instead of the day, so the placement is a claim worth pinning.
  expect(questionBox!.y).toBeLessThan(totalsBox!.y);
});

test("a missed day can be filled in later, without limit", async ({ page }) => {
  await page.goto(`/klient?datum=${BACKFILL_DATE}`);

  await scoreAndWait(page, "Wie ging es dir heute?", 4, 10);

  const { data } = await admin
    .from("client_daily_checkins")
    .select("checkin_date,wellbeing")
    .eq("client_user_id", userId)
    .order("checkin_date", { ascending: true });

  // Two separate days, and the older one did not overwrite today.
  expect(data).toHaveLength(2);
  expect(data![0]).toMatchObject({ checkin_date: BACKFILL_DATE, wellbeing: 4 });
  expect(data![1]).toMatchObject({ checkin_date: TODAY, wellbeing: 7 });
});

test("a field switched off disappears but keeps what it already holds", async ({ page }) => {
  await page.goto("/klient/einstellungen");

  const digestion = page.getByRole("switch", { name: "Verdauung tracken" });
  await expect(digestion).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/rest/v1/client_metric_preferences"),
    ),
    digestion.click(),
  ]);

  await page.goto("/klient");
  await page.getByRole("button", { name: "Genauer" }).click();
  await scoreAndWait(page, "Verdauung", 5, 5);

  await page.goto("/klient/einstellungen");
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/rest/v1/client_metric_preferences"),
    ),
    page.getByRole("switch", { name: "Verdauung tracken" }).click(),
  ]);

  await page.goto("/klient");
  await expect(page.getByText("Wie ging es dir heute?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verdauung: 5 von 5" })).toHaveCount(0);

  // Hidden, not deleted. Switching it back on has to reveal a history, and a
  // preference toggle is the wrong place to throw data away.
  const { data } = await admin
    .from("client_daily_checkins")
    .select("digestion")
    .eq("client_user_id", userId)
    .eq("checkin_date", TODAY)
    .single();
  expect(data!.digestion).toBe(5);
});
