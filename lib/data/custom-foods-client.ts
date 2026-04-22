import type { SupabaseClient } from "@supabase/supabase-js";
import type { Food, NutrientValue, FoodPortionSize } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";
import { isUuid } from "@/lib/data/local-records";

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
  food_nutrients: FoodNutrientRow[] | null;
  food_portions: FoodPortionRow[] | null;
}

interface FoodNutrientRow {
  nutrient_id: string;
  amount: number;
  per_amount: number;
}

interface FoodPortionRow {
  label: string;
  amount_grams: number;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

function mapFoodRow(row: FoodRow): Food {
  const nutrients: NutrientValue[] = (row.food_nutrients ?? []).map((n) => ({
    nutrientId: n.nutrient_id,
    amount: Number(n.amount),
  }));

  const portionSizes: FoodPortionSize[] = (row.food_portions ?? []).map((p) => ({
    label: p.label,
    amount: Number(p.amount_grams),
  }));

  return {
    id: row.id,
    legacyId: row.source_food_id,
    name: row.name,
    categoryId: row.category_id ?? "cat_sonstiges",
    source: "Eigene Eingabe",
    sourceId: (row.data_source_id as Food["sourceId"]) ?? "custom",
    sourceVersion: row.source_version ?? undefined,
    blsCode: row.bls_code ?? undefined,
    foodGroupId: row.food_group_id ?? undefined,
    nutrients,
    baseAmount: row.food_nutrients?.[0]?.per_amount ? Number(row.food_nutrients[0].per_amount) : 100,
    manufacturer: row.manufacturer ?? undefined,
    allergens: row.allergens ?? undefined,
    additives: row.additives ?? undefined,
    co2PerPortion: row.co2_per_portion ?? undefined,
    sustainabilityScore: row.sustainability_score ?? undefined,
    prodScore: row.prod_score ?? undefined,
    isBranded: row.is_branded,
    isCustom: row.is_custom,
    isRecipeDerived: row.is_recipe_derived,
    portionSizes,
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchCustomFoodRowByIdentity(
  foodId: string,
  client: SupabaseClient,
): Promise<FoodRow | null> {
  const column = isUuid(foodId) ? "id" : "source_food_id";
  const { data, error } = await withTimeout(
    client
      .from("foods")
      .select(
        "id, name, data_source_id, source_food_id, source_version, bls_code, food_group_id, category_id, manufacturer, allergens, additives, tags, is_branded, is_custom, is_recipe_derived, co2_per_portion, sustainability_score, prod_score, created_at, updated_at, food_nutrients(nutrient_id, amount, per_amount), food_portions(label, amount_grams)"
      )
      .eq("is_custom", true)
      .eq(column, foodId)
      .maybeSingle(),
    5000,
    "Supabase custom food lookup timed out",
  );

  if (error) throw new Error(error.message);
  return (data as unknown as FoodRow | null) ?? null;
}

export async function fetchCustomFoodsClient(supabase?: SupabaseClient): Promise<Food[]> {
  const client = resolveBrowserClient(supabase);
  
  const { data, error } = await withTimeout(
    client
      .from("foods")
      .select(
        "id, name, data_source_id, source_food_id, source_version, bls_code, food_group_id, category_id, manufacturer, allergens, additives, tags, is_branded, is_custom, is_recipe_derived, co2_per_portion, sustainability_score, prod_score, created_at, updated_at, food_nutrients(nutrient_id, amount, per_amount), food_portions(label, amount_grams)"
      )
      .eq("is_custom", true),
    5000,
    "Supabase custom foods request timed out"
  );

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as FoodRow[]).map(mapFoodRow);
}

export async function persistCustomFood(
  food: Food,
  supabase?: SupabaseClient,
): Promise<Food> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) throw new Error("AUTH_REQUIRED");

  const canonicalId = isUuid(food.id) ? food.id : null;
  const legacyId = canonicalId ? food.legacyId ?? food.id : food.legacyId ?? food.id;

  // Upsert the main food record
  const { data: persistedFood, error: foodError } = await client
    .from("foods")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        name: food.name,
        data_source_id: food.sourceId ?? "custom",
        source_food_id: legacyId,
        source_version: food.sourceVersion ?? null,
        bls_code: food.blsCode ?? null,
        food_group_id: food.foodGroupId ?? null,
        category_id: food.categoryId ?? null,
        manufacturer: food.manufacturer ?? null,
        allergens: food.allergens ?? null,
        additives: food.additives ?? null,
        tags: food.tags ?? null,
        is_branded: food.isBranded ?? false,
        is_custom: true,
        is_recipe_derived: food.isRecipeDerived ?? false,
        co2_per_portion: food.co2PerPortion ?? null,
        sustainability_score: food.sustainabilityScore ?? null,
        prod_score: food.prodScore ?? null,
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: canonicalId ? "id" : "data_source_id,source_food_id" }
    )
    .select("id")
    .single();

  if (foodError) throw new Error(foodError.message);

  const supabaseId = persistedFood.id;

  // Handle nutrients
  if (food.nutrients && food.nutrients.length > 0) {
    const { error: delNutrientsError } = await client
      .from("food_nutrients")
      .delete()
      .eq("food_id", supabaseId);
    
    if (delNutrientsError) throw new Error(delNutrientsError.message);

    const nutrientsToInsert = food.nutrients.map(n => ({
      food_id: supabaseId,
      nutrient_id: n.nutrientId,
      amount: n.amount,
      per_amount: food.baseAmount ?? 100,
    }));

    const { error: insNutrientsError } = await client
      .from("food_nutrients")
      .insert(nutrientsToInsert);
    
    if (insNutrientsError) throw new Error(insNutrientsError.message);
  }

  // Handle portions
  if (food.portionSizes && food.portionSizes.length > 0) {
    const { error: delPortionsError } = await client
      .from("food_portions")
      .delete()
      .eq("food_id", supabaseId);
    
    if (delPortionsError) throw new Error(delPortionsError.message);

    const portionsToInsert = food.portionSizes.map(p => ({
      food_id: supabaseId,
      label: p.label,
      amount_grams: p.amount,
    }));

    const { error: insPortionsError } = await client
      .from("food_portions")
      .insert(portionsToInsert);
    
    if (insPortionsError) throw new Error(insPortionsError.message);
  }

  const persisted = await fetchCustomFoodByIdClient(supabaseId, client);
  if (!persisted) {
    throw new Error("Persisted custom food could not be loaded");
  }

  return persisted;
}

export async function fetchCustomFoodByIdClient(
  foodId: string,
  supabase?: SupabaseClient,
): Promise<Food | null> {
  const client = resolveBrowserClient(supabase);
  const row = await fetchCustomFoodRowByIdentity(foodId, client);
  return row ? mapFoodRow(row) : null;
}

export async function deleteCustomFoodClient(
  foodId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  let query = client.from("foods").delete().eq("data_source_id", "custom");
  query = isUuid(foodId) ? query.eq("id", foodId) : query.eq("source_food_id", foodId);
  const { error } = await query;

  if (error) throw new Error(error.message);
}
