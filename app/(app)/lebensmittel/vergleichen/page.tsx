import { LebensmittelVergleichPageClient } from "./lebensmittel-vergleichen-client";
import { fetchBrandedFoods, fetchFoodsForComparison } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function LebensmittelVergleichPage() {
  const [foods, brandedFoods] = await Promise.all([
    fetchFoodsForComparison(),
    fetchBrandedFoods(),
  ]);

  return (
    <FoodsProvider foods={foods}>
      <LebensmittelVergleichPageClient brandedFoods={brandedFoods} />
    </FoodsProvider>
  );
}
