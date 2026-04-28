"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreeningResult } from "@/lib/types";
import {
  deleteScreeningClient,
  fetchScreeningsClient,
  persistScreening,
} from "@/lib/data/patient-screenings-client";
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

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

function sortEntries(items: ScreeningResult[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getLocalOnlyEntries(items: ScreeningResult[]) {
  return items.filter(isLocalMigrationCandidate);
}

function buildInitial(initialEntries: ScreeningResult[] = []): ScreeningResult[] {
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

interface UseScreeningsOptions {
  initialEntries?: ScreeningResult[];
}

export function useScreenings(options: UseScreeningsOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const initialEntriesRef = useRef(options.initialEntries);
  const [entries, setEntries] = useState<ScreeningResult[]>(() =>
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
        const remoteEntries = initialRemoteEntries ?? await fetchScreeningsClient();
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
            void persistScreening(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate screening entry ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync screenings from Supabase:", error);
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
    (payload: Omit<ScreeningResult, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const tempId = `screen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEntry: ScreeningResult = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => sortEntries([newEntry, ...prev]));

      if (isAuthenticated) {
        void persistScreening(newEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist screening entry:", err);
          });
      }

      return newEntry;
    },
    [isAuthenticated],
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    if (isAuthenticated && isUuid(id)) {
      void deleteScreeningClient(id).catch((err) => {
        console.error("Failed to delete screening in Supabase:", err);
      });
    }
  }, [isAuthenticated]);

  return { entries, getForPatient, addEntry, deleteEntry, isLoadingRemote };
}
