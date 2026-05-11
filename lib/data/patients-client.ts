import type { SupabaseClient } from "@supabase/supabase-js";

import type { Patient } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";

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
  indications: string[] | null;
  notes: string | null;
  amputations: string[] | null;
  status: Patient["status"] | null;
  care_setting: Patient["careSetting"] | null;
  external_patient_number: string | null;
  case_number: string | null;
  preferred_contact_channel: Patient["preferredContactChannel"] | null;
  preferred_language: string | null;
  communication_consent: boolean | null;
  digital_protocol_consent: boolean | null;
  referrer_name: string | null;
  department: string | null;
  intake_reason: string | null;
  patient_goals: string | null;
  clinical_notes: string | null;
  admin_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
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
  "indications",
  "notes",
  "amputations",
  "status",
  "care_setting",
  "external_patient_number",
  "case_number",
  "preferred_contact_channel",
  "preferred_language",
  "communication_consent",
  "digital_protocol_consent",
  "referrer_name",
  "department",
  "intake_reason",
  "patient_goals",
  "clinical_notes",
  "admin_notes",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "created_at",
  "updated_at",
].join(",");

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
    indications: row.indications ?? undefined,
    notes: row.notes ?? undefined,
    amputations: row.amputations ?? undefined,
    status: row.status ?? undefined,
    careSetting: row.care_setting ?? undefined,
    externalPatientNumber: row.external_patient_number ?? undefined,
    caseNumber: row.case_number ?? undefined,
    preferredContactChannel: row.preferred_contact_channel ?? undefined,
    preferredLanguage: row.preferred_language ?? undefined,
    communicationConsent: row.communication_consent ?? undefined,
    digitalProtocolConsent: row.digital_protocol_consent ?? undefined,
    referrerName: row.referrer_name ?? undefined,
    department: row.department ?? undefined,
    intakeReason: row.intake_reason ?? undefined,
    patientGoals: row.patient_goals ?? undefined,
    clinicalNotes: row.clinical_notes ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    emergencyContactName: row.emergency_contact_name ?? undefined,
    emergencyContactPhone: row.emergency_contact_phone ?? undefined,
    emergencyContactRelationship: row.emergency_contact_relationship ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPatientsClient(
  supabase?: SupabaseClient,
): Promise<Patient[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patients").select(PATIENT_COLUMNS).order("last_name", { ascending: true }),
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
        indications: patient.indications ?? [],
        notes: patient.notes ?? null,
        amputations: patient.amputations ?? null,
        status: patient.status ?? "active",
        care_setting: patient.careSetting ?? "ambulatory",
        external_patient_number: patient.externalPatientNumber ?? null,
        case_number: patient.caseNumber ?? null,
        preferred_contact_channel: patient.preferredContactChannel ?? null,
        preferred_language: patient.preferredLanguage ?? null,
        communication_consent: patient.communicationConsent ?? null,
        digital_protocol_consent: patient.digitalProtocolConsent ?? null,
        referrer_name: patient.referrerName ?? null,
        department: patient.department ?? null,
        intake_reason: patient.intakeReason ?? null,
        patient_goals: patient.patientGoals ?? null,
        clinical_notes: patient.clinicalNotes ?? null,
        admin_notes: patient.adminNotes ?? null,
        emergency_contact_name: patient.emergencyContactName ?? null,
        emergency_contact_phone: patient.emergencyContactPhone ?? null,
        emergency_contact_relationship: patient.emergencyContactRelationship ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select(PATIENT_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = mapPatientRow(persistedPatient as unknown as PatientRow);
  await writeAccessAuditLog(client, {
    action: canonicalId ? "patient_record_updated" : "patient_record_created",
    targetType: "patient",
    targetId: result.id,
    metadata: {
      source: "patients-client",
      legacyId,
      changedFields: Object.keys(patient).filter((key) => !["id", "legacyId", "createdAt", "updatedAt"].includes(key)),
    },
  });

  return result;
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

  await writeAccessAuditLog(client, {
    action: "patient_record_deleted",
    targetType: "patient",
    targetId: patientId,
    metadata: {
      source: "patients-client",
      lookupColumn: column,
    },
  });
}
