"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScreeningResult } from "@/lib/types";
import { SCREENINGS } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_screenings";

function loadFromStorage(): ScreeningResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScreeningResult[];
  } catch {
    return [];
  }
}

function buildInitial(): ScreeningResult[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return [...SCREENINGS.filter((item) => !ids.has(item.id)), ...stored];
}

export function useScreenings() {
  const [entries, setEntries] = useState<ScreeningResult[]>(buildInitial);

  useEffect(() => {
    const custom = entries.filter((entry) => !SCREENINGS.find((mock) => mock.id === entry.id));
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
    (payload: Omit<ScreeningResult, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newEntry: ScreeningResult = {
        ...payload,
        id: `screen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [...prev, newEntry]);
      return newEntry;
    },
    [],
  );

  return { entries, getForPatient, addEntry };
}
