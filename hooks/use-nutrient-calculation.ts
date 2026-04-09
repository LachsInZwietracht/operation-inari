"use client";

import { useMemo } from "react";
import type { Food, Ingredient, NutrientValue } from "@/lib/types";
import { scaleNutrients, sumNutrients } from "@/lib/nutrients";

interface UseNutrientCalculationResult {
  totalNutrients: NutrientValue[];
  perServingNutrients: NutrientValue[];
}

export function useNutrientCalculation(
  ingredients: Ingredient[],
  foods: Food[],
  servings: number,
): UseNutrientCalculationResult {
  const totalNutrients = useMemo(() => {
    const foodMap = new Map(foods.map((f) => [f.id, f]));

    const scaledArrays: NutrientValue[][] = [];
    for (const ingredient of ingredients) {
      const food = foodMap.get(ingredient.foodId);
      if (!food) continue;
      scaledArrays.push(
        scaleNutrients(food.nutrients, food.baseAmount, ingredient.amount),
      );
    }

    return sumNutrients(scaledArrays);
  }, [ingredients, foods]);

  const perServingNutrients = useMemo(() => {
    const s = Math.max(servings, 1);
    return totalNutrients.map((nv) => ({
      nutrientId: nv.nutrientId,
      amount: nv.amount / s,
    }));
  }, [totalNutrients, servings]);

  return { totalNutrients, perServingNutrients };
}
