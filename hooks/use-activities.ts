"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityEntry } from "@/lib/types";
import { ACTIVITIES } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_activities";

function loadFromStorage(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityEntry[];
  } catch {
    return [];
  }
}

function buildInitial(): ActivityEntry[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return [...ACTIVITIES.filter((item) => !ids.has(item.id)), ...stored];
}

export function useActivities() {
  const [entries, setEntries] = useState<ActivityEntry[]>(buildInitial);

  useEffect(() => {
    const custom = entries.filter((entry) => !ACTIVITIES.find((mock) => mock.id === entry.id));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // ignore
    }
  }, [entries]);

  const getForPatient = useCallback(
    (patientId: string) => entries.filter((entry) => entry.patientId === patientId),
    [entries],
  );

  const addEntry = useCallback(
    (payload: Omit<ActivityEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newEntry: ActivityEntry = {
        ...payload,
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [...prev, newEntry]);
      return newEntry;
    },
    [],
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return { entries, getForPatient, addEntry, deleteEntry };
}
