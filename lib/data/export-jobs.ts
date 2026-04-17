import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExportFormat, ExportJobRecord, ExportScope } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface ExportJobRow {
  id: string;
  user_id: string;
  type: "export" | "import";
  format: ExportFormat;
  scope: ExportScope;
  status: "abgeschlossen" | "in Bearbeitung" | "fehlgeschlagen";
  created_at: string;
  file_size: string | null;
  created_by: string;
  file_name: string | null;
  parameters: Record<string, unknown> | null;
}

function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapExportJobRow(row: ExportJobRow): ExportJobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    format: row.format,
    scope: row.scope,
    status: row.status,
    createdAt: row.created_at,
    fileSize: row.file_size ?? undefined,
    createdBy: row.created_by,
    fileName: row.file_name ?? undefined,
    parameters: row.parameters ?? undefined,
  };
}

export async function fetchExportJobsClient(
  supabase?: SupabaseClient,
): Promise<ExportJobRecord[]> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client.from("export_jobs").select("*").order("created_at", { ascending: false }),
    5000,
    "Supabase export job request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ExportJobRow[]).map(mapExportJobRow);
}

