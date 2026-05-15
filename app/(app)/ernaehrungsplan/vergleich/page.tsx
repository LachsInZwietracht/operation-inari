import { PlanVergleichClient } from "./plan-vergleich-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";
import type { DailyMealPlan, Recipe } from "@/lib/types";

// Same coverage as the planner — keeping the lists aligned lets the comparison
// view show the exact totals a user sees when they open a single plan, instead
// of subtly different numbers because a nutrient was filtered out server-side.
const PLAN_VERGLEICH_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "gesaettigte_fettsaeuren",
  "ungesaettigte_fettsaeuren",
  "zucker",
  "natrium",
  "vitamin_c",
  "calcium",
  "eisen",
  "magnesium",
  "vitamin_d",
  "kalium",
  "phosphor",
];

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

export default async function PlanVergleichPage({
  searchParams,
}: {
  searchParams: Promise<{ plans?: string }>;
}) {
  const params = await searchParams;
  const [recipes, mealPlans] = await Promise.all([fetchRecipes(), fetchMealPlans()]);

  const foodIds = extractFoodIds(recipes, mealPlans);
  const foods =
    foodIds.length > 0
      ? await fetchFoodsViaRpc({ foodIds, nutrientIds: PLAN_VERGLEICH_NUTRIENT_IDS })
      : [];

  const presetPlanIds =
    params.plans
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  return (
    <FoodsProvider foods={foods}>
      <PlanVergleichClient
        plans={mealPlans}
        recipes={recipes}
        nutrientIds={PLAN_VERGLEICH_NUTRIENT_IDS}
        presetPlanIds={presetPlanIds}
      />
    </FoodsProvider>
  );
}
