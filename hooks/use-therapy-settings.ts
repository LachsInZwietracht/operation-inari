"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TherapySetting } from "@/lib/types";
import {
  deleteTherapySettingClient,
  fetchTherapySettingsClient,
  persistTherapySetting,
} from "@/lib/data/patient-therapy-settings-client";
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_therapy_settings";

function loadFromStorage(): TherapySetting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TherapySetting[];
  } catch {
    return [];
  }
}

function sortEntries(items: TherapySetting[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getLocalOnlyEntries(items: TherapySetting[]) {
  return items.filter(isLocalMigrationCandidate);
}

function buildInitial(initialEntries: TherapySetting[] = []): TherapySetting[] {
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

interface UseTherapySettingsOptions {
  initialEntries?: TherapySetting[];
}

export function useTherapySettings(options: UseTherapySettingsOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const initialEntriesRef = useRef(options.initialEntries);
  const [entries, setEntries] = useState<TherapySetting[]>(() =>
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
        const remoteEntries = initialRemoteEntries ?? await fetchTherapySettingsClient();
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
            void persistTherapySetting(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate therapy setting ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync therapy settings from Supabase:", error);
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

  const upsertSetting = useCallback(
    (payload: Omit<TherapySetting, "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const nextEntry: TherapySetting = {
        ...payload,
        createdAt: now,
        updatedAt: now,
      };

      setEntries((prev) => {
        const existing = prev.find((entry) => entry.id === payload.id);
        if (existing) {
          return sortEntries(
            prev.map((entry) => (entry.id === payload.id ? { ...entry, ...payload, updatedAt: now } : entry)),
          );
        }

        return sortEntries([nextEntry, ...prev]);
      });

      if (isAuthenticated) {
        void persistTherapySetting(nextEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === payload.id ? persisted : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist therapy setting:", err);
          });
      }

      return nextEntry;
    },
    [isAuthenticated],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (isAuthenticated && isUuid(id)) {
        void deleteTherapySettingClient(id).catch((err) => {
          console.error("Failed to delete therapy setting in Supabase:", err);
        });
      }
    },
    [isAuthenticated],
  );

  return { entries, getForPatient, upsertSetting, deleteEntry, isLoadingRemote };
}
