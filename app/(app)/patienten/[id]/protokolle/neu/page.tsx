import { NeuesProtokollPageClient } from "./neues-protokoll-client";
import { fetchAllFoodsForList } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function NeuesProtokollPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const foods = await fetchAllFoodsForList();
  return (
    <FoodsProvider foods={foods}>
      <NeuesProtokollPageClient params={params} />
    </FoodsProvider>
  );
}
