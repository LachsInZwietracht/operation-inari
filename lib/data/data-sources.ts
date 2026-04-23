import { cache } from "react";

import { createServiceClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";
import type { FoodSourceId } from "@/lib/types";

export interface DataSourceCatalogEntry {
  id: FoodSourceId;
  name: string;
  version: string;
  importedAt: string;
  recordCount: number | null;
  nutrientCount: number | null;
  license: string | null;
  url: string | null;
}

interface DataSourceRow {
  id: string;
  name: string;
  version: string;
  imported_at: string;
  record_count: number | null;
  nutrient_count: number | null;
  license: string | null;
  url: string | null;
}

export const fetchDataSources = cache(async (): Promise<{
  sources: DataSourceCatalogEntry[];
  error: string | null;
}> => {
  try {
    const client = await createServiceClient();
    const { data, error } = await withTimeout(
      client
        .from("data_sources")
        .select("id,name,version,imported_at,record_count,nutrient_count,license,url")
        .order("imported_at", { ascending: false }),
      5000,
      "Supabase data source request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as DataSourceRow[];

    return {
      sources: rows.map((row) => ({
        id: row.id as FoodSourceId,
        name: row.name,
        version: row.version,
        importedAt: row.imported_at,
        recordCount: row.record_count,
        nutrientCount: row.nutrient_count,
        license: row.license,
        url: row.url,
      })),
      error: null,
    };
  } catch (error) {
    console.warn("Unable to load data source catalog:", error);
    return {
      sources: [],
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Laden des Quellenkatalogs.",
    };
  }
});
