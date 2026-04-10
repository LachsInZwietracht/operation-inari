"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Food, FoodPortionSize, Recipe } from "@/lib/types";
import { FOODS } from "@/lib/mock-data";
import {
  calculatePerServing,
  calculateRecipeNutrients,
} from "@/lib/nutrients";

const STORAGE_KEY = "prodi_custom_foods";

function loadFromStorage(): Food[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Food[];
  } catch {
    return [];
  }
}

function saveToStorage(items: Food[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

function buildDefaultPortions(): FoodPortionSize[] {
  return [
    { label: "Portion", amount: 1 },
    { label: "Halbe Portion", amount: 0.5 },
    { label: "Doppelte Portion", amount: 2 },
  ];
}

export function useCustomFoods() {
  const [customFoods, setCustomFoods] = useState<Food[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(customFoods);
  }, [customFoods]);

  const allFoods = useMemo(
    () => [...FOODS, ...customFoods],
    [customFoods],
  );

  const addFood = useCallback(
    (food: Omit<Food, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newFood: Food = {
        ...food,
        id: `custom_food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        sourceId: food.sourceId ?? "custom",
        source: food.source ?? "Eigene Eingabe",
        isCustom: true,
      };
      setCustomFoods((prev) => [...prev, newFood]);
      return newFood;
    },
    [],
  );

  const deleteFood = useCallback((id: string) => {
    setCustomFoods((prev) => prev.filter((food) => food.id !== id));
  }, []);

  const convertRecipeToFood = useCallback(
    (recipe: Recipe) => {
      const total = calculateRecipeNutrients(recipe, allFoods);
      const perServing = calculatePerServing(total, recipe.servings);
      const now = new Date().toISOString();
      const newFood: Food = {
        id: `recipe_food_${recipe.id}`,
        name: recipe.name,
        categoryId: "cat_fertiggerichte",
        source: "Aus Rezept",
        sourceId: "custom",
        sourceVersion: recipe.updatedAt ?? now,
        baseAmount: 1,
        nutrients: perServing,
        allergens: recipe.allergens,
        additives: recipe.additives,
        co2PerPortion: recipe.co2PerPortion,
        portionSizes: buildDefaultPortions(),
        isCustom: true,
        isRecipeDerived: true,
        createdAt: now,
        updatedAt: now,
      };

      setCustomFoods((prev) => {
        // replace existing conversion if present
        const filtered = prev.filter((food) => food.id !== newFood.id);
        return [...filtered, newFood];
      });

      return newFood;
    },
    [allFoods],
  );

  return {
    customFoods,
    allFoods,
    addFood,
    deleteFood,
    convertRecipeToFood,
  };
}
