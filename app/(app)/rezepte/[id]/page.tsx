import { RecipeDetailContent } from "@/components/recipe-detail-content";
import { RecipeDetailClient } from "./recipe-detail-client";
import { fetchAllFoods } from "@/lib/data/foods";
import { fetchRecipeById } from "@/lib/data/recipes";
import { FoodsProvider } from "@/components/foods-provider";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [foods, recipe] = await Promise.all([
    fetchAllFoods(),
    fetchRecipeById(id),
  ]);

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
