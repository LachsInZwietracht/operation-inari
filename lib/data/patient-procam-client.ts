import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProcamResult } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface ProcamRow {
  id: string;
  user_id: string;
  patient_id: string;
  score: string;
  category: ProcamResult["category"];
  age: string;
  ldl: string;
  hdl: string;
  systolic: string;
  smoker: boolean;
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

function mapProcamRow(row: ProcamRow): ProcamResult {
  return {
    id: row.id,
    patientId: row.patient_id,
    score: Number(row.score),
    category: row.category,
    age: Number(row.age),
    ldl: Number(row.ldl),
    hdl: Number(row.hdl),
    systolic: Number(row.systolic),
    smoker: row.smoker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchProcamResultsClient(
  supabase?: SupabaseClient,
): Promise<ProcamResult[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_procam_results").select("*").order("updated_at", { ascending: false }),
    5000,
    "Supabase PROCAM request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ProcamRow[]).map((row) => mapProcamRow(row));
}

export async function persistProcamResult(
  entry: Partial<ProcamResult> & {
    patientId: string;
    score: number;
    category: ProcamResult["category"];
    age: number;
    ldl: number;
    hdl: number;
    systolic: number;
    smoker: boolean;
  },
  supabase?: SupabaseClient,
): Promise<ProcamResult> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_procam_results")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        score: entry.score,
        category: entry.category,
        age: entry.age,
        ldl: entry.ldl,
        hdl: entry.hdl,
        systolic: entry.systolic,
        smoker: entry.smoker,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProcamRow(persistedEntry as unknown as ProcamRow);
}

export async function deleteProcamResultClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_procam_results").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
