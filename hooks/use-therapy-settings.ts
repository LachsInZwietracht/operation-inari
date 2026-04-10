"use client";

import { useCallback, useEffect, useState } from "react";
import type { TherapySetting } from "@/lib/types";
import { THERAPY_SETTINGS } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_therapy_settings";

function loadFromStorage(): TherapySetting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TherapySetting[];
  } catch {
    return [];
  }
}

function buildInitial(): TherapySetting[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return [...THERAPY_SETTINGS.filter((item) => !ids.has(item.id)), ...stored];
}

export function useTherapySettings() {
  const [entries, setEntries] = useState<TherapySetting[]>(buildInitial);

  useEffect(() => {
    const custom = entries.filter((entry) => !THERAPY_SETTINGS.find((mock) => mock.id === entry.id));
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

  const upsertSetting = useCallback(
    (payload: Omit<TherapySetting, "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      setEntries((prev) => {
        const existing = prev.find((entry) => entry.id === payload.id);
        if (existing) {
          return prev.map((entry) =>
            entry.id === payload.id ? { ...entry, ...payload, updatedAt: now } : entry,
          );
        }
        const newEntry: TherapySetting = {
          ...payload,
          createdAt: now,
          updatedAt: now,
        };
        return [...prev, newEntry];
      });
    },
    [],
  );

  return { entries, getForPatient, upsertSetting };
}
