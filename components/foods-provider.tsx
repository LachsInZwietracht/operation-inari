"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { fetchCustomFoodsClient } from "@/lib/data/custom-foods-client";
import type { Food, FoodSearchItem } from "@/lib/types";

interface FoodSearchContextType {
  index: FoodSearchItem[];
  isLoading: boolean;
  loadIndex: () => Promise<void>;
}

const FoodsContext = createContext<Food[] | null>(null);
const FoodSearchContext = createContext<FoodSearchContextType | null>(null);

export function FoodsProvider({
  foods,
  children,
}: {
  foods: Food[];
  children: ReactNode;
}) {
  return <FoodsContext.Provider value={foods}>{children}</FoodsContext.Provider>;
}

export function FoodSearchProvider({
  foods: initialFoods,
  children,
}: {
  foods: FoodSearchItem[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState<FoodSearchItem[]>(initialFoods);
  const [isLoading, setIsLoading] = useState(false);
  // The server index is catalog-only; the user's own custom foods are merged
  // from the RLS-scoped client fetch. Tracked separately from index.length
  // because SSR callers (recipe edit page) prefill the base index.
  const [customLoaded, setCustomLoaded] = useState(false);

  const loadIndex = useCallback(async () => {
    const needsBase = index.length === 0;
    if ((!needsBase && customLoaded) || isLoading) return;

    setIsLoading(true);
    try {
      const [baseItems, customItems] = await Promise.all([
        needsBase ? fetchBaseIndex() : Promise.resolve<FoodSearchItem[] | null>(null),
        customLoaded ? Promise.resolve<FoodSearchItem[] | null>(null) : fetchOwnCustomSearchItems(),
      ]);
      setIndex((prev) => {
        const base = baseItems ?? prev;
        if (!customItems) return base;
        const seen = new Set(base.map((item) => item.id));
        return [...base, ...customItems.filter((item) => !seen.has(item.id))];
      });
      if (customItems) setCustomLoaded(true);
    } catch (error) {
      console.error("Failed to load food search index:", error);
    } finally {
      setIsLoading(false);
    }
  }, [index.length, isLoading, customLoaded]);

  return (
    <FoodSearchContext.Provider value={{ index, isLoading, loadIndex }}>
      {children}
    </FoodSearchContext.Provider>
  );
}

async function fetchBaseIndex(): Promise<FoodSearchItem[]> {
  const response = await fetch("/api/foods/search-index");
  if (!response.ok) return [];
  const compactData = await response.json();
  // Inflate compact arrays: [id, name, categoryId, sourceId, isCustom]
  return compactData.map((row: [string, string, string, string, number]) => ({
    id: row[0],
    name: row[1],
    categoryId: row[2],
    sourceId: row[3] as FoodSearchItem["sourceId"],
    isCustom: Boolean(row[4]),
  }));
}

async function fetchOwnCustomSearchItems(): Promise<FoodSearchItem[] | null> {
  try {
    const foods = await fetchCustomFoodsClient();
    return foods.map((food) => ({
      id: food.id,
      name: food.name,
      categoryId: food.categoryId,
      sourceId: food.sourceId,
      isCustom: true,
    }));
  } catch {
    // Custom foods must never block the base index; null keeps customLoaded
    // false so the next loadIndex() call retries.
    return null;
  }
}

export function useFoods() {
  const value = useContext(FoodsContext);
  if (!value) {
    throw new Error("useFoods must be used within a FoodsProvider");
  }
  return value;
}

export function useFoodSearch() {
  const value = useContext(FoodSearchContext);
  if (!value) {
    throw new Error("useFoodSearch must be used within a FoodSearchProvider");
  }
  return value;
}

/**
 * @deprecated Use useFoodSearch instead
 */
export function useFoodSearchIndex() {
  const { index } = useFoodSearch();
  return index;
}
