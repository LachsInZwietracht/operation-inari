import type { DailyMealPlan, Food, Recipe } from "@/lib/types";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";

export interface ShoppingListSource {
  planId: string;
  planDate: string;
  planTitle?: string;
  /**
   * When the entry came in via a recipe, we capture the recipe so the UI can
   * explain "150 g Tomaten · via Tomatensuppe (2 Portionen)". Pure food
   * entries omit these fields.
   */
  viaRecipeId?: string;
  viaRecipeName?: string;
  viaRecipeServings?: number;
  grams: number;
}

export interface ShoppingListItem {
  /**
   * The canonical foodId. Aggregating by id is the natural synonym-merge step
   * because every Food row owns its synonyms (Tomate/Tomaten/Paradeiser map to
   * one id). Cross-id deduplication would require fuzzy matching and risks
   * collapsing legitimately distinct products (e.g. Bio vs. conventional).
   */
  foodId: string;
  name: string;
  categoryId: string;
  totalGrams: number;
  sources: ShoppingListSource[];
}

export interface ShoppingListGroup {
  categoryId: string;
  categoryLabel: string;
  items: ShoppingListItem[];
  totalGrams: number;
}

export interface ShoppingListMissing {
  /** Reference id that could not be resolved against the food / recipe lookup. */
  referenceId: string;
  type: "food" | "recipe";
  planId: string;
  planDate: string;
}

export interface ShoppingList {
  groups: ShoppingListGroup[];
  itemCount: number;
  totalGrams: number;
  planCount: number;
  /** Surfaces orphaned references so the UI can warn the user instead of
   *  silently dropping items. Typical cause: a food/recipe was deleted after a
   *  plan referenced it. */
  missing: ShoppingListMissing[];
}

const UNCATEGORIZED_ID = "cat_unbekannt";

const CATEGORY_ORDER = new Map(
  FOOD_CATEGORIES.map((category, index) => [category.id, index]),
);

const CATEGORY_LABELS = new Map(
  FOOD_CATEGORIES.map((category) => [category.id, category.name]),
);

interface Bucket {
  foodId: string;
  name: string;
  categoryId: string;
  totalGrams: number;
  /**
   * Keyed by `${planId}::${recipeId ?? ""}` so we collapse repeated entries
   * from the same source into a single chip while still distinguishing
   * "Tomatensuppe at lunch" from "Tomatensuppe at dinner" only when the
   * recipe differs. Same plan + same recipe = one cumulative source.
   */
  sources: Map<string, ShoppingListSource>;
}

function makeSourceKey(planId: string, recipeId?: string): string {
  return `${planId}::${recipeId ?? ""}`;
}

function addToBucket(
  buckets: Map<string, Bucket>,
  food: Food,
  grams: number,
  source: ShoppingListSource,
): void {
  if (grams <= 0) return;
  const existing = buckets.get(food.id);
  if (existing) {
    existing.totalGrams += grams;
    const key = makeSourceKey(source.planId, source.viaRecipeId);
    const prior = existing.sources.get(key);
    if (prior) {
      prior.grams += grams;
    } else {
      existing.sources.set(key, { ...source, grams });
    }
    return;
  }
  buckets.set(food.id, {
    foodId: food.id,
    name: food.name,
    categoryId: food.categoryId || UNCATEGORIZED_ID,
    totalGrams: grams,
    sources: new Map([[makeSourceKey(source.planId, source.viaRecipeId), { ...source, grams }]]),
  });
}

/**
 * Aggregates ingredients from a list of meal plans into a grouped shopping
 * list. Food entries are summed by their stored gram amount; recipe entries
 * are expanded by walking the recipe ingredients and scaling them by the
 * served-portion ratio (`entry.amount / recipe.servings`).
 *
 * Items below a quarter-gram total are dropped after aggregation so the UI
 * does not surface meaningless rows from rounding noise (e.g. a pinch of salt
 * referenced three layers deep).
 */
