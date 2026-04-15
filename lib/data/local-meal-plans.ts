import type { DailyMealPlan, Food } from "@/lib/types";

import { normalizeMealPlanFoodReferences } from "@/lib/data/food-reference-normalization";

const STORAGE_KEY = "prodi_meal_plans";

export function getLocalMealPlansRecord(foods: Food[] = []): Record<string, DailyMealPlan> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, DailyMealPlan>;
    return Object.fromEntries(
      Object.entries(parsed).map(([date, plan]) => [
        date,
        normalizeMealPlanFoodReferences(plan, foods),
      ]),
    );
  } catch {
    return {};
  }
}

export function saveLocalMealPlansRecord(
  plans: Record<string, DailyMealPlan>,
  foods: Food[] = [],
) {
  if (typeof window === "undefined") return;

  const normalized = Object.fromEntries(
    Object.entries(plans).map(([date, plan]) => [
      date,
      normalizeMealPlanFoodReferences(plan, foods),
    ]),
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}
