import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * The client's own weigh-in, written into the counselor's measurement record.
 *
 * Goes through `client_record_weight` rather than a table write: the target
 * table carries columns a bathroom scale does not supply, and a row there sits
 * next to measurements taken by a professional. The function decides what is
 * allowed; this file only translates its refusals into something a person can
 * act on.
 */

export interface ClientWeighIn {
  id: string;
  date: string;
  weight: number;
  height: number;
  bmi: number;
}

/** Height is missing and has to be asked for once before a weight can be saved. */
export class MissingHeightError extends Error {
  constructor() {
    super("height_unknown");
    this.name = "MissingHeightError";
  }
}

export async function recordClientWeight(
  input: { weightKg: number; date: string; heightCm?: number },
  supabase?: SupabaseClient,
): Promise<ClientWeighIn> {
  const client = supabase ?? createBrowserSupabaseClient();

  const { data, error } = await client.rpc("client_record_weight", {
    weight_kg: input.weightKg,
    // The app's day boundary is Europe/Berlin; the database's is not, so the
    // date travels rather than being derived at the other end.
    measured_on: input.date,
    height_cm: input.heightCm ?? null,
  });

  if (error) {
    if (error.message.includes("height_unknown")) throw new MissingHeightError();
    throw new Error(error.message);
  }

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    date: String(row.date),
    weight: Number(row.weight),
    height: Number(row.height),
    bmi: Number(row.bmi),
  };
}
