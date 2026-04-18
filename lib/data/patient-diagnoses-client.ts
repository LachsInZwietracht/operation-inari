import type { SupabaseClient } from "@supabase/supabase-js";

import type { DiagnosisEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface DiagnosisRow {
  id: string;
  user_id: string;
  patient_id: string;
  diagnosis: string;
  icd_code: string | null;
  start_date: string;
  end_date: string | null;
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

function mapDiagnosisRow(row: DiagnosisRow): DiagnosisEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    diagnosis: row.diagnosis,
    icdCode: row.icd_code ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDiagnosesClient(
  supabase?: SupabaseClient,
): Promise<DiagnosisEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_diagnoses").select("*").order("start_date", { ascending: false }),
    5000,
    "Supabase diagnoses request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as DiagnosisRow[]).map((row) => mapDiagnosisRow(row));
}

export async function persistDiagnosis(
  entry: Partial<DiagnosisEntry> & {
    patientId: string;
    diagnosis: string;
    startDate: string;
  },
  supabase?: SupabaseClient,
): Promise<DiagnosisEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_diagnoses")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        diagnosis: entry.diagnosis,
        icd_code: entry.icdCode ?? null,
        start_date: entry.startDate,
        end_date: entry.endDate ?? null,
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

  return mapDiagnosisRow(persistedEntry as unknown as DiagnosisRow);
}

export async function deleteDiagnosisClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_diagnoses").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
