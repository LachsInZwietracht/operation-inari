import type { SupabaseClient } from "@supabase/supabase-js";

import type { CounselingSession, CounselingTemplate } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface CounselingSessionRow {
  id: string;
  legacy_id: string | null;
  patient_id: string;
  session_date: string;
  duration_minutes: number;
  session_type: string;
  indication: string;
  goals: string | null;
  content: string;
  recommendations: string | null;
  next_appointment: string | null;
  timeline: CounselingSession["timeline"] | null;
  materials: CounselingSession["materials"] | null;
  progress: CounselingSession["progress"] | null;
  created_at: string;
  updated_at: string;
}

interface CounselingTemplateRow {
  id: string;
  legacy_id: string | null;
  name: string;
  session_type: string;
  indication: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CounselingSessionPersistInput extends Omit<CounselingSession, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  legacyId?: string;
}

interface CounselingTemplatePersistInput extends Omit<CounselingTemplate, "id"> {
  id?: string;
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

async function resolveCanonicalPatientId(client: SupabaseClient, patientId: string): Promise<string> {
  if (isUuid(patientId)) {
    return patientId;
  }

  const { data, error } = await withTimeout(
    client
      .from("patients")
      .select("id")
      .eq("legacy_id", patientId)
      .maybeSingle(),
    5000,
    "Supabase patient lookup timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error(`PATIENT_NOT_FOUND:${patientId}`);
  }

  return data.id;
}

function mapCounselingSessionRow(row: CounselingSessionRow): CounselingSession {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    patientId: row.patient_id,
    date: row.session_date,
    duration: row.duration_minutes,
    type: row.session_type,
    indication: row.indication,
    goals: row.goals ?? undefined,
    content: row.content,
    recommendations: row.recommendations ?? undefined,
    nextAppointment: row.next_appointment ?? undefined,
    timeline: row.timeline ?? [],
    materials: row.materials ?? [],
    progress: row.progress ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCounselingTemplateRow(row: CounselingTemplateRow): CounselingTemplate {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    name: row.name,
    type: row.session_type,
    indication: row.indication,
    content: row.content,
  };
}

export async function fetchCounselingSessionsClient(
  supabase?: SupabaseClient,
): Promise<CounselingSession[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("counseling_sessions")
      .select("*")
      .order("session_date", { ascending: false }),
    5000,
    "Supabase counseling session request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CounselingSessionRow[]).map((row) => mapCounselingSessionRow(row));
}

export async function persistCounselingSession(
  session: CounselingSessionPersistInput,
  supabase?: SupabaseClient,
): Promise<CounselingSession> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = session.id && isUuid(session.id) ? session.id : null;
  const legacyId = canonicalId ? session.legacyId ?? null : session.id ?? null;
  const canonicalPatientId = await resolveCanonicalPatientId(client, session.patientId);

  const { data, error } = await client
    .from("counseling_sessions")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        patient_id: canonicalPatientId,
        session_date: session.date,
        duration_minutes: session.duration,
        session_type: session.type,
        indication: session.indication,
        goals: session.goals ?? null,
        content: session.content,
        recommendations: session.recommendations ?? null,
        next_appointment: session.nextAppointment ?? null,
        timeline: session.timeline ?? [],
        materials: session.materials ?? [],
        progress: session.progress ?? [],
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCounselingSessionRow(data as CounselingSessionRow);
}

export async function deleteCounselingSessionClient(
  sessionId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(sessionId) ? "id" : "legacy_id";
  const { error } = await client
    .from("counseling_sessions")
    .delete()
    .eq(column, sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchCounselingTemplatesClient(
  supabase?: SupabaseClient,
): Promise<CounselingTemplate[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("counseling_templates")
      .select("*")
      .order("name", { ascending: true }),
    5000,
    "Supabase counseling template request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CounselingTemplateRow[]).map((row) => mapCounselingTemplateRow(row));
}

export async function persistCounselingTemplate(
  template: CounselingTemplatePersistInput,
  supabase?: SupabaseClient,
): Promise<CounselingTemplate> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = template.id && isUuid(template.id) ? template.id : null;
  const legacyId = canonicalId ? template.legacyId ?? null : template.id ?? null;

  const { data, error } = await client
    .from("counseling_templates")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        name: template.name,
        session_type: template.type,
        indication: template.indication,
        content: template.content,
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCounselingTemplateRow(data as CounselingTemplateRow);
}

export async function deleteCounselingTemplateClient(
  templateId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(templateId) ? "id" : "legacy_id";
  const { error } = await client
    .from("counseling_templates")
    .delete()
    .eq(column, templateId);

  if (error) {
    throw new Error(error.message);
  }
}
