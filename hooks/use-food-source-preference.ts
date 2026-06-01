"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { FoodSourceId } from "@/lib/types";

/**
 * Persisted "active database" the practitioner works with in the foods
 * browser. This is the day-to-day source selection (PRODI-feedback #3):
 * `"all"` searches every connected source, a concrete id scopes searches and
 * browsing to that database.
 *
 * Stored in `localStorage` so the choice sticks across visits without a schema
 * change; a server-backed per-user default can be layered on later if
 * cross-device sync is needed. Uses the module-store + `useSyncExternalStore`
 * pattern so every consumer re-renders synchronously when the value changes
 * (robust under the React Compiler).
 */
export type FoodSourcePreference = FoodSourceId | "all";

const STORAGE_KEY = "prodi:active-food-source:v1";
const DEFAULT_SOURCE: FoodSourcePreference = "all";

function readStorage(): FoodSourcePreference {
  if (typeof window === "undefined") return DEFAULT_SOURCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (raw as FoodSourcePreference) : DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
}

let current: FoodSourcePreference = readStorage();

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return DEFAULT_SOURCE;
}

function persist(value: FoodSourcePreference) {
  current = value;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage failures (private mode, quota) — the in-memory value
      // still drives the session.
    }
  }
  emitChange();
}

export function useFoodSourcePreference() {
  const activeSource = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setActiveSource = useCallback((value: FoodSourcePreference) => {
    persist(value);
  }, []);

  return { activeSource, setActiveSource } as const;
}
