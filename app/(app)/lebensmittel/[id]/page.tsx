import { notFound } from "next/navigation";
import { FoodDetailContent } from "@/components/food-detail-content";
import { FoodDetailClient } from "./food-detail-client";
import { fetchCatalogFoodById } from "@/lib/data/foods";

export default async function LebensmittelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const food = await fetchCatalogFoodById(id);

  if (food) {
    return <FoodDetailContent food={food} />;
  }

  if (id.startsWith("food_")) {
    notFound();
  }

  return <FoodDetailClient foodId={id} />;
}
