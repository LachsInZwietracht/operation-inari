import { WissenPageClient } from "./wissen-client";
import { fetchFoodsByIdsCached } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";
import type { DailyMealPlan, Recipe } from "@/lib/types";

const LIST_NUTRIENT_IDS = [
  "energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe",
  "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren", "zucker",
  "natrium", "vitamin_c", "calcium", "eisen", "magnesium",
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

export default async function WissenPage() {
  const [recipes, mealPlans] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans({ limit: 5 }),
  ]);

  const foodIds = extractFoodIds(recipes, mealPlans);
  const foods = foodIds.length > 0
    ? await fetchFoodsByIdsCached({
        foodIds,
        nutrientIds: LIST_NUTRIENT_IDS,
        cacheKeyPrefix: "wissen-foods",
      })
    : [];

  return (
    <FoodsProvider foods={foods}>
      <WissenPageClient recipes={recipes} mealPlans={mealPlans} />
    </FoodsProvider>
  );
}
