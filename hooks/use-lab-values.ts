"use client"

import { useState, useCallback, useEffect } from "react"
import type { LabValueEntry } from "@/lib/types"
import { LAB_VALUES } from "@/lib/mock-data"

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
  const stored = loadFromStorage()
  const storedIds = new Set(stored.map((e) => e.id))
  const mockOnly = LAB_VALUES.filter((e) => !storedIds.has(e.id))
  return [...mockOnly, ...stored].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

export function useLabValues() {
  const [entries, setEntries] = useState<LabValueEntry[]>(buildInitial)

  useEffect(() => {
    try {
      const custom = entries.filter(
        (e) => !LAB_VALUES.find((m) => m.id === e.id),
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // Ignore quota errors
    }
  }, [entries])

  const getForPatient = useCallback(
    (patientId: string): LabValueEntry[] =>
      entries
        .filter((e) => e.patientId === patientId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [entries],
  )

  const getForPatientAndParameter = useCallback(
    (patientId: string, parameterId: string): LabValueEntry[] =>
      entries
        .filter((e) => e.patientId === patientId && e.parameterId === parameterId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [entries],
  )

  const addEntry = useCallback(
    (entry: Omit<LabValueEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const newEntry: LabValueEntry = {
        ...entry,
        id: `lv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }
      setEntries((prev) =>
        [...prev, newEntry].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      )
      return newEntry
    },
    [],
  )

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return {
    entries,
    getForPatient,
    getForPatientAndParameter,
    addEntry,
    deleteEntry,
  }
}
