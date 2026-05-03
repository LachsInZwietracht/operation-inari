import type { SupabaseClient } from "@supabase/supabase-js";

import type { MealOrder } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface MealOrderRow {
  id: string;
  legacy_id: string | null;
  user_id: string;
  inpatient_stay_id: string;
  patient_id: string;
  patient_name: string;
  station: string;
  room: string;
  bed: string;
  service_date: string;
  meal_slot: MealOrder["mealSlot"];
  recipe_id: string;
  recipe_name: string;
  diet_form_ids_snapshot: string[] | null;
  allergen_ids_snapshot: string[] | null;
  restriction_summary: string[] | null;
  special_instructions: string | null;
  status: MealOrder["status"];
  created_at: string;
  updated_at: string;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

async function resolvePatientId(client: SupabaseClient, patientId: string) {
  if (isUuid(patientId)) return patientId;

  const { data, error } = await client
    .from("patients")
    .select("id")
    .eq("legacy_id", patientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("PATIENT_NOT_SYNCED");
  }

  return data.id as string;
}

async function resolveStayId(client: SupabaseClient, stayId: string) {
  if (isUuid(stayId)) return stayId;

  const { data, error } = await client
    .from("inpatient_stays")
    .select("id")
    .eq("legacy_id", stayId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("STAY_NOT_SYNCED");
  }

  return data.id as string;
}

function mapMealOrderRow(row: MealOrderRow): MealOrder {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    inpatientStayId: row.inpatient_stay_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    station: row.station,
    room: row.room,
    bed: row.bed,
    date: row.service_date,
    mealSlot: row.meal_slot,
    recipeId: row.recipe_id,
    recipeName: row.recipe_name,
    dietFormIdsSnapshot: row.diet_form_ids_snapshot ?? [],
    allergenIdsSnapshot: row.allergen_ids_snapshot ?? [],
    restrictionSummary: row.restriction_summary ?? [],
    specialInstructions: row.special_instructions ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchMealOrdersClient(
  supabase?: SupabaseClient,
): Promise<MealOrder[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("meal_orders").select("*").order("service_date", { ascending: false }),
    5000,
    "Supabase meal orders request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as MealOrderRow[]).map((row) => mapMealOrderRow(row));
}

export async function persistMealOrder(
  order: MealOrder,
  supabase?: SupabaseClient,
): Promise<MealOrder> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const patientId = await resolvePatientId(client, order.patientId);
  const inpatientStayId = await resolveStayId(client, order.inpatientStayId);
  const canonicalId = order.id && isUuid(order.id) ? order.id : null;
  const legacyId = canonicalId ? order.legacyId ?? null : order.id ?? null;

  const { data, error } = await client
    .from("meal_orders")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        inpatient_stay_id: inpatientStayId,
        patient_id: patientId,
        patient_name: order.patientName,
        station: order.station,
        room: order.room,
        bed: order.bed,
        service_date: order.date,
        meal_slot: order.mealSlot,
        recipe_id: order.recipeId,
        recipe_name: order.recipeName,
        diet_form_ids_snapshot: order.dietFormIdsSnapshot,
        allergen_ids_snapshot: order.allergenIdsSnapshot,
        restriction_summary: order.restrictionSummary,
        special_instructions: order.specialInstructions ?? null,
        status: order.status,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: canonicalId ? "id" : "legacy_id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = mapMealOrderRow(data as unknown as MealOrderRow);
  await writeAccessAuditLog(client, {
    action: canonicalId ? "meal_order_updated" : "meal_order_created",
    targetType: "meal_order",
    targetId: result.id,
    metadata: {
      patientId,
      inpatientStayId,
      serviceDate: result.date,
      mealSlot: result.mealSlot,
      station: result.station,
      status: result.status,
      allergenSnapshotCount: result.allergenIdsSnapshot.length,
      dietFormSnapshotCount: result.dietFormIdsSnapshot.length,
    },
  });

  return result;
}

export async function deleteMealOrderClient(
  orderId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(orderId) ? "id" : "legacy_id";
  const { error } = await client.from("meal_orders").delete().eq(column, orderId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAccessAuditLog(client, {
    action: "meal_order_deleted",
    targetType: "meal_order",
    targetId: orderId,
    metadata: {
      lookupColumn: column,
    },
  });
}
