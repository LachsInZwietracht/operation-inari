import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MealEntry,
  MealPlanTemplate,
  MealPlanTemplateDayBlock,
  MealSlot,
  MealSlotType,
} from "@/lib/types";
import {
  createClient as createServerSupabaseClient,
} from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";
import { isUuid } from "@/lib/data/local-records";
import { LOCAL_TEST_MEAL_PLAN_TEMPLATES } from "@/lib/mock-data/meal-plan-template-test-fixtures";

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
  patient_id?: string | null;
  name: string;
  description?: string | null;
  indication?: string | null;
  diet_line_id?: string | null;
  target_profile_id?: string | null;
  slots: RawSlot[] | null;
  day_blocks?: RawDayBlock[] | null;
  notes?: string | null;
  source_type?: MealPlanTemplate["sourceType"] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface RawDayBlock {
  offsetDays?: number;
  offset_days?: number;
  slots?: RawSlot[] | null;
}

export interface FetchMealPlanTemplatesOptions {
  supabase?: SupabaseClient;
  userId?: string | null;
  /** Limits personal templates to the counselor-wide and this patient's scope. */
  patientId?: string | null;
  indication?: string | null;
  dietLineId?: string | null;
  limit?: number;
}

function isLocalTemplateTesting(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.NEXT_PUBLIC_USE_LOCAL_MEAL_PLAN_TEMPLATE_FIXTURES === "true" ||
      process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true")
  );
}

function localTestTemplates(
  options: FetchMealPlanTemplatesOptions,
): MealPlanTemplate[] {
  if (!isLocalTemplateTesting()) {
    return [];
  }

  let templates = LOCAL_TEST_MEAL_PLAN_TEMPLATES;
  templates = templates.filter((template) => {
    if (template.sourceType !== "personal") return false;
    return options.patientId
      ? !template.patientId || template.patientId === options.patientId
      : !template.patientId;
  });
  if (options.indication) {
    templates = templates.filter(
      (template) => template.indication === options.indication,
    );
  }
  if (options.dietLineId) {
    templates = templates.filter(
      (template) => template.dietLineId === options.dietLineId,
    );
  }
  const sorted = templates
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  return typeof options.limit === "number"
    ? sorted.slice(0, options.limit)
    : sorted;
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

function normalizeDayBlocks(blocks: RawDayBlock[] | null | undefined): MealPlanTemplateDayBlock[] | undefined {
  if (!blocks?.length) return undefined;
  const normalized = blocks
    .map((block) => {
      const offsetDays = Number(block.offsetDays ?? block.offset_days)
      if (!Number.isInteger(offsetDays) || offsetDays < 0) return null
      return { offsetDays, slots: normalizeSlots(block.slots ?? []) }
    })
    .filter((block): block is MealPlanTemplateDayBlock => block !== null)
    .sort((a, b) => a.offsetDays - b.offsetDays)
  return normalized.length ? normalized : undefined
}

function mapTemplateRow(row: MealPlanTemplateRow): MealPlanTemplate {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    userId: row.user_id ?? undefined,
    patientId: row.patient_id ?? undefined,
    name: row.name,
    description: row.description ?? "",
    indication: row.indication ?? undefined,
    dietLineId: row.diet_line_id ?? undefined,
    targetProfileId: row.target_profile_id ?? undefined,
    slots: normalizeSlots(row.slots),
    dayBlocks: normalizeDayBlocks(row.day_blocks),
    notes: row.notes ?? undefined,
    sourceType: row.source_type ?? (row.user_id ? "personal" : "system"),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

const TEMPLATE_COLUMNS =
  "id,legacy_id,user_id,patient_id,name,description,indication,diet_line_id,target_profile_id,slots,day_blocks,notes,source_type,created_at,updated_at";

export const fetchMealPlanTemplates = cache(
  async (options: FetchMealPlanTemplatesOptions = {}): Promise<MealPlanTemplate[]> => {
    if (isLocalTemplateTesting()) return localTestTemplates(options);

    try {
      const client = await resolveClient(options.supabase);
      let query = client
        .from("meal_plan_templates")
        .select(TEMPLATE_COLUMNS)
        .order("name", { ascending: true });

      if (!options.userId) return [];
      query = query.eq("user_id", options.userId).eq("source_type", "personal");
      const patientId = isUuid(options.patientId) ? options.patientId : null;
      query = patientId
        ? query.or(`patient_id.is.null,patient_id.eq.${patientId}`)
        : query.is("patient_id", null);

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
      const templates = (data ?? []).map((row) =>
        mapTemplateRow(row as MealPlanTemplateRow),
      );
      return templates.length > 0 ? templates : localTestTemplates(options);
    } catch (error) {
      const fallback = localTestTemplates(options);
      console.warn(
        fallback.length > 0
          ? "Falling back to local test meal plan templates:"
          : "Falling back to empty meal plan templates:",
        error,
      );
      return fallback;
    }
  },
);
