import type { SupabaseClient } from "@supabase/supabase-js";

import type { PatientAllergenEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface AllergenRow {
  id: string;
  user_id: string;
  patient_id: string;
  allergen_id: string;
  type: string;
  severity: string;
  diagnosed_date: string | null;
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

function mapAllergenRow(row: AllergenRow): PatientAllergenEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    allergenId: row.allergen_id,
    type: row.type as PatientAllergenEntry["type"],
    severity: row.severity as PatientAllergenEntry["severity"],
    diagnosedDate: row.diagnosed_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPatientAllergensClient(
  supabase?: SupabaseClient,
): Promise<PatientAllergenEntry[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await withTimeout(
    client.from("patient_allergens").select("*").order("created_at", { ascending: false }),
    5000,
    "Supabase allergens request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as AllergenRow[]).map((row) => mapAllergenRow(row));
}

export async function persistPatientAllergen(
  entry: Partial<PatientAllergenEntry> & {
    patientId: string;
    allergenId: string;
    type: PatientAllergenEntry["type"];
    severity: PatientAllergenEntry["severity"];
  },
  supabase?: SupabaseClient,
): Promise<PatientAllergenEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = entry.id && isUuid(entry.id) ? entry.id : null;

  const { data: persistedEntry, error } = await client
    .from("patient_allergens")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        user_id: userId,
        patient_id: entry.patientId,
        allergen_id: entry.allergenId,
        type: entry.type,
        severity: entry.severity,
        diagnosed_date: entry.diagnosedDate ?? null,
        notes: entry.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      canonicalId ? { onConflict: "id" } : undefined,
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapAllergenRow(persistedEntry as unknown as AllergenRow);
}

export async function deletePatientAllergenClient(
  entryId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(entryId)) return;

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("patient_allergens").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}
