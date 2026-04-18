import type { SupabaseClient } from "@supabase/supabase-js";

import type { TherapySetting } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface TherapySettingRow {
  id: string;
  user_id: string;
  patient_id: string;
  module: TherapySetting["module"];
  status: TherapySetting["status"];
  targets: TherapySetting["targets"] | null;
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

function mapTherapySettingRow(row: TherapySettingRow): TherapySetting {
  return {
    id: row.id,
    patientId: row.patient_id,
    module: row.module,
    status: row.status,
    targets: row.targets ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchTherapySettingsClient(
  supabase?: SupabaseClient,
): Promise<TherapySetting[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_therapy_settings").select("*").order("updated_at", { ascending: false }),
    5000,
    "Supabase therapy settings request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as TherapySettingRow[]).map((row) =>
    mapTherapySettingRow(row),
  );
}

export async function persistTherapySetting(
  entry: Partial<TherapySetting> & {
    patientId: string;
    module: TherapySetting["module"];
    status: TherapySetting["status"];
  },
  supabase?: SupabaseClient,
): Promise<TherapySetting> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_therapy_settings")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        module: entry.module,
        status: entry.status,
        targets: entry.targets ?? {},
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

  return mapTherapySettingRow(persistedEntry as unknown as TherapySettingRow);
}

export async function deleteTherapySettingClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_therapy_settings").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
