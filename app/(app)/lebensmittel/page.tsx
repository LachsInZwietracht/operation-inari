import { LebensmittelPageClient } from "./lebensmittel-client";
import { fetchAllFoodsForList } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function LebensmittelPage() {
  const foods = await fetchAllFoodsForList();
  return (
    <FoodsProvider foods={foods}>
      <LebensmittelPageClient />
    </FoodsProvider>
  );
}
