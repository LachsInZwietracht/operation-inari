"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProcamResult } from "@/lib/types";
import { PROCAM_RESULTS } from "@/lib/mock-data";
import {
  deleteProcamResultClient,
  fetchProcamResultsClient,
  persistProcamResult,
} from "@/lib/data/patient-procam-client";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_procam";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

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

function sortEntries(items: ProcamResult[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function buildInitial(): ProcamResult[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return sortEntries([...PROCAM_RESULTS.filter((item) => !ids.has(item.id)), ...stored]);
}

function isMockEntry(entry: ProcamResult) {
  return PROCAM_RESULTS.some((mockEntry) => mockEntry.id === entry.id);
}

function getLocalOnlyEntries(items: ProcamResult[]) {
  return items.filter((entry) => !isMockEntry(entry));
}

export function useProcam() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<ProcamResult[]>(buildInitial);
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
        const remoteEntries = await fetchProcamResultsClient();
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
            void persistProcamResult(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate PROCAM result ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync PROCAM results from Supabase:", error);
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

  const addResult = useCallback(
    (payload: Omit<ProcamResult, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const tempId = `procam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEntry: ProcamResult = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => sortEntries([newEntry, ...prev]));

      if (isAuthenticated) {
        void persistProcamResult(newEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist PROCAM result:", err);
          });
      }

      return newEntry;
    },
    [isAuthenticated],
  );

  const deleteResult = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (isAuthenticated && isUuid(id)) {
        void deleteProcamResultClient(id).catch((err) => {
          console.error("Failed to delete PROCAM result in Supabase:", err);
        });
      }
    },
    [isAuthenticated],
  );

  return { entries, getForPatient, addResult, deleteResult, isLoadingRemote };
}
