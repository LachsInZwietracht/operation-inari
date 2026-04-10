"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiagnosisEntry } from "@/lib/types";
import { DIAGNOSES } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_diagnoses";

function loadFromStorage(): DiagnosisEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DiagnosisEntry[];
  } catch {
    return [];
  }
}

function buildInitial(): DiagnosisEntry[] {
  const stored = loadFromStorage();
  const storedIds = new Set(stored.map((item) => item.id));
  const combined = [...DIAGNOSES.filter((item) => !storedIds.has(item.id)), ...stored];
  return combined.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export function useDiagnoses() {
  const [entries, setEntries] = useState<DiagnosisEntry[]>(buildInitial);

  useEffect(() => {
    const custom = entries.filter((entry) => !DIAGNOSES.find((mock) => mock.id === entry.id));
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
    (payload: Omit<DiagnosisEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newEntry: DiagnosisEntry = {
        ...payload,
        id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [newEntry, ...prev]);
      return newEntry;
    },
    [],
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return { entries, getForPatient, addEntry, deleteEntry };
}
