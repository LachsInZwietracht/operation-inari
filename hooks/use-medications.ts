"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MedicationEntry } from "@/lib/types";
import { MEDICATIONS } from "@/lib/mock-data";
import {
  deleteMedicationClient,
  fetchMedicationsClient,
  persistMedication,
} from "@/lib/data/patient-medications-client";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_medications";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

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

function sortEntries(items: MedicationEntry[]) {
  return [...items].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

function buildInitial(): MedicationEntry[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return sortEntries([...MEDICATIONS.filter((item) => !ids.has(item.id)), ...stored]);
}

function isMockEntry(entry: MedicationEntry) {
  return MEDICATIONS.some((mockEntry) => mockEntry.id === entry.id);
}

function getLocalOnlyEntries(items: MedicationEntry[]) {
  return items.filter((entry) => !isMockEntry(entry));
}

export function useMedications() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<MedicationEntry[]>(buildInitial);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const entriesRef = useRef(entries);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    const custom = getLocalOnlyEntries(entries);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // ignore
    }
  }, [entries]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoadingRemote(true);

    async function syncEntries() {
      try {
        const remoteEntries = await fetchMedicationsClient();
        if (cancelled) return;

        const localOnly = getLocalOnlyEntries(entriesRef.current);
        const merged = [...remoteEntries];

        for (const local of localOnly) {
          const existsRemote = remoteEntries.some((remoteEntry) => remoteEntry.id === local.id);
          if (!existsRemote) {
            merged.push(local);
          }
        }

        setEntries(sortEntries(merged));

        if (!migrationDone.current) {
          migrationDone.current = true;
          const pendingMigration = localOnly.filter(
            (localEntry) => !remoteEntries.some((remoteEntry) => remoteEntry.id === localEntry.id),
          );

          for (const entry of pendingMigration) {
            void persistMedication(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate medication entry ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync medications from Supabase:", error);
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }

    void syncEntries();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const getForPatient = useCallback(
    (patientId: string) => sortEntries(entries.filter((entry) => entry.patientId === patientId)),
    [entries],
  );

  const addEntry = useCallback(
    (payload: Omit<MedicationEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const tempId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEntry: MedicationEntry = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => sortEntries([...prev, newEntry]));

      if (isAuthenticated) {
        void persistMedication(newEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist medication entry:", err);
          });
      }

      return newEntry;
    },
    [isAuthenticated],
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    if (isAuthenticated && isUuid(id)) {
      void deleteMedicationClient(id).catch((err) => {
        console.error("Failed to delete medication in Supabase:", err);
      });
    }
  }, [isAuthenticated]);

  return { entries, getForPatient, addEntry, deleteEntry, isLoadingRemote };
}
