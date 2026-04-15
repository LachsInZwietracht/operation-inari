import { WissenPageClient } from "./wissen-client";
import { fetchAllFoodsForList } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";

export default async function WissenPage() {
  const [foods, recipes, mealPlans] = await Promise.all([
    fetchAllFoodsForList(),
    fetchRecipes(),
    fetchMealPlans({ limit: 5 }),
  ]);
  return (
    <FoodsProvider foods={foods}>
      <WissenPageClient recipes={recipes} mealPlans={mealPlans} />
    </FoodsProvider>
  );
}
