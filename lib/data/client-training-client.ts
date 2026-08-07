import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientWorkoutSession, ClientWorkoutSet } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface SessionRow {
  id: string;
  session_date: string;
  title: string;
  notes: string | null;
  client_workout_sets: SetRow[] | null;
}

interface SetRow {
  id: string;
  session_id: string;
  exercise_name: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  notes: string | null;
}

const SESSION_COLUMNS =
  "id,session_date,title,notes,client_workout_sets(id,session_id,exercise_name,set_index,reps,weight_kg,notes)";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

function mapSetRow(row: SetRow): ClientWorkoutSet {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseName: row.exercise_name,
    setIndex: row.set_index,
    reps: row.reps ?? undefined,
    weightKg: row.weight_kg === null ? undefined : Number(row.weight_kg),
    notes: row.notes ?? undefined,
  };
}

function mapSessionRow(row: SessionRow): ClientWorkoutSession {
  return {
    id: row.id,
    date: row.session_date,
    title: row.title,
    notes: row.notes ?? undefined,
    sets: (row.client_workout_sets ?? [])
      .map(mapSetRow)
      .sort((a, b) => a.setIndex - b.setIndex),
  };
}

/**
 * Sessions with their sets, newest first. `clientUserId` is explicit so the
 * same query serves the client and — under training consent — the counselor.
 */
export async function fetchClientWorkoutSessions(
  clientUserId: string,
  limit = 20,
  supabase?: SupabaseClient,
): Promise<ClientWorkoutSession[]> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("client_workout_sessions")
      .select(SESSION_COLUMNS)
      .eq("client_user_id", clientUserId)
      .order("session_date", { ascending: false })
      .limit(limit),
    8000,
    "Supabase workout sessions request timed out",
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SessionRow[]).map(mapSessionRow);
}

export async function createClientWorkoutSession(
  input: { date: string; title: string; notes?: string },
  supabase?: SupabaseClient,
): Promise<ClientWorkoutSession> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("client_workout_sessions")
    .insert({
      client_user_id: userId,
      session_date: input.date,
      title: input.title,
      notes: input.notes ?? null,
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapSessionRow(data as unknown as SessionRow);
}

export async function addClientWorkoutSet(
  input: {
    sessionId: string;
    exerciseName: string;
    setIndex: number;
    reps?: number;
    weightKg?: number;
  },
  supabase?: SupabaseClient,
): Promise<ClientWorkoutSet> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("client_workout_sets")
    .insert({
      session_id: input.sessionId,
      client_user_id: userId,
      exercise_name: input.exerciseName.trim(),
      set_index: input.setIndex,
      reps: input.reps ?? null,
      weight_kg: input.weightKg ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapSetRow(data as unknown as SetRow);
}

export async function deleteClientWorkoutSet(
  setId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const { error } = await client.from("client_workout_sets").delete().eq("id", setId);
  if (error) throw new Error(error.message);
}

export async function deleteClientWorkoutSession(
  sessionId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const { error } = await client.from("client_workout_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
}
