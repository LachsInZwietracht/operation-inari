import type { SupabaseClient } from "@supabase/supabase-js";

import type { TherapyDeviceIntegration } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface TherapyIntegrationRow {
  id: string;
  user_id: string;
  patient_id: string;
  type: TherapyDeviceIntegration["type"];
  status: TherapyDeviceIntegration["status"];
  vendor: string;
  last_sync: string | null;
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

function mapTherapyIntegrationRow(row: TherapyIntegrationRow): TherapyDeviceIntegration {
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    status: row.status,
    vendor: row.vendor,
    lastSync: row.last_sync ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchTherapyIntegrationsClient(
  supabase?: SupabaseClient,
): Promise<TherapyDeviceIntegration[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_therapy_integrations").select("*").order("created_at", { ascending: false }),
    5000,
    "Supabase therapy integrations request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as TherapyIntegrationRow[]).map((row) =>
    mapTherapyIntegrationRow(row),
  );
}

export async function persistTherapyIntegration(
  entry: Partial<TherapyDeviceIntegration> & {
    patientId: string;
    type: TherapyDeviceIntegration["type"];
    status: TherapyDeviceIntegration["status"];
    vendor: string;
  },
  supabase?: SupabaseClient,
): Promise<TherapyDeviceIntegration> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_therapy_integrations")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        type: entry.type,
        status: entry.status,
        vendor: entry.vendor,
        last_sync: entry.lastSync ?? null,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapTherapyIntegrationRow(persistedEntry as unknown as TherapyIntegrationRow);
}

export async function deleteTherapyIntegrationClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_therapy_integrations").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
