import { EinkaufslisteClient } from "./einkaufsliste-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";
import type { DailyMealPlan, Recipe } from "@/lib/types";

// The shopping list aggregates raw gram amounts and never reads nutrient
// fields — but `fetchFoodsViaRpc` requires at least one nutrient id, and the
// food lookup needs to include every food referenced anywhere in the source
// plans (direct food entries plus recipe ingredients). We pull a single
// lightweight nutrient so the payload stays small.
const SHOPPING_LIST_NUTRIENT_IDS = ["energie"];

function extractFoodIds(recipes: Recipe[], mealPlans: DailyMealPlan[]): string[] {
  const ids = new Set<string>();

  for (const plan of mealPlans) {
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") ids.add(entry.referenceId);
      }
    }
  }

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      ids.add(ingredient.foodId);
    }
  }

  return Array.from(ids);
}

export default async function EinkaufslistePage({
  searchParams,
}: {
  searchParams: Promise<{ plans?: string }>;
}) {
  const params = await searchParams;
  const [recipes, mealPlans] = await Promise.all([fetchRecipes(), fetchMealPlans()]);

  const foodIds = extractFoodIds(recipes, mealPlans);
  const foods =
    foodIds.length > 0
      ? await fetchFoodsViaRpc({ foodIds, nutrientIds: SHOPPING_LIST_NUTRIENT_IDS })
      : [];

  const presetPlanIds =
    params.plans
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  return (
    <FoodsProvider foods={foods}>
      <EinkaufslisteClient
        plans={mealPlans}
        recipes={recipes}
        presetPlanIds={presetPlanIds}
      />
    </FoodsProvider>
  );
}
