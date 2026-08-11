import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClientAdherenceSlot,
  ClientAdherenceSummary,
  ClientMealCompletion,
  ClientPlanDay,
  ClientPlanEntry,
  MealSlotType,
} from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface PlanRow {
  id: string;
  date: string;
  title: string | null;
  meal_entries: PlanEntryRow[] | null;
}

interface PlanEntryRow {
  id: string;
  slot_type: MealSlotType;
  entry_type: ClientPlanEntry["entryType"];
  reference_id: string;
  amount: number;
  sort_order: number | null;
}

interface CompletionRow {
  id: string;
  meal_plan_id: string;
  meal_entry_id: string;
  skipped: boolean;
  amount: string | number | null;
  note: string | null;
  completed_at: string;
}

const PLAN_COLUMNS =
  "id,date,title,meal_entries(id,slot_type,entry_type,reference_id,amount,sort_order)";
const COMPLETION_COLUMNS =
  "id,meal_plan_id,meal_entry_id,skipped,amount,note,completed_at";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

function mapPlanRow(row: PlanRow): ClientPlanDay {
  const entries = [...(row.meal_entries ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((entry) => ({
      id: entry.id,
      slotType: entry.slot_type,
      entryType: entry.entry_type,
      referenceId: entry.reference_id,
      amount: Number(entry.amount ?? 0),
    }));

  return {
    id: row.id,
    date: row.date,
    title: row.title ?? undefined,
    entries,
  };
}

function mapCompletionRow(row: CompletionRow): ClientMealCompletion {
  return {
    id: row.id,
    mealPlanId: row.meal_plan_id,
    mealEntryId: row.meal_entry_id,
    skipped: row.skipped,
    amount: row.amount === null ? undefined : Number(row.amount),
    note: row.note ?? undefined,
    completedAt: row.completed_at,
  };
}

/**
 * The plan shared with the signed-in client for one date.
 *
 * No patient filter is needed: RLS narrows `daily_meal_plans` to plans of the
 * patient record this client is linked to, and only in `active`/`approved`
 * state. A client without a link simply gets nothing back.
 */
export async function fetchClientPlanDay(
  date: string,
  supabase?: SupabaseClient,
): Promise<ClientPlanDay | null> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("daily_meal_plans")
      .select(PLAN_COLUMNS)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    5000,
    "Supabase client plan request timed out",
  );

  if (error) throw new Error(error.message);
  return data ? mapPlanRow(data as unknown as PlanRow) : null;
}

/** The client's own plans over a range — the statistics window's reference. */
export async function fetchClientPlanDays(
  range: { from: string; to: string },
  supabase?: SupabaseClient,
): Promise<ClientPlanDay[]> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("daily_meal_plans")
      .select(PLAN_COLUMNS)
      .gte("date", range.from)
      .lte("date", range.to)
      .order("date", { ascending: true }),
    8000,
    "Supabase client plan range request timed out",
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PlanRow[]).map(mapPlanRow);
}

export async function fetchClientMealCompletions(
  clientUserId: string,
  mealPlanId: string,
  supabase?: SupabaseClient,
): Promise<ClientMealCompletion[]> {
  const client = resolveClient(supabase);
  const { data, error } = await client
    .from("client_meal_completions")
    .select(COMPLETION_COLUMNS)
    .eq("client_user_id", clientUserId)
    .eq("meal_plan_id", mealPlanId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CompletionRow[]).map(mapCompletionRow);
}

/** Completions across several plans — the range counterpart of the above. */
export async function fetchClientMealCompletionsForPlans(
  clientUserId: string,
  mealPlanIds: string[],
  supabase?: SupabaseClient,
): Promise<ClientMealCompletion[]> {
  if (mealPlanIds.length === 0) return [];
  const client = resolveClient(supabase);
  const { data, error } = await client
    .from("client_meal_completions")
    .select(COMPLETION_COLUMNS)
    .eq("client_user_id", clientUserId)
    .in("meal_plan_id", mealPlanIds);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CompletionRow[]).map(mapCompletionRow);
}

