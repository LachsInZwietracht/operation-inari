import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientEnergyReference } from "@/lib/client-targets";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ActivityEntry, AnthropometricEntry, Patient } from "@/lib/types";

/**
 * The client's own measurement history, as kept by their counselor.
 *
 * Goes through the `client_patient_history` RPC rather than table queries on
 * purpose: RLS grants rows, and these tables carry columns the client has no
 * business reading (counselor notes on the record and on individual
 * measurements). The function returns a fixed projection, so the permission is
 * the column list rather than a policy that happens to be paired with a
 * careful `select`.
 */

export interface ClientPatientHistory {
  /** Only the fields the charts read; there is no fuller patient object here. */
  patient: Pick<Patient, "firstName" | "goalWeight"> | null;
  /** The counselor's energy target, already reduced to answers not inputs. */
  energy: ClientEnergyReference | null;
  /**
   * Daily reference intake by nutrient id, resolved server-side for this
   * person's age group, sex and life stage — none of which come with it.
   * Empty when nobody has assigned a reference standard.
   */
  references: Map<string, number>;
  measurements: AnthropometricEntry[];
  activities: ActivityEntry[];
}

interface HistoryPayload {
  patient: { firstName: string; goalWeight: number | null } | null;
  energy: Record<string, unknown> | null;
  references: Array<{ nutrientId: string; amount: unknown }> | null;
  measurements: Array<Record<string, unknown>> | null;
  activities: Array<Record<string, unknown>> | null;
}

const EMPTY: ClientPatientHistory = {
  patient: null,
  energy: null,
  references: new Map(),
  measurements: [],
  activities: [],
};

/** JSON numerics arrive as numbers or strings depending on the driver path. */
function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapMeasurement(row: Record<string, unknown>): AnthropometricEntry {
  return {
    id: String(row.id),
    date: String(row.date),
    weight: num(row.weight) ?? 0,
    height: num(row.height) ?? 0,
    bmi: num(row.bmi) ?? 0,
    waistCircumference: num(row.waistCircumference),
    hipCircumference: num(row.hipCircumference),
    bodyFatPercentage: num(row.bodyFatPercentage),
    fatFreeMassKg: num(row.fatFreeMassKg),
    subcutaneousFatPercentage: num(row.subcutaneousFatPercentage),
    visceralFatRating: num(row.visceralFatRating),
    bodyWaterPercentage: num(row.bodyWaterPercentage),
    muscleMassKg: num(row.muscleMassKg),
    skeletalMusclePercentage: num(row.skeletalMusclePercentage),
    boneMassKg: num(row.boneMassKg),
    proteinPercentage: num(row.proteinPercentage),
    bmrKcal: num(row.bmrKcal),
    metabolicAgeYears: num(row.metabolicAgeYears),
  } as AnthropometricEntry;
}

function mapActivity(row: Record<string, unknown>): ActivityEntry {
  return {
    id: String(row.id),
    date: String(row.date),
    type: String(row.type ?? ""),
    durationMinutes: num(row.durationMinutes) ?? 0,
    intensity: row.intensity ? String(row.intensity) : undefined,
    pal: num(row.pal),
    energyKcal: num(row.energyKcal),
  } as ActivityEntry;
}

export async function fetchClientPatientHistory(
  supabase?: SupabaseClient,
): Promise<ClientPatientHistory> {
  const client = supabase ?? createBrowserSupabaseClient();
  const { data, error } = await client.rpc("client_patient_history");

  if (error) throw new Error(error.message);
  if (!data) return EMPTY;

  const payload = data as HistoryPayload;
  return {
    patient: payload.patient
      ? {
          firstName: payload.patient.firstName,
          goalWeight: payload.patient.goalWeight ?? undefined,
        }
      : null,
    energy: payload.energy
      ? {
          dailyCalorieGoal: num(payload.energy.dailyCalorieGoal),
          macroPreset: payload.energy.macroPreset
            ? String(payload.energy.macroPreset)
            : undefined,
          pal: num(payload.energy.pal),
          basalKcal: num(payload.energy.basalKcal),
        }
      : null,
    references: new Map(
      (payload.references ?? [])
        .map((row) => [row.nutrientId, num(row.amount)] as const)
        .filter((pair): pair is readonly [string, number] => pair[1] !== undefined),
    ),
    measurements: (payload.measurements ?? []).map(mapMeasurement),
    activities: (payload.activities ?? []).map(mapActivity),
  };
}
