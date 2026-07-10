"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  computeGapSuggestions,
  type NutrientGapConstraint,
  type NutrientGapSuggestion,
} from "@/lib/nutrient-gap"
import type { Food, FoodBrowserResult, PatientAllergenEntry } from "@/lib/types"

interface UseNutrientGapSearchOptions {
  nutrientId: string | null
  gapAmount: number | null
  constraints: NutrientGapConstraint[]
  patientAllergens: PatientAllergenEntry[]
  /** Only fetch while the dialog is open. */
  enabled: boolean
}

interface UseNutrientGapSearchResult {
  suggestions: NutrientGapSuggestion[]
  isLoading: boolean
  error: string | null
  totalCandidates: number
}

const PAGE_SIZE = 100
const MAX_PAGES = 3
const MIN_USABLE_RESULTS = 15
const DEBOUNCE_MS = 300

/**
 * Fetches nutrient-density-ranked candidates from the food browser API and
 * turns them into gap suggestions. Only the nutrient/constraint IDs trigger a
 * refetch; gap amount and constraint bounds recompute over cached candidates.
 */
export function useNutrientGapSearch({
  nutrientId,
  gapAmount,
  constraints,
  patientAllergens,
  enabled,
}: UseNutrientGapSearchOptions): UseNutrientGapSearchResult {
  const [candidates, setCandidates] = useState<Food[]>([])
  const [totalCandidates, setTotalCandidates] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Snapshot of the volatile params for the fetch loop's "enough usable
  // results?" check, so amount edits never retrigger the network effect.
  const paramsRef = useRef({ gapAmount, constraints, patientAllergens })
  useEffect(() => {
    paramsRef.current = { gapAmount, constraints, patientAllergens }
  }, [gapAmount, constraints, patientAllergens])

  const constraintNutrientIds = useMemo(() => {
    const ids = new Set<string>(["energie"])
    for (const constraint of constraints) ids.add(constraint.nutrientId)
    return Array.from(ids).sort()
  }, [constraints])

  const fetchKey = nutrientId ? `${nutrientId}|${constraintNutrientIds.join(",")}` : null

  useEffect(() => {
    if (!enabled || !fetchKey || !nutrientId) {
      setCandidates([])
      setTotalCandidates(0)
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const timer = window.setTimeout(async () => {
      try {
        const collected: Food[] = []
        let total = 0

        for (let page = 1; page <= MAX_PAGES; page++) {
          const searchParams = new URLSearchParams({
            mode: "browse",
            nutrientId,
            nutrientSort: "desc",
            page: String(page),
            pageSize: String(PAGE_SIZE),
            includePortions: "1",
            nutrientIds: constraintNutrientIds.join(","),
          })
          const response = await fetch(`/api/foods/browser?${searchParams.toString()}`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
            cache: "no-store",
          })
          if (!response.ok) throw new Error(`Food browser request failed (${response.status})`)
          const result = (await response.json()) as FoodBrowserResult

          collected.push(...result.foods)
          total = result.totalCount

          const usable = computeGapSuggestions(collected, {
            ...paramsRef.current,
            nutrientId,
          }).length
          if (usable >= MIN_USABLE_RESULTS || !result.hasMore) break
        }

        if (!controller.signal.aborted) {
          setCandidates(collected)
          setTotalCandidates(total)
          setIsLoading(false)
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.warn("Nutrient gap search failed:", fetchError)
          setCandidates([])
          setTotalCandidates(0)
          setError("Suche fehlgeschlagen. Bitte erneut versuchen.")
          setIsLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // constraintNutrientIds is covered by fetchKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchKey, nutrientId])

  const suggestions = useMemo(() => {
    if (!nutrientId || candidates.length === 0) return []
    return computeGapSuggestions(candidates, {
      nutrientId,
      gapAmount,
      constraints,
      patientAllergens,
    })
  }, [candidates, nutrientId, gapAmount, constraints, patientAllergens])

  return { suggestions, isLoading, error, totalCandidates }
}
