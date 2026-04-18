"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActivityEntry } from "@/lib/types";
import { ACTIVITIES } from "@/lib/mock-data";
import {
  deleteActivityClient,
  fetchActivitiesClient,
  persistActivity,
} from "@/lib/data/patient-activities-client";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_activities";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function loadFromStorage(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityEntry[];
  } catch {
    return [];
  }
}

function sortEntries(items: ActivityEntry[]) {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function buildInitial(): ActivityEntry[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return sortEntries([...ACTIVITIES.filter((item) => !ids.has(item.id)), ...stored]);
}

function isMockEntry(entry: ActivityEntry) {
  return ACTIVITIES.some((mockEntry) => mockEntry.id === entry.id);
}

function getLocalOnlyEntries(items: ActivityEntry[]) {
  return items.filter((entry) => !isMockEntry(entry));
}

export function useActivities() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<ActivityEntry[]>(buildInitial);
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
        const remoteEntries = await fetchActivitiesClient();
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
            void persistActivity(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate activity entry ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync activities from Supabase:", error);
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
    (payload: Omit<ActivityEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const tempId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEntry: ActivityEntry = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => sortEntries([newEntry, ...prev]));

      if (isAuthenticated) {
        void persistActivity(newEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist activity entry:", err);
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
        void deleteActivityClient(id).catch((err) => {
          console.error("Failed to delete activity in Supabase:", err);
        });
      }
    },
    [isAuthenticated],
  );

  return { entries, getForPatient, addEntry, deleteEntry, isLoadingRemote };
}
