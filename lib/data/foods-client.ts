import type { SupabaseClient } from "@supabase/supabase-js";
import type { Food, NutrientValue, FoodSourceId } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const FALLBACK_CATEGORY_ID = "cat_unbekannt";

interface FoodRow {
  id: string;
  name: string;
  data_source_id: string;
  source_food_id: string;
  source_version: string | null;
  bls_code: string | null;
  food_group_id: string | null;
  category_id: string | null;
  manufacturer: string | null;
  allergens: string[] | null;
  additives: string[] | null;
  tags: string[] | null;
  is_branded: boolean;
  is_custom: boolean;
  is_recipe_derived: boolean;
  co2_per_portion: number | null;
  sustainability_score: number | null;
  prod_score: number | null;
  created_at: string;
  updated_at: string;
  food_nutrients: Array<{
    nutrient_id: string;
    amount: number;
    per_amount: number;
  }> | null;
  food_portions: Array<{
    label: string;
    amount_grams: number;
  }> | null;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapFoodRow(row: FoodRow): Food {
  const nutrients: NutrientValue[] = (row.food_nutrients ?? []).map((n) => ({
    nutrientId: n.nutrient_id,
    amount: Number(n.amount),
  }));

  const baseAmount = row.food_nutrients?.[0]?.per_amount
    ? Number(row.food_nutrients[0].per_amount)
    : 100;

  const portionSizes = row.food_portions?.map((portion) => ({
    label: portion.label,
    amount: Number(portion.amount_grams),
  }));

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id ?? FALLBACK_CATEGORY_ID,
    source: row.data_source_id,
    sourceId: row.data_source_id as FoodSourceId,
    sourceVersion: row.source_version ?? undefined,
    blsCode: row.bls_code ?? undefined,
    foodGroupId: row.food_group_id ?? undefined,
    nutrients,
    baseAmount,
    manufacturer: row.manufacturer ?? undefined,
    allergens: row.allergens ?? undefined,
    additives: row.additives ?? undefined,
    co2PerPortion: row.co2_per_portion ?? undefined,
    sustainabilityScore: row.sustainability_score ?? undefined,
    prodScore: row.prod_score ?? undefined,
    isBranded: row.is_branded,
    isCustom: row.is_custom,
    isRecipeDerived: row.is_recipe_derived,
    portionSizes: portionSizes ?? [],
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchFoodById(
  id: string,
  supabase?: SupabaseClient,
): Promise<Food | null> {
  const client = resolveBrowserClient(supabase);
  
  const { data, error } = await withTimeout(
    client
      .from("foods")
      .select("*, food_nutrients(nutrient_id, amount, per_amount), food_portions(label, amount_grams)")
      .eq("id", id)
      .maybeSingle(),
    5000,
    "Supabase food request timed out"
  );

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapFoodRow(data as unknown as FoodRow);
}

export async function fetchFoodsByIds(
  ids: string[],
  supabase?: SupabaseClient,
): Promise<Food[]> {
  if (ids.length === 0) return [];
  const client = resolveBrowserClient(supabase);
  
  const { data, error } = await withTimeout(
    client
      .from("foods")
      .select("*, food_nutrients(nutrient_id, amount, per_amount), food_portions(label, amount_grams)")
      .in("id", ids),
    10000,
    "Supabase foods request timed out"
  );

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as FoodRow[]).map(mapFoodRow);
}
