import type { SupabaseClient } from "@supabase/supabase-js";

import type { LabValueEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface LabValueRow {
  id: string;
  user_id: string;
  patient_id: string;
  parameter_id: string;
  date: string;
  value: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
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

function mapLabValueRow(row: LabValueRow): LabValueEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    parameterId: row.parameter_id,
    date: row.date,
    value: Number(row.value),
    notes: row.notes ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchLabValuesClient(
  supabase?: SupabaseClient,
): Promise<LabValueEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_lab_values").select("*").order("date", { ascending: true }),
    5000,
    "Supabase lab values request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as LabValueRow[]).map((row) => mapLabValueRow(row));
}

export async function persistLabValue(
  entry: Partial<LabValueEntry> & {
    patientId: string;
    parameterId: string;
    date: string;
    value: number;
  },
  supabase?: SupabaseClient,
): Promise<LabValueEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const payload = {
    ...(canonicalId ? { id: canonicalId } : {}),
    user_id: userId,
    patient_id: entry.patientId,
    parameter_id: entry.parameterId,
    date: entry.date,
    value: entry.value,
    notes: entry.notes ?? null,
    metadata: entry.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  let { data: persistedEntry, error } = await client
    .from("patient_lab_values")
    .upsert(payload, canonicalId ? { onConflict: "id" } : undefined)
    .select("*")
    .single();

  if (error && error.message.includes("metadata")) {
    const retry = await client
      .from("patient_lab_values")
      .upsert(
        {
          ...(canonicalId ? { id: canonicalId } : {}),
          user_id: userId,
          patient_id: entry.patientId,
          parameter_id: entry.parameterId,
          date: entry.date,
          value: entry.value,
          notes: entry.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        canonicalId ? { onConflict: "id" } : undefined,
      )
      .select("*")
      .single();
    persistedEntry = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return mapLabValueRow(persistedEntry as unknown as LabValueRow);
}

export async function deleteLabValueClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_lab_values").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
