import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS for the training module.
 *
 * The point of interest is that training has its own consent flag: a counselor
 * with nutrition consent alone must not see workouts.
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
  const email = `training-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
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

// Shared fixtures and a test that flips consent: keep them in one worker.
test.describe.configure({ mode: "serial" });

test.describe("client training RLS", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;
  let linkId: string;
  let sessionId: string;

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Training",
        last_name: `RLS ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1995-09-09",
        gender: "d",
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
        consent_training: true,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);
    linkId = link.id;

    const { data: session, error: sessionError } = await admin
      .from("client_workout_sessions")
      .insert({
        client_user_id: clientUser.id,
        session_date: "2026-08-05",
        title: "Oberkörper",
      })
      .select("id")
      .single();
    if (sessionError) throw new Error(sessionError.message);
    sessionId = session.id;

    const { error: setError } = await admin.from("client_workout_sets").insert({
      session_id: sessionId,
      client_user_id: clientUser.id,
      exercise_name: "Bankdrücken",
      set_index: 1,
      reps: 8,
      weight_kg: 60,
    });
    if (setError) throw new Error(setError.message);
  });

  test.afterAll(async () => {
    await admin.from("client_workout_sessions").delete().eq("client_user_id", clientUser.id);
    await admin.from("client_links").delete().eq("id", linkId);
    await admin.from("patients").delete().eq("id", patientId);
    for (const user of [counselor, clientUser, outsider]) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("the client reads their own training", async () => {
    const client = await signedInClient(clientUser);
    const { data } = await client.from("client_workout_sessions").select("id");
    expect((data ?? []).map((row) => row.id)).toContain(sessionId);
  });

  test("a counselor with training consent reads it", async () => {
    const client = await signedInClient(counselor);
    const { data } = await client.from("client_workout_sets").select("exercise_name");
    expect((data ?? []).map((row) => row.exercise_name)).toContain("Bankdrücken");
  });

  test("nutrition consent alone does not expose training", async () => {
    await admin.from("client_links").update({ consent_training: false }).eq("id", linkId);

    const client = await signedInClient(counselor);
    const { data: sessions } = await client.from("client_workout_sessions").select("id");
    const { data: sets } = await client.from("client_workout_sets").select("id");
    expect(sessions ?? []).toHaveLength(0);
    expect(sets ?? []).toHaveLength(0);

    await admin.from("client_links").update({ consent_training: true }).eq("id", linkId);
  });

  test("an unrelated account reads nothing", async () => {
    const client = await signedInClient(outsider);
    const { data } = await client.from("client_workout_sessions").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  test("a counselor cannot log training for the client", async () => {
    const client = await signedInClient(counselor);
    const { error } = await client.from("client_workout_sessions").insert({
      client_user_id: clientUser.id,
      session_date: "2026-08-06",
      title: "Fremdeintrag",
    });
    expect(error).not.toBeNull();
  });

  test("a set cannot be parked on someone else's session", async () => {
    const client = await signedInClient(outsider);
    const { error } = await client.from("client_workout_sets").insert({
      session_id: sessionId,
      client_user_id: outsider.id,
      exercise_name: "Fremdsatz",
      set_index: 1,
      reps: 5,
    });
    expect(error).not.toBeNull();
  });
});