/**
 * Marks a planned meal as eaten or skipped. Upserts on the unique
 * (client_user_id, meal_entry_id) pair so tapping twice corrects the answer
 * instead of stacking rows.
 */
export async function setClientMealCompletion(
  input: { mealPlanId: string; mealEntryId: string; skipped: boolean; amount?: number },
  supabase?: SupabaseClient,
): Promise<ClientMealCompletion> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("client_meal_completions")
    .upsert(
      {
        client_user_id: userId,
        meal_plan_id: input.mealPlanId,
        meal_entry_id: input.mealEntryId,
        skipped: input.skipped,
        // NULL means "as planned", which is the ordinary case and must not be
        // forced to carry a number.
        amount: input.amount ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "client_user_id,meal_entry_id" },
    )
    .select(COMPLETION_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapCompletionRow(data as unknown as CompletionRow);
}

/** Removes an answer entirely, back to "no reaction". */
export async function clearClientMealCompletion(
  mealEntryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const { error } = await client
    .from("client_meal_completions")
    .delete()
    .eq("meal_entry_id", mealEntryId);

  if (error) throw new Error(error.message);
}

/**
 * Adherence for the counselor: planned meals against the client's answers.
 *
 * Cut two ways from one pass. By day answers "did they follow it"; by meal
 * answers "which meal is the problem", which is the one a counselor can act
 * on — a client can be at 80 % overall and still be skipping every dinner.
 *
 * Runs from the counselor session: the plans are theirs, the completions come
 * through the consented link.
 */
export async function fetchClientAdherence(
  patientId: string,
  clientUserId: string,
  range: { from: string; to: string },
  supabase?: SupabaseClient,
): Promise<ClientAdherenceSummary> {
  const client = resolveClient(supabase);

  const { data: planData, error: planError } = await withTimeout(
    client
      .from("daily_meal_plans")
      .select(PLAN_COLUMNS)
      .eq("patient_id", patientId)
      .in("status", ["active", "approved"])
      .gte("date", range.from)
      .lte("date", range.to)
      .order("date", { ascending: false }),
    8000,
    "Supabase adherence request timed out",
  );

  if (planError) throw new Error(planError.message);
  const plans = ((planData ?? []) as unknown as PlanRow[]).map(mapPlanRow);
  if (plans.length === 0) return { byDay: [], bySlot: [] };

  const { data: completionData, error: completionError } = await client
    .from("client_meal_completions")
    .select(COMPLETION_COLUMNS)
    .eq("client_user_id", clientUserId)
    .in(
      "meal_plan_id",
      plans.map((plan) => plan.id),
    );

  if (completionError) throw new Error(completionError.message);

  const byEntry = new Map<string, ClientMealCompletion>();
  for (const row of (completionData ?? []) as unknown as CompletionRow[]) {
    byEntry.set(row.meal_entry_id, mapCompletionRow(row));
  }

  const bySlot = new Map<MealSlotType, ClientAdherenceSlot>();

  const byDay = plans.map((plan) => {
    let completed = 0;
    let skipped = 0;

    for (const entry of plan.entries) {
      const slot = bySlot.get(entry.slotType) ?? {
        slotType: entry.slotType,
        planned: 0,
        completed: 0,
        skipped: 0,
      };
      slot.planned += 1;

      const completion = byEntry.get(entry.id);
      if (completion) {
        if (completion.skipped) {
          skipped += 1;
          slot.skipped += 1;
        } else {
          completed += 1;
          slot.completed += 1;
        }
      }
      bySlot.set(entry.slotType, slot);
    }

    return { date: plan.date, planned: plan.entries.length, completed, skipped };
  });

  return { byDay, bySlot: [...bySlot.values()] };
}
