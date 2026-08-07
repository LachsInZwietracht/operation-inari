import type { SupabaseClient } from "@supabase/supabase-js";

import type { PatientIntakePayload, PatientIntakeSubmission } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface PatientIntakeSubmissionRow {
  id: string;
  link_id: string;
  patient_id: string | null;
  submitted_at: string;
  payload: PatientIntakePayload;
  status: PatientIntakeSubmission["status"];
  applied_patient_id: string | null;
  created_at: string;
  updated_at: string;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapRow(row: PatientIntakeSubmissionRow): PatientIntakeSubmission {
  return {
    id: row.id,
    linkId: row.link_id,
    patientId: row.patient_id ?? undefined,
    submittedAt: row.submitted_at,
    payload: row.payload,
    status: row.status,
    appliedPatientId: row.applied_patient_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPatientIntakeSubmissionsClient(
  supabase?: SupabaseClient,
): Promise<PatientIntakeSubmission[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("patient_intake_submissions")
      .select("*")
      .order("submitted_at", { ascending: false }),
    5000,
    "Supabase intake submission request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as PatientIntakeSubmissionRow[]).map(mapRow);
}

export interface ApplyIntakeSubmissionResult {
  patientId: string;
}

export async function applyPatientIntakeSubmission(
  submissionId: string,
): Promise<ApplyIntakeSubmissionResult> {
  const response = await fetch("/api/patient-intake-submissions/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? `Übernahme fehlgeschlagen (${response.status})`);
  }

  return { patientId: body.patientId as string };
}
