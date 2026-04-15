"use client"

import { useState, useCallback, useEffect } from "react"
import type { Food, NutritionProtocol } from "@/lib/types"
import { PROTOCOLS } from "@/lib/mock-data"
import { normalizeProtocolFoodReferences } from "@/lib/data/food-reference-normalization"

const STORAGE_KEY = "prodi_protocols"

function loadFromStorage(foods: Food[]): NutritionProtocol[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return (JSON.parse(raw) as NutritionProtocol[]).map((protocol) =>
        normalizeProtocolFoodReferences(protocol, foods),
      )
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

function buildInitial(foods: Food[]): NutritionProtocol[] {
  const stored = loadFromStorage(foods)
  const storedIds = new Set(stored.map((p) => p.id))
  const mockOnly = PROTOCOLS
    .filter((p) => !storedIds.has(p.id))
    .map((protocol) => normalizeProtocolFoodReferences(protocol, foods))
  return [...mockOnly, ...stored].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  )
}

export function useProtocols(foods: Food[] = []) {
  const [protocols, setProtocols] = useState<NutritionProtocol[]>(() => buildInitial(foods))

  useEffect(() => {
    try {
      const custom = protocols.filter(
        (p) => !PROTOCOLS.find((m) => m.id === p.id),
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // Ignore quota errors
    }
  }, [protocols])

  const getProtocol = useCallback(
    (id: string): NutritionProtocol | undefined =>
      protocols.find((p) => p.id === id),
    [protocols],
  )

  const getForPatient = useCallback(
    (patientId: string): NutritionProtocol[] =>
      protocols.filter((p) => p.patientId === patientId),
    [protocols],
  )

  const addProtocol = useCallback(
    (protocol: Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const newProtocol: NutritionProtocol = {
        ...normalizeProtocolFoodReferences(protocol as NutritionProtocol, foods),
        id: `protocol_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }
      setProtocols((prev) =>
        [...prev, newProtocol].sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
        ),
      )
      return newProtocol
    },
    [foods],
  )

  const deleteProtocol = useCallback((id: string) => {
    setProtocols((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return {
    protocols,
    getProtocol,
    getForPatient,
    addProtocol,
    deleteProtocol,
  }
}
