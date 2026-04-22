"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { AnthropometricEntry } from "@/lib/types"
import {
  deleteAnthropometricEntryClient,
  fetchAnthropometricEntriesClient,
  persistAnthropometricEntry,
} from "@/lib/data/patient-anthropometrics-client"
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records"
import { useAuth } from "@/hooks/use-auth"

const STORAGE_KEY = "prodi_anthropometric"

function loadFromStorage(): AnthropometricEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AnthropometricEntry[]
  } catch {
    // Ignore parse errors
  }
  return []
}

function sortEntries(items: AnthropometricEntry[]) {
  return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function buildInitial(): AnthropometricEntry[] {
  return sortEntries(loadFromStorage())
}

function getLocalOnlyEntries(items: AnthropometricEntry[]) {
  return items.filter(isLocalMigrationCandidate)
}

export function useAnthropometric() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<AnthropometricEntry[]>(buildInitial)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const entriesRef = useRef(entries)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalOnlyEntries(entries)))
    } catch {
      // Ignore quota errors
    }
  }, [entries])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function syncEntries() {
      try {
        const remoteEntries = await fetchAnthropometricEntriesClient()
        if (cancelled) return

        const localOnly = getLocalOnlyEntries(entriesRef.current)
        const merged = [...remoteEntries]

        for (const local of localOnly) {
          const existsRemote = remoteEntries.some((remoteEntry) =>
            matchesRecordIdentity(remoteEntry, local),
          )
          if (!existsRemote) {
            merged.push(local)
          }
        }

        setEntries(sortEntries(merged))

        if (!migrationDone.current) {
          migrationDone.current = true

          const pendingMigration = localOnly.filter((localEntry) =>
            !remoteEntries.some((remoteEntry) => matchesRecordIdentity(remoteEntry, localEntry)),
          )

          for (const entry of pendingMigration) {
            void persistAnthropometricEntry(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                )
              })
              .catch((err) => {
                console.error(`Failed to migrate anthropometric entry ${entry.id}:`, err)
              })
          }
        }
      } catch (error) {
        console.error("Failed to sync anthropometric entries from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncEntries()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const getForPatient = useCallback(
    (patientId: string): AnthropometricEntry[] =>
      sortEntries(entries.filter((e) => e.patientId === patientId)),
    [entries],
  )

  const addEntry = useCallback(
    (entry: Omit<AnthropometricEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const tempId = `anthro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const newEntry: AnthropometricEntry = {
        ...entry,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      }

      setEntries((prev) => sortEntries([...prev, newEntry]))

      if (isAuthenticated) {
        void persistAnthropometricEntry(newEntry)
          .then((persisted) => {
            setEntries((prev) => sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))))
          })
          .catch((err) => {
            console.error("Failed to persist anthropometric entry:", err)
          })
      }

      return newEntry
    },
    [isAuthenticated],
  )

  const deleteEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id))

      if (isAuthenticated && isUuid(id)) {
        void deleteAnthropometricEntryClient(id).catch((err) => {
          console.error("Failed to delete anthropometric entry in Supabase:", err)
        })
      }
    },
    [isAuthenticated],
  )

  return {
    entries,
    getForPatient,
    addEntry,
    deleteEntry,
    isLoadingRemote,
  }
}
