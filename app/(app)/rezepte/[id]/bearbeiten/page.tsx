import { RezeptBearbeitenPageClient } from "./rezept-bearbeiten-client";
import { fetchFoodSearchIndex } from "@/lib/data/foods";
import { fetchRecipeById } from "@/lib/data/recipes";
import { FoodSearchProvider } from "@/components/foods-provider";

export default async function RezeptBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [foods, recipe] = await Promise.all([
    fetchFoodSearchIndex(),
    fetchRecipeById(id),
  ]);
  return (
    <FoodSearchProvider foods={foods}>
      <RezeptBearbeitenPageClient recipeId={id} recipe={recipe} />
    </FoodSearchProvider>
  );
}
