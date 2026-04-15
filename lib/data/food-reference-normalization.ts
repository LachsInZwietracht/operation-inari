import { LEGACY_FOOD_ID_TO_BLS_CODE } from "@/lib/legacy-food-map";
import type { DailyMealPlan, Food, NutritionProtocol, Recipe } from "@/lib/types";

function createFoodResolver(foods: Food[]) {
  const foodsById = new Set(foods.map((food) => food.id));
  const foodsByBlsCode = new Map<string, string>();

  for (const food of foods) {
    if (food.blsCode) {
      foodsByBlsCode.set(food.blsCode, food.id);
    }
  }

  return (foodId: string) => {
    if (foodsById.has(foodId)) {
      return foodId;
    }

    const blsCode = LEGACY_FOOD_ID_TO_BLS_CODE[foodId];
    if (!blsCode) {
      return foodId;
    }

    return foodsByBlsCode.get(blsCode) ?? blsCode;
  };
}

export function normalizeRecipeFoodReferences(recipe: Recipe, foods: Food[]): Recipe {
  const resolveFoodId = createFoodResolver(foods);
  let changed = false;

  const ingredients = recipe.ingredients.map((ingredient) => {
    const foodId = resolveFoodId(ingredient.foodId);
    if (foodId !== ingredient.foodId) {
      changed = true;
      return { ...ingredient, foodId };
    }
    return ingredient;
  });

  return changed ? { ...recipe, ingredients } : recipe;
}

export function normalizeMealPlanFoodReferences(plan: DailyMealPlan, foods: Food[]): DailyMealPlan {
  const resolveFoodId = createFoodResolver(foods);
  let changed = false;

  const slots = plan.slots.map((slot) => {
    const entries = slot.entries.map((entry) => {
      if (entry.type !== "food") {
        return entry;
      }

      const referenceId = resolveFoodId(entry.referenceId);
      if (referenceId !== entry.referenceId) {
        changed = true;
        return { ...entry, referenceId };
      }

      return entry;
    });

    return changed ? { ...slot, entries } : slot;
  });

  return changed ? { ...plan, slots } : plan;
}

export function normalizeProtocolFoodReferences(
  protocol: NutritionProtocol,
  foods: Food[],
): NutritionProtocol {
  const resolveFoodId = createFoodResolver(foods);
  let changed = false;

  const days = protocol.days.map((day) => {
    const entries = day.entries.map((entry) => {
      const foodId = resolveFoodId(entry.foodId);
      if (foodId !== entry.foodId) {
        changed = true;
        return { ...entry, foodId };
      }
      return entry;
    });

    return changed ? { ...day, entries } : day;
  });

  return changed ? { ...protocol, days } : protocol;
}
