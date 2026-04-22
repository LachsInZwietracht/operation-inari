"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TherapyDeviceIntegration } from "@/lib/types";
import {
  deleteTherapyIntegrationClient,
  fetchTherapyIntegrationsClient,
  persistTherapyIntegration,
} from "@/lib/data/patient-therapy-integrations-client";
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_therapy_integrations";

function loadFromStorage(): TherapyDeviceIntegration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TherapyDeviceIntegration[];
  } catch {
    return [];
  }
}

function sortEntries(items: TherapyDeviceIntegration[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function buildInitial(): TherapyDeviceIntegration[] {
  return sortEntries(loadFromStorage());
}

function getLocalOnlyEntries(items: TherapyDeviceIntegration[]) {
  return items.filter(isLocalMigrationCandidate);
}

export function useTherapyIntegrations() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TherapyDeviceIntegration[]>(buildInitial);
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
        const remoteEntries = await fetchTherapyIntegrationsClient();
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
            void persistTherapyIntegration(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate therapy integration ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync therapy integrations from Supabase:", error);
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

  const addIntegration = useCallback(
    (payload: Omit<TherapyDeviceIntegration, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = new Date().toISOString();
      const tempId = `integration_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const entry: TherapyDeviceIntegration = {
        ...payload,
        id: tempId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setEntries((prev) => sortEntries([entry, ...prev]));

      if (isAuthenticated) {
        void persistTherapyIntegration(entry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist therapy integration:", err);
          });
      }

      return entry;
    },
    [isAuthenticated],
  );

  const updateIntegration = useCallback(
    (id: string, updates: Partial<TherapyDeviceIntegration>) => {
      let nextEntry: TherapyDeviceIntegration | null = null;

      setEntries((prev) =>
        sortEntries(
          prev.map((entry) => {
            if (entry.id !== id) return entry;
            nextEntry = { ...entry, ...updates, updatedAt: new Date().toISOString() };
            return nextEntry;
          }),
        ),
      );

      if (isAuthenticated && nextEntry) {
        void persistTherapyIntegration(nextEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === id ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to update therapy integration:", err);
          });
      }
    },
    [isAuthenticated],
  );

  const deleteIntegration = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (isAuthenticated && isUuid(id)) {
        void deleteTherapyIntegrationClient(id).catch((err) => {
          console.error("Failed to delete therapy integration in Supabase:", err);
        });
      }
    },
    [isAuthenticated],
  );

  return { entries, getForPatient, addIntegration, updateIntegration, deleteIntegration, isLoadingRemote };
}
