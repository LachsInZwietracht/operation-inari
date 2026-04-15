import type { DailyMealPlan, Food } from "@/lib/types";

import { fetchMealPlansClient } from "@/lib/data/meal-plans-client";
import { getLocalMealPlansRecord } from "@/lib/data/local-meal-plans";
import { normalizeMealPlanFoodReferences } from "@/lib/data/food-reference-normalization";

function mergeMealPlans(
  basePlans: DailyMealPlan[],
  persistedPlans: DailyMealPlan[],
  localPlans: DailyMealPlan[],
  foods: Food[],
): DailyMealPlan[] {
  const mergedByDate = new Map<string, DailyMealPlan>();

  for (const plan of basePlans) {
    mergedByDate.set(plan.date, normalizeMealPlanFoodReferences(plan, foods));
  }

  for (const plan of persistedPlans) {
    mergedByDate.set(plan.date, normalizeMealPlanFoodReferences(plan, foods));
  }

  for (const plan of localPlans) {
    if (!mergedByDate.has(plan.date)) {
      mergedByDate.set(plan.date, normalizeMealPlanFoodReferences(plan, foods));
    }
  }

  return [...mergedByDate.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function loadBrowserMealPlans(
  basePlans: DailyMealPlan[],
  foods: Food[],
): Promise<DailyMealPlan[]> {
  const localPlans = Object.values(getLocalMealPlansRecord(foods));

  try {
    const persistedPlans = await fetchMealPlansClient();
    return mergeMealPlans(basePlans, persistedPlans, localPlans, foods);
  } catch (error) {
    console.error("Failed to load meal plans from Supabase for browser consumer:", error);
    return mergeMealPlans(basePlans, [], localPlans, foods);
  }
}
