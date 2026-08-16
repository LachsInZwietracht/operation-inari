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
  reviewer_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
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
    reviewerNotes: row.reviewer_notes ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
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
  patientName?: string;
}

export async function applyPatientIntakeSubmission(
  submissionId: string,
  options?: { payload?: PatientIntakePayload; reviewerNotes?: string },
): Promise<ApplyIntakeSubmissionResult> {
  const response = await fetch("/api/patient-intake-submissions/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, ...options }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? `Übernahme fehlgeschlagen (${response.status})`);
  }

  return {
    patientId: body.patientId as string,
    patientName: typeof body.patientName === "string" ? body.patientName : undefined,
  };
}

export async function discardPatientIntakeSubmission(
  submissionId: string,
  options?: { reviewerNotes?: string },
): Promise<void> {
  const response = await fetch("/api/patient-intake-submissions/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, action: "discard", ...options }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Verwerfen fehlgeschlagen (${response.status})`);
  }
}
