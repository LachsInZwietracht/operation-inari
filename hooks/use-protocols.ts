"use client"

import { useState, useCallback, useEffect } from "react"

import type { Food, NutritionProtocol } from "@/lib/types"
import { normalizeProtocolFoodReferences } from "@/lib/data/food-reference-normalization"
import { isLocalMigrationCandidate, matchesRecordIdentity } from "@/lib/data/local-records"
import { deleteProtocolClient, fetchProtocolsClient, persistProtocol } from "@/lib/data/protocols-client"
import { getLocalProtocols, saveLocalProtocols } from "@/lib/data/local-protocols"

function sortProtocols(protocols: NutritionProtocol[]) {
  return [...protocols].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  )
}

function buildInitial(foods: Food[], initialProtocols: NutritionProtocol[] = []): NutritionProtocol[] {
  const localProtocols = getLocalProtocols(foods)
  const merged = [...initialProtocols]

  for (const local of localProtocols) {
    const existsRemote = initialProtocols.some((persisted) =>
      matchesRecordIdentity(persisted, local),
    )
    if (!existsRemote) {
      merged.push(local)
    }
  }

  return sortProtocols(merged)
}

interface UseProtocolsOptions {
  initialProtocols?: NutritionProtocol[]
}

export function useProtocols(foods: Food[] = [], options: UseProtocolsOptions = {}) {
  const [protocols, setProtocols] = useState<NutritionProtocol[]>(() =>
    buildInitial(foods, options.initialProtocols),
  )

  useEffect(() => {
    if (options.initialProtocols) return

    let cancelled = false

    async function loadPersistedProtocols() {
      try {
        const persistedProtocols = await fetchProtocolsClient()
        if (cancelled) return

        setProtocols((prev) => {
          const merged = [...prev]

          for (const persisted of persistedProtocols.map((protocol) =>
            normalizeProtocolFoodReferences(protocol, foods),
          )) {
            const existingIndex = merged.findIndex(
              (entry) => matchesRecordIdentity(entry, persisted),
            )

            if (existingIndex >= 0) {
              merged[existingIndex] = persisted
            } else {
              merged.push(persisted)
            }
          }

          return merged.sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
          )
        })
      } catch (error) {
        console.error("Failed to load protocols from Supabase:", error)
      }
    }

    void loadPersistedProtocols()

    return () => {
      cancelled = true
    }
  }, [foods, options.initialProtocols])

  useEffect(() => {
    const localOnly = protocols.filter(isLocalMigrationCandidate)

    saveLocalProtocols(localOnly, foods)
  }, [foods, protocols])

  const getProtocol = useCallback(
    (id: string): NutritionProtocol | undefined =>
      protocols.find((protocol) => protocol.id === id || protocol.legacyId === id),
    [protocols],
  )

  const getForPatient = useCallback(
    (patientId: string): NutritionProtocol[] =>
      protocols.filter((protocol) => protocol.patientId === patientId),
    [protocols],
  )

  const addProtocol = useCallback(
    async (protocol: Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const draftProtocol: NutritionProtocol = {
        ...normalizeProtocolFoodReferences(protocol as NutritionProtocol, foods),
        id: `protocol_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }

      try {
        const persistedProtocol = await persistProtocol(draftProtocol)
        const normalized = normalizeProtocolFoodReferences(persistedProtocol, foods)

        setProtocols((prev) =>
          [...prev.filter((entry) => entry.id !== draftProtocol.id), normalized].sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
          ),
        )

        return normalized
      } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (message && message !== "AUTH_REQUIRED") {
          console.error("Failed to persist protocol to Supabase:", error)
        }

        setProtocols((prev) =>
          [...prev, draftProtocol].sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
          ),
        )

        return draftProtocol
      }
    },
    [foods],
  )

  const deleteProtocol = useCallback(async (id: string) => {
    try {
      await deleteProtocolClient(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (message && message !== "AUTH_REQUIRED") {
        console.error("Failed to delete protocol from Supabase:", error)
      }
    }

    setProtocols((prev) =>
      prev.filter((protocol) => protocol.id !== id && protocol.legacyId !== id),
    )
  }, [])

  return {
    protocols,
    getProtocol,
    getForPatient,
    addProtocol,
    deleteProtocol,
  }
}
