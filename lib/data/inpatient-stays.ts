import { cache } from "react";

import type { InpatientStay } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

interface InpatientStayRow {
  id: string;
  legacy_id: string | null;
  patient_id: string;
  station: string;
  room: string;
  bed: string;
  status: InpatientStay["status"];
  admission_date: string;
  discharge_date: string | null;
  diet_form_ids: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapInpatientStayRow(row: InpatientStayRow): InpatientStay {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    patientId: row.patient_id,
    station: row.station,
    room: row.room,
    bed: row.bed,
    status: row.status,
    admissionDate: row.admission_date,
    dischargeDate: row.discharge_date ?? undefined,
    dietFormIds: row.diet_form_ids ?? [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const fetchInpatientStays = cache(async (): Promise<InpatientStay[]> => {
  try {
    const client = await createClient();
    const { data, error } = await withTimeout(
      client.from("inpatient_stays").select("*").order("admission_date", { ascending: false }),
      5000,
      "Supabase inpatient stays request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as InpatientStayRow[];
    return rows.map((row) => mapInpatientStayRow(row));
  } catch (error) {
    console.warn("Failed to fetch inpatient stays from Supabase:", error);
    return [];
  }
});
