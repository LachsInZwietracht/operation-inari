import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientFoodLogDay, ClientFoodLogEntry, MealSlotType, NutrientValue } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface FoodLogDayRow {
  id: string;
  client_user_id: string;
  log_date: string;
  notes: string | null;
  water_ml: number | null;
  client_food_log_entries: FoodLogEntryRow[] | null;
}

interface FoodLogEntryRow {
  id: string;
  day_id: string;
  slot_type: MealSlotType;
  source_type: ClientFoodLogEntry["sourceType"];
  food_id: string | null;
  custom_name: string | null;
  custom_nutrients: NutrientValue[] | null;
  amount: number;
  notes: string | null;
  logged_at: string;
  sort_order: number;
}

const DAY_COLUMNS =
  "id,client_user_id,log_date,notes,water_ml," +
  "client_food_log_entries(id,day_id,slot_type,source_type,food_id,custom_name,custom_nutrients,amount,notes,logged_at,sort_order)";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

function mapEntryRow(row: FoodLogEntryRow): ClientFoodLogEntry {
  return {
    id: row.id,
    dayId: row.day_id,
    slotType: row.slot_type,
    sourceType: row.source_type,
    foodId: row.food_id ?? undefined,
    customName: row.custom_name ?? undefined,
    customNutrients: row.custom_nutrients ?? undefined,
    amount: Number(row.amount ?? 0),
    notes: row.notes ?? undefined,
    loggedAt: row.logged_at,
    sortOrder: row.sort_order ?? 0,
  };
}

function mapDayRow(row: FoodLogDayRow): ClientFoodLogDay {
  const entries = (row.client_food_log_entries ?? [])
    .map(mapEntryRow)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.loggedAt.localeCompare(b.loggedAt));

  return {
    id: row.id,
    date: row.log_date,
    notes: row.notes ?? undefined,
    waterMl: row.water_ml ?? undefined,
    entries,
  };
}

/**
 * One logged day with its entries. `clientUserId` is explicit so the same
 * query serves the client reading their own day and the counselor reading a
 * consented client's day — RLS decides whether the row comes back.
 */
export async function fetchClientFoodLogDay(
  clientUserId: string,
  date: string,
  supabase?: SupabaseClient,
): Promise<ClientFoodLogDay | null> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("client_food_log_days")
      .select(DAY_COLUMNS)
      .eq("client_user_id", clientUserId)
      .eq("log_date", date)
      .maybeSingle(),
    5000,
    "Supabase client food log request timed out",
  );

  if (error) throw new Error(error.message);
  return data ? mapDayRow(data as unknown as FoodLogDayRow) : null;
}

/** Logged days in a date range, newest first. Used by the counselor view. */
export async function fetchClientFoodLogDays(
  clientUserId: string,
  range: { from: string; to: string },
  supabase?: SupabaseClient,
): Promise<ClientFoodLogDay[]> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("client_food_log_days")
      .select(DAY_COLUMNS)
      .eq("client_user_id", clientUserId)
      .gte("log_date", range.from)
      .lte("log_date", range.to)
      .order("log_date", { ascending: false }),
    8000,
    "Supabase client food log range request timed out",
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FoodLogDayRow[]).map(mapDayRow);
}

/**
 * Returns the day row for the signed-in client, creating it on first entry.
 * `upsert` on the (client_user_id, log_date) unique index keeps concurrent
 * first entries from racing into a duplicate-key error.
 */
export async function ensureClientFoodLogDay(
  date: string,
  supabase?: SupabaseClient,
): Promise<ClientFoodLogDay> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("client_food_log_days")
    .upsert(
      { client_user_id: userId, log_date: date },
      { onConflict: "client_user_id,log_date", ignoreDuplicates: false },
    )
    .select(DAY_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapDayRow(data as unknown as FoodLogDayRow);
}

export interface ClientFoodLogEntryInput {
  dayId: string;
  slotType: MealSlotType;
  sourceType: ClientFoodLogEntry["sourceType"];
  foodId?: string;
  customName?: string;
  customNutrients?: NutrientValue[];
  amount: number;
  notes?: string;
  sortOrder?: number;
}

export async function addClientFoodLogEntry(
  input: ClientFoodLogEntryInput,
  supabase?: SupabaseClient,
): Promise<ClientFoodLogEntry> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("client_food_log_entries")
    .insert({
      day_id: input.dayId,
      client_user_id: userId,
      slot_type: input.slotType,
      source_type: input.sourceType,
      food_id: input.foodId ?? null,
      custom_name: input.customName ?? null,
      custom_nutrients: input.customNutrients ?? null,
      amount: input.amount,
      notes: input.notes ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapEntryRow(data as unknown as FoodLogEntryRow);
}

export async function updateClientFoodLogEntryAmount(
  entryId: string,
  amount: number,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const { error } = await client
    .from("client_food_log_entries")
    .update({ amount })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
}

/**
 * Household measures for the given foods, keyed by food id.
 *
 * `food_portions` is filled by a curated ETL for the German catalog and has so
 * far only been read on the counselor side. A client does not weigh their
 * bread — they eat a slice — so the diary offers the slice.
 */
export async function fetchFoodPortions(
  foodIds: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, { label: string; amountGrams: number }[]>> {
  const byFood = new Map<string, { label: string; amountGrams: number }[]>();
  if (foodIds.length === 0) return byFood;

  const client = resolveClient(supabase);
  const { data, error } = await client
    .from("food_portions")
    .select("food_id,label,amount_grams")
    .in("food_id", [...new Set(foodIds)]);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { food_id: string; label: string; amount_grams: number }[]) {
    const list = byFood.get(row.food_id) ?? [];
    list.push({ label: row.label, amountGrams: Number(row.amount_grams) });
    byFood.set(row.food_id, list);
  }
  return byFood;
}

/**
 * The day's own context — how it went, and how much was drunk.
 *
 * `null` clears a value; leaving a key out leaves it alone. The distinction
 * matters for water, where 0 ml is a statement and "not tracked" is not.
 */
export async function updateClientFoodLogDay(
  dayId: string,
  patch: { notes?: string | null; waterMl?: number | null },
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);

  const row: Record<string, unknown> = {};
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null;
  if (patch.waterMl !== undefined) row.water_ml = patch.waterMl;
  if (Object.keys(row).length === 0) return;

  const { error } = await client.from("client_food_log_days").update(row).eq("id", dayId);
  if (error) throw new Error(error.message);
}

export async function deleteClientFoodLogEntry(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const { error } = await client
    .from("client_food_log_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw new Error(error.message);
}
