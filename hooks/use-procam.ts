"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProcamResult } from "@/lib/types";
import { PROCAM_RESULTS } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_procam";

function loadFromStorage(): ProcamResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProcamResult[];
  } catch {
    return [];
  }
}

function buildInitial(): ProcamResult[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return [...PROCAM_RESULTS.filter((item) => !ids.has(item.id)), ...stored];
}

export function useProcam() {
  const [entries, setEntries] = useState<ProcamResult[]>(buildInitial);

  useEffect(() => {
    const custom = entries.filter((entry) => !PROCAM_RESULTS.find((mock) => mock.id === entry.id));
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

  const addResult = useCallback(
    (payload: Omit<ProcamResult, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newEntry: ProcamResult = {
        ...payload,
        id: `procam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [...prev, newEntry]);
      return newEntry;
    },
    [],
  );

  return { entries, getForPatient, addResult };
}
