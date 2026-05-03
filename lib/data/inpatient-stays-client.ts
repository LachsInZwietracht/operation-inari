import type { SupabaseClient } from "@supabase/supabase-js";

import type { InpatientStay } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface InpatientStayRow {
  id: string;
  legacy_id: string | null;
  user_id: string;
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

async function resolvePatientId(client: SupabaseClient, patientId: string) {
  if (isUuid(patientId)) return patientId;

  const { data, error } = await client
    .from("patients")
    .select("id")
    .eq("legacy_id", patientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("PATIENT_NOT_SYNCED");
  }

  return data.id as string;
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

export async function fetchInpatientStaysClient(
  supabase?: SupabaseClient,
): Promise<InpatientStay[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("inpatient_stays").select("*").order("admission_date", { ascending: false }),
    5000,
    "Supabase inpatient stays request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as InpatientStayRow[]).map((row) => mapInpatientStayRow(row));
}

export async function persistInpatientStay(
  stay: InpatientStay,
  supabase?: SupabaseClient,
): Promise<InpatientStay> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const patientId = await resolvePatientId(client, stay.patientId);
  const canonicalId = stay.id && isUuid(stay.id) ? stay.id : null;
  const legacyId = canonicalId ? stay.legacyId ?? null : stay.id ?? null;

  const { data, error } = await client
    .from("inpatient_stays")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        patient_id: patientId,
        station: stay.station,
        room: stay.room,
        bed: stay.bed,
        status: stay.status,
        admission_date: stay.admissionDate,
        discharge_date: stay.dischargeDate ?? null,
        diet_form_ids: stay.dietFormIds,
        notes: stay.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = mapInpatientStayRow(data as unknown as InpatientStayRow);
  await writeAccessAuditLog(client, {
    action: canonicalId ? "inpatient_stay_updated" : "inpatient_stay_created",
    targetType: "inpatient_stay",
    targetId: result.id,
    metadata: {
      patientId,
      station: result.station,
      status: result.status,
      dietFormCount: result.dietFormIds.length,
    },
  });

  return result;
}

export async function deleteInpatientStayClient(
  stayId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(stayId) ? "id" : "legacy_id";
  const { error } = await client.from("inpatient_stays").delete().eq(column, stayId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAccessAuditLog(client, {
    action: "inpatient_stay_deleted",
    targetType: "inpatient_stay",
    targetId: stayId,
    metadata: {
      lookupColumn: column,
    },
  });
}
