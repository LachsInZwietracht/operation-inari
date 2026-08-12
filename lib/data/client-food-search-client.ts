import type { SupabaseClient } from "@supabase/supabase-js";

import {
  energyPer100g,
  foodSubtitle,
  type ClientSearchItem,
} from "@/lib/client-food-search";
import { hydrateClientFoods } from "@/lib/data/client-custom-foods-client";
import { scaleNutrients } from "@/lib/nutrients";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ClientSavedMeal } from "@/lib/types";

/**
 * One search across everything a client can log.
 *
 * Three sources, one list. The catalog and the client's own products both come
 * out of `foods` — `search_foods` already returns own custom rows when it is
 * given `requesting_user_id`, which the client surface previously omitted, so
 * a client's own products were invisible to their own search. Recipes come
 * from `recipes`, where RLS already hands the client their counselor's planned
 * recipes and the shared libraries. Saved meals are matched in memory; there
 * are never enough of them to be worth a query.
 */

interface SearchRow {
  food_id: string;
  food_name: string;
  data_source_id: string | null;
}

interface RecipeRow {
  id: string;
  name: string;
  servings: number | null;
  user_id: string | null;
  source_type: string | null;
  cached_kcal_per_portion: number | null;
}

const FOOD_LIMIT = 20;
const RECIPE_LIMIT = 8;

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

export async function searchClientFoods(
  query: string,
  options: { savedMeals?: ClientSavedMeal[]; signal?: AbortSignal; supabase?: SupabaseClient } = {},
): Promise<ClientSearchItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const client = resolveClient(options.supabase);
  const {
    data: { user },
  } = await client.auth.getUser();

  const [foodResult, recipeResult] = await Promise.allSettled([
    client
      .rpc("search_foods", {
        search_query: trimmed,
        // Without this the client's own products never appear in their own
        // search — the function filters custom rows on exactly this argument.
        requesting_user_id: user?.id ?? null,
        result_limit: FOOD_LIMIT,
      })
      .abortSignal(options.signal ?? new AbortController().signal),
    client
      .from("recipes")
      .select("id,name,servings,user_id,source_type,cached_kcal_per_portion")
      .ilike("name", `%${trimmed}%`)
      .limit(RECIPE_LIMIT),
  ]);

  const items: ClientSearchItem[] = [];

  if (foodResult.status === "fulfilled" && foodResult.value.data) {
    const rows = foodResult.value.data as SearchRow[];
    const foods = await hydrateClientFoods(
      rows.map((row) => row.food_id),
      client,
    );

    for (const row of rows) {
      const food = foods.get(row.food_id);
      const isOwn = Boolean(food?.isCustom);
      items.push({
        key: `food:${row.food_id}`,
        kind: "food",
        id: row.food_id,
        name: row.food_name,
        subtitle: foodSubtitle({
          manufacturer: food?.manufacturer,
          sourceId: row.data_source_id ?? undefined,
          isOwn,
        }),
        kcalPerUnit: energyPer100g(food?.nutrients, food?.baseAmount ?? 100),
        // Normalised to 100 g so the detail card does not have to know what
        // base amount the source happened to use.
        nutrientsPerUnit: food
          ? scaleNutrients(food.nutrients, food.baseAmount, 100)
          : undefined,
        unit: "g",
        defaultAmount: 100,
        isOwn,
      });
    }
  }

  if (recipeResult.status === "fulfilled" && recipeResult.value.data) {
    for (const row of recipeResult.value.data as unknown as RecipeRow[]) {
      const isOwn = row.user_id === user?.id;
      items.push({
        key: `recipe:${row.id}`,
        kind: "recipe",
        id: row.id,
        name: row.name,
        subtitle: isOwn
          ? "Eigenes Rezept"
          : row.source_type && row.source_type !== "personal"
            ? "Geteiltes Rezept"
            : "Von deiner Beratung",
        kcalPerUnit:
          row.cached_kcal_per_portion === null ? undefined : Number(row.cached_kcal_per_portion),
        unit: "portion",
        defaultAmount: 1,
        isOwn,
      });
    }
  }

  const needle = trimmed.toLowerCase();
  for (const meal of options.savedMeals ?? []) {
    if (!meal.name.toLowerCase().includes(needle)) continue;
    items.push({
      key: `meal:${meal.id}`,
      kind: "meal",
      id: meal.id,
      name: meal.name,
      subtitle: `${meal.items.length} ${meal.items.length === 1 ? "Zutat" : "Zutaten"}`,
      unit: "portion",
      defaultAmount: 1,
      isOwn: true,
    });
  }

  // Own things first — a person searching for something they made is not
  // looking for the catalog's version of it.
  return items.sort((a, b) => Number(b.isOwn) - Number(a.isOwn));
}
