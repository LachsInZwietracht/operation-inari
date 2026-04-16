import type { SupabaseClient } from "@supabase/supabase-js";

import type { Recipe } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface RecipeRow {
  id: string;
  legacy_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  instructions: string[] | null;
  image_url: string | null;
  allergens: string[] | null;
  additives: string[] | null;
  tags: string[] | null;
  prod_score: number | null;
  co2_per_portion: number | null;
  source_type: string | null;
  teaching_kitchen_notes: string | null;
  created_at: string;
  updated_at: string;
  cached_kcal_per_portion: number | null;
  cached_protein_per_portion: number | null;
  cached_fat_per_portion: number | null;
  cached_carbs_per_portion: number | null;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  food_id: string;
  amount: number;
  sort_order: number | null;
}

interface RecipeRowWithRelations extends RecipeRow {
  recipe_ingredients: IngredientRow[] | null;
}

interface FetchRecipesOptions {
  supabase?: SupabaseClient;
  limit?: number;
  offset?: number;
  sourceType?: string;
}

interface FetchRecipeByIdOptions {
  supabase?: SupabaseClient;
}

interface PersistRecipeOptions {
  supabase?: SupabaseClient;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function mapRecipeRow(row: RecipeRowWithRelations): Recipe {
  const ingredients = (row.recipe_ingredients ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((ingredient) => ({
      foodId: ingredient.food_id,
      amount: Number(ingredient.amount ?? 0),
    }));

  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    name: row.name,
    description: row.description ?? "",
    category: row.category ?? "Rezepte",
    servings: row.servings ?? 1,
    prepTime: row.prep_time ?? 0,
    cookTime: row.cook_time ?? 0,
    ingredients,
    instructions: row.instructions ?? [],
    imageUrl: row.image_url ?? undefined,
    allergens: row.allergens ?? undefined,
    additives: row.additives ?? undefined,
    tags: row.tags ?? undefined,
    prodScore: row.prod_score ?? undefined,
    co2PerPortion: row.co2_per_portion ?? undefined,
    sourceType: (row.source_type as Recipe["sourceType"]) ?? "community",
    referenceTargets: undefined,
    teachingKitchenNotes: row.teaching_kitchen_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cachedKcalPerPortion: row.cached_kcal_per_portion ?? undefined,
    cachedProteinPerPortion: row.cached_protein_per_portion ?? undefined,
    cachedFatPerPortion: row.cached_fat_per_portion ?? undefined,
    cachedCarbsPerPortion: row.cached_carbs_per_portion ?? undefined,
  };
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

function baseRecipeQuery(client: SupabaseClient) {
  return client
    .from("recipes")
    .select(
      [
        "id",
        "legacy_id",
        "name",
        "description",
        "category",
        "servings",
        "prep_time",
        "cook_time",
        "instructions",
        "image_url",
        "allergens",
        "additives",
        "tags",
        "prod_score",
        "co2_per_portion",
        "source_type",
        "teaching_kitchen_notes",
        "created_at",
        "updated_at",
        "cached_kcal_per_portion",
        "cached_protein_per_portion",
        "cached_fat_per_portion",
        "cached_carbs_per_portion",
        "recipe_ingredients(id,recipe_id,food_id,amount,sort_order)",
      ].join(",")
    );
}

export async function fetchRecipesClient(options: FetchRecipesOptions = {}): Promise<Recipe[]> {
  const client = resolveBrowserClient(options.supabase);
  let query = baseRecipeQuery(client).order("name", { ascending: true });

  if (typeof options.limit === "number") {
    const start = options.offset ?? 0;
    query = query.range(start, start + options.limit - 1);
  }

  if (options.sourceType) {
    query = query.eq("source_type", options.sourceType);
  }

  const { data, error } = await withTimeout(
    query,
    5000,
    "Supabase recipes request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as RecipeRowWithRelations[]).map((row) => mapRecipeRow(row));
}

export async function fetchRecipeByIdClient(
  id: string,
  options: FetchRecipeByIdOptions = {}
): Promise<Recipe | null> {
  const client = resolveBrowserClient(options.supabase);
  const column = isUuid(id) ? "id" : "legacy_id";
  const { data, error } = await withTimeout(
    baseRecipeQuery(client).eq(column, id).maybeSingle(),
    5000,
    "Supabase recipe lookup timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRecipeRow(data as unknown as RecipeRowWithRelations) : null;
}

export async function persistPersonalRecipe(
  recipe: Recipe,
  options: PersistRecipeOptions = {}
): Promise<Recipe> {
  const client = resolveBrowserClient(options.supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = isUuid(recipe.id) ? recipe.id : null;
  const legacyId = canonicalId ? recipe.legacyId ?? null : recipe.id;
  const recipePayload = {
    ...(canonicalId ? { id: canonicalId } : {}),
    legacy_id: legacyId,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    servings: recipe.servings,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    instructions: recipe.instructions,
    image_url: recipe.imageUrl ?? null,
    allergens: recipe.allergens ?? null,
    additives: recipe.additives ?? null,
    tags: recipe.tags ?? null,
    prod_score: recipe.prodScore ?? null,
    co2_per_portion: recipe.co2PerPortion ?? null,
    source_type: "personal",
    teaching_kitchen_notes: recipe.teachingKitchenNotes ?? null,
    user_id: userId,
    cached_kcal_per_portion: recipe.cachedKcalPerPortion ?? null,
    cached_protein_per_portion: recipe.cachedProteinPerPortion ?? null,
    cached_fat_per_portion: recipe.cachedFatPerPortion ?? null,
    cached_carbs_per_portion: recipe.cachedCarbsPerPortion ?? null,
  };

  const { data: persistedRecipe, error: recipeError } = await client
    .from("recipes")
    .upsert(recipePayload, { onConflict: canonicalId ? "id" : "legacy_id" })
    .select("id,legacy_id")
    .single();

  if (recipeError) {
    throw new Error(recipeError.message);
  }

  const recipeId = persistedRecipe.id;

  const { error: deleteIngredientsError } = await client
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);

  if (deleteIngredientsError) {
    throw new Error(deleteIngredientsError.message);
  }

  if (recipe.ingredients.length > 0) {
    const { error: ingredientError } = await client
      .from("recipe_ingredients")
      .insert(
        recipe.ingredients.map((ingredient, index) => ({
          recipe_id: recipeId,
          food_id: ingredient.foodId,
          amount: ingredient.amount,
          sort_order: index,
        })),
      );

    if (ingredientError) {
      throw new Error(ingredientError.message);
    }
  }

  const persisted = await fetchRecipeByIdClient(recipeId, { supabase: client });
  if (!persisted) {
    throw new Error("Persisted recipe could not be loaded");
  }

  return persisted;
}
