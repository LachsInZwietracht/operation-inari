"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Food, FoodSearchItem } from "@/lib/types";

const FoodsContext = createContext<Food[] | null>(null);
const FoodSearchContext = createContext<FoodSearchItem[] | null>(null);

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
  foods,
  children,
}: {
  foods: FoodSearchItem[];
  children: ReactNode;
}) {
  return (
    <FoodSearchContext.Provider value={foods}>{children}</FoodSearchContext.Provider>
  );
}

export function useFoods() {
  const value = useContext(FoodsContext);
  if (!value) {
    throw new Error("useFoods must be used within a FoodsProvider");
  }
  return value;
}

export function useFoodSearchIndex() {
  const value = useContext(FoodSearchContext);
  if (!value) {
    throw new Error("useFoodSearchIndex must be used within a FoodSearchProvider");
  }
  return value;
}
