import type { SupabaseClient } from "@supabase/supabase-js";

import type { DailyMealPlan, MealEntry, MealSlot, MealSlotType } from "@/lib/types";
import { isUuid } from "@/lib/data/local-records";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
];

interface MealPlanRow {
  id: string;
  date: string;
  user_id: string | null;
  legacy_id?: string | null;
  patient_id?: string | null;
  title?: string | null;
  status?: DailyMealPlan["status"] | null;
  notes?: string | null;
  target_profile_id?: string | null;
  diet_line_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  meal_entries: MealEntryRow[] | null;
}

interface MealEntryRow {
  id: string;
  meal_plan_id: string;
  slot_type: MealSlotType;
  entry_type: MealEntry["type"];
  reference_id: string;
  amount: number;
  sort_order: number | null;
}

interface FetchMealPlansOptions {
  supabase?: SupabaseClient;
  limit?: number;
}

interface PersistMealPlanOptions {
  supabase?: SupabaseClient;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapEntries(rows: MealEntryRow[] | null): Map<MealSlotType, MealEntry[]> {
  const groupedRows = new Map<MealSlotType, MealEntryRow[]>();
  for (const slot of SLOT_ORDER) {
    groupedRows.set(slot, []);
  }

  for (const row of rows ?? []) {
    const bucket = groupedRows.get(row.slot_type);
    if (!bucket) {
      groupedRows.set(row.slot_type, [row]);
    } else {
      bucket.push(row);
    }
  }

  const grouped = new Map<MealSlotType, MealEntry[]>();
  for (const slot of SLOT_ORDER) {
    const entryRows = groupedRows.get(slot) ?? [];
    entryRows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    grouped.set(
      slot,
      entryRows.map((row) => ({
        id: row.id,
        type: row.entry_type,
        referenceId: row.reference_id,
        amount: Number(row.amount ?? 0),
      })),
    );
  }

  return grouped;
}

function mapMealPlanRow(row: MealPlanRow): DailyMealPlan {
  const grouped = mapEntries(row.meal_entries);
  const slots: MealSlot[] = SLOT_ORDER.map((type) => ({
    type,
    entries: grouped.get(type) ?? [],
  }));

  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    date: row.date,
    patientId: row.patient_id ?? undefined,
    title: row.title ?? undefined,
    status: row.status ?? undefined,
    notes: row.notes ?? undefined,
    targetProfileId: row.target_profile_id ?? undefined,
    dietLineId: row.diet_line_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    slots,
  };
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

function baseMealPlanQuery(client: SupabaseClient) {
  return client
    .from("daily_meal_plans")
    .select(
      "id,date,user_id,legacy_id,patient_id,title,status,notes,target_profile_id,diet_line_id,approved_at,approved_by,meal_entries(id,meal_plan_id,slot_type,entry_type,reference_id,amount,sort_order)",
    )
    .order("date", { ascending: false });
}

export async function fetchMealPlansClient(
  options: FetchMealPlansOptions = {},
): Promise<DailyMealPlan[]> {
  const client = resolveBrowserClient(options.supabase);
  let query = baseMealPlanQuery(client);

  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  const { data, error } = await withTimeout(
    query,
    5000,
    "Supabase meal plan request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapMealPlanRow(row as MealPlanRow));
}

export async function persistMealPlan(
  plan: DailyMealPlan,
  options: PersistMealPlanOptions = {},
): Promise<DailyMealPlan> {
  const client = resolveBrowserClient(options.supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = isUuid(plan.id) ? plan.id : null;
  const legacyId = canonicalId ? plan.legacyId ?? plan.id : plan.legacyId ?? plan.id;
  const planPayload = {
    ...(canonicalId ? { id: canonicalId } : {}),
    legacy_id: legacyId,
    date: plan.date,
    user_id: userId,
    patient_id: plan.patientId ?? null,
    title: plan.title ?? null,
    status: plan.status ?? "draft",
    notes: plan.notes ?? null,
    target_profile_id: plan.targetProfileId ?? null,
    diet_line_id: plan.dietLineId ?? null,
    approved_at: plan.approvedAt ?? null,
    approved_by: plan.approvedBy ?? null,
  };

  let persistedPlan: MealPlanRow | null = null;
  let planError: { message: string } | null = null;

  if (canonicalId) {
    const { data, error } = await client
      .from("daily_meal_plans")
      .upsert(planPayload, { onConflict: "id" })
      .select("id,date,user_id,legacy_id,patient_id,title,status,notes,target_profile_id,diet_line_id,approved_at,approved_by")
      .single();
    persistedPlan = data as MealPlanRow | null;
    planError = error;
  } else {
    let lookup = client
      .from("daily_meal_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("date", plan.date)
      .limit(1);

    lookup = plan.patientId
      ? lookup.eq("patient_id", plan.patientId)
      : lookup.is("patient_id", null);

    const { data: existingPlans, error: lookupError } = await lookup;

    if (lookupError) {
      planError = lookupError;
    } else {
      const existingId = existingPlans?.[0]?.id as string | undefined;
      const request = existingId
        ? client
            .from("daily_meal_plans")
            .update(planPayload)
            .eq("id", existingId)
        : client
            .from("daily_meal_plans")
            .insert(planPayload);

      const { data, error } = await request
        .select("id,date,user_id,legacy_id,patient_id,title,status,notes,target_profile_id,diet_line_id,approved_at,approved_by")
        .single();
      persistedPlan = data as MealPlanRow | null;
      planError = error;
    }
  }

  if (planError) {
    throw new Error(planError.message);
  }

  if (!persistedPlan) {
    throw new Error("Meal plan persistence returned no row");
  }

  const planId = persistedPlan.id;

  const { error: deleteEntriesError } = await client
    .from("meal_entries")
    .delete()
    .eq("meal_plan_id", planId);

  if (deleteEntriesError) {
    throw new Error(deleteEntriesError.message);
  }

  const flattenedEntries = plan.slots.flatMap((slot) =>
    slot.entries.map((entry, index) => ({
      meal_plan_id: planId,
      slot_type: slot.type,
      entry_type: entry.type,
      reference_id: entry.referenceId,
      amount: entry.amount,
      sort_order: index,
    })),
  );

  if (flattenedEntries.length > 0) {
    const { error: insertEntriesError } = await client
      .from("meal_entries")
      .insert(flattenedEntries);

    if (insertEntriesError) {
      throw new Error(insertEntriesError.message);
    }
  }

  const { data: reloadedPlan, error: reloadError } = await withTimeout(
    baseMealPlanQuery(client).eq("id", planId).single(),
    5000,
    "Supabase meal plan lookup timed out",
  );

  if (reloadError) {
    throw new Error(reloadError.message);
  }

  return mapMealPlanRow(reloadedPlan as MealPlanRow);
}

export async function deleteMealPlanClient(
  planId: string,
  options: PersistMealPlanOptions = {},
): Promise<void> {
  const client = resolveBrowserClient(options.supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const { error } = await client
    .from("daily_meal_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
