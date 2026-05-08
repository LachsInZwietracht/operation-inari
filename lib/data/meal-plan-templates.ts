import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MealEntry,
  MealPlanTemplate,
  MealSlot,
  MealSlotType,
} from "@/lib/types";
import {
  createClient as createServerSupabaseClient,
  createServiceClient,
} from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
];

interface RawSlotEntry {
  id?: string;
  type?: MealEntry["type"];
  referenceId?: string;
  reference_id?: string;
  amount?: number;
}

interface RawSlot {
  type?: MealSlotType;
  entries?: RawSlotEntry[];
}

interface MealPlanTemplateRow {
  id: string;
  legacy_id?: string | null;
  user_id?: string | null;
  name: string;
  description?: string | null;
  indication?: string | null;
  diet_line_id?: string | null;
  target_profile_id?: string | null;
  slots: RawSlot[] | null;
  notes?: string | null;
  source_type?: MealPlanTemplate["sourceType"] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FetchMealPlanTemplatesOptions {
  supabase?: SupabaseClient;
  userId?: string | null;
  includeSystem?: boolean;
  indication?: string | null;
  dietLineId?: string | null;
  limit?: number;
}

async function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createServerSupabaseClient();
}

function generateLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSlots(slots: RawSlot[] | null): MealSlot[] {
  const indexed = new Map<MealSlotType, MealSlot>();
  for (const slot of SLOT_ORDER) {
    indexed.set(slot, { type: slot, entries: [] });
  }

  for (const slot of slots ?? []) {
    if (!slot.type) continue;
    const target = indexed.get(slot.type);
    if (!target) continue;
    target.entries = (slot.entries ?? [])
      .map((entry, index): MealEntry | null => {
        const referenceId = entry.referenceId ?? entry.reference_id;
        if (!entry.type || !referenceId) return null;
        return {
          id: entry.id ?? `tplentry_${index}_${generateLocalId("e")}`,
          type: entry.type,
          referenceId,
          amount: Number(entry.amount ?? 0),
        };
      })
      .filter((entry): entry is MealEntry => entry !== null);
  }

  return SLOT_ORDER.map((type) => indexed.get(type) ?? { type, entries: [] });
}

function mapTemplateRow(row: MealPlanTemplateRow): MealPlanTemplate {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    userId: row.user_id ?? undefined,
    name: row.name,
    description: row.description ?? "",
    indication: row.indication ?? undefined,
    dietLineId: row.diet_line_id ?? undefined,
    targetProfileId: row.target_profile_id ?? undefined,
    slots: normalizeSlots(row.slots),
    notes: row.notes ?? undefined,
    sourceType: row.source_type ?? (row.user_id ? "personal" : "system"),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

const TEMPLATE_COLUMNS =
  "id,legacy_id,user_id,name,description,indication,diet_line_id,target_profile_id,slots,notes,source_type,created_at,updated_at";

export const fetchMealPlanTemplates = cache(
  async (options: FetchMealPlanTemplatesOptions = {}): Promise<MealPlanTemplate[]> => {
    const isSystemOnly =
      !options.supabase &&
      !options.userId &&
      (options.includeSystem ?? true) &&
      !options.indication &&
      !options.dietLineId &&
      !options.limit;

    if (isSystemOnly) {
      return unstable_cache(
        async () => {
          try {
            const client = await createServiceClient();
            const { data, error } = await withTimeout(
              client
                .from("meal_plan_templates")
                .select(TEMPLATE_COLUMNS)
                .is("user_id", null)
                .order("name", { ascending: true }),
              5000,
              "Supabase meal plan template request timed out",
            );
            if (error) throw new Error(error.message);
            return (data ?? []).map((row) =>
              mapTemplateRow(row as MealPlanTemplateRow),
            );
          } catch (error) {
            console.warn("Falling back to empty meal plan templates:", error);
            return [];
          }
        },
        ["meal-plan-templates-system"],
        { revalidate: 300, tags: ["meal-plan-templates"] },
      )();
    }

    try {
      const client = await resolveClient(options.supabase);
      let query = client
        .from("meal_plan_templates")
        .select(TEMPLATE_COLUMNS)
        .order("name", { ascending: true });

      const includeSystem = options.includeSystem ?? true;
      if (options.userId) {
        query = includeSystem
          ? query.or(`user_id.eq.${options.userId},user_id.is.null`)
          : query.eq("user_id", options.userId);
      } else if (includeSystem) {
        query = query.is("user_id", null);
      }

      if (options.indication) {
        query = query.eq("indication", options.indication);
      }
      if (options.dietLineId) {
        query = query.eq("diet_line_id", options.dietLineId);
      }
      if (typeof options.limit === "number") {
        query = query.limit(options.limit);
      }

      const { data, error } = await withTimeout(
        query,
        5000,
        "Supabase meal plan template request timed out",
      );
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) =>
        mapTemplateRow(row as MealPlanTemplateRow),
      );
    } catch (error) {
      console.warn("Falling back to empty meal plan templates:", error);
      return [];
    }
  },
);