export function buildShoppingList(
  plans: DailyMealPlan[],
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): ShoppingList {
  const buckets = new Map<string, Bucket>();
  const missing: ShoppingListMissing[] = [];

  for (const plan of plans) {
    const planMeta = {
      planId: plan.id,
      planDate: plan.date,
      planTitle: plan.title,
    } as const;

    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          const food = foodMap.get(entry.referenceId);
          if (!food) {
            missing.push({
              referenceId: entry.referenceId,
              type: "food",
              planId: plan.id,
              planDate: plan.date,
            });
            continue;
          }
          addToBucket(buckets, food, entry.amount, {
            ...planMeta,
            grams: entry.amount,
          });
          continue;
        }

        const recipe = recipeMap.get(entry.referenceId);
        if (!recipe) {
          missing.push({
            referenceId: entry.referenceId,
            type: "recipe",
            planId: plan.id,
            planDate: plan.date,
          });
          continue;
        }
        if (recipe.servings <= 0) continue;
        const scale = entry.amount / recipe.servings;
        if (scale <= 0) continue;

        for (const ingredient of recipe.ingredients) {
          const food = foodMap.get(ingredient.foodId);
          if (!food) {
            missing.push({
              referenceId: ingredient.foodId,
              type: "food",
              planId: plan.id,
              planDate: plan.date,
            });
            continue;
          }
          const grams = ingredient.amount * scale;
          addToBucket(buckets, food, grams, {
            ...planMeta,
            viaRecipeId: recipe.id,
            viaRecipeName: recipe.name,
            viaRecipeServings: entry.amount,
            grams,
          });
        }
      }
    }
  }

  const items: ShoppingListItem[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.totalGrams < 0.25) continue;
    items.push({
      foodId: bucket.foodId,
      name: bucket.name,
      categoryId: bucket.categoryId,
      totalGrams: bucket.totalGrams,
      sources: Array.from(bucket.sources.values()).sort((a, b) => {
        if (a.planDate !== b.planDate) return a.planDate.localeCompare(b.planDate);
        return (a.viaRecipeName ?? "").localeCompare(b.viaRecipeName ?? "", "de");
      }),
    });
  }

  const groupsMap = new Map<string, ShoppingListGroup>();
  for (const item of items) {
    const categoryId = item.categoryId || UNCATEGORIZED_ID;
    const existing = groupsMap.get(categoryId);
    if (existing) {
      existing.items.push(item);
      existing.totalGrams += item.totalGrams;
      continue;
    }
    groupsMap.set(categoryId, {
      categoryId,
      categoryLabel: CATEGORY_LABELS.get(categoryId) ?? "Unkategorisiert",
      items: [item],
      totalGrams: item.totalGrams,
    });
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    const orderA = CATEGORY_ORDER.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const orderB = CATEGORY_ORDER.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.categoryLabel.localeCompare(b.categoryLabel, "de");
  });

  for (const group of groups) {
    group.items.sort((a, b) => {
      if (b.totalGrams !== a.totalGrams) return b.totalGrams - a.totalGrams;
      return a.name.localeCompare(b.name, "de");
    });
  }

  const totalGrams = items.reduce((acc, item) => acc + item.totalGrams, 0);

  return {
    groups,
    itemCount: items.length,
    totalGrams,
    planCount: plans.length,
    missing,
  };
}

/**
 * Formats a gram amount for display in the shopping list. Switches to
 * kilograms above 1 000 g and falls back to whole grams below the gram
 * threshold to keep the list readable for kitchen staff scanning quickly.
 */
export function formatShoppingAmount(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    const decimals = kg >= 10 ? 1 : 2;
    return `${kg.toLocaleString("de-DE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} kg`;
  }
  if (grams >= 10) {
    return `${Math.round(grams).toLocaleString("de-DE")} g`;
  }
  return `${grams.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} g`;
}
