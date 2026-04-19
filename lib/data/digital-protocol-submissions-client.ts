import type { SupabaseClient } from "@supabase/supabase-js";

import type { DigitalProtocolSubmission } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface SubmissionRow {
  id: string;
  link_id: string;
  patient_id: string;
  submitted_at: string;
  days: unknown;
  notes: string | null;
  status: DigitalProtocolSubmission["status"];
  converted_protocol_id: string | null;
  created_at: string;
  updated_at: string;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapRow(row: SubmissionRow): DigitalProtocolSubmission {
  return {
    id: row.id,
    linkId: row.link_id,
    patientId: row.patient_id,
    submittedAt: row.submitted_at,
    days: row.days as DigitalProtocolSubmission["days"],
    notes: row.notes ?? undefined,
    status: row.status,
    convertedProtocolId: row.converted_protocol_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchSubmissionsForPatientClient(
  patientId: string,
  supabase?: SupabaseClient
): Promise<DigitalProtocolSubmission[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("digital_protocol_submissions")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    5000,
    "Supabase submissions request timed out"
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as SubmissionRow[]).map(mapRow);
}

export async function fetchSubmissionByIdClient(
  submissionId: string,
  supabase?: SupabaseClient
): Promise<DigitalProtocolSubmission | null> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("digital_protocol_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle(),
    5000,
    "Supabase submission lookup timed out"
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapRow(data as unknown as SubmissionRow);
}

export async function updateSubmissionStatusClient(
  submissionId: string,
  status: DigitalProtocolSubmission["status"],
  supabase?: SupabaseClient
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const { error } = await client
    .from("digital_protocol_submissions")
    .update({ status })
    .eq("id", submissionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function completeSubmissionConversionClient(
  submissionId: string,
  protocolId: string
): Promise<DigitalProtocolSubmission> {
  const response = await fetch("/api/digital-protocol-submissions/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      submissionId,
      protocolId,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string; submission?: SubmissionRow }
    | null;

  if (!response.ok || !body?.submission) {
    throw new Error(body?.error ?? `Fehler beim Uebernehmen der Einreichung (${response.status})`);
  }

  return mapRow(body.submission);
}
