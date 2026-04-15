import { LebensmittelVergleichPageClient } from "./lebensmittel-vergleichen-client";
import { fetchAllFoods, fetchBrandedFoods } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function LebensmittelVergleichPage() {
  const [foods, brandedFoods] = await Promise.all([
    fetchAllFoods(),
    fetchBrandedFoods(),
  ]);

  return (
    <FoodsProvider foods={foods}>
      <LebensmittelVergleichPageClient brandedFoods={brandedFoods} />
    </FoodsProvider>
  );
}
