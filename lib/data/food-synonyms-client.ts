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

const SYNONYM_COLUMNS =
  "id, food_id, name, locale, source, is_primary, usage_count, created_by, created_at";

function synonymPage(client: SupabaseClient, from: number, count?: "exact") {
  return client
    .from("food_synonyms")
    .select(SYNONYM_COLUMNS, count ? { count } : undefined)
    .eq("source", "system")
    .order("created_at", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
}

/**
 * Every system synonym, in as few round trips as the table allows.
 *
 * PostgREST caps a response at {@link PAGE_SIZE} rows, and there are ~7,000 of
 * these, so it has to be paged. It used to page *sequentially* — each request
 * waiting for the one before it — which cost roughly 1.4 seconds. Asking the
 * first page for an exact count tells us how many remain, so the rest go out
 * together.
 */
export async function fetchSystemFoodSynonyms(
  supabase?: SupabaseClient,
): Promise<FoodSynonym[]> {
  const client = resolveBrowserClient(supabase);

  const { data, error, count } = await withTimeout(
    synonymPage(client, 0, "exact"),
    10000,
    "Supabase food synonym request timed out",
  );
  if (error) throw new Error(error.message);

  const firstPage = (data ?? []) as FoodSynonymRow[];
  const total = count ?? firstPage.length;

  const offsets: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);

  const rest = await Promise.all(
    offsets.map(async (from) => {
      const page = await withTimeout(
        synonymPage(client, from),
        10000,
        "Supabase food synonym request timed out",
      );
      if (page.error) throw new Error(page.error.message);
      return (page.data ?? []) as FoodSynonymRow[];
    }),
  );

  return [firstPage, ...rest].flat().map(mapFoodSynonymRow);
}
