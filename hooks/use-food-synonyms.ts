"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FoodSynonym } from "@/lib/types";
import { fetchSystemFoodSynonyms } from "@/lib/data/food-synonyms-client";

const STORAGE_KEY = "prodi_food_synonyms_v1";
const STORAGE_PRIMARY_KEY = "prodi_food_synonym_primary_v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function loadUserSynonyms(): FoodSynonym[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FoodSynonym[];
  } catch {
    return [];
  }
}

function saveUserSynonyms(items: FoodSynonym[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

type PreferredMap = Record<string, string>;

function loadPreferredMap(): PreferredMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PRIMARY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PreferredMap;
  } catch {
    return {};
  }
}

function savePreferredMap(map: PreferredMap) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_PRIMARY_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function useFoodSynonyms() {
  const [systemSynonyms, setSystemSynonyms] = useState<FoodSynonym[]>([]);
  const [userSynonyms, setUserSynonyms] = useState<FoodSynonym[]>(() => loadUserSynonyms());
  const [preferredMap, setPreferredMap] = useState<PreferredMap>(() => loadPreferredMap());

  useEffect(() => {
    let cancelled = false;

    async function loadSystemSynonyms() {
      try {
        const synonyms = await fetchSystemFoodSynonyms();
        if (!cancelled) {
          setSystemSynonyms(synonyms);
        }
      } catch (error) {
        console.error("Failed to load system food synonyms from Supabase:", error);
      }
    }

    void loadSystemSynonyms();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveUserSynonyms(userSynonyms);
  }, [userSynonyms]);

  useEffect(() => {
    savePreferredMap(preferredMap);
  }, [preferredMap]);

  const synonyms = useMemo(() => [...systemSynonyms, ...userSynonyms], [systemSynonyms, userSynonyms]);

  const synonymsById = useMemo(() => {
    const map = new Map<string, FoodSynonym>();
    for (const synonym of synonyms) {
      map.set(synonym.id, synonym);
    }
    return map;
  }, [synonyms]);

  const synonymsByFoodId = useMemo(() => {
    const map = new Map<string, FoodSynonym[]>();
    for (const synonym of synonyms) {
      const list = map.get(synonym.foodId) ?? [];
      list.push(synonym);
      map.set(synonym.foodId, list);
    }
    return map;
  }, [synonyms]);

  const addSynonym = useCallback(
    (foodId: string, name: string, options?: { locale?: string; makePrimary?: boolean; createdBy?: string }) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const now = new Date().toISOString();
      const newSynonym: FoodSynonym = {
        id: `syn_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        foodId,
        name: trimmed,
        locale: options?.locale ?? "de-DE",
        createdBy: options?.createdBy ?? "Sie",
        source: "user",
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      setUserSynonyms((prev) => [...prev, newSynonym]);
      if (options?.makePrimary) {
        setPreferredMap((prev) => ({ ...prev, [foodId]: newSynonym.id }));
      }
      return newSynonym;
    },
    [],
  );

  const deleteSynonym = useCallback((synonymId: string) => {
    setUserSynonyms((prev) => prev.filter((synonym) => synonym.id !== synonymId));
    setPreferredMap((prev) => {
      const next = { ...prev };
      for (const [foodId, id] of Object.entries(prev)) {
        if (id === synonymId) {
          delete next[foodId];
        }
      }
      return next;
    });
  }, []);

  const setPrimarySynonym = useCallback((foodId: string, synonymId: string | null) => {
    setPreferredMap((prev) => {
      if (!synonymId) {
        if (!(foodId in prev)) return prev;
        const next = { ...prev };
        delete next[foodId];
        return next;
      }
      return { ...prev, [foodId]: synonymId };
    });
  }, []);

  const getSynonymsForFood = useCallback(
    (foodId: string) => synonymsByFoodId.get(foodId) ?? [],
    [synonymsByFoodId],
  );

  const getDisplayName = useCallback(
    (foodId: string, fallback?: string | null) => {
      const preferredId = preferredMap[foodId];
      if (preferredId) {
        const preferred = synonymsById.get(preferredId);
        if (preferred) return preferred.name;
      }
      const primary = getSynonymsForFood(foodId).find((syn) => syn.isPrimary);
      if (primary) return primary.name;
      return fallback ?? null;
    },
    [preferredMap, synonymsById, getSynonymsForFood],
  );

  return {
    synonyms,
    userSynonyms,
    synonymsByFoodId,
    synonymsById,
    preferredSynonymMap: preferredMap,
    getSynonymsForFood,
    getDisplayName,
    addSynonym,
    deleteSynonym,
    setPrimarySynonym,
  };
}
