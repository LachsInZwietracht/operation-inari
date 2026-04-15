import type { SupabaseClient } from "@supabase/supabase-js";

import type { DailyMealPlan, MealEntry, MealSlot, MealSlotType } from "@/lib/types";
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
    date: row.date,
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
      "id,date,user_id,legacy_id,meal_entries(id,meal_plan_id,slot_type,entry_type,reference_id,amount,sort_order)",
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

  const planPayload = {
    legacy_id: plan.id,
    date: plan.date,
    user_id: userId,
  };

  const { data: persistedPlan, error: planError } = await client
    .from("daily_meal_plans")
    .upsert(planPayload, { onConflict: "user_id,date" })
    .select("id,date,user_id,legacy_id")
    .single();

  if (planError) {
    throw new Error(planError.message);
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
