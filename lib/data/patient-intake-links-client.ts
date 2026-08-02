import type { SupabaseClient } from "@supabase/supabase-js";

import type { PatientIntakeLink } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface PatientIntakeLinkRow {
  id: string;
  user_id: string;
  patient_id: string | null;
  label: string;
  status: PatientIntakeLink["status"];
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

/** The public URL is always derived, never persisted. */
export function buildIntakeUrl(linkId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/onboarding/${linkId}`;
}

function mapRow(row: PatientIntakeLinkRow): PatientIntakeLink {
  return {
    id: row.id,
    label: row.label,
    patientId: row.patient_id ?? undefined,
    status: row.status,
    expiresAt: row.expires_at ?? undefined,
    url: buildIntakeUrl(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPatientIntakeLinksClient(
  supabase?: SupabaseClient,
): Promise<PatientIntakeLink[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("patient_intake_links")
      .select("*")
      .order("updated_at", { ascending: false }),
    5000,
    "Supabase intake link request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as PatientIntakeLinkRow[]).map(mapRow);
}

export interface CreatePatientIntakeLinkInput {
  label: string;
  /** Set only when re-onboarding an existing patient. */
  patientId?: string;
  expiresAt?: string;
}

export async function createPatientIntakeLinkClient(
  input: CreatePatientIntakeLinkInput,
  supabase?: SupabaseClient,
): Promise<PatientIntakeLink> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data, error } = await client
    .from("patient_intake_links")
    .insert({
      user_id: userId,
      patient_id: input.patientId ?? null,
      label: input.label,
      status: "pending",
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as unknown as PatientIntakeLinkRow);
}

export async function revokePatientIntakeLinkClient(
  linkId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(linkId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client
    .from("patient_intake_links")
    .update({ status: "revoked" })
    .eq("id", linkId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePatientIntakeLinkClient(
  linkId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(linkId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_intake_links").delete().eq("id", linkId);

  if (error) {
    throw new Error(error.message);
  }
}
