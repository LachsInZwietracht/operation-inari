"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MedicationEntry } from "@/lib/types";
import {
  deleteMedicationClient,
  fetchMedicationsClient,
  persistMedication,
} from "@/lib/data/patient-medications-client";
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

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

function sortEntries(items: MedicationEntry[]) {
  return [...items].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

function getLocalOnlyEntries(items: MedicationEntry[]) {
  return items.filter(isLocalMigrationCandidate);
}

function buildInitial(initialEntries: MedicationEntry[] = []): MedicationEntry[] {
  const localOnly = getLocalOnlyEntries(loadFromStorage());
  const merged = [...initialEntries];

  for (const local of localOnly) {
    const existsRemote = initialEntries.some((remoteEntry) =>
      matchesRecordIdentity(remoteEntry, local),
    );
    if (!existsRemote) {
      merged.push(local);
    }
  }

  return sortEntries(merged);
}

interface UseMedicationsOptions {
  initialEntries?: MedicationEntry[];
}

export function useMedications(options: UseMedicationsOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const initialEntriesRef = useRef(options.initialEntries);
  const [entries, setEntries] = useState<MedicationEntry[]>(() =>
    buildInitial(options.initialEntries),
  );
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
    const initialRemoteEntries = initialEntriesRef.current;
    setIsLoadingRemote(!initialRemoteEntries);

    async function syncEntries() {
      try {
        const remoteEntries = initialRemoteEntries ?? await fetchMedicationsClient();
        initialEntriesRef.current = undefined;
        if (cancelled) return;

        const localOnly = getLocalOnlyEntries(entriesRef.current);
        const merged = [...remoteEntries];

        for (const local of localOnly) {
          const existsRemote = remoteEntries.some((remoteEntry) =>
            matchesRecordIdentity(remoteEntry, local),
          );
          if (!existsRemote) {
            merged.push(local);
          }
        }

        setEntries(sortEntries(merged));

        if (!migrationDone.current) {
          migrationDone.current = true;
          const pendingMigration = localOnly.filter(
            (localEntry) => !remoteEntries.some((remoteEntry) =>
              matchesRecordIdentity(remoteEntry, localEntry),
            ),
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
