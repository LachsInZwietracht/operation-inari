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
  indications: string[] | null;
  notes: string | null;
  amputations: string[] | null;
  daily_calorie_goal: number | null;
  goal_weight: number | null;
  macro_preset: string | null;
  nutrition_preferences: Patient["nutritionPreferences"] | null;
  nutrition_preference_notes: string | null;
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

const PATIENT_BASE_COLUMNS = [
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
  "daily_calorie_goal",
  "goal_weight",
  "macro_preset",
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
];

const PATIENT_NUTRITION_PREFERENCE_COLUMNS = [
  "nutrition_preferences",
  "nutrition_preference_notes",
];

const PATIENT_COLUMNS = [
  ...PATIENT_BASE_COLUMNS,
  ...PATIENT_NUTRITION_PREFERENCE_COLUMNS,
].join(",");

const PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES = PATIENT_BASE_COLUMNS.join(",");

function isMissingNutritionPreferenceColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return PATIENT_NUTRITION_PREFERENCE_COLUMNS.some((column) => message.includes(column));
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
    dailyCalorieGoal: row.daily_calorie_goal ?? undefined,
    goalWeight: row.goal_weight ?? undefined,
    macroPreset: row.macro_preset ?? undefined,
    nutritionPreferences: row.nutrition_preferences ?? undefined,
    nutritionPreferenceNotes: row.nutrition_preference_notes ?? undefined,
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

async function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createServerSupabaseClient();
}

async function fetchPatientRows(
  client: SupabaseClient,
  columns: string,
): Promise<PatientRow[]> {
  const { data, error } = await withTimeout(
    client.from("patients").select(columns).order("last_name", { ascending: true }),
    5000,
    "Supabase patient request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as PatientRow[];
}

async function fetchPatientRowByRef(
  client: SupabaseClient,
  columns: string,
  patientRef: string,
): Promise<PatientRow | null> {
  const column = isUuid(patientRef) ? "id" : "legacy_id";
  const { data, error } = await withTimeout(
    client
      .from("patients")
      .select(columns)
      .eq(column, patientRef)
      .maybeSingle(),
    5000,
    "Supabase patient detail request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as PatientRow | null;
}

export const fetchPatients = cache(async (supabase?: SupabaseClient): Promise<Patient[]> => {
  try {
    const client = await resolveClient(supabase);
    try {
      const rows = await fetchPatientRows(client, PATIENT_COLUMNS);
      return rows.map(mapPatientRow);
    } catch (error) {
      if (!isMissingNutritionPreferenceColumnError(error)) throw error;
      const rows = await fetchPatientRows(client, PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES);
      return rows.map(mapPatientRow);
    }
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
    try {
      const row = await fetchPatientRowByRef(client, PATIENT_COLUMNS, patientRef);
      return row ? mapPatientRow(row) : null;
    } catch (error) {
      if (!isMissingNutritionPreferenceColumnError(error)) throw error;
      const row = await fetchPatientRowByRef(
        client,
        PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES,
        patientRef,
      );
      return row ? mapPatientRow(row) : null;
    }
  } catch (error) {
    console.warn("Falling back from patient detail lookup:", error);
    return null;
  }
}

export async function fetchPatientByRefForUser(
  patientRef: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<Patient | null> {
  const column = isUuid(patientRef) ? "id" : "legacy_id";
  async function runQuery(columns: string) {
    const { data, error } = await withTimeout(
      supabase
        .from("patients")
        .select(columns)
        .eq(column, patientRef)
        .eq("user_id", userId)
        .maybeSingle(),
      5000,
      "Supabase patient detail service lookup timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapPatientRow(data as unknown as PatientRow) : null;
  }

  try {
    return await runQuery(PATIENT_COLUMNS);
  } catch (error) {
    if (!isMissingNutritionPreferenceColumnError(error)) throw error;
    return runQuery(PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES);
  }
}
