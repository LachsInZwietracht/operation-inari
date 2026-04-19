import { ErnaehrungsplanPageClient } from "./ernaehrungsplan-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";
import type { DailyMealPlan, Recipe } from "@/lib/types";

const MEAL_PLAN_NUTRIENT_IDS = [
  "energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe",
  "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren", "zucker",
  "natrium", "vitamin_c", "calcium", "eisen", "magnesium",
  "vitamin_d", "kalium", "phosphor",
];

function extractFoodIds(recipes: Recipe[], mealPlans: DailyMealPlan[]): string[] {
  const ids = new Set<string>();

  for (const plan of mealPlans) {
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          ids.add(entry.referenceId);
        }
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

export default async function ErnaehrungsplanPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const { patientId } = await searchParams;
  // Step 1: Fetch recipes + meal plans first (both cached)
  const [recipes, mealPlans] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans(),
  ]);

  // Step 2: Extract only the food IDs actually referenced
  const foodIds = extractFoodIds(recipes, mealPlans);

  // Step 3: Fetch only those foods via single RPC call
  const foods = foodIds.length > 0
    ? await fetchFoodsViaRpc({ foodIds, nutrientIds: MEAL_PLAN_NUTRIENT_IDS })
    : [];

  return (
    <FoodsProvider foods={foods}>
      <ErnaehrungsplanPageClient recipes={recipes} initialPlans={mealPlans} patientId={patientId} />
    </FoodsProvider>
  );
}
