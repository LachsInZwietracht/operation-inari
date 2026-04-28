"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PatientAllergenEntry } from "@/lib/types";
import {
  deletePatientAllergenClient,
  fetchPatientAllergensClient,
  persistPatientAllergen,
} from "@/lib/data/patient-allergens-client";
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_patient_allergens";

function loadFromStorage(): PatientAllergenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PatientAllergenEntry[];
  } catch {
    return [];
  }
}

function sortEntries(items: PatientAllergenEntry[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function buildInitialEntries(initialEntries: PatientAllergenEntry[] = []): PatientAllergenEntry[] {
  const localOnly = loadFromStorage().filter(isLocalMigrationCandidate);
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

interface UsePatientAllergensOptions {
  initialEntries?: PatientAllergenEntry[];
}

export function usePatientAllergens(options: UsePatientAllergensOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const initialEntriesRef = useRef(options.initialEntries);
  const [entries, setEntries] = useState<PatientAllergenEntry[]>(() =>
    buildInitialEntries(options.initialEntries),
  );
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const entriesRef = useRef(entries);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(entries.filter(isLocalMigrationCandidate)),
      );
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
        const remoteEntries = initialRemoteEntries ?? await fetchPatientAllergensClient();
        initialEntriesRef.current = undefined;
        if (cancelled) return;

        const localOnly = entriesRef.current.filter(isLocalMigrationCandidate);
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
            (local) => !remoteEntries.some((remoteEntry) =>
              matchesRecordIdentity(remoteEntry, local),
            ),
          );

          for (const entry of pendingMigration) {
            void persistPatientAllergen(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate allergen entry ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync allergens from Supabase:", error);
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
    (patientId: string) =>
      sortEntries(entries.filter((entry) => entry.patientId === patientId)),
    [entries],
  );

  const addEntry = useCallback(
    (
      payload: Omit<PatientAllergenEntry, "id" | "createdAt" | "updatedAt">,
    ) => {
      const now = new Date().toISOString();
      const tempId = `alrg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEntry: PatientAllergenEntry = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => sortEntries([newEntry, ...prev]));

      if (isAuthenticated) {
        void persistPatientAllergen(newEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist allergen entry:", err);
          });
      }

      return newEntry;
    },
    [isAuthenticated],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (isAuthenticated && isUuid(id)) {
        void deletePatientAllergenClient(id).catch((err) => {
          console.error("Failed to delete allergen in Supabase:", err);
        });
      }
    },
    [isAuthenticated],
  );

  return { entries, getForPatient, addEntry, deleteEntry, isLoadingRemote };
}
