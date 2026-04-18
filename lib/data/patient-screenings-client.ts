import type { SupabaseClient } from "@supabase/supabase-js";

import type { ScreeningResult } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface ScreeningRow {
  id: string;
  user_id: string;
  patient_id: string;
  tool: ScreeningResult["tool"];
  score: string;
  risk_level: ScreeningResult["riskLevel"];
  answers: ScreeningResult["answers"];
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

function mapScreeningRow(row: ScreeningRow): ScreeningResult {
  return {
    id: row.id,
    patientId: row.patient_id,
    tool: row.tool,
    score: Number(row.score),
    riskLevel: row.risk_level,
    answers: row.answers ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchScreeningsClient(
  supabase?: SupabaseClient,
): Promise<ScreeningResult[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_screenings").select("*").order("created_at", { ascending: false }),
    5000,
    "Supabase screenings request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ScreeningRow[]).map((row) => mapScreeningRow(row));
}

export async function persistScreening(
  entry: Partial<ScreeningResult> & {
    patientId: string;
    tool: ScreeningResult["tool"];
    score: number;
    riskLevel: ScreeningResult["riskLevel"];
    answers: ScreeningResult["answers"];
  },
  supabase?: SupabaseClient,
): Promise<ScreeningResult> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_screenings")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        tool: entry.tool,
        score: entry.score,
        risk_level: entry.riskLevel,
        answers: entry.answers,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapScreeningRow(persistedEntry as unknown as ScreeningRow);
}

export async function deleteScreeningClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_screenings").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
