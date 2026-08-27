import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MealEntry,
  MealPlanTemplate,
  MealPlanTemplateDayBlock,
  MealSlot,
  MealSlotType,
} from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";
import { isUuid } from "@/lib/data/local-records";

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
];

const TEMPLATE_COLUMNS =
  "id,legacy_id,user_id,patient_id,name,description,indication,diet_line_id,target_profile_id,slots,day_blocks,notes,source_type,created_at,updated_at";

interface RawSlotEntry {
  id?: string;
  type?: MealEntry["type"];
  referenceId?: string;
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

interface FetchMealPlanTemplatesOptions {
  supabase?: SupabaseClient;
  indication?: string | null;
  dietLineId?: string | null;
  patientId?: string | null;
  limit?: number;
}

interface SaveMealPlanTemplateInput {
  id?: string;
  name: string;
  description?: string;
  indication?: string;
  dietLineId?: string;
  targetProfileId?: string;
  slots: MealSlot[];
  dayBlocks?: MealPlanTemplateDayBlock[];
  notes?: string;
  patientId?: string;
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

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
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
        if (!entry.type || !entry.referenceId) return null;
        return {
          id: entry.id ?? `tplentry_${index}_${Math.random().toString(36).slice(2, 9)}`,
          type: entry.type,
          referenceId: entry.referenceId,
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

function serializeDayBlocks(blocks: MealPlanTemplateDayBlock[] | undefined) {
  if (!blocks?.length) return null
  return blocks.map((block) => ({
    offsetDays: block.offsetDays,
    slots: serializeSlots(block.slots),
  }))
}

function serializeSlots(slots: MealSlot[]): RawSlot[] {
  return slots.map((slot) => ({
    type: slot.type,
    entries: slot.entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      referenceId: entry.referenceId,
      amount: entry.amount,
    })),
  }));
}

async function getAuthenticatedUserId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }
  return data.user?.id ?? null;
}

export async function fetchMealPlanTemplatesClient(
  options: FetchMealPlanTemplatesOptions = {},
): Promise<MealPlanTemplate[]> {
  const client = resolveBrowserClient(options.supabase);
  let query = client
    .from("meal_plan_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("source_type", "personal")
    .order("name", { ascending: true });

  if (options.indication) {
    query = query.eq("indication", options.indication);
  }
  if (options.dietLineId) {
    query = query.eq("diet_line_id", options.dietLineId);
  }
  const patientId = isUuid(options.patientId) ? options.patientId : null;
  query = patientId
    ? query.or(`patient_id.is.null,patient_id.eq.${patientId}`)
    : query.is("patient_id", null);
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
  return (data ?? []).map((row) => mapTemplateRow(row as MealPlanTemplateRow));
}

export async function saveMealPlanTemplate(
  input: SaveMealPlanTemplateInput,
  options: { supabase?: SupabaseClient } = {},
): Promise<MealPlanTemplate> {
  const client = resolveBrowserClient(options.supabase);
  const userId = await getAuthenticatedUserId(client);
  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const payload = {
    ...(input.id ? { id: input.id } : {}),
    user_id: userId,
    patient_id: input.patientId ?? null,
    name: input.name,
    description: input.description ?? "",
    indication: input.indication ?? null,
    diet_line_id: input.dietLineId ?? null,
    target_profile_id: input.targetProfileId ?? null,
    slots: serializeSlots(input.slots),
    day_blocks: serializeDayBlocks(input.dayBlocks),
    notes: input.notes ?? null,
    source_type: "personal" as const,
  };

  const { data, error } = await client
    .from("meal_plan_templates")
    .upsert(payload, { onConflict: "id" })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapTemplateRow(data as MealPlanTemplateRow);
}

export async function deleteMealPlanTemplate(
  id: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const client = resolveBrowserClient(options.supabase);
  const { error } = await client
    .from("meal_plan_templates")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}
