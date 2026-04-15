import { ErnaehrungsplanPageClient } from "./ernaehrungsplan-client";
import { fetchFoodsForMealPlans } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";

export default async function ErnaehrungsplanPage() {
  const [foods, recipes, mealPlans] = await Promise.all([
    fetchFoodsForMealPlans(),
    fetchRecipes(),
    fetchMealPlans(),
  ]);
  return (
    <FoodsProvider foods={foods}>
      <ErnaehrungsplanPageClient recipes={recipes} initialPlans={mealPlans} />
    </FoodsProvider>
  );
}
