import type { SupabaseClient } from "@supabase/supabase-js";

import type { DigitalProtocolLink } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface DigitalProtocolLinkRow {
  id: string;
  user_id: string;
  patient_id: string;
  method: string;
  status: DigitalProtocolLink["status"];
  url: string;
  expires_at: string | null;
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

function mapDigitalProtocolLinkRow(row: DigitalProtocolLinkRow): DigitalProtocolLink {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    id: row.id,
    patientId: row.patient_id,
    method: row.method,
    status: row.status,
    url: origin ? `${origin}/protokoll/${row.id}` : row.url,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDigitalProtocolLinksClient(
  supabase?: SupabaseClient,
): Promise<DigitalProtocolLink[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("patient_digital_protocol_links")
      .select("*")
      .order("updated_at", { ascending: false }),
    5000,
    "Supabase digital protocol links request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as DigitalProtocolLinkRow[]).map((row) =>
    mapDigitalProtocolLinkRow(row),
  );
}

export async function persistDigitalProtocolLink(
  entry: Partial<DigitalProtocolLink> & {
    patientId: string;
    method: string;
    status: DigitalProtocolLink["status"];
    url: string;
  },
  supabase?: SupabaseClient,
): Promise<DigitalProtocolLink> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_digital_protocol_links")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        method: entry.method,
        status: entry.status,
        url: entry.url,
        expires_at: entry.expiresAt ?? null,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDigitalProtocolLinkRow(persistedEntry as unknown as DigitalProtocolLinkRow);
}

export async function deleteDigitalProtocolLinkClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client
    .from("patient_digital_protocol_links")
    .delete()
    .eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
