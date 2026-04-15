import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DailyMealPlan, MealEntry, MealSlot, MealSlotType } from "@/lib/types";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
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

export interface FetchMealPlansOptions {
  supabase?: SupabaseClient;
  userId?: string | null;
  includeSystem?: boolean;
  limit?: number;
}

async function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createServerSupabaseClient();
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
      }))
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

export const fetchMealPlans = cache(async (
  options: FetchMealPlansOptions = {}
): Promise<DailyMealPlan[]> => {
  try {
    const client = await resolveClient(options.supabase);
    let query = client
      .from("daily_meal_plans")
      .select(
        "id,date,user_id,meal_entries(id,meal_plan_id,slot_type,entry_type,reference_id,amount,sort_order)"
      )
      .order("date", { ascending: false });

    const includeSystem = options.includeSystem ?? true;
    if (options.userId) {
      if (includeSystem) {
        query = query.or(`user_id.eq.${options.userId},user_id.is.null`);
      } else {
        query = query.eq("user_id", options.userId);
      }
    } else if (includeSystem) {
      query = query.is("user_id", null);
    }

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
  } catch (error) {
    console.warn("Falling back to local meal plans:", error);
    return [];
  }
});
