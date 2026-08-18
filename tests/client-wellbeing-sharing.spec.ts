import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * What the counselor actually gets, and what they never do.
 *
 * The per-metric switch only means something if the read path honours it, and
 * the read path is a single function. Three gates have to hold independently:
 * the consent flag on the link, the per-metric `shared` switch, and the link
 * still being active. Each one is asserted alone, because a function that
 * checks two of three would pass a naive test and leak in production.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "prodi-test-passwort-2026";

type TestUser = { id: string; email: string };
type SeriesRow = { checkin_date: string; metric_key: string; value: number | string };

async function createUser(label: string): Promise<TestUser> {
  const email = `wellbeing-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
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

test.describe("what a counselor may read from the check-in", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;
  let linkId: string;

  async function readSeries(user: TestUser): Promise<SeriesRow[]> {
    const client = await signedInClient(user);
    const { data, error } = await client.rpc("client_wellbeing_series", {
      target_patient: patientId,
      from_date: "2026-08-01",
      to_date: "2026-08-31",
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as SeriesRow[];
  }

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Freigabe",
        last_name: `Test ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1990-01-01",
        gender: "m",
      })
      .select("id")
      .single();
    if (patientError) throw new Error(patientError.message);
    patientId = patient.id;

    // Starts with the consent OFF, so the first assertion is the closed door.
    const { data: link, error: linkError } = await admin
      .from("client_links")
      .insert({
        patient_id: patientId,
        counselor_user_id: counselor.id,
        client_user_id: clientUser.id,
        invite_code: `SHR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        status: "active",
        consent_nutrition: true,
        consent_training: true,
        consent_wellbeing: false,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);
    linkId = link.id;

    await admin.from("client_daily_checkins").insert({
      client_user_id: clientUser.id,
      checkin_date: "2026-08-18",
      wellbeing: 7,
      mood: 2,
      sleep_minutes: 435,
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

  test("without the consent the function returns nothing at all", async () => {
    expect(await readSeries(counselor)).toHaveLength(0);
  });

  test("with the consent it returns the answered metrics, and only those", async () => {
    await admin.from("client_links").update({ consent_wellbeing: true }).eq("id", linkId);

    const rows = await readSeries(counselor);
    const keys = rows.map((row) => row.metric_key).sort();

    expect(keys).toEqual(["mood", "sleep_minutes", "wellbeing"]);
    // Unanswered values never travel — there is no row for them to hide in.
    expect(rows.every((row) => row.value !== null)).toBe(true);
  });

  test("a metric switched off produces no rows while the others still do", async () => {
    await admin.from("client_metric_preferences").insert({
      client_user_id: clientUser.id,
      metric_key: "mood",
      tracked: true,
      shown: true,
      shared: false,
    });

    const keys = (await readSeries(counselor)).map((row) => row.metric_key).sort();

    // Absent, not nulled: long format means an unshared metric has no row to
    // be forgotten and rendered.
    expect(keys).toEqual(["sleep_minutes", "wellbeing"]);
  });

  test("a stranger gets nothing, whatever they pass in", async () => {
    expect(await readSeries(outsider)).toHaveLength(0);
  });

  test("revoking the link stops every read immediately", async () => {
    await admin.from("client_links").update({ status: "revoked" }).eq("id", linkId);
    expect(await readSeries(counselor)).toHaveLength(0);

    // Restored so the state at the end matches what the other tests set up.
    await admin.from("client_links").update({ status: "active" }).eq("id", linkId);
  });
});
