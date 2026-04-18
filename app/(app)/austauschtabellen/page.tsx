import { AustauschtabellenPageClient } from "./austauschtabellen-client";
import { fetchAllFoodsForList } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export const dynamic = "force-dynamic";

export default async function AustauschtabellenPage() {
  const foods = await fetchAllFoodsForList();
  return (
    <FoodsProvider foods={foods}>
      <AustauschtabellenPageClient />
    </FoodsProvider>
  );
}
