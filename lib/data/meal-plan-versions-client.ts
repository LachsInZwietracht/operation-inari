import type { SupabaseClient } from "@supabase/supabase-js";

import type { DailyMealPlan, MealPlanVersion, MealSlot, MealSlotType } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
];

interface MealPlanVersionRow {
  id: string;
  meal_plan_id: string;
  version_number: number;
  snapshot: unknown;
  reason: MealPlanVersion["reason"];
  created_by: string | null;
  created_at: string;
}

interface SnapshotOptions {
  supabase?: SupabaseClient;
  reason?: MealPlanVersion["reason"];
}

interface ListOptions {
  supabase?: SupabaseClient;
  limit?: number;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function normalizeSnapshotSlots(value: unknown): MealSlot[] {
  if (!Array.isArray(value)) {
    return SLOT_ORDER.map((type) => ({ type, entries: [] }));
  }

  const grouped = new Map<MealSlotType, MealSlot["entries"]>();
  for (const slotType of SLOT_ORDER) grouped.set(slotType, []);

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const slotRecord = raw as Record<string, unknown>;
    const type = slotRecord.type as MealSlotType | undefined;
    if (!type || !grouped.has(type)) continue;
    const entries = Array.isArray(slotRecord.entries) ? slotRecord.entries : [];
    grouped.set(
      type,
      entries
        .map((entryValue, index) => {
          if (!entryValue || typeof entryValue !== "object") return null;
          const entry = entryValue as Record<string, unknown>;
          const referenceId =
            (entry.referenceId as string | undefined) ??
            (entry.reference_id as string | undefined);
          const entryType = entry.type as "food" | "recipe" | undefined;
          const amount = Number(entry.amount ?? 0);
          if (!referenceId || (entryType !== "food" && entryType !== "recipe")) {
            return null;
          }
          return {
            id: typeof entry.id === "string" && entry.id.length > 0
              ? entry.id
              : `version_entry_${type}_${index}`,
            type: entryType,
            referenceId,
            amount,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    );
  }

  return SLOT_ORDER.map((type) => ({
    type,
    entries: grouped.get(type) ?? [],
  }));
}

function mapVersionRow(row: MealPlanVersionRow): MealPlanVersion {
  const snapshotRecord = (row.snapshot && typeof row.snapshot === "object"
    ? (row.snapshot as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  return {
    id: row.id,
    mealPlanId: row.meal_plan_id,
    versionNumber: row.version_number,
    reason: row.reason,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    snapshot: {
      title: typeof snapshotRecord.title === "string" ? snapshotRecord.title : undefined,
      notes: typeof snapshotRecord.notes === "string" ? snapshotRecord.notes : undefined,
      status: snapshotRecord.status as MealPlanVersion["snapshot"]["status"],
      targetProfileId:
        typeof snapshotRecord.targetProfileId === "string"
          ? snapshotRecord.targetProfileId
          : undefined,
      dietLineId:
        typeof snapshotRecord.dietLineId === "string" ? snapshotRecord.dietLineId : undefined,
      approvedAt:
        typeof snapshotRecord.approvedAt === "string" ? snapshotRecord.approvedAt : undefined,
      approvedBy:
        typeof snapshotRecord.approvedBy === "string" ? snapshotRecord.approvedBy : undefined,
      slots: normalizeSnapshotSlots(snapshotRecord.slots),
    },
  };
}

function buildSnapshotPayload(plan: DailyMealPlan) {
  return {
    title: plan.title ?? null,
    notes: plan.notes ?? null,
    status: plan.status ?? null,
    targetProfileId: plan.targetProfileId ?? null,
    dietLineId: plan.dietLineId ?? null,
    approvedAt: plan.approvedAt ?? null,
    approvedBy: plan.approvedBy ?? null,
    slots: plan.slots.map((slot) => ({
      type: slot.type,
      entries: slot.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        referenceId: entry.referenceId,
        amount: entry.amount,
      })),
    })),
  };
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

export async function fetchMealPlanVersionsClient(
  mealPlanId: string,
  options: ListOptions = {},
): Promise<MealPlanVersion[]> {
  const client = resolveBrowserClient(options.supabase);
  let query = client
    .from("meal_plan_versions")
    .select("id,meal_plan_id,version_number,snapshot,reason,created_by,created_at")
    .eq("meal_plan_id", mealPlanId)
    .order("version_number", { ascending: false });

  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  const { data, error } = await withTimeout(
    query,
    5000,
    "Supabase meal plan versions request timed out",
  );

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVersionRow(row as MealPlanVersionRow));
}

export async function snapshotMealPlanVersion(
  plan: DailyMealPlan,
  options: SnapshotOptions = {},
): Promise<MealPlanVersion> {
  const client = resolveBrowserClient(options.supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data: latest, error: latestError } = await client
    .from("meal_plan_versions")
    .select("version_number")
    .eq("meal_plan_id", plan.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);

  const nextVersion = (latest?.version_number ?? 0) + 1;

  const { data, error } = await client
    .from("meal_plan_versions")
    .insert({
      meal_plan_id: plan.id,
      version_number: nextVersion,
      snapshot: buildSnapshotPayload(plan),
      reason: options.reason ?? "approved",
      created_by: userId,
    })
    .select("id,meal_plan_id,version_number,snapshot,reason,created_by,created_at")
    .single();

  if (error) throw new Error(error.message);
  return mapVersionRow(data as MealPlanVersionRow);
}
