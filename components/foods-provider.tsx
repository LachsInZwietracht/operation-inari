"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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

  const loadIndex = useCallback(async () => {
    if (index.length > 0 || isLoading) return;

    setIsLoading(true);
    try {
      // We use a dynamic import to avoid bundling server-side code on the client
      // or we can use an API route / Server Action.
      // Given we are in a client component, we'll call a server action or fetch.
      const response = await fetch("/api/foods/search-index");
      if (response.ok) {
        const compactData = await response.json();
        // Inflate compact arrays: [id, name, categoryId, sourceId, isCustom]
        const inflated: FoodSearchItem[] = compactData.map((row: [string, string, string, string, number]) => ({
          id: row[0],
          name: row[1],
          categoryId: row[2],
          sourceId: row[3] as any, // casting sourceId since it comes from compact int/string
          isCustom: Boolean(row[4]),
        }));
        setIndex(inflated);
      }
    } catch (error) {
      console.error("Failed to load food search index:", error);
    } finally {
      setIsLoading(false);
    }
  }, [index.length, isLoading]);

  return (
    <FoodSearchContext.Provider value={{ index, isLoading, loadIndex }}>
      {children}
    </FoodSearchContext.Provider>
  );
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
