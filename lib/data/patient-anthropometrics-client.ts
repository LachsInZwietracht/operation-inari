import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnthropometricEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface AnthropometricRow {
  id: string;
  user_id: string;
  patient_id: string;
  date: string;
  weight: string;
  height: string;
  bmi: string;
  waist_circumference: string | null;
  hip_circumference: string | null;
  body_fat_percentage: string | null;
  notes: string | null;
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

function mapAnthropometricRow(row: AnthropometricRow): AnthropometricEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    weight: Number(row.weight),
    height: Number(row.height),
    bmi: Number(row.bmi),
    waistCircumference: row.waist_circumference ? Number(row.waist_circumference) : undefined,
    hipCircumference: row.hip_circumference ? Number(row.hip_circumference) : undefined,
    bodyFatPercentage: row.body_fat_percentage ? Number(row.body_fat_percentage) : undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAnthropometricEntriesClient(
  supabase?: SupabaseClient,
): Promise<AnthropometricEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_anthropometrics").select("*").order("date", { ascending: true }),
    5000,
    "Supabase anthropometrics request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as AnthropometricRow[]).map((row) =>
    mapAnthropometricRow(row),
  );
}

export async function persistAnthropometricEntry(
  entry: Partial<AnthropometricEntry> & {
    patientId: string;
    date: string;
    weight: number;
    height: number;
    bmi: number;
  },
  supabase?: SupabaseClient,
): Promise<AnthropometricEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_anthropometrics")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        date: entry.date,
        weight: entry.weight,
        height: entry.height,
        bmi: entry.bmi,
        waist_circumference: entry.waistCircumference ?? null,
        hip_circumference: entry.hipCircumference ?? null,
        body_fat_percentage: entry.bodyFatPercentage ?? null,
        notes: entry.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapAnthropometricRow(persistedEntry as unknown as AnthropometricRow);
}

export async function deleteAnthropometricEntryClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_anthropometrics").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
