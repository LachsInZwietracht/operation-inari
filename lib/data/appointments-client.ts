import type { SupabaseClient } from "@supabase/supabase-js";

import type { PracticeAppointment } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface AppointmentRow {
  id: string;
  legacy_id: string | null;
  user_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  patient_id: string | null;
  location: string | null;
  type: PracticeAppointment["type"];
  recurring: string | null;
  reminder: string | null;
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

function mapAppointmentRow(row: AppointmentRow): PracticeAppointment {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    title: row.title,
    date: row.date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    patientId: row.patient_id ?? undefined,
    location: row.location ?? undefined,
    type: row.type,
    recurring: row.recurring ?? undefined,
    reminder: row.reminder ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAppointmentsClient(
  supabase?: SupabaseClient,
): Promise<PracticeAppointment[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("appointments").select("*").order("date", { ascending: true }).order("start_time", { ascending: true }),
    5000,
    "Supabase appointment request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as AppointmentRow[]).map((row) => mapAppointmentRow(row));
}

export async function persistAppointment(
  appointment: Partial<PracticeAppointment> & { title: string; date: string; startTime: string; endTime: string; type: PracticeAppointment["type"] },
  supabase?: SupabaseClient,
): Promise<PracticeAppointment> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = appointment.id && isUuid(appointment.id) ? appointment.id : null;
  const legacyId = canonicalId ? appointment.legacyId ?? null : appointment.id ?? null;

  const { data: persisted, error } = await client
    .from("appointments")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        title: appointment.title,
        date: appointment.date,
        start_time: appointment.startTime,
        end_time: appointment.endTime,
        patient_id: appointment.patientId ?? null,
        location: appointment.location ?? null,
        type: appointment.type,
        recurring: appointment.recurring ?? null,
        reminder: appointment.reminder ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapAppointmentRow(persisted as unknown as AppointmentRow);
}

export async function deleteAppointmentClient(
  appointmentId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(appointmentId) ? "id" : "legacy_id";
  const { error } = await client
    .from("appointments")
    .delete()
    .eq(column, appointmentId);

  if (error) {
    throw new Error(error.message);
  }
}
