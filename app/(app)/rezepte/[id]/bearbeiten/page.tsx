import { RezeptBearbeitenPageClient } from "./rezept-bearbeiten-client";
import { fetchAllFoods } from "@/lib/data/foods";
import { fetchRecipeById } from "@/lib/data/recipes";
import { FoodsProvider } from "@/components/foods-provider";

export default async function RezeptBearbeitenPage({
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
      <RezeptBearbeitenPageClient recipeId={id} recipe={recipe} />
    </FoodsProvider>
  );
}
