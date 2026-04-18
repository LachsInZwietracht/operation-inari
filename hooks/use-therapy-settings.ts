"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TherapySetting } from "@/lib/types";
import { THERAPY_SETTINGS } from "@/lib/mock-data";
import {
  deleteTherapySettingClient,
  fetchTherapySettingsClient,
  persistTherapySetting,
} from "@/lib/data/patient-therapy-settings-client";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_therapy_settings";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

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

function buildInitial(): TherapySetting[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return sortEntries([...THERAPY_SETTINGS.filter((item) => !ids.has(item.id)), ...stored]);
}

function isMockEntry(entry: TherapySetting) {
  return THERAPY_SETTINGS.some((mockEntry) => mockEntry.id === entry.id);
}

function getLocalOnlyEntries(items: TherapySetting[]) {
  return items.filter((entry) => !isMockEntry(entry));
}

export function useTherapySettings() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TherapySetting[]>(buildInitial);
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
        const remoteEntries = await fetchTherapySettingsClient();
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
