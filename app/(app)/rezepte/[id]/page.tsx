import { RecipeDetailContent } from "@/components/recipe-detail-content";
import { RecipeDetailClient } from "./recipe-detail-client";
import { fetchFoodsByIds } from "@/lib/data/foods";
import { fetchRecipeById } from "@/lib/data/recipes";
import { FoodsProvider } from "@/components/foods-provider";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await fetchRecipeById(id);
  
  // Hydrate only the foods needed for this specific recipe
  const foodIds = recipe?.ingredients.map(i => i.foodId) ?? [];
  const foods = await fetchFoodsByIds(foodIds);

  return (
    <FoodsProvider foods={foods}>
      {recipe ? (
        <RecipeDetailContent recipe={recipe} />
      ) : (
        <RecipeDetailClient recipeId={id} />
      )}
    </FoodsProvider>
  );
}
