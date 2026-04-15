"use client";

import { useEffect, useMemo, useState } from "react";
import type { Food } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const nutrientCache = new Map<string, Map<string, number>>();

interface FoodNutrientRow {
  food_id: string;
  amount: number;
  per_amount: number | null;
}

function normalizeAmount(row: FoodNutrientRow): number {
  if (!row.per_amount || row.per_amount === 100) return row.amount;
  if (row.per_amount === 0) return row.amount;
  return row.amount * (100 / row.per_amount);
}

export function useNutrientValues(nutrientId: string, foods: Food[]) {
  const baseValues = useMemo(() => {
    const map = new Map<string, number>();
    let missing = 0;
    for (const food of foods) {
      const nutrient = food.nutrients.find((nv) => nv.nutrientId === nutrientId);
      if (nutrient) {
        map.set(food.id, nutrient.amount);
      } else {
        missing += 1;
      }
    }
    return { values: map, missing };
  }, [foods, nutrientId]);

  const [remoteValues, setRemoteValues] = useState<Map<string, number> | null>(() =>
    nutrientCache.get(nutrientId) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (baseValues.missing === 0) {
      setRemoteValues(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = nutrientCache.get(nutrientId);
    if (cached) {
      setRemoteValues(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      const client = createClient();
      const { data, error } = await client
        .from("food_nutrients")
        .select("food_id, amount, per_amount")
        .eq("nutrient_id", nutrientId)
        .limit(10000);

      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const map = new Map<string, number>();
      for (const row of (data ?? []) as FoodNutrientRow[]) {
        map.set(row.food_id, normalizeAmount(row));
      }

      nutrientCache.set(nutrientId, map);
      setRemoteValues(map);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [nutrientId, baseValues.missing]);

  const combinedValues = useMemo(() => {
    const merged = new Map(baseValues.values);
    remoteValues?.forEach((value, foodId) => {
      merged.set(foodId, value);
    });
    return merged;
  }, [baseValues.values, remoteValues]);

  return {
    values: combinedValues,
    isLoading: loading,
    error,
  };
}
