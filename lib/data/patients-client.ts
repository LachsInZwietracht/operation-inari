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
  daily_calorie_goal: number | null;
  goal_weight: number | null;
  macro_preset: string | null;
  basal_metabolic_rate_override: number | null;
  nutrition_preferences: Patient["nutritionPreferences"] | null;
  nutrition_preference_notes: string | null;
  diet_style: Patient["dietStyle"] | null;
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
  intake_stage_override: Patient["intakeStageOverride"] | null;
  intake_stage_override_at: string | null;
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
  "basal_metabolic_rate_override",
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

// Diet columns are queried defensively: a deployment can reach production
// before its migration has been applied, and the fallback keeps patient lists
// readable instead of failing the whole query.
const PATIENT_NUTRITION_PREFERENCE_COLUMNS = [
  "nutrition_preferences",
  "nutrition_preference_notes",
  "diet_style",
];

/** Same reasoning; see the intake-stage override migration. */
const PATIENT_INTAKE_OVERRIDE_COLUMNS = [
  "intake_stage_override",
  "intake_stage_override_at",
];

const PATIENT_COLUMNS = [
  ...PATIENT_BASE_COLUMNS,
  ...PATIENT_NUTRITION_PREFERENCE_COLUMNS,
  ...PATIENT_INTAKE_OVERRIDE_COLUMNS,
].join(",");

const PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES = [
  ...PATIENT_BASE_COLUMNS,
  ...PATIENT_INTAKE_OVERRIDE_COLUMNS,
].join(",");

const PATIENT_COLUMNS_WITHOUT_INTAKE_OVERRIDE = [
  ...PATIENT_BASE_COLUMNS,
  ...PATIENT_NUTRITION_PREFERENCE_COLUMNS,
].join(",");

const PATIENT_COLUMNS_MINIMAL = PATIENT_BASE_COLUMNS.join(",");

function isMissingNutritionPreferenceColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return PATIENT_NUTRITION_PREFERENCE_COLUMNS.some((column) => message.includes(column));
}

function isMissingIntakeOverrideColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return PATIENT_INTAKE_OVERRIDE_COLUMNS.some((column) => message.includes(column));
}

/**
 * Runs a patient query, retrying without whichever optional column group the
 * database reports as missing. Anything else is rethrown untouched.
 */
async function withOptionalColumns<T>(run: (columns: string) => Promise<T>): Promise<T> {
  try {
    return await run(PATIENT_COLUMNS);
  } catch (error) {
    const missingNutrition = isMissingNutritionPreferenceColumnError(error);
    const missingOverride = isMissingIntakeOverrideColumnError(error);
    if (!missingNutrition && !missingOverride) throw error;

    if (missingNutrition && missingOverride) return run(PATIENT_COLUMNS_MINIMAL);
    if (missingNutrition) {
      try {
        return await run(PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES);
      } catch (retryError) {
        if (!isMissingIntakeOverrideColumnError(retryError)) throw retryError;
        return run(PATIENT_COLUMNS_MINIMAL);
      }
    }

    try {
      return await run(PATIENT_COLUMNS_WITHOUT_INTAKE_OVERRIDE);
    } catch (retryError) {
      if (!isMissingNutritionPreferenceColumnError(retryError)) throw retryError;
      return run(PATIENT_COLUMNS_MINIMAL);
    }
  }
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
    indications: row.indications ?? undefined,
    notes: row.notes ?? undefined,
    amputations: row.amputations ?? undefined,
    dailyCalorieGoal: row.daily_calorie_goal ?? undefined,
    goalWeight: row.goal_weight ?? undefined,
    macroPreset: row.macro_preset ?? undefined,
    basalMetabolicRateOverride: row.basal_metabolic_rate_override ?? undefined,
    nutritionPreferences: row.nutrition_preferences ?? undefined,
    nutritionPreferenceNotes: row.nutrition_preference_notes ?? undefined,
    dietStyle: row.diet_style ?? undefined,
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
    intakeStageOverride: row.intake_stage_override ?? undefined,
    intakeStageOverrideAt: row.intake_stage_override_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPatientsClient(
  supabase?: SupabaseClient,
): Promise<Patient[]> {
  const client = resolveBrowserClient(supabase);
  async function runQuery(columns: string) {
    const { data, error } = await withTimeout(
      client.from("patients").select(columns).order("last_name", { ascending: true }),
      5000,
      "Supabase patient request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as unknown as PatientRow[]).map((row) => mapPatientRow(row));
  }

  return withOptionalColumns(runQuery);
}

/**
 * Pins or clears a patient's Aufnahmen stage by hand.
 *
 * Deliberately narrow rather than part of the general upsert: this writes two
 * columns and nothing else, so setting an override from the board can never
 * touch the rest of a patient record.
 */
export async function setPatientIntakeStageOverrideClient(
  patientId: string,
  stage: Patient["intakeStageOverride"] | null,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const { error } = await client
    .from("patients")
    .update({
      intake_stage_override: stage ?? null,
      intake_stage_override_at: stage ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId);

  if (error) {
    if (isMissingIntakeOverrideColumnError(error)) {
      throw new Error(
        "Die manuelle Stufe ist in dieser Datenbank noch nicht eingerichtet. Die Migration muss zuerst eingespielt werden.",
      );
    }
    throw new Error(error.message);
  }
}

function toPatientUpsertPayload(
  patient: Partial<Patient> & { firstName: string; lastName: string; dateOfBirth: string; gender: Patient["gender"] },
  userId: string,
  canonicalId: string | null,
  legacyId: string | null,
  includeNutritionPreferenceColumns: boolean,
) {
  return {
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
    daily_calorie_goal: patient.dailyCalorieGoal ?? null,
    goal_weight: patient.goalWeight ?? null,
    macro_preset: patient.macroPreset ?? null,
    basal_metabolic_rate_override: patient.basalMetabolicRateOverride ?? null,
    ...(includeNutritionPreferenceColumns
      ? {
          nutrition_preferences: patient.nutritionPreferences ?? [],
          nutrition_preference_notes: patient.nutritionPreferenceNotes ?? null,
          diet_style: patient.dietStyle ?? null,
        }
      : {}),
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
  };
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

  async function runUpsert(includeNutritionPreferenceColumns: boolean) {
    const { data: persistedPatient, error } = await client
      .from("patients")
      .upsert(
        toPatientUpsertPayload(
          patient,
          userId,
          canonicalId,
          legacyId,
          includeNutritionPreferenceColumns,
        ),
        { onConflict: canonicalId ? "id" : "legacy_id" },
      )
      .select(
        includeNutritionPreferenceColumns
          ? PATIENT_COLUMNS
          : PATIENT_COLUMNS_WITHOUT_NUTRITION_PREFERENCES,
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPatientRow(persistedPatient as unknown as PatientRow);
  }

  let result: Patient;
  try {
    result = await runUpsert(true);
  } catch (error) {
    if (!isMissingNutritionPreferenceColumnError(error)) throw error;
    result = await runUpsert(false);
  }

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
