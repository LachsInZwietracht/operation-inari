import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientLink } from "@/lib/types";

/**
 * Shared row mapping for `client_links`. Reads work with any Supabase client
 * (server or browser) because RLS lets both sides of a link read it. Writes
 * live in server actions with the service-role client — see the migration.
 */
export interface ClientLinkRow {
  id: string;
  patient_id: string;
  counselor_user_id: string;
  client_user_id: string | null;
  invite_code: string;
  invite_expires_at: string | null;
  status: ClientLink["status"];
  consent_nutrition: boolean;
  consent_training: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CLIENT_LINK_COLUMNS =
  "id,patient_id,counselor_user_id,client_user_id,invite_code,invite_expires_at,status,consent_nutrition,consent_training,consented_at,revoked_at,created_at,updated_at";

export function mapClientLinkRow(row: ClientLinkRow): ClientLink {
  return {
    id: row.id,
    patientId: row.patient_id,
    counselorUserId: row.counselor_user_id,
    clientUserId: row.client_user_id ?? undefined,
    inviteCode: row.invite_code,
    inviteExpiresAt: row.invite_expires_at ?? undefined,
    status: row.status,
    consentNutrition: row.consent_nutrition,
    consentTraining: row.consent_training,
    consentedAt: row.consented_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The open or active link of a patient record. Revoked links are history. */
export async function fetchClientLinkForPatient(
  supabase: SupabaseClient,
  patientId: string,
): Promise<ClientLink | null> {
  const { data, error } = await supabase
    .from("client_links")
    .select(CLIENT_LINK_COLUMNS)
    .eq("patient_id", patientId)
    .neq("status", "revoked")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapClientLinkRow(data as unknown as ClientLinkRow) : null;
}

/**
 * Display names for the counselor side of a link.
 *
 * Needs a service-role client: a client account has no membership in the
 * counselor's organization and no read access to their patient record, so
 * neither name resolves through RLS. Only names are surfaced, nothing else.
 */
export async function fetchCounselorNames(
  serviceClient: SupabaseClient,
  counselorUserIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (counselorUserIds.length === 0) return names;

  const { data, error } = await serviceClient
    .from("organization_memberships")
    .select("user_id,display_name,email")
    .in("user_id", counselorUserIds);

  if (error) return names;

  for (const row of (data ?? []) as { user_id: string; display_name: string | null; email: string }[]) {
    if (names.has(row.user_id)) continue;
    names.set(row.user_id, row.display_name?.trim() || row.email);
  }

  return names;
}

export async function fetchPatientNames(
  serviceClient: SupabaseClient,
  patientIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (patientIds.length === 0) return names;

  const { data, error } = await serviceClient
    .from("patients")
    .select("id,first_name,last_name")
    .in("id", patientIds);

  if (error) return names;

  for (const row of (data ?? []) as { id: string; first_name: string; last_name: string }[]) {
    names.set(row.id, `${row.first_name} ${row.last_name}`.trim());
  }

  return names;
}

/** All active links where the given user is the client. */
export async function fetchActiveLinksForClient(
  supabase: SupabaseClient,
  clientUserId: string,
): Promise<ClientLink[]> {
  const { data, error } = await supabase
    .from("client_links")
    .select(CLIENT_LINK_COLUMNS)
    .eq("client_user_id", clientUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ClientLinkRow[]).map(mapClientLinkRow);
}
