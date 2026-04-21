import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Recipe } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";
import { RECIPES } from "@/lib/mock-data/recipes";

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

async function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
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

export const fetchRecipes = cache(async (options: FetchRecipesOptions = {}): Promise<Recipe[]> => {
  // Use unstable_cache for the default (no supabase, no filters) case
  if (!options.supabase && !options.limit && !options.offset && !options.sourceType) {
    return unstable_cache(
      async () => {
        try {
          const client = await createServiceClient();
          const { data, error } = await withTimeout(
            baseRecipeQuery(client).order("name", { ascending: true }),
            5000,
            "Supabase recipes request timed out",
          );
          if (error) throw new Error(error.message);
          const rows = (data ?? []) as unknown as RecipeRowWithRelations[];
          if (rows.length === 0) return RECIPES;
          return rows.map((row) => mapRecipeRow(row));
        } catch (error) {
          console.warn("Falling back to local recipes:", error);
          return RECIPES;
        }
      },
      ["recipes-all"],
      { revalidate: 3600, tags: ["recipes"] },
    )();
  }

  // Fallback: direct fetch with options
  try {
    const client = await resolveClient(options.supabase);
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

    const rows = (data ?? []) as unknown as RecipeRowWithRelations[];
    if (rows.length === 0 && !options.sourceType && !options.limit && !options.offset) {
      return RECIPES;
    }
    return rows.map((row) => mapRecipeRow(row));
  } catch (error) {
    console.warn("Falling back to local recipes:", error);
    return RECIPES;
  }
});

export const fetchRecipeById = cache(async (
  id: string,
  options: FetchRecipeByIdOptions = {}
): Promise<Recipe | null> => {
  try {
    const client = await resolveClient(options.supabase);
    const column = isUuid(id) ? "id" : "legacy_id";
    const { data, error } = await withTimeout(
      baseRecipeQuery(client).eq(column, id).maybeSingle(),
      5000,
      "Supabase recipe lookup timed out",
    );
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    return mapRecipeRow(data as unknown as RecipeRowWithRelations);
  } catch (error) {
    console.warn(`Falling back to local recipe ${id}:`, error);
    return RECIPES.find((recipe) => recipe.id === id || recipe.legacyId === id) ?? null;
  }
});
