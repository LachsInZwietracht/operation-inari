import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The check-in is the one client table with no counselor read path at all.
 *
 * Everywhere else in client mode a consenting counselor reads the client's
 * rows directly, because consent is per area and an area is a whole table.
 * Here it is per metric, which is column-level, and no row policy can express
 * that. So the policies grant the owner and nobody else, and the counselor's
 * access is a function that emits only what was shared.
 *
 * What this spec pins is the negative: an active link with the wellbeing
 * consent switched on still gets zero rows out of the table itself. If that
 * ever changes, every per-metric switch in the settings quietly stops meaning
 * anything.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "prodi-test-passwort-2026";

type TestUser = { id: string; email: string };

async function createUser(label: string): Promise<TestUser> {
  const email = `checkin-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return { id: data.user.id, email };
}

async function signedInClient(user: TestUser) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
  });
  if (error) throw new Error(error.message);
  return client;
}

test.describe.configure({ mode: "serial" });

test.describe("who may read a check-in", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Befinden",
        last_name: `RLS ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1990-01-01",
        gender: "w",
      })
      .select("id")
      .single();
    if (patientError) throw new Error(patientError.message);
    patientId = patient.id;

    // Consent deliberately switched ON: the point is that it still does not
    // open the table.
    const { error: linkError } = await admin.from("client_links").insert({
      patient_id: patientId,
      counselor_user_id: counselor.id,
      client_user_id: clientUser.id,
      invite_code: `CHK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      status: "active",
      consent_nutrition: true,
      consent_training: true,
      consent_wellbeing: true,
      consented_at: new Date().toISOString(),
    });
    if (linkError) throw new Error(linkError.message);

    await admin.from("client_daily_checkins").insert({
      client_user_id: clientUser.id,
      checkin_date: "2026-08-18",
      energy: 3,
      mood: 4,
      sleep_minutes: 435,
    });

    await admin.from("client_metric_preferences").insert({
      client_user_id: clientUser.id,
      metric_key: "mood",
      tracked: true,
      shown: true,
      shared: false,
    });
  });

  test.afterAll(async () => {
    await admin.from("client_daily_checkins").delete().eq("client_user_id", clientUser.id);
    await admin.from("client_metric_preferences").delete().eq("client_user_id", clientUser.id);
    await admin.from("client_links").delete().eq("patient_id", patientId);
    await admin.from("patients").delete().eq("id", patientId);
    for (const user of [counselor, clientUser, outsider]) {
      await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("the client reads their own day", async () => {
    const client = await signedInClient(clientUser);
    const { data, error } = await client
      .from("client_daily_checkins")
      .select("checkin_date,energy,sleep_minutes");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].energy).toBe(3);
  });

  test("a stranger reads nothing", async () => {
    const client = await signedInClient(outsider);
    const { data } = await client.from("client_daily_checkins").select("energy");
    expect(data ?? []).toHaveLength(0);

    const { data: preferences } = await client
      .from("client_metric_preferences")
      .select("metric_key");
    expect(preferences ?? []).toHaveLength(0);
  });

  test("the consenting counselor reads nothing from the table itself", async () => {
    const client = await signedInClient(counselor);

    // The link is active and consent_wellbeing is true. The table still
    // answers with nothing, because sharing is decided per metric elsewhere.
    const { data } = await client.from("client_daily_checkins").select("energy");
    expect(data ?? []).toHaveLength(0);

    const { data: preferences } = await client
      .from("client_metric_preferences")
      .select("metric_key,shared");
    expect(preferences ?? []).toHaveLength(0);
  });

  test("nobody can park a check-in under someone else's account", async () => {
    const client = await signedInClient(outsider);
    const { error } = await client.from("client_daily_checkins").insert({
      client_user_id: clientUser.id,
      checkin_date: "2026-08-19",
      energy: 1,
    });

    expect(error).not.toBeNull();
  });

  test("the client can correct a day and clear a value back to unanswered", async () => {
    const client = await signedInClient(clientUser);
    const { error } = await client
      .from("client_daily_checkins")
      .update({ energy: 5, mood: null })
      .eq("checkin_date", "2026-08-18");
    expect(error).toBeNull();

    const { data } = await client
      .from("client_daily_checkins")
      .select("energy,mood")
      .eq("checkin_date", "2026-08-18")
      .single();

    expect(data!.energy).toBe(5);
    // Cleared is unanswered, not a low score.
    expect(data!.mood).toBeNull();
  });
});
