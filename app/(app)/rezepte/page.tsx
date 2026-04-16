import { RezeptePageClient } from "./rezepte-client";
import { fetchFoodSearchIndex } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { FoodSearchProvider } from "@/components/foods-provider";

export default async function RezeptePage() {
  const [foods, recipes] = await Promise.all([
    fetchFoodSearchIndex(),
    fetchRecipes(),
  ]);
  return (
    <FoodSearchProvider foods={foods}>
      <RezeptePageClient recipes={recipes} />
    </FoodSearchProvider>
  );
}
