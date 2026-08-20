import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The comparison, as it reaches a person.
 *
 * The arithmetic is pinned in client-checkin.spec.ts. What matters here is
 * what the screen is willing to claim: that a thin bucket keeps its row and
 * loses its number, that a comparison below the floor of paired days says how
 * far off it is instead of guessing, and that every comparison carries the
 * line about cause. Those three are the difference between an evaluation tool
 * and a machine for producing convictions.
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

/** Energy groups into 1–2 / 3 / 4–5; sleep is what gets averaged. */
const SEED: { offset: number; energy: number; sleepMinutes: number }[] = [
  ...Array.from({ length: 8 }, (_, index) => ({
    offset: index + 2,
    energy: 1,
    sleepMinutes: 300,
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    offset: index + 12,
    energy: 3,
    sleepMinutes: 450,
  })),
  // Two good days: under the bucket's floor of three, so it keeps its row and
  // loses its number. The gaps between the blocks are deliberate — they are
  // what makes a shift cost pairs.
  ...Array.from({ length: 2 }, (_, index) => ({
    offset: index + 24,
    energy: 5,
    sleepMinutes: 480,
  })),
];

async function seed(rows: typeof SEED) {
  if (rows.length === 0) return;
  const { error } = await admin.from("client_daily_checkins").insert(
    rows.map((row) => ({
      client_user_id: userId,
      checkin_date: isoDaysAgo(row.offset),
      energy: row.energy,
      sleep_minutes: row.sleepMinutes,
    })),
  );
  if (error) throw new Error(error.message);
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
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "prodi_mode", value: "client", domain: "localhost", path: "/" },
  ]);
});

test("below the floor of paired days it says how far off it is", async ({ page }) => {
  await seed(SEED.slice(0, 6));

  await page.goto("/klient/statistik");
  const card = page.locator("[data-slot=card]").filter({ hasText: "Zusammenhänge" });

  await expect(card.getByText(/brauchst du 14 Tage/)).toBeVisible();
  // Nothing else: no buckets, no chart, no hedged number.
  await expect(card.getByText("Zusammenhang, keine Ursache.")).toHaveCount(0);
});

test("with enough days it groups them and averages the second metric", async ({ page }) => {
  await seed(SEED.slice(6));

  await page.goto("/klient/statistik");
  const card = page.locator("[data-slot=card]").filter({ hasText: "Zusammenhänge" });

  await expect(card.getByText("20 mit beiden Werten")).toBeVisible();

  // Eight days rated 1–2, all on five hours of sleep.
  const low = card.locator("[data-bucket='1–2']");
  await expect(low).toContainText("5:00 h");
  await expect(low).toContainText("n=8");

  const middle = card.locator("[data-bucket='3']");
  await expect(middle).toContainText("7:30 h");
  await expect(middle).toContainText("n=10");
});

test("a bucket with too few days keeps its row and loses its number", async ({ page }) => {
  await page.goto("/klient/statistik");
  const card = page.locator("[data-slot=card]").filter({ hasText: "Zusammenhänge" });

  const thin = card.locator("[data-bucket='4–5']");
  // Drawn, because a hidden bucket is a lie about the shape of the window.
  await expect(thin).toContainText("n=2");
  await expect(thin).toContainText("zu wenige");
});

test("every comparison carries the line about cause, and nothing ranks itself", async ({
  page,
}) => {
  await page.goto("/klient/statistik");
  const card = page.locator("[data-slot=card]").filter({ hasText: "Zusammenhänge" });

  await expect(card.getByText("Zusammenhang, keine Ursache.")).toBeVisible();
  // The words this surface must never use about its own output.
  await expect(card).not.toContainText(/signifikant/i);
  await expect(card).not.toContainText(/stärkster Zusammenhang/i);
  await expect(card).not.toContainText(/du solltest/i);
});

test("the offset is stated as a sentence and changes what is compared", async ({ page }) => {
  await page.goto("/klient/statistik");
  const card = page.locator("[data-slot=card]").filter({ hasText: "Zusammenhänge" });

  await expect(card.getByText(/am selben Tag/)).toBeVisible();

  // Radix puts role=slider on the thumb, which carries no label of its own —
  // the visible "Versatz" line above it is what names the control.
  const slider = card.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await slider.press("ArrowRight");

  // The wording says what is being held against what, rather than "+2".
  await expect(card.getByText(/2 Tage vorher →/)).toBeVisible();
  // Shifting drops the pairs at the edge; the seeded days sit in blocks, so
  // the count has to fall — here from 20 to the 14 that are still paired.
  await expect(card.getByText("14 mit beiden Werten")).toBeVisible();
});
