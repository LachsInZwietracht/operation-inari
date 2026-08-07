import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS isolation for client mode.
 *
 * This is the safety net for the client surface: a client's food log is health
 * data, and the only thing standing between two accounts is the policy set in
 * `20260806000072_client_mode.sql`. The test drives Supabase directly instead
 * of the UI, because it is the database rules that must hold.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and creates throwaway users, so point
 * the run at `.env.test`, never at the live project.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "prodi-test-passwort-2026";

interface TestUser {
  id: string;
  email: string;
}

async function createUser(label: string): Promise<TestUser> {
  const email = `client-mode-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return { id: data.user.id, email };
}

/** A client signed in as the given user — subject to RLS, unlike `admin`. */
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

// Shared fixtures, and the last test revokes the link: keep them in one worker.
test.describe.configure({ mode: "serial" });

test.describe("client mode RLS", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;
  let linkId: string;
  let dayId: string;

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Klient",
        last_name: `Test ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1990-01-01",
        gender: "w",
      })
      .select("id")
      .single();
    if (patientError) throw new Error(patientError.message);
    patientId = patient.id;

    const { data: link, error: linkError } = await admin
      .from("client_links")
      .insert({
        patient_id: patientId,
        counselor_user_id: counselor.id,
        client_user_id: clientUser.id,
        invite_code: `T${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        status: "active",
        consent_nutrition: true,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);
    linkId = link.id;

    const { data: day, error: dayError } = await admin
      .from("client_food_log_days")
      .insert({ client_user_id: clientUser.id, log_date: "2026-08-01" })
      .select("id")
      .single();
    if (dayError) throw new Error(dayError.message);
    dayId = day.id;

    const { error: entryError } = await admin.from("client_food_log_entries").insert({
      day_id: dayId,
      client_user_id: clientUser.id,
      slot_type: "fruehstueck",
      source_type: "custom",
      custom_name: "Testeintrag",
      amount: 100,
    });
    if (entryError) throw new Error(entryError.message);
  });

  test.afterAll(async () => {
    await admin.from("client_food_log_days").delete().eq("client_user_id", clientUser.id);
    await admin.from("client_links").delete().eq("id", linkId);
    await admin.from("patients").delete().eq("id", patientId);
    for (const user of [counselor, clientUser, outsider]) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("the client reads their own log", async () => {
    const client = await signedInClient(clientUser);
    const { data } = await client.from("client_food_log_days").select("id");
    expect(data?.map((row) => row.id)).toContain(dayId);
  });

  test("a consented counselor reads the client's log", async () => {
    const client = await signedInClient(counselor);
    const { data } = await client.from("client_food_log_entries").select("id,custom_name");
    expect(data?.some((row) => row.custom_name === "Testeintrag")).toBe(true);
  });

  test("an unrelated account reads nothing", async () => {
    const client = await signedInClient(outsider);
    const { data: days } = await client.from("client_food_log_days").select("id");
    const { data: entries } = await client.from("client_food_log_entries").select("id");
    expect(days ?? []).toHaveLength(0);
    expect(entries ?? []).toHaveLength(0);
  });

  test("a counselor cannot write into the client's log", async () => {
    const client = await signedInClient(counselor);
    const { error } = await client.from("client_food_log_entries").insert({
      day_id: dayId,
      client_user_id: clientUser.id,
      slot_type: "mittagessen",
      source_type: "custom",
      custom_name: "Fremdeintrag",
      amount: 50,
    });
    expect(error).not.toBeNull();
  });

  test("revoking the link cuts counselor access immediately", async () => {
    await admin
      .from("client_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", linkId);

    const client = await signedInClient(counselor);
    const { data } = await client.from("client_food_log_days").select("id");
    expect(data ?? []).toHaveLength(0);

    // Restore for afterAll cleanup symmetry.
    await admin
      .from("client_links")
      .update({ status: "active", revoked_at: null })
      .eq("id", linkId);
  });
});
