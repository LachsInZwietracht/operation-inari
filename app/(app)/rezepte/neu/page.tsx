import { NeuesRezeptPageClient } from "./neues-rezept-client";
import { fetchFoodSearchIndex } from "@/lib/data/foods";
import { FoodSearchProvider } from "@/components/foods-provider";

export default async function NeuesRezeptPage() {
  const foods = await fetchFoodSearchIndex();
  return (
    <FoodSearchProvider foods={foods}>
      <NeuesRezeptPageClient />
    </FoodSearchProvider>
  );
}
