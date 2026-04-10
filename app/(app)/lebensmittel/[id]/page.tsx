import { notFound } from "next/navigation";
import { FoodDetailContent } from "@/components/food-detail-content";
import { FOODS, BRANDED_FOODS } from "@/lib/mock-data";
import type { Food } from "@/lib/types";
import { FoodDetailClient } from "./food-detail-client";

const STATIC_FOODS: Food[] = [...FOODS, ...BRANDED_FOODS];

export default async function LebensmittelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const food = STATIC_FOODS.find((item) => item.id === id);

  if (food) {
    return <FoodDetailContent food={food} />;
  }

  if (id.startsWith("food_")) {
    notFound();
  }

  return <FoodDetailClient foodId={id} />;
}
