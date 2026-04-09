import { RECIPES } from "@/lib/mock-data";
import { RecipeDetailContent } from "@/components/recipe-detail-content";
import { RecipeDetailClient } from "./recipe-detail-client";
import type { Recipe } from "@/lib/types";

function findMockRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mockRecipe = findMockRecipe(id);

  if (mockRecipe) {
    return <RecipeDetailContent recipe={mockRecipe} />;
  }

  return <RecipeDetailClient recipeId={id} />;
}
