import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS for the plan module.
 *
 * Plan visibility runs opposite to the food log: the counselor wrote the plan
 * *for* this person, so it hangs on an active link rather than on a consent
 * flag. Drafts must stay invisible, and an unrelated account must see nothing
 * at all.
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
  const email = `plan-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
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

// Shared fixtures, and the last test flips the link's status: these must not
// be spread across workers by the suite's fullyParallel default.
test.describe.configure({ mode: "serial" });

test.describe("client plan RLS", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;
  let linkId: string;
  let approvedPlanId: string;
  let draftPlanId: string;
  let approvedEntryId: string;
  let revisionPlanId: string | null = null;
  let foodId: string;

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: food, error: foodError } = await admin
      .from("foods")
      .insert({
        name: "Plan-RLS Testfood",
        data_source_id: "bls",
        source_food_id: `plan-rls-${Math.random().toString(36).slice(2, 10)}`,
      })
      .select("id")
      .single();
    if (foodError) throw new Error(foodError.message);
    foodId = food.id;

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Plan",
        last_name: `RLS ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1988-02-02",
        gender: "m",
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
        invite_code: `P${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        status: "active",
        consent_nutrition: true,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);
    linkId = link.id;

    const { data: approved, error: approvedError } = await admin
      .from("daily_meal_plans")
      .insert({
        user_id: counselor.id,
        patient_id: patientId,
        date: "2026-08-05",
        status: "approved",
        title: "Freigegebener Tag",
      })
      .select("id")
      .single();
    if (approvedError) throw new Error(approvedError.message);
    approvedPlanId = approved.id;

    const { data: entry, error: entryError } = await admin
      .from("meal_entries")
      .insert({
        meal_plan_id: approvedPlanId,
        slot_type: "fruehstueck",
        entry_type: "food",
        reference_id: foodId,
        amount: 80,
      })
      .select("id")
      .single();
    if (entryError) throw new Error(entryError.message);
    approvedEntryId = entry.id;

    const { data: draft, error: draftError } = await admin
      .from("daily_meal_plans")
      .insert({
        user_id: counselor.id,
        patient_id: patientId,
        date: "2026-08-06",
        status: "draft",
        title: "Entwurf",
      })
      .select("id")
      .single();
    if (draftError) throw new Error(draftError.message);
    draftPlanId = draft.id;
  });

  test.afterAll(async () => {
    await admin.from("client_meal_completions").delete().eq("client_user_id", clientUser.id);
    await admin
      .from("daily_meal_plans")
      .delete()
      .in("id", [approvedPlanId, draftPlanId, revisionPlanId].filter(Boolean));
    await admin.from("client_links").delete().eq("id", linkId);
    await admin.from("patients").delete().eq("id", patientId);
    await admin.from("foods").delete().eq("id", foodId);
    for (const user of [counselor, clientUser, outsider]) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("the linked client reads the approved plan but not the draft", async () => {
    const client = await signedInClient(clientUser);
    const { data } = await client.from("daily_meal_plans").select("id,status");
    const ids = (data ?? []).map((row) => row.id);
    expect(ids).toContain(approvedPlanId);
    expect(ids).not.toContain(draftPlanId);
  });

  test("the linked client reads the plan's entries", async () => {
    const client = await signedInClient(clientUser);
    const { data } = await client.from("meal_entries").select("id");
    expect((data ?? []).map((row) => row.id)).toContain(approvedEntryId);
  });

  test("an unrelated account sees no plan at all", async () => {
    const client = await signedInClient(outsider);
    const { data: plans } = await client.from("daily_meal_plans").select("id");
    const { data: entries } = await client.from("meal_entries").select("id");
    expect(plans ?? []).toHaveLength(0);
    expect(entries ?? []).toHaveLength(0);
  });

  test("the client ticks a meal off and the counselor sees it", async () => {
    const client = await signedInClient(clientUser);
    const { error } = await client.from("client_meal_completions").insert({
      client_user_id: clientUser.id,
      meal_plan_id: approvedPlanId,
      meal_entry_id: approvedEntryId,
      skipped: false,
    });
    expect(error).toBeNull();

    const counselorClient = await signedInClient(counselor);
    const { data } = await counselorClient
      .from("client_meal_completions")
      .select("meal_entry_id");
    expect((data ?? []).map((row) => row.meal_entry_id)).toContain(approvedEntryId);
  });

  test("a counselor cannot tick meals off for the client", async () => {
    const counselorClient = await signedInClient(counselor);
    const { error } = await counselorClient.from("client_meal_completions").insert({
      client_user_id: clientUser.id,
      meal_plan_id: approvedPlanId,
      meal_entry_id: approvedEntryId,
      skipped: true,
    });
    expect(error).not.toBeNull();
  });

  test("revoking the link hides the plan again", async () => {
    await admin.from("client_links").update({ status: "revoked" }).eq("id", linkId);

    const client = await signedInClient(clientUser);
    const { data } = await client.from("daily_meal_plans").select("id");
    expect(data ?? []).toHaveLength(0);

    await admin.from("client_links").update({ status: "active" }).eq("id", linkId);
  });

  test("a revision keeps the released stand visible until the successor is released", async () => {
    const counselorClient = await signedInClient(counselor);
    const linkedClient = await signedInClient(clientUser);

    const { data: draftId, error: beginError } = await counselorClient.rpc(
      "begin_meal_plan_revision",
      { source_plan_id: approvedPlanId },
    );
    expect(beginError).toBeNull();
    revisionPlanId = String(draftId);

    const { data: beforeRelease } = await linkedClient
      .from("daily_meal_plans")
      .select("id");
    const visibleBeforeRelease = (beforeRelease ?? []).map((row) => row.id);
    expect(visibleBeforeRelease).toContain(approvedPlanId);
    expect(visibleBeforeRelease).not.toContain(revisionPlanId);

    const { error: releaseError } = await counselorClient.rpc(
      "release_meal_plan_revision",
      { target_plan_id: revisionPlanId },
    );
    expect(releaseError).toBeNull();

    const { data: afterRelease } = await linkedClient
      .from("daily_meal_plans")
      .select("id");
    const visibleAfterRelease = (afterRelease ?? []).map((row) => row.id);
    expect(visibleAfterRelease).toContain(revisionPlanId);
    expect(visibleAfterRelease).not.toContain(approvedPlanId);

    const { data: revisions, error: revisionError } = await admin
      .from("daily_meal_plans")
      .select("id,status,revision_number,supersedes_plan_id,replaced_at")
      .in("id", [approvedPlanId, revisionPlanId]);
    expect(revisionError).toBeNull();
    const formerRelease = revisions?.find((plan) => plan.id === approvedPlanId);
    const currentRelease = revisions?.find((plan) => plan.id === revisionPlanId);
    expect(formerRelease).toMatchObject({ status: "archived" });
    expect(formerRelease?.replaced_at).not.toBeNull();
    expect(currentRelease).toMatchObject({
      status: "approved",
      revision_number: 2,
      supersedes_plan_id: approvedPlanId,
    });

    const { data: snapshots, error: snapshotError } = await admin
      .from("meal_plan_versions")
      .select("reason,snapshot")
      .eq("meal_plan_id", revisionPlanId);
    expect(snapshotError).toBeNull();
    expect(snapshots).toHaveLength(1);
    expect(snapshots?.[0]).toMatchObject({
      reason: "approved",
      snapshot: { status: "approved" },
    });

    const { error: lockedPlanError } = await counselorClient
      .from("daily_meal_plans")
      .update({ title: "Still überschrieben" })
      .eq("id", revisionPlanId)
      .select("id")
      .single();
    expect(lockedPlanError).not.toBeNull();

    const { error: lockedEntriesError } = await counselorClient
      .from("meal_entries")
      .delete()
      .eq("meal_plan_id", revisionPlanId)
      .select("id")
      .single();
    expect(lockedEntriesError).not.toBeNull();

    const { error: archiveError } = await counselorClient.rpc(
      "archive_meal_plan_revision",
      { target_plan_id: revisionPlanId },
    );
    expect(archiveError).toBeNull();

    const { error: releasedDeleteError } = await counselorClient
      .from("daily_meal_plans")
      .delete()
      .eq("id", revisionPlanId)
      .select("id")
      .single();
    expect(releasedDeleteError).not.toBeNull();
  });
});
