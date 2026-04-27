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

export function useNutrientValueMaps(nutrientIds: string[]) {
  const cacheKey = useMemo(
    () => Array.from(new Set(nutrientIds.filter(Boolean))).sort().join("|"),
    [nutrientIds],
  );
  const normalizedIds = useMemo(() => (cacheKey ? cacheKey.split("|") : []), [cacheKey]);

  const [valuesByNutrient, setValuesByNutrient] = useState<Map<string, Map<string, number>>>(() => {
    const initial = new Map<string, Map<string, number>>();
    for (const nutrientId of normalizedIds) {
      const cached = nutrientCache.get(nutrientId);
      if (cached) initial.set(nutrientId, cached);
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const missingIds = normalizedIds.filter((nutrientId) => !nutrientCache.has(nutrientId));

    if (missingIds.length === 0) {
      const cachedValues = new Map<string, Map<string, number>>();
      for (const nutrientId of normalizedIds) {
        const cached = nutrientCache.get(nutrientId);
        if (cached) cachedValues.set(nutrientId, cached);
      }
      setValuesByNutrient(cachedValues);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      const client = createClient();

      const results = await Promise.all(
        missingIds.map(async (nutrientId) => {
          const { data, error } = await client
            .from("food_nutrients")
            .select("food_id, amount, per_amount")
            .eq("nutrient_id", nutrientId)
            .limit(10000);

          if (error) {
            throw new Error(`${nutrientId}: ${error.message}`);
          }

          const map = new Map<string, number>();
          for (const row of (data ?? []) as FoodNutrientRow[]) {
            map.set(row.food_id, normalizeAmount(row));
          }

          nutrientCache.set(nutrientId, map);
          return [nutrientId, map] as const;
        }),
      );

      if (!active) return;

      const nextValues = new Map<string, Map<string, number>>();
      for (const nutrientId of normalizedIds) {
        const cached = nutrientCache.get(nutrientId);
        if (cached) nextValues.set(nutrientId, cached);
      }
      for (const [nutrientId, map] of results) {
        nextValues.set(nutrientId, map);
      }

      setValuesByNutrient(nextValues);
      setLoading(false);
    }

    void load().catch((loadError) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "Nährstoffwerte konnten nicht geladen werden");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [cacheKey, normalizedIds]);

  return {
    valuesByNutrient,
    isLoading: loading,
    error,
  };
}
