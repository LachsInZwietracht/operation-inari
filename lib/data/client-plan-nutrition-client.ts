import type { SupabaseClient } from "@supabase/supabase-js";

import { CLIENT_LOG_NUTRIENT_IDS } from "@/lib/client-food-log";
import {
  calculatePerServing,
  calculateRecipeNutrients,
  scaleNutrients,
} from "@/lib/nutrients";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  ClientPlanDay,
  ClientPlanEntryFacts,
  Food,
  NutrientValue,
  Recipe,
} from "@/lib/types";

/**
 * Resolves plan entries to something the diary can add up.
 *
 * Plan entries are polymorphic — grams of a food or portions of a recipe — and
 * a recipe's cost only exists once its ingredients are priced. Everything is
 * normalised to nutrients **per one unit** so the same number serves both the
 * planned amount and whatever the client says they actually ate.
 *
 * A recipe whose ingredients cannot be read yields no facts rather than a
 * wrong zero: an entry that silently costs nothing would quietly deflate the
 * day's totals.
 */

interface RecipeRow {
  id: string;
  name: string;
  servings: number | null;
  recipe_ingredients: { food_id: string; amount: number }[] | null;
}

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function fetchFoodsByIds(ids: string[]): Promise<Food[]> {
  if (ids.length === 0) return [];
  const response = await fetch("/api/foods/by-ids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [...new Set(ids)], nutrientIds: CLIENT_LOG_NUTRIENT_IDS }),
  });
  if (!response.ok) return [];
  return (await response.json()) as Food[];
}

/**
 * Facts for every entry of the given plan days, keyed by meal entry id.
 *
 * Takes days rather than a single day so the statistics window resolves in one
 * round trip instead of fourteen.
 */
/**
 * Name and per-portion nutrients for recipes logged straight into the diary.
 *
 * The same pricing as a planned recipe, keyed by recipe id instead of by plan
 * entry — a diary row points at the recipe itself.
 */
export async function fetchClientRecipeFacts(
  recipeIds: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, { name: string; perPortion: NutrientValue[] }>> {
  const facts = new Map<string, { name: string; perPortion: NutrientValue[] }>();
  const unique = [...new Set(recipeIds)];
  if (unique.length === 0) return facts;

  const client = resolveClient(supabase);
  const { data, error } = await client
    .from("recipes")
    .select("id,name,servings,recipe_ingredients(food_id,amount)")
    .in("id", unique);
  if (error) throw new Error(error.message);

  const recipes = (data ?? []) as unknown as RecipeRow[];
  const foods = await fetchFoodsByIds(
    recipes.flatMap((recipe) =>
      (recipe.recipe_ingredients ?? []).map((ingredient) => ingredient.food_id),
    ),
  );

  for (const recipe of recipes) {
    const ingredients = (recipe.recipe_ingredients ?? []).map((ingredient) => ({
      foodId: ingredient.food_id,
      amount: Number(ingredient.amount ?? 0),
    }));
    const total =
      ingredients.length === 0
        ? []
        : calculateRecipeNutrients(
            { ingredients, servings: recipe.servings ?? 1 } as Recipe,
            foods,
          );
    facts.set(recipe.id, {
      name: recipe.name,
      perPortion: calculatePerServing(total, recipe.servings ?? 1),
    });
  }

  return facts;
}

export async function fetchClientPlanFacts(
  plans: ClientPlanDay[],
  supabase?: SupabaseClient,
): Promise<Map<string, ClientPlanEntryFacts>> {
  const facts = new Map<string, ClientPlanEntryFacts>();
  const entries = plans.flatMap((plan) => plan.entries);
  if (entries.length === 0) return facts;

  const client = resolveClient(supabase);

  const foodIds = entries.filter((e) => e.entryType === "food").map((e) => e.referenceId);
  const recipeIds = [
    ...new Set(entries.filter((e) => e.entryType === "recipe").map((e) => e.referenceId)),
  ];

  let recipes: RecipeRow[] = [];
  if (recipeIds.length > 0) {
    const { data, error } = await client
      .from("recipes")
      .select("id,name,servings,recipe_ingredients(food_id,amount)")
      .in("id", recipeIds);
    if (error) throw new Error(error.message);
    recipes = (data ?? []) as unknown as RecipeRow[];
  }

  // One round trip for both the planned foods and every recipe ingredient.
  const ingredientFoodIds = recipes.flatMap((recipe) =>
    (recipe.recipe_ingredients ?? []).map((ingredient) => ingredient.food_id),
  );
  const foods = await fetchFoodsByIds([...foodIds, ...ingredientFoodIds]);
  const foodMap = new Map(foods.map((food) => [food.id, food]));

  for (const entry of entries) {
    if (facts.has(entry.id)) continue;

    if (entry.entryType === "food") {
      const food = foodMap.get(entry.referenceId);
      if (!food) continue;
      facts.set(entry.id, {
        // Per gram, so the amount can be anything the client ate.
        perUnit: scaleNutrients(food.nutrients, food.baseAmount, 1),
        label: food.name,
        unit: "g",
      });
      continue;
    }

    const recipe = recipes.find((row) => row.id === entry.referenceId);
    if (!recipe) continue;

    const ingredients = (recipe.recipe_ingredients ?? []).map((ingredient) => ({
      foodId: ingredient.food_id,
      amount: Number(ingredient.amount ?? 0),
    }));
    // Without ingredients there is nothing to price — the label alone would
    // make the entry look counted when it is not.
    if (ingredients.length === 0) {
      facts.set(entry.id, { perUnit: [], label: recipe.name, unit: "portion" });
      continue;
    }

    const total = calculateRecipeNutrients(
      { ingredients, servings: recipe.servings ?? 1 } as Recipe,
      foods,
    );
    facts.set(entry.id, {
      perUnit: calculatePerServing(total, recipe.servings ?? 1),
      label: recipe.name,
      unit: "portion",
    });
  }

  return facts;
}
