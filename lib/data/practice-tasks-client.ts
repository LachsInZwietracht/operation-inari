import type { SupabaseClient } from "@supabase/supabase-js";

import type { PracticeTask, PracticeTaskPriority, PracticeTaskStatus } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface PracticeTaskRow {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  status: PracticeTaskStatus;
  priority: PracticeTaskPriority;
  due_date: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const TASK_COLUMNS = [
  "id",
  "user_id",
  "title",
  "notes",
  "status",
  "priority",
  "due_date",
  "position",
  "completed_at",
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

function mapTaskRow(row: PracticeTaskRow): PracticeTask {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    position: row.position,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Alle Aufgaben des angemeldeten Nutzers, boardfertig sortiert. */
export async function fetchPracticeTasks(supabase?: SupabaseClient): Promise<PracticeTask[]> {
  const client = resolveBrowserClient(supabase);

  const { data, error } = await withTimeout(
    client
      .from("practice_tasks")
      .select(TASK_COLUMNS)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    5000,
    "Supabase practice task request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as PracticeTaskRow[]).map(mapTaskRow);
}

export async function createPracticeTask(
  input: { title: string; status: PracticeTaskStatus; position: number; priority?: PracticeTaskPriority; dueDate?: string | null; notes?: string | null },
  supabase?: SupabaseClient,
): Promise<PracticeTask> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data, error } = await withTimeout(
    client
      .from("practice_tasks")
      .insert({
        user_id: userId,
        title: input.title,
        status: input.status,
        position: input.position,
        priority: input.priority ?? "normal",
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
        completed_at: input.status === "done" ? new Date().toISOString() : null,
      })
      .select(TASK_COLUMNS)
      .single(),
    5000,
    "Supabase practice task insert timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return mapTaskRow(data as unknown as PracticeTaskRow);
}

export async function updatePracticeTask(
  id: string,
  patch: Partial<Pick<PracticeTask, "title" | "notes" | "status" | "priority" | "dueDate" | "position">>,
  supabase?: SupabaseClient,
): Promise<PracticeTask> {
  const client = resolveBrowserClient(supabase);

  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.notes !== undefined) payload.notes = patch.notes || null;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate || null;
  if (patch.position !== undefined) payload.position = patch.position;
  if (patch.status !== undefined) {
    payload.status = patch.status;
    // Der Zeitstempel gehört zum Statuswechsel, sonst behält eine
    // zurückgezogene Aufgabe ihr Erledigungsdatum.
    payload.completed_at = patch.status === "done" ? new Date().toISOString() : null;
  }

  const { data, error } = await withTimeout(
    client.from("practice_tasks").update(payload).eq("id", id).select(TASK_COLUMNS).single(),
    5000,
    "Supabase practice task update timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return mapTaskRow(data as unknown as PracticeTaskRow);
}

export async function deletePracticeTask(id: string, supabase?: SupabaseClient): Promise<void> {
  const client = resolveBrowserClient(supabase);

  const { error } = await withTimeout(
    client.from("practice_tasks").delete().eq("id", id),
    5000,
    "Supabase practice task delete timed out",
  );

  if (error) {
    throw new Error(error.message);
  }
}
