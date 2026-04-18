import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActivityEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface ActivityRow {
  id: string;
  user_id: string;
  patient_id: string;
  date: string;
  type: string;
  duration_minutes: string;
  intensity: string | null;
  pal: string | null;
  energy_kcal: string | null;
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

function mapActivityRow(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    type: row.type,
    durationMinutes: Number(row.duration_minutes),
    intensity: row.intensity ?? undefined,
    pal: row.pal ? Number(row.pal) : undefined,
    energyKcal: row.energy_kcal ? Number(row.energy_kcal) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchActivitiesClient(
  supabase?: SupabaseClient,
): Promise<ActivityEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_activities").select("*").order("date", { ascending: false }),
    5000,
    "Supabase activities request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ActivityRow[]).map((row) => mapActivityRow(row));
}

export async function persistActivity(
  entry: Partial<ActivityEntry> & {
    patientId: string;
    date: string;
    type: string;
    durationMinutes: number;
  },
  supabase?: SupabaseClient,
): Promise<ActivityEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_activities")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        date: entry.date,
        type: entry.type,
        duration_minutes: entry.durationMinutes,
        intensity: entry.intensity ?? null,
        pal: entry.pal ?? null,
        energy_kcal: entry.energyKcal ?? null,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapActivityRow(persistedEntry as unknown as ActivityRow);
}

export async function deleteActivityClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_activities").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
