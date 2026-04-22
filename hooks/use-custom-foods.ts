"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Food, FoodPortionSize, Recipe } from "@/lib/types";
import {
  calculatePerServing,
  calculateRecipeNutrients,
} from "@/lib/nutrients";
import { fetchCustomFoodsClient, persistCustomFood, deleteCustomFoodClient } from "@/lib/data/custom-foods-client";
import {
  isLocalMigrationCandidate,
  matchesRecordIdentity,
  upsertByIdentity,
} from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "inari_custom_foods";
const LEGACY_STORAGE_KEY = "prodi_custom_foods";

function loadFromStorage(): Food[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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
    localStorage.removeItem(LEGACY_STORAGE_KEY);
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

export function useCustomFoods(baseFoods: Food[]) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [customFoods, setCustomFoods] = useState<Food[]>(() => loadFromStorage());
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const customFoodsRef = useRef(customFoods);

  useEffect(() => {
    customFoodsRef.current = customFoods;
  }, [customFoods]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoadingRemote(true);

    async function loadPersistedFoods() {
      try {
        const persistedFoods = await fetchCustomFoodsClient();
        if (cancelled) return;

        const localCandidates = customFoodsRef.current.filter(isLocalMigrationCandidate);
        const mergedFoods = [...persistedFoods];
        for (const localFood of localCandidates) {
          if (!mergedFoods.some((remoteFood) => matchesRecordIdentity(remoteFood, localFood))) {
            mergedFoods.push(localFood);
          }
        }

        setCustomFoods(mergedFoods);

        if (!migrationDone.current) {
          migrationDone.current = true;
          for (const food of localCandidates) {
            try {
              const persistedFood = await persistCustomFood(food);
              if (cancelled) return;
              setCustomFoods((prev) => upsertByIdentity(prev, persistedFood));
            } catch (err) {
              console.error(`Failed to migrate custom food ${food.name}:`, err);
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message && message !== "AUTH_REQUIRED") {
          console.error("Failed to load custom foods from Supabase:", error);
        }
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }

    void loadPersistedFoods();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    saveToStorage(customFoods.filter(isLocalMigrationCandidate));
  }, [customFoods]);

  const allFoods = useMemo(
    () => [...baseFoods, ...customFoods],
    [baseFoods, customFoods],
  );

  const addFood = useCallback(
    async (food: Omit<Food, "id" | "createdAt" | "updatedAt">) => {
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

      setCustomFoods((prev) => upsertByIdentity(prev, newFood));

      if (isAuthenticated) {
        try {
          const persistedFood = await persistCustomFood(newFood);
          setCustomFoods((prev) => upsertByIdentity(prev, persistedFood));
          return persistedFood;
        } catch (error) {
          console.error("Failed to persist custom food:", error);
        }
      }

      return newFood;
    },
    [isAuthenticated],
  );

  const deleteFood = useCallback((id: string) => {
    setCustomFoods((prev) => prev.filter((food) => !matchesRecordIdentity(food, { id })));

    if (isAuthenticated) {
      void deleteCustomFoodClient(id).catch((error) => {
        console.error("Failed to delete custom food:", error);
      });
    }
  }, [isAuthenticated]);

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

      setCustomFoods((prev) => upsertByIdentity(prev, newFood));

      if (isAuthenticated) {
        void persistCustomFood(newFood)
          .then((persistedFood) => {
            setCustomFoods((prev) => upsertByIdentity(prev, persistedFood));
          })
          .catch((error) => {
            console.error("Failed to persist converted recipe food:", error);
          });
      }

      return newFood;
    },
    [allFoods, isAuthenticated],
  );

  return {
    customFoods,
    allFoods,
    addFood,
    deleteFood,
    convertRecipeToFood,
    isLoadingRemote
  };
}
