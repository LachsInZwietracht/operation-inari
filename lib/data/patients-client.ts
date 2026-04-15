import type { SupabaseClient } from "@supabase/supabase-js";

import type { Patient } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface PatientRow {
  id: string;
  legacy_id: string | null;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: Patient["gender"];
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  indication: string | null;
  notes: string | null;
  amputations: string[] | null;
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

function mapPatientRow(row: PatientRow): Patient {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    street: row.street ?? undefined,
    zip: row.zip ?? undefined,
    city: row.city ?? undefined,
    insuranceProvider: row.insurance_provider ?? undefined,
    insuranceNumber: row.insurance_number ?? undefined,
    indication: row.indication ?? undefined,
    notes: row.notes ?? undefined,
    amputations: row.amputations ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPatientsClient(
  supabase?: SupabaseClient,
): Promise<Patient[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patients").select("*").order("last_name", { ascending: true }),
    5000,
    "Supabase patient request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as PatientRow[]).map((row) => mapPatientRow(row));
}

export async function persistPatient(
  patient: Partial<Patient> & { firstName: string; lastName: string; dateOfBirth: string; gender: Patient["gender"] },
  supabase?: SupabaseClient,
): Promise<Patient> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = patient.id && isUuid(patient.id) ? patient.id : null;
  const legacyId = canonicalId ? patient.legacyId ?? null : patient.id ?? null;

  const { data: persistedPatient, error } = await client
    .from("patients")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        first_name: patient.firstName,
        last_name: patient.lastName,
        date_of_birth: patient.dateOfBirth,
        gender: patient.gender,
        email: patient.email ?? null,
        phone: patient.phone ?? null,
        street: patient.street ?? null,
        zip: patient.zip ?? null,
        city: patient.city ?? null,
        insurance_provider: patient.insuranceProvider ?? null,
        insurance_number: patient.insuranceNumber ?? null,
        indication: patient.indication ?? null,
        notes: patient.notes ?? null,
        amputations: patient.amputations ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPatientRow(persistedPatient as unknown as PatientRow);
}

export async function deletePatientClient(
  patientId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(patientId) ? "id" : "legacy_id";
  const { error } = await client
    .from("patients")
    .delete()
    .eq(column, patientId);

  if (error) {
    throw new Error(error.message);
  }
}
