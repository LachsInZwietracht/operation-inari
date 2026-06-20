import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnthropometricEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface AnthropometricRow {
  id: string;
  user_id: string;
  patient_id: string;
  date: string;
  weight: string;
  height: string;
  bmi: string;
  waist_circumference: string | null;
  hip_circumference: string | null;
  body_fat_percentage: string | null;
  fat_free_mass_kg?: string | null;
  subcutaneous_fat_percentage?: string | null;
  visceral_fat_rating?: string | null;
  body_water_percentage?: string | null;
  muscle_mass_kg?: string | null;
  skeletal_muscle_percentage?: string | null;
  bone_mass_kg?: string | null;
  protein_percentage?: string | null;
  bmr_kcal?: string | null;
  metabolic_age_years?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const BODY_COMPOSITION_COLUMNS = [
  "fat_free_mass_kg",
  "subcutaneous_fat_percentage",
  "visceral_fat_rating",
  "body_water_percentage",
  "muscle_mass_kg",
  "skeletal_muscle_percentage",
  "bone_mass_kg",
  "protein_percentage",
  "bmr_kcal",
  "metabolic_age_years",
] as const;

function isMissingBodyCompositionColumnError(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  return BODY_COMPOSITION_COLUMNS.some((column) => error.message?.includes(column));
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

function mapAnthropometricRow(row: AnthropometricRow): AnthropometricEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    weight: Number(row.weight),
    height: Number(row.height),
    bmi: Number(row.bmi),
    waistCircumference: row.waist_circumference ? Number(row.waist_circumference) : undefined,
    hipCircumference: row.hip_circumference ? Number(row.hip_circumference) : undefined,
    bodyFatPercentage: row.body_fat_percentage ? Number(row.body_fat_percentage) : undefined,
    fatFreeMassKg: row.fat_free_mass_kg ? Number(row.fat_free_mass_kg) : undefined,
    subcutaneousFatPercentage: row.subcutaneous_fat_percentage
      ? Number(row.subcutaneous_fat_percentage)
      : undefined,
    visceralFatRating: row.visceral_fat_rating ? Number(row.visceral_fat_rating) : undefined,
    bodyWaterPercentage: row.body_water_percentage ? Number(row.body_water_percentage) : undefined,
    muscleMassKg: row.muscle_mass_kg ? Number(row.muscle_mass_kg) : undefined,
    skeletalMusclePercentage: row.skeletal_muscle_percentage
      ? Number(row.skeletal_muscle_percentage)
      : undefined,
    boneMassKg: row.bone_mass_kg ? Number(row.bone_mass_kg) : undefined,
    proteinPercentage: row.protein_percentage ? Number(row.protein_percentage) : undefined,
    bmrKcal: row.bmr_kcal ? Number(row.bmr_kcal) : undefined,
    metabolicAgeYears: row.metabolic_age_years ? Number(row.metabolic_age_years) : undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAnthropometricEntriesClient(
  supabase?: SupabaseClient,
): Promise<AnthropometricEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_anthropometrics").select("*").order("date", { ascending: true }),
    5000,
    "Supabase anthropometrics request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as AnthropometricRow[]).map((row) =>
    mapAnthropometricRow(row),
  );
}

export async function persistAnthropometricEntry(
  entry: Partial<AnthropometricEntry> & {
    patientId: string;
    date: string;
    weight: number;
    height: number;
    bmi: number;
  },
  supabase?: SupabaseClient,
): Promise<AnthropometricEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const payload = {
    ...(canonicalId ? { id: canonicalId } : {}),
    user_id: userId,
    patient_id: entry.patientId,
    date: entry.date,
    weight: entry.weight,
    height: entry.height,
    bmi: entry.bmi,
    waist_circumference: entry.waistCircumference ?? null,
    hip_circumference: entry.hipCircumference ?? null,
    body_fat_percentage: entry.bodyFatPercentage ?? null,
    fat_free_mass_kg: entry.fatFreeMassKg ?? null,
    subcutaneous_fat_percentage: entry.subcutaneousFatPercentage ?? null,
    visceral_fat_rating: entry.visceralFatRating ?? null,
    body_water_percentage: entry.bodyWaterPercentage ?? null,
    muscle_mass_kg: entry.muscleMassKg ?? null,
    skeletal_muscle_percentage: entry.skeletalMusclePercentage ?? null,
    bone_mass_kg: entry.boneMassKg ?? null,
    protein_percentage: entry.proteinPercentage ?? null,
    bmr_kcal: entry.bmrKcal ?? null,
    metabolic_age_years: entry.metabolicAgeYears ?? null,
    notes: entry.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  let result = await client
    .from("patient_anthropometrics")
    .upsert(payload, canonicalId ? { onConflict: "id" } : undefined)
    .select("*")
    .single();

  if (isMissingBodyCompositionColumnError(result.error)) {
    const fallbackPayload = { ...payload };
    for (const column of BODY_COMPOSITION_COLUMNS) {
      delete fallbackPayload[column];
    }

    result = await client
      .from("patient_anthropometrics")
      .upsert(fallbackPayload, canonicalId ? { onConflict: "id" } : undefined)
      .select("*")
      .single();
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return mapAnthropometricRow(result.data as unknown as AnthropometricRow);
}

export async function deleteAnthropometricEntryClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_anthropometrics").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
