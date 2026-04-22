import { cache } from "react";

import type { PatientAllergenEntry } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";
import { PATIENT_ALLERGENS } from "@/lib/mock-data";

interface PatientAllergenRow {
  id: string;
  patient_id: string;
  allergen_id: string;
  type: PatientAllergenEntry["type"];
  severity: PatientAllergenEntry["severity"];
  diagnosed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapPatientAllergenRow(row: PatientAllergenRow): PatientAllergenEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    allergenId: row.allergen_id,
    type: row.type,
    severity: row.severity,
    diagnosedDate: row.diagnosed_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const fetchPatientAllergens = cache(async (): Promise<PatientAllergenEntry[]> => {
  try {
    const client = await createClient();
    const { data, error } = await withTimeout(
      client.from("patient_allergens").select("*").order("created_at", { ascending: false }),
      5000,
      "Supabase patient allergens request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as PatientAllergenRow[];
    if (rows.length === 0) {
      return PATIENT_ALLERGENS;
    }

    return rows.map((row) => mapPatientAllergenRow(row));
  } catch (error) {
    console.warn("Failed to fetch patient allergens from Supabase:", error);
    return PATIENT_ALLERGENS;
  }
});
