import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DailyMealPlan, MealEntry, MealSlot, MealSlotType } from "@/lib/types";
import type { PatientPlanSummary } from "@/lib/patient-journey";
import { createClient as createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
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
  revision_number?: number | null;
  supersedes_plan_id?: string | null;
  replaced_at?: string | null;
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
    revisionNumber: row.revision_number ?? undefined,
    supersedesPlanId: row.supersedes_plan_id ?? undefined,
    replacedAt: row.replaced_at ?? undefined,
    slots,
  };
}

export const fetchMealPlans = cache(async (
  options: FetchMealPlansOptions = {}
): Promise<DailyMealPlan[]> => {
  // Use unstable_cache for system/template plans (no user, no custom supabase)
  const isSystemOnly = !options.supabase && !options.userId && (options.includeSystem ?? true);
  if (isSystemOnly && !options.limit) {
    return unstable_cache(
      async () => {
        try {
          const client = await createServiceClient();
          const { data, error } = await withTimeout(
            client
              .from("daily_meal_plans")
              .select(
                "id,date,user_id,legacy_id,patient_id,title,status,notes,target_profile_id,diet_line_id,approved_at,approved_by,revision_number,supersedes_plan_id,replaced_at,meal_entries(id,meal_plan_id,slot_type,entry_type,reference_id,amount,sort_order)"
              )
              .is("user_id", null)
              .order("date", { ascending: false }),
            5000,
            "Supabase meal plan request timed out",
          );
          if (error) throw new Error(error.message);
          return (data ?? []).map((row) => mapMealPlanRow(row as MealPlanRow));
        } catch (error) {
          console.warn("Falling back to local meal plans:", error);
          return [];
        }
      },
      ["meal-plans-system"],
      { revalidate: 300, tags: ["meal-plans"] },
    )();
  }

  // Fallback: direct fetch with options
  try {
    const client = await resolveClient(options.supabase);
    let query = client
      .from("daily_meal_plans")
      .select(
        "id,date,user_id,legacy_id,patient_id,title,status,notes,target_profile_id,diet_line_id,approved_at,approved_by,revision_number,supersedes_plan_id,replaced_at,meal_entries(id,meal_plan_id,slot_type,entry_type,reference_id,amount,sort_order)"
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

/**
 * Slim per-patient plan projection for pipeline status derivation.
 *
 * `fetchMealPlans` joins `meal_entries`, which is the right shape for the plan
 * editor and the wrong shape for a patient list — deriving a status only needs
 * to know that a plan exists, whether it is archived, and how recent it is.
 */
export const fetchPatientPlanSummaries = cache(async (
  options: { supabase?: SupabaseClient; userId?: string | null } = {}
): Promise<PatientPlanSummary[]> => {
  try {
    const client = await resolveClient(options.supabase);
    let query = client
      .from("daily_meal_plans")
      .select("patient_id,status,date")
      .not("patient_id", "is", null)
      .order("date", { ascending: false });

    if (options.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { data, error } = await withTimeout(
      query,
      5000,
      "Supabase plan summary request timed out",
    );
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => {
      const summary = row as {
        patient_id: string | null;
        status: DailyMealPlan["status"] | null;
        date: string;
      };
      return {
        patientId: summary.patient_id ?? undefined,
        status: summary.status ?? undefined,
        date: summary.date,
      };
    });
  } catch (error) {
    console.warn("Failed to load patient plan summaries:", error);
    return [];
  }
});
