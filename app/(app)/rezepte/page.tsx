import { RezeptePageClient } from "./rezepte-client";
import { fetchAllFoodsForList } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { FoodsProvider } from "@/components/foods-provider";

export default async function RezeptePage() {
  const [foods, recipes] = await Promise.all([
    fetchAllFoodsForList(),
    fetchRecipes(),
  ]);
  return (
    <FoodsProvider foods={foods}>
      <RezeptePageClient recipes={recipes} />
    </FoodsProvider>
  );
}
