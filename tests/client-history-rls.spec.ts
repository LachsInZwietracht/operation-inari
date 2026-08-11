import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Access to the counselor's measurement history from the client surface.
 *
 * The interesting property is not that the data arrives — it is what does
 * *not* arrive. The underlying tables carry counselor notes, so these tests
 * assert the projection's omissions as hard requirements, not just its
 * contents.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "prodi-test-passwort-2026";
const PRIVATE_PATIENT_NOTE = "GEHEIM-PATIENT-VERMERK";
const PRIVATE_MEASUREMENT_NOTE = "GEHEIM-MESSUNG-VERMERK";

interface TestUser {
  id: string;
  email: string;
}

async function createUser(label: string): Promise<TestUser> {
  const email = `history-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
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

test.describe("client patient history", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;
  let linkId: string;

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Verlauf",
        last_name: `RLS ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1988-04-04",
        gender: "w",
        goal_weight: 68,
        notes: PRIVATE_PATIENT_NOTE,
        insurance_number: "A123456789",
        daily_calorie_goal: 1900,
        macro_preset: "lowcarb",
      })
      .select("id")
      .single();
    if (patientError) throw new Error(patientError.message);
    patientId = patient.id;

    const { error: assignmentError } = await admin
      .from("patient_reference_assignments")
      .insert({
        patient_id: patientId,
        user_id: counselor.id,
        standard_id: "dge",
        pal_value: 1.4,
      });
    if (assignmentError) throw new Error(assignmentError.message);

    const { error: measurementError } = await admin.from("patient_anthropometrics").insert([
      {
        patient_id: patientId,
        user_id: counselor.id,
        date: "2026-06-01",
        weight: 78,
        height: 170,
        bmi: 27,
        body_fat_percentage: 31,
        notes: PRIVATE_MEASUREMENT_NOTE,
      },
      {
        patient_id: patientId,
        user_id: counselor.id,
        date: "2026-08-01",
        weight: 74.5,
        height: 170,
        bmi: 25.8,
        body_fat_percentage: 28.5,
      },
    ]);
    if (measurementError) throw new Error(measurementError.message);

    const { error: activityError } = await admin.from("patient_activities").insert({
      patient_id: patientId,
      user_id: counselor.id,
      date: "2026-07-15",
      type: "Radfahren",
      duration_minutes: 45,
      energy_kcal: 380,
    });
    if (activityError) throw new Error(activityError.message);

    const { data: link, error: linkError } = await admin
      .from("client_links")
      .insert({
        patient_id: patientId,
        counselor_user_id: counselor.id,
        client_user_id: clientUser.id,
        invite_code: `H${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        status: "active",
        consent_nutrition: true,
        consent_training: true,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);
    linkId = link.id;
  });

  test.afterAll(async () => {
    await admin.from("client_links").delete().eq("id", linkId);
    await admin.from("patients").delete().eq("id", patientId);
    for (const user of [counselor, clientUser, outsider]) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("the linked client reads their whole measurement history", async () => {
    const client = await signedInClient(clientUser);
    const { data, error } = await client.rpc("client_patient_history");

    expect(error).toBeNull();
    expect(data.patient.firstName).toBe("Verlauf");
    expect(Number(data.patient.goalWeight)).toBe(68);
    expect(data.measurements).toHaveLength(2);
    // Ordered oldest first, so a chart drawn straight from it reads forwards.
    expect(data.measurements[0].date).toBe("2026-06-01");
    expect(Number(data.measurements[1].weight)).toBe(74.5);
    expect(data.activities).toHaveLength(1);
  });

  test("counselor notes never leave the counselor's side", async () => {
    const client = await signedInClient(clientUser);
    const { data } = await client.rpc("client_patient_history");

    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain(PRIVATE_PATIENT_NOTE);
    expect(serialized).not.toContain(PRIVATE_MEASUREMENT_NOTE);
    expect(serialized).not.toContain("A123456789");
    expect(Object.keys(data.measurements[0])).not.toContain("notes");
    // Date of birth and sex go into the basal rate and stay behind it.
    expect(serialized).not.toContain("1988-04-04");
    expect(Object.keys(data.energy)).toEqual([
      "pal",
      "basalKcal",
      "macroPreset",
      "dailyCalorieGoal",
    ]);
  });

  test("the energy target arrives as answers, not as inputs", async () => {
    const client = await signedInClient(clientUser);
    const { data } = await client.rpc("client_patient_history");

    expect(Number(data.energy.dailyCalorieGoal)).toBe(1900);
    expect(data.energy.macroPreset).toBe("lowcarb");
    expect(Number(data.energy.pal)).toBe(1.4);
    // Mifflin-St Jeor on the latest measurement: 74.5 kg, 170 cm, female.
    // 10×74.5 + 6.25×170 − 5×age − 161, with age taken at query time.
    expect(Number(data.energy.basalKcal)).toBeGreaterThan(1200);
    expect(Number(data.energy.basalKcal)).toBeLessThan(1500);
  });

  test("the underlying tables stay closed to the client", async () => {
    // The projection is the only way in — a direct read must still fail,
    // otherwise the RPC would be a convenience rather than a boundary.
    const client = await signedInClient(clientUser);

    const { data: patients } = await client.from("patients").select("id,notes");
    const { data: measurements } = await client
      .from("patient_anthropometrics")
      .select("id,notes");

    expect(patients ?? []).toHaveLength(0);
    expect(measurements ?? []).toHaveLength(0);
  });

  test("an unrelated account gets nothing", async () => {
    const client = await signedInClient(outsider);
    const { data } = await client.rpc("client_patient_history");
    expect(data).toBeNull();
  });

  test("revoking the link cuts the history off", async () => {
    await admin.from("client_links").update({ status: "revoked" }).eq("id", linkId);

    const client = await signedInClient(clientUser);
    const { data } = await client.rpc("client_patient_history");
    expect(data).toBeNull();

    await admin.from("client_links").update({ status: "active" }).eq("id", linkId);
  });
});
