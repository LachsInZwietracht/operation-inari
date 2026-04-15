import { NeuesLebensmittelPageClient } from "./neues-lebensmittel-client";
import { fetchAllFoods } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function NeuesLebensmittelPage() {
  const foods = await fetchAllFoods();
  return (
    <FoodsProvider foods={foods}>
      <NeuesLebensmittelPageClient />
    </FoodsProvider>
  );
}
