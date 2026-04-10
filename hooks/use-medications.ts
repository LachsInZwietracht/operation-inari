"use client";

import { useCallback, useEffect, useState } from "react";
import type { MedicationEntry } from "@/lib/types";
import { MEDICATIONS } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_medications";

function loadFromStorage(): MedicationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MedicationEntry[];
  } catch {
    return [];
  }
}

function buildInitial(): MedicationEntry[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return [...MEDICATIONS.filter((item) => !ids.has(item.id)), ...stored];
}

export function useMedications() {
  const [entries, setEntries] = useState<MedicationEntry[]>(buildInitial);

  useEffect(() => {
    const custom = entries.filter((entry) => !MEDICATIONS.find((mock) => mock.id === entry.id));
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
    (payload: Omit<MedicationEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newEntry: MedicationEntry = {
        ...payload,
        id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
