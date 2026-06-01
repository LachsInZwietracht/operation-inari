import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CustomReferenceProfile,
  OfficialReferenceValueRow,
  PatientReferenceAssignment,
  ReferenceNutrientValue,
  UserReferencePreference,
} from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";
import { AGE_GROUPS } from "@/lib/reference-metadata";
import { REFERENCE_STANDARDS as LEGACY_REFERENCE_STANDARDS } from "@/lib/mock-data/reference-standards";

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

interface ReferenceValueRowDb {
  id: string;
  nutrient_id: string;
  amount: string;
  gender: "m" | "w";
  age_group_id: string;
  age_min: number | null;
  age_max: number | null;
  life_stage: OfficialReferenceValueRow["lifeStage"] | null;
  source: string;
  label: string;
  standard_id: OfficialReferenceValueRow["standardId"];
}

interface ReferenceProfileRowDb {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  based_on_standard_id: CustomReferenceProfile["basedOn"] | null;
  age_group_id: string;
  gender: "m" | "w";
  life_stage: CustomReferenceProfile["lifeStage"];
  created_at: string;
  updated_at: string;
  reference_profile_values?: Array<{
    nutrient_id: string;
    amount: string;
  }> | null;
}

interface ReferencePreferenceRowDb {
  user_id: string;
  standard_id: UserReferencePreference["standardId"] | null;
  profile_id: string | null;
  age_group_id: string;
  gender: "m" | "w";
  life_stage: UserReferencePreference["lifeStage"];
  created_at: string;
  updated_at: string;
}

interface PatientReferenceAssignmentRowDb {
  patient_id: string;
  user_id: string;
  standard_id: PatientReferenceAssignment["standardId"] | null;
  profile_id: string | null;
  life_stage: PatientReferenceAssignment["lifeStage"];
  pal_value: string | number | null;
  created_at: string;
  updated_at: string;
}

function mapReferenceValueRow(row: ReferenceValueRowDb): OfficialReferenceValueRow {
  return {
    id: row.id,
    standardId: row.standard_id,
    nutrientId: row.nutrient_id,
    amount: Number(row.amount),
    gender: row.gender,
    ageGroupId: row.age_group_id,
    ageMin: row.age_min,
    ageMax: row.age_max,
    lifeStage: row.life_stage ?? "none",
    source: row.source,
    label: row.label,
    createdAt: row.id,
    updatedAt: row.id,
  };
}

export function getBundledReferenceValueRows(): OfficialReferenceValueRow[] {
  return LEGACY_REFERENCE_STANDARDS.flatMap((standard) =>
    standard.brackets.flatMap((bracket, bracketIndex) => {
      const ageGroup = AGE_GROUPS.find((group) => group.id === bracket.ageGroupId);
      return bracket.values.map((value, valueIndex) => ({
        id: `${standard.id}-${bracketIndex}-${valueIndex}`,
        standardId: standard.id as OfficialReferenceValueRow["standardId"],
        nutrientId: value.nutrientId,
        amount: value.amount,
        gender: bracket.gender,
        ageGroupId: bracket.ageGroupId,
        ageMin: ageGroup?.minAge ?? null,
        ageMax: ageGroup?.maxAge ?? null,
        lifeStage: bracket.lifeStage,
        source: `${standard.shortName} ${standard.edition}`,
        label: `${standard.shortName} ${standard.edition} · ${bracket.ageGroupId} · ${value.nutrientId}`,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      }));
    }),
  );
}

