"use client"

import { useState, useCallback, useEffect } from "react"
import type { AnthropometricEntry } from "@/lib/types"
import { ANTHROPOMETRIC_DATA } from "@/lib/mock-data"

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

function buildInitial(): AnthropometricEntry[] {
  const stored = loadFromStorage()
  const storedIds = new Set(stored.map((e) => e.id))
  const mockOnly = ANTHROPOMETRIC_DATA.filter((e) => !storedIds.has(e.id))
  return [...mockOnly, ...stored].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

export function useAnthropometric() {
  const [entries, setEntries] = useState<AnthropometricEntry[]>(buildInitial)

  useEffect(() => {
    try {
      const custom = entries.filter(
        (e) => !ANTHROPOMETRIC_DATA.find((m) => m.id === e.id),
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // Ignore quota errors
    }
  }, [entries])

  const getForPatient = useCallback(
    (patientId: string): AnthropometricEntry[] =>
      entries
        .filter((e) => e.patientId === patientId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [entries],
  )

  const addEntry = useCallback(
    (entry: Omit<AnthropometricEntry, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const newEntry: AnthropometricEntry = {
        ...entry,
        id: `anthro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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
    addEntry,
    deleteEntry,
  }
}
