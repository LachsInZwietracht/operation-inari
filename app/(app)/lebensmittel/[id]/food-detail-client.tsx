"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { Food } from "@/lib/types";
import { FoodDetailContent } from "@/components/food-detail-content";

function loadCustomFood(id: string): Food | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("prodi_custom_foods");
    if (!raw) return null;
    const foods: Food[] = JSON.parse(raw);
    return foods.find((food) => food.id === id) ?? null;
  } catch {
    return null;
  }
}

export function FoodDetailClient({ foodId }: { foodId: string }) {
  const [food, setFood] = useState<Food | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFood(loadCustomFood(foodId));
    setLoaded(true);
  }, [foodId]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!food) {
    notFound();
  }

  return <FoodDetailContent food={food} />;
}
