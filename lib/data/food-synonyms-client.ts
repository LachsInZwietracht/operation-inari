import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodSynonym } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const PAGE_SIZE = 1000;

interface FoodSynonymRow {
  id: string;
  food_id: string;
  name: string;
  locale: string | null;
  source: "system" | "user";
  is_primary: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapFoodSynonymRow(row: FoodSynonymRow): FoodSynonym {
  return {
    id: row.id,
    foodId: row.food_id,
    name: row.name,
    locale: row.locale ?? "de-DE",
    createdBy: row.created_by ?? "System",
    source: row.source,
    usageCount: row.usage_count,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export async function fetchSystemFoodSynonyms(
  supabase?: SupabaseClient,
): Promise<FoodSynonym[]> {
  const client = resolveBrowserClient(supabase);
  const rows: FoodSynonymRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await withTimeout(
      client
        .from("food_synonyms")
        .select("id, food_id, name, locale, source, is_primary, usage_count, created_by, created_at")
        .eq("source", "system")
        .order("created_at", { ascending: true })
        .range(from, to),
      10000,
      "Supabase food synonym request timed out",
    );

    if (error) throw new Error(error.message);

    const batch = (data ?? []) as FoodSynonymRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows.map(mapFoodSynonymRow);
}
