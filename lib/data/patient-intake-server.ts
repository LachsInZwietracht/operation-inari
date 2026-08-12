import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildIntakeUrl } from "@/lib/data/patient-intake-links-client";
import type { PatientIntakeLink } from "@/lib/types";

/**
 * Server-side read of the intake links.
 *
 * The submissions fetcher needs no server variant — like the counseling and
 * appointment fetchers, it takes a Supabase client and maps plain columns, so
 * a page can call it directly. Links are the exception: their public URL is
 * derived from `window.location.origin`, which is empty on the server, so a
 * server-rendered link would carry a relative URL and the copy-link button
 * would hand out something unusable.
 */

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const explicit = requestHeaders.get("origin");
  if (explicit) return explicit;

  const host = requestHeaders.get("host");
  if (host) {
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    return `${isLocal ? "http" : "https"}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

interface PatientIntakeLinkRow {
  id: string;
  patient_id: string | null;
  label: string;
  status: PatientIntakeLink["status"];
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchPatientIntakeLinksServer(
  supabase: SupabaseClient,
): Promise<PatientIntakeLink[]> {
  const origin = await requestOrigin();
  const { data, error } = await supabase
    .from("patient_intake_links")
    .select("id, patient_id, label, status, expires_at, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as PatientIntakeLinkRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    patientId: row.patient_id ?? undefined,
    status: row.status,
    expiresAt: row.expires_at ?? undefined,
    url: buildIntakeUrl(row.id, origin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
