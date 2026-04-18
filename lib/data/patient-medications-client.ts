import type { SupabaseClient } from "@supabase/supabase-js";

import type { MedicationEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface MedicationRow {
  id: string;
  user_id: string;
  patient_id: string;
  name: string;
  dosage: string;
  schedule: string;
  start_date: string;
  end_date: string | null;
  reason: string | null;
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

function mapMedicationRow(row: MedicationRow): MedicationEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    dosage: row.dosage,
    schedule: row.schedule,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    reason: row.reason ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchMedicationsClient(
  supabase?: SupabaseClient,
): Promise<MedicationEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_medications").select("*").order("start_date", { ascending: false }),
    5000,
    "Supabase medications request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as MedicationRow[]).map((row) => mapMedicationRow(row));
}

export async function persistMedication(
  entry: Partial<MedicationEntry> & {
    patientId: string;
    name: string;
    dosage: string;
    schedule: string;
    startDate: string;
  },
  supabase?: SupabaseClient,
): Promise<MedicationEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_medications")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        name: entry.name,
        dosage: entry.dosage,
        schedule: entry.schedule,
        start_date: entry.startDate,
        end_date: entry.endDate ?? null,
        reason: entry.reason ?? null,
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

  return mapMedicationRow(persistedEntry as unknown as MedicationRow);
}

export async function deleteMedicationClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_medications").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
