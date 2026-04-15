import { NeuesRezeptPageClient } from "./neues-rezept-client";
import { fetchAllFoods } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function NeuesRezeptPage() {
  const foods = await fetchAllFoods();
  return (
    <FoodsProvider foods={foods}>
      <NeuesRezeptPageClient />
    </FoodsProvider>
  );
}
