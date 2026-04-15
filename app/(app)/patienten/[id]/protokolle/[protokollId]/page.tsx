import { ProtokollDetailPageClient } from "./protokoll-detail-client";
import { fetchFoodsForProtocols } from "@/lib/data/foods";
import { FoodsProvider } from "@/components/foods-provider";

export default async function ProtokollDetailPage({
  params,
}: {
  params: Promise<{ id: string; protokollId: string }>;
}) {
  const foods = await fetchFoodsForProtocols();
  return (
    <FoodsProvider foods={foods}>
      <ProtokollDetailPageClient params={params} />
    </FoodsProvider>
  );
}
