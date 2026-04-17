import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExportFormat, ExportScope } from "@/lib/types";
import { formatBytes } from "@/lib/exports/csv";

export async function createExportJob(
  supabase: SupabaseClient,
  input: {
    format: ExportFormat;
    scope: ExportScope;
    createdBy: string;
    fileName: string;
    sizeBytes: number;
    parameters?: Record<string, unknown>;
  },
) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(authError.message);
  }
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const { error } = await supabase.from("export_jobs").insert({
    user_id: userId,
    type: "export",
    format: input.format,
    scope: input.scope,
    status: "abgeschlossen",
    file_size: formatBytes(input.sizeBytes),
    created_by: input.createdBy,
    file_name: input.fileName,
    parameters: input.parameters ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function buildFileResponse(payload: Buffer | string, options: {
  contentType: string;
  fileName: string;
  disposition?: "attachment" | "inline";
}) {
  return new Response(payload, {
    headers: {
      "content-type": options.contentType,
      "content-disposition": `${options.disposition ?? "attachment"}; filename="${options.fileName}"`,
    },
  });
}
