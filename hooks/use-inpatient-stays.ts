"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { InpatientStay } from "@/lib/types";
import {
  deleteInpatientStayClient,
  fetchInpatientStaysClient,
  persistInpatientStay,
} from "@/lib/data/inpatient-stays-client";
import { isLocalMigrationCandidate, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_inpatient_stays";

function loadFromStorage(): InpatientStay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InpatientStay[];
  } catch {
    return [];
  }
}

function sortStays(items: InpatientStay[]) {
  return [...items].sort((a, b) => {
    if (a.station !== b.station) return a.station.localeCompare(b.station, "de");
    if (a.room !== b.room) return a.room.localeCompare(b.room, "de");
    return a.bed.localeCompare(b.bed, "de");
  });
}

function buildInitialStays() {
  return sortStays(loadFromStorage());
}

export function useInpatientStays() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [stays, setStays] = useState<InpatientStay[]>(buildInitialStays);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const staysRef = useRef(stays);

  useEffect(() => {
    staysRef.current = stays;
  }, [stays]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(stays.filter(isLocalMigrationCandidate)),
      );
    } catch {
      // ignore
    }
  }, [stays]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoadingRemote(true);

    async function syncStays() {
      try {
        const remoteStays = await fetchInpatientStaysClient();
        if (cancelled) return;

        const localOnly = staysRef.current.filter(isLocalMigrationCandidate);
        const merged = [...remoteStays];

        for (const local of localOnly) {
          if (!remoteStays.some((remoteStay) => matchesRecordIdentity(remoteStay, local))) {
            merged.push(local);
          }
        }

        setStays(sortStays(merged));

        if (!migrationDone.current) {
          migrationDone.current = true;
          const pendingMigration = localOnly.filter(
            (stay) => !remoteStays.some((remoteStay) => matchesRecordIdentity(remoteStay, stay)),
          );

          for (const stay of pendingMigration) {
            void persistInpatientStay(stay)
              .then((persisted) => {
                setStays((prev) => sortStays(prev.map((item) => (item.id === stay.id ? persisted : item))));
              })
              .catch((err) => {
                console.error(`Failed to migrate inpatient stay ${stay.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync inpatient stays from Supabase:", error);
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }

    void syncStays();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const addStay = useCallback((payload: Omit<InpatientStay, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const tempId = `stay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newStay: InpatientStay = {
      ...payload,
      id: tempId,
      createdAt: now,
      updatedAt: now,
    };

    setStays((prev) => sortStays([...prev, newStay]));

    if (isAuthenticated) {
      void persistInpatientStay(newStay)
        .then((persisted) => {
          setStays((prev) => sortStays(prev.map((item) => (item.id === tempId ? persisted : item))));
        })
        .catch((err) => {
          console.error("Failed to persist inpatient stay:", err);
        });
    }

    return newStay;
  }, [isAuthenticated]);

  const updateStay = useCallback((id: string, updates: Partial<InpatientStay>) => {
    setStays((prev) => {
      const next = prev.map((stay) =>
        stay.id === id || stay.legacyId === id
          ? { ...stay, ...updates, updatedAt: new Date().toISOString() }
          : stay,
      );

      const updated = next.find((stay) => stay.id === id || stay.legacyId === id);
      if (updated && isAuthenticated) {
        void persistInpatientStay(updated).then((persisted) => {
          setStays((current) => sortStays(current.map((item) => (item.id === updated.id ? persisted : item))));
        }).catch((err) => {
          console.error("Failed to update inpatient stay in Supabase:", err);
        });
      }

      return sortStays(next);
    });
  }, [isAuthenticated]);

  const deleteStay = useCallback((id: string) => {
    setStays((prev) => prev.filter((stay) => stay.id !== id && stay.legacyId !== id));
    if (isAuthenticated) {
      void deleteInpatientStayClient(id).catch((err) => {
        console.error("Failed to delete inpatient stay in Supabase:", err);
      });
    }
  }, [isAuthenticated]);

  return {
    stays,
    addStay,
    updateStay,
    deleteStay,
    isLoadingRemote,
  };
}
