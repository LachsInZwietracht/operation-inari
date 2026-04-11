"use client"

import { useCallback, useEffect, useState } from "react"

import type { TherapyDeviceIntegration } from "@/lib/types"
import { THERAPY_INTEGRATIONS } from "@/lib/mock-data"

const STORAGE_KEY = "prodi_therapy_integrations"

function loadFromStorage(): TherapyDeviceIntegration[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TherapyDeviceIntegration[]
  } catch {
    return []
  }
}

function buildInitial(): TherapyDeviceIntegration[] {
  const stored = loadFromStorage()
  const ids = new Set(stored.map((entry) => entry.id))
  return [...THERAPY_INTEGRATIONS.filter((entry) => !ids.has(entry.id)), ...stored]
}

export function useTherapyIntegrations() {
  const [entries, setEntries] = useState<TherapyDeviceIntegration[]>(buildInitial)

  useEffect(() => {
    const custom = entries.filter((entry) => !THERAPY_INTEGRATIONS.find((mock) => mock.id === entry.id))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // ignore
    }
  }, [entries])

  const getForPatient = useCallback(
    (patientId: string) => entries.filter((entry) => entry.patientId === patientId),
    [entries],
  )

  const addIntegration = useCallback(
    (payload: Omit<TherapyDeviceIntegration, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = new Date().toISOString()
      const entry: TherapyDeviceIntegration = {
        ...payload,
        id: `integration_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setEntries((prev) => [entry, ...prev])
      return entry
    },
    [],
  )

  const updateIntegration = useCallback((id: string, updates: Partial<TherapyDeviceIntegration>) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, ...updates, updatedAt: new Date().toISOString() }
          : entry,
      ),
    )
  }, [])

  return { entries, getForPatient, addIntegration, updateIntegration }
}
