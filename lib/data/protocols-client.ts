import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NutritionProtocol,
  ProtocolDay,
  ProtocolEntry,
  ProtocolMetadata,
} from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface ProtocolRow {
  id: string;
  legacy_id: string | null;
  patient_id: string;
  title: string;
  type: NutritionProtocol["type"];
  start_date: string;
  end_date: string;
  notes: string | null;
  metadata: ProtocolMetadata | null;
  created_at: string;
  updated_at: string;
  nutrition_protocol_entries: ProtocolEntryRow[] | null;
}

interface ProtocolEntryRow {
  id: string;
  protocol_id: string;
  protocol_date: string;
  food_id: string;
  amount: number;
  meal_slot: ProtocolEntry["mealSlot"];
  entry_time: string | null;
  notes: string | null;
  measurement_mode: ProtocolEntry["measurementMode"] | null;
  household_measurement: ProtocolEntry["householdMeasurement"] | null;
  sort_order: number | null;
}

interface ProtocolPersistInput extends Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  legacyId?: string;
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

function baseProtocolQuery(client: SupabaseClient) {
  return client
    .from("nutrition_protocols")
    .select(
      [
        "id",
        "legacy_id",
        "patient_id",
        "title",
        "type",
        "start_date",
        "end_date",
        "notes",
        "metadata",
        "created_at",
        "updated_at",
        "nutrition_protocol_entries(id,protocol_id,protocol_date,food_id,amount,meal_slot,entry_time,notes,measurement_mode,household_measurement,sort_order)",
      ].join(","),
    )
    .order("start_date", { ascending: false });
}

function mapProtocolRow(row: ProtocolRow): NutritionProtocol {
  const groupedDays = new Map<string, ProtocolEntry[]>();

  for (const entry of row.nutrition_protocol_entries ?? []) {
    const bucket = groupedDays.get(entry.protocol_date) ?? [];
    bucket.push({
      id: entry.id,
      foodId: entry.food_id,
      amount: Number(entry.amount ?? 0),
      mealSlot: entry.meal_slot,
      time: entry.entry_time ?? undefined,
      notes: entry.notes ?? undefined,
      measurementMode: entry.measurement_mode ?? undefined,
      householdMeasurement: entry.household_measurement ?? undefined,
    });
    groupedDays.set(entry.protocol_date, bucket);
  }

  const days: ProtocolDay[] = [...groupedDays.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({
      date,
      entries,
    }));

  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    patientId: row.patient_id,
    title: row.title,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes ?? undefined,
    days,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchProtocolsClient(
  supabase?: SupabaseClient,
  options: { patientRefs?: string[] } = {},
): Promise<NutritionProtocol[]> {
  const client = resolveBrowserClient(supabase);
  let query = baseProtocolQuery(client);
  const patientRefs = options.patientRefs?.filter(Boolean);
  if (patientRefs?.length) {
    query = query.in("patient_id", patientRefs);
  }

  const { data, error } = await withTimeout(
    query,
    5000,
    "Supabase protocol request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ProtocolRow[]).map((row) => mapProtocolRow(row));
}

export async function persistProtocol(
  protocol: ProtocolPersistInput,
  supabase?: SupabaseClient,
): Promise<NutritionProtocol> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = protocol.id && isUuid(protocol.id) ? protocol.id : null;
  const legacyId = canonicalId ? protocol.legacyId ?? null : protocol.id ?? null;

  const { data: persistedProtocol, error: protocolError } = await client
    .from("nutrition_protocols")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        patient_id: protocol.patientId,
        title: protocol.title,
        type: protocol.type,
        start_date: protocol.startDate,
        end_date: protocol.endDate,
        notes: protocol.notes ?? null,
        metadata: protocol.metadata ?? {},
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select("id")
    .single();

  if (protocolError) {
    throw new Error(protocolError.message);
  }

  const protocolId = persistedProtocol.id;

  const { error: deleteEntriesError } = await client
    .from("nutrition_protocol_entries")
    .delete()
    .eq("protocol_id", protocolId);

  if (deleteEntriesError) {
    throw new Error(deleteEntriesError.message);
  }

  const flattenedEntries = protocol.days.flatMap((day) =>
    day.entries.map((entry, index) => ({
      protocol_id: protocolId,
      protocol_date: day.date,
      food_id: entry.foodId,
      amount: entry.amount,
      meal_slot: entry.mealSlot,
      entry_time: entry.time ?? null,
      notes: entry.notes ?? null,
      measurement_mode: entry.measurementMode ?? null,
      household_measurement: entry.householdMeasurement ?? null,
      sort_order: index,
    })),
  );

  if (flattenedEntries.length > 0) {
    const { error: insertEntriesError } = await client
      .from("nutrition_protocol_entries")
      .insert(flattenedEntries);

    if (insertEntriesError) {
      throw new Error(insertEntriesError.message);
    }
  }

  const { data: reloadedProtocol, error: reloadError } = await withTimeout(
    baseProtocolQuery(client).eq("id", protocolId).single(),
    5000,
    "Supabase protocol lookup timed out",
  );

  if (reloadError) {
    throw new Error(reloadError.message);
  }

  return mapProtocolRow(reloadedProtocol as unknown as ProtocolRow);
}

export async function deleteProtocolClient(
  protocolId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(protocolId) ? "id" : "legacy_id";
  const { error } = await client
    .from("nutrition_protocols")
    .delete()
    .eq(column, protocolId);

  if (error) {
    throw new Error(error.message);
  }
}