function mapReferenceProfileRow(row: ReferenceProfileRowDb): CustomReferenceProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    basedOn: row.based_on_standard_id ?? undefined,
    ageGroupId: row.age_group_id,
    gender: row.gender,
    lifeStage: row.life_stage,
    overrides: (row.reference_profile_values ?? []).map((value) => ({
      nutrientId: value.nutrient_id,
      amount: Number(value.amount),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserPreferenceRow(row: ReferencePreferenceRowDb): UserReferencePreference {
  return {
    userId: row.user_id,
    standardId: row.standard_id ?? undefined,
    profileId: row.profile_id ?? undefined,
    ageGroupId: row.age_group_id,
    gender: row.gender,
    lifeStage: row.life_stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPatientAssignmentRow(row: PatientReferenceAssignmentRowDb): PatientReferenceAssignment {
  return {
    patientId: row.patient_id,
    userId: row.user_id,
    standardId: row.standard_id ?? undefined,
    profileId: row.profile_id ?? undefined,
    lifeStage: row.life_stage,
    palValue: row.pal_value != null ? Number(row.pal_value) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchOfficialReferenceValues(
  supabase?: SupabaseClient,
): Promise<OfficialReferenceValueRow[]> {
  const client = resolveBrowserClient(supabase);
  try {
    const { data, error } = await withTimeout(
      client.from("reference_values").select("*").order("standard_id").order("nutrient_id"),
      5000,
      "Supabase reference values request timed out",
    );
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as ReferenceValueRowDb[]).map(mapReferenceValueRow);
    return rows.length > 0 ? rows : getBundledReferenceValueRows();
  } catch (error) {
    console.warn("Falling back to bundled reference values:", error);
    return getBundledReferenceValueRows();
  }
}

export async function fetchReferenceProfiles(
  supabase?: SupabaseClient,
): Promise<CustomReferenceProfile[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("reference_profiles")
      .select("*, reference_profile_values(nutrient_id, amount)")
      .order("created_at", { ascending: true }),
    5000,
    "Supabase reference profiles request timed out",
  );
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReferenceProfileRowDb[]).map(mapReferenceProfileRow);
}

export async function persistReferenceProfile(
  profile: Omit<CustomReferenceProfile, "createdAt" | "updatedAt">,
  supabase?: SupabaseClient,
): Promise<CustomReferenceProfile> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);
  if (!userId) throw new Error("AUTH_REQUIRED");

  const { error: profileError } = await client
    .from("reference_profiles")
    .upsert(
      {
        id: profile.id,
        user_id: userId,
        name: profile.name,
        description: profile.description ?? null,
        based_on_standard_id: profile.basedOn ?? null,
        age_group_id: profile.ageGroupId,
        gender: profile.gender,
        life_stage: profile.lifeStage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (profileError) throw new Error(profileError.message);

  const { error: deleteError } = await client
    .from("reference_profile_values")
    .delete()
    .eq("profile_id", profile.id);
  if (deleteError) throw new Error(deleteError.message);

  if (profile.overrides.length > 0) {
    const { error: valuesError } = await client.from("reference_profile_values").insert(
      profile.overrides.map((value: ReferenceNutrientValue) => ({
        profile_id: profile.id,
        nutrient_id: value.nutrientId,
        amount: value.amount,
      })),
    );
    if (valuesError) throw new Error(valuesError.message);
  }

  const { data: hydratedProfile, error: hydratedError } = await client
    .from("reference_profiles")
    .select("*, reference_profile_values(nutrient_id, amount)")
    .eq("id", profile.id)
    .single();
  if (hydratedError) throw new Error(hydratedError.message);

  return mapReferenceProfileRow(hydratedProfile as ReferenceProfileRowDb);
}

export async function deleteReferenceProfile(profileId: string, supabase?: SupabaseClient): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("reference_profiles").delete().eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function fetchUserReferencePreference(
  supabase?: SupabaseClient,
): Promise<UserReferencePreference | null> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);
  if (!userId) return null;

  const { data, error } = await client
    .from("user_reference_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUserPreferenceRow(data as ReferencePreferenceRowDb) : null;
}

export async function persistUserReferencePreference(
  preference: Omit<UserReferencePreference, "userId" | "createdAt" | "updatedAt">,
  supabase?: SupabaseClient,
): Promise<UserReferencePreference> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);
  if (!userId) throw new Error("AUTH_REQUIRED");

  const { data, error } = await client
    .from("user_reference_preferences")
    .upsert(
      {
        user_id: userId,
        standard_id: preference.standardId ?? null,
        profile_id: preference.profileId ?? null,
        age_group_id: preference.ageGroupId,
        gender: preference.gender,
        life_stage: preference.lifeStage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapUserPreferenceRow(data as ReferencePreferenceRowDb);
}

export async function fetchPatientReferenceAssignments(
  supabase?: SupabaseClient,
): Promise<PatientReferenceAssignment[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await client.from("patient_reference_assignments").select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as PatientReferenceAssignmentRowDb[]).map(mapPatientAssignmentRow);
}

export async function persistPatientReferenceAssignment(
  assignment: Omit<PatientReferenceAssignment, "userId" | "createdAt" | "updatedAt">,
  supabase?: SupabaseClient,
): Promise<PatientReferenceAssignment> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);
  if (!userId) throw new Error("AUTH_REQUIRED");

  const { data, error } = await client
    .from("patient_reference_assignments")
    .upsert(
      {
        patient_id: assignment.patientId,
        user_id: userId,
        standard_id: assignment.standardId ?? null,
        profile_id: assignment.profileId ?? null,
        life_stage: assignment.lifeStage,
        pal_value: assignment.palValue ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPatientAssignmentRow(data as PatientReferenceAssignmentRowDb);
}
