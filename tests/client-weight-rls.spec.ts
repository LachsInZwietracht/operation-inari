import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The one place the client writes into the counselor's record.
 *
 * Everything else client mode writes belongs to the client. A weigh-in lands
 * in `patient_anthropometrics`, next to rows a professional measured, so the
 * function carries the whole permission: who may write, into whose record, and
 * what it must never touch.
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
  const email = `weight-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
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

test.describe("a client writing down their weight", () => {
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
        first_name: "Waage",
        last_name: `RLS ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1990-01-01",
        gender: "w",
      })
      .select("id")
      .single();
    if (patientError) throw new Error(patientError.message);
    patientId = patient.id;

    const { error: linkError } = await admin.from("client_links").insert({
      patient_id: patientId,
      counselor_user_id: counselor.id,
      client_user_id: clientUser.id,
      invite_code: `WGT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      status: "active",
      consent_nutrition: true,
      consent_training: true,
      consented_at: new Date().toISOString(),
    });
    if (linkError) throw new Error(linkError.message);
  });

  test.afterAll(async () => {
    await admin.from("client_links").delete().eq("patient_id", patientId);
    await admin.from("patients").delete().eq("id", patientId);
    for (const user of [counselor, clientUser, outsider]) {
      await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("without a height on record it asks instead of inventing one", async () => {
    // The table requires height and BMI. A default would be a made-up number
    // in a real person's clinical record.
    const client = await signedInClient(clientUser);
    const { error } = await client.rpc("client_record_weight", {
      weight_kg: 70,
      measured_on: "2026-08-14",
      height_cm: null,
    });

    expect(error?.message).toContain("height_unknown");
  });

  test("with a height it records the weight and derives the BMI", async () => {
    const client = await signedInClient(clientUser);
    const { data, error } = await client.rpc("client_record_weight", {
      weight_kg: 70,
      measured_on: "2026-08-14",
      height_cm: 170,
    });

    expect(error).toBeNull();
    expect(Number(data.weight)).toBe(70);
    // 70 / 1.7² = 24.2
    expect(Number(data.bmi)).toBeCloseTo(24.2, 1);

    const { data: rows } = await admin
      .from("patient_anthropometrics")
      .select("weight,recorded_by_client")
      .eq("patient_id", patientId);
    expect(rows).toHaveLength(1);
    // The counselor has to be able to tell a bathroom scale from their own.
    expect(rows![0].recorded_by_client).toBe(true);
  });

  test("a second weigh-in on the same day corrects rather than duplicates", async () => {
    const client = await signedInClient(clientUser);
    await client.rpc("client_record_weight", {
      weight_kg: 71.2,
      measured_on: "2026-08-14",
      height_cm: null,
    });

    const { data: rows } = await admin
      .from("patient_anthropometrics")
      .select("weight,height")
      .eq("patient_id", patientId);
    expect(rows).toHaveLength(1);
    expect(Number(rows![0].weight)).toBe(71.2);
    // Height carried forward without being asked for again.
    expect(Number(rows![0].height)).toBe(170);
  });

  test("a measurement taken in the practice is never overwritten", async () => {
    await admin.from("patient_anthropometrics").insert({
      patient_id: patientId,
      user_id: counselor.id,
      date: "2026-08-15",
      weight: 69,
      height: 170,
      bmi: 23.9,
    });

    const client = await signedInClient(clientUser);
    await client.rpc("client_record_weight", {
      weight_kg: 75,
      measured_on: "2026-08-15",
      height_cm: null,
    });

    const { data: rows } = await admin
      .from("patient_anthropometrics")
      .select("weight,recorded_by_client")
      .eq("patient_id", patientId)
      .eq("date", "2026-08-15")
      .order("recorded_by_client");

    // Two rows for that date: the practice's and the client's, side by side.
    expect(rows).toHaveLength(2);
    expect(Number(rows![0].weight)).toBe(69);
    expect(rows![0].recorded_by_client).toBe(false);
    expect(Number(rows![1].weight)).toBe(75);
  });

  test("someone without a link cannot write into anyone's record", async () => {
    const client = await signedInClient(outsider);
    const { error } = await client.rpc("client_record_weight", {
      weight_kg: 70,
      measured_on: "2026-08-14",
      height_cm: 170,
    });

    expect(error?.message).toContain("no_active_link");

    const { count } = await admin
      .from("patient_anthropometrics")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId);
    expect(count).toBe(3);
  });

  test("a revoked link stops the writing", async () => {
    await admin.from("client_links").update({ status: "revoked" }).eq("patient_id", patientId);

    const client = await signedInClient(clientUser);
    const { error } = await client.rpc("client_record_weight", {
      weight_kg: 68,
      measured_on: "2026-08-16",
      height_cm: null,
    });

    expect(error?.message).toContain("no_active_link");

    await admin.from("client_links").update({ status: "active" }).eq("patient_id", patientId);
  });

  test("an implausible weight is refused", async () => {
    const client = await signedInClient(clientUser);
    const { error } = await client.rpc("client_record_weight", {
      weight_kg: 900,
      measured_on: "2026-08-14",
      height_cm: null,
    });

    expect(error?.message).toContain("weight_out_of_range");
  });
});
