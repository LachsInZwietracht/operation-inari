/**
 * Shared helper for writing data source lifecycle events from ETL scripts.
 *
 * Inserts a row into `data_source_events` so the /datenbank page shows
 * real import/change history instead of an empty timeline.
 */

import { createClient } from "@supabase/supabase-js";

interface WriteEventParams {
  dataSourceId: string;
  eventType: "import" | "version_update" | "nutrient_mapping" | "license" | "change_note";
  version?: string;
  title: string;
  summary: string;
  recordCount?: number;
  nutrientCount?: number;
  metadata?: Record<string, unknown>;
}

function getServiceClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for ETL event logging");
  }
  return createClient(url, key);
}

export async function writeDataSourceEvent(params: WriteEventParams): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("data_source_events").insert({
      data_source_id: params.dataSourceId,
      event_type: params.eventType,
      version: params.version ?? null,
      title: params.title,
      summary: params.summary,
      record_count: params.recordCount ?? null,
      nutrient_count: params.nutrientCount ?? null,
      metadata: params.metadata ?? {},
    });

    if (error) {
      console.warn(`Could not write data source event: ${error.message}`);
    } else {
      console.log(`Logged data source event: ${params.title}`);
    }
  } catch (err) {
    // Non-fatal: ETL should not fail because event logging is unavailable
    console.warn(
      "Could not write data source event:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
