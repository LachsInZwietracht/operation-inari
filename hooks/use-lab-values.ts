"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { LabValueEntry } from "@/lib/types"
import {
  deleteLabValueClient,
  fetchLabValuesClient,
  persistLabValue,
} from "@/lib/data/patient-lab-values-client"
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records"
import { useAuth } from "@/hooks/use-auth"

const STORAGE_KEY = "prodi_lab_values"

function loadFromStorage(): LabValueEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as LabValueEntry[]
  } catch {
    // Ignore parse errors
  }
  return []
}

function buildInitial(): LabValueEntry[] {
  return sortEntries(loadFromStorage())
}

function sortEntries(items: LabValueEntry[]) {
  return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function getLocalOnlyEntries(items: LabValueEntry[]) {
  return items.filter(isLocalMigrationCandidate)
}

export function useLabValues() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<LabValueEntry[]>(buildInitial)
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
        const remoteEntries = await fetchLabValuesClient()
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
          const pendingMigration = localOnly.filter(
            (localEntry) => !remoteEntries.some((remoteEntry) =>
              matchesRecordIdentity(remoteEntry, localEntry),
            ),
          )

          for (const entry of pendingMigration) {
            void persistLabValue(entry)
              .then((persisted) => {
                setEntries((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                )
              })
              .catch((err) => {
                console.error(`Failed to migrate lab value entry ${entry.id}:`, err)
              })
          }
        }
      } catch (error) {
        console.error("Failed to sync lab values from Supabase:", error)
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
    (patientId: string): LabValueEntry[] =>
      sortEntries(entries.filter((e) => e.patientId === patientId)),
    [entries],
  )

  const getForPatientAndParameter = useCallback(
    (patientId: string, parameterId: string): LabValueEntry[] =>
      sortEntries(
        entries.filter((e) => e.patientId === patientId && e.parameterId === parameterId),
      ),
    [entries],
  )

  const addEntry = useCallback(
    (entry: Omit<LabValueEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const tempId = `lv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const newEntry: LabValueEntry = {
        ...entry,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      }
      setEntries((prev) => sortEntries([...prev, newEntry]))

      if (isAuthenticated) {
        void persistLabValue(newEntry)
          .then((persisted) => {
            setEntries((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId ? persisted : item))),
            )
          })
          .catch((err) => {
            console.error("Failed to persist lab value entry:", err)
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
        void deleteLabValueClient(id).catch((err) => {
          console.error("Failed to delete lab value in Supabase:", err)
        })
      }
    },
    [isAuthenticated],
  )

  return {
    entries,
    getForPatient,
    getForPatientAndParameter,
    addEntry,
    deleteEntry,
    isLoadingRemote,
  }
}
