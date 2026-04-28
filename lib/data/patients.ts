import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Patient } from "@/lib/types";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface PatientRow {
  id: string;
  legacy_id: string | null;
  user_id: string | null;
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

const PATIENT_COLUMNS = [
  "id",
  "legacy_id",
  "user_id",
  "first_name",
  "last_name",
  "date_of_birth",
  "gender",
  "email",
  "phone",
  "street",
  "zip",
  "city",
  "insurance_provider",
  "insurance_number",
  "indication",
  "notes",
  "amputations",
  "created_at",
  "updated_at",
].join(",");

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

async function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createServerSupabaseClient();
}

export const fetchPatients = cache(async (supabase?: SupabaseClient): Promise<Patient[]> => {
  try {
    const client = await resolveClient(supabase);
    const { data, error } = await withTimeout(
      client.from("patients").select(PATIENT_COLUMNS).order("last_name", { ascending: true }),
      5000,
      "Supabase patient request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as unknown as PatientRow[]).map(mapPatientRow);
  } catch (error) {
    console.warn("Falling back to empty patient list:", error);
    return [];
  }
});

export async function fetchPatientByRef(
  patientRef: string,
  supabase?: SupabaseClient,
): Promise<Patient | null> {
  try {
    const client = await resolveClient(supabase);
    const column = isUuid(patientRef) ? "id" : "legacy_id";
    const { data, error } = await withTimeout(
      client
        .from("patients")
        .select(PATIENT_COLUMNS)
        .eq(column, patientRef)
        .maybeSingle(),
      5000,
      "Supabase patient detail request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapPatientRow(data as unknown as PatientRow) : null;
  } catch (error) {
    console.warn("Falling back from patient detail lookup:", error);
    return null;
  }
}
