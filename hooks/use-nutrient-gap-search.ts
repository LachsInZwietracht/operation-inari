"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { fetchFoodsByIds } from "@/lib/data/foods-client"
import {
  computeGapSuggestions,
  computeRecipeGapSuggestions,
  sortGapSuggestions,
  type NutrientGapConstraint,
  type NutrientGapSortMode,
  type NutrientGapSuggestion,
} from "@/lib/nutrient-gap"
import type {
  Food,
  FoodBrowserResult,
  PatientAllergenEntry,
  Recipe,
} from "@/lib/types"

interface UseNutrientGapSearchOptions {
  nutrientId: string | null
  gapAmount: number | null
  constraints: NutrientGapConstraint[]
  patientAllergens: PatientAllergenEntry[]
  /** Recipe library candidates, scored locally per serving. */
  recipes: Recipe[]
  /** Hydrated foods used to resolve recipe ingredients. */
  foods: Food[]
  sortMode: NutrientGapSortMode
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
 * Fetches nutrient-density-ranked food candidates from the food browser API,
 * scores the loaded recipe library alongside them, and merges both into gap
 * suggestions. Only the nutrient/constraint IDs trigger a refetch; gap
 * amount, constraint bounds, and sorting recompute over cached candidates.
 */
export function useNutrientGapSearch({
  nutrientId,
  gapAmount,
  constraints,
  patientAllergens,
  recipes,
  foods,
  sortMode,
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

  // Recipe scoring needs the ingredient foods' nutrients, but the planner
  // only hydrates foods referenced by plan entries. Fetch the missing
  // ingredients once per dialog session (all nutrients, so nutrient/constraint
  // changes never refetch them).
  const [ingredientFoods, setIngredientFoods] = useState<Food[]>([])
  useEffect(() => {
    if (!enabled || recipes.length === 0) return
    const known = new Set(foods.map((food) => food.id))
    const missing = Array.from(
      new Set(recipes.flatMap((recipe) => recipe.ingredients.map((i) => i.foodId))),
    ).filter((id) => !known.has(id))
    if (missing.length === 0) return

    let cancelled = false
    const batches: Promise<Food[]>[] = []
    for (let i = 0; i < missing.length; i += 150) {
      batches.push(fetchFoodsByIds(missing.slice(i, i + 150)))
    }
    Promise.all(batches)
      .then((results) => {
        if (!cancelled) setIngredientFoods(results.flat())
      })
      .catch((fetchError) => {
        // Recipes silently score lower without their ingredients; food results
        // are unaffected, so this is a degradation rather than an error state.
        console.warn("Nutrient gap ingredient hydration failed:", fetchError)
      })
    return () => {
      cancelled = true
    }
    // One-shot per dialog session: foods growing via plan hydration must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, recipes])

  const recipeFoods = useMemo(() => {
    if (ingredientFoods.length === 0) return foods
    const merged = new Map(foods.map((food) => [food.id, food]))
    for (const food of ingredientFoods) {
      if (!merged.has(food.id)) merged.set(food.id, food)
    }
    return Array.from(merged.values())
  }, [foods, ingredientFoods])

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
    if (!nutrientId) return []
    const params = { nutrientId, gapAmount, constraints, patientAllergens }
    const foodSuggestions = candidates.length > 0 ? computeGapSuggestions(candidates, params) : []
    const recipeSuggestions = computeRecipeGapSuggestions(recipes, recipeFoods, params)
    return sortGapSuggestions([...foodSuggestions, ...recipeSuggestions], sortMode)
  }, [candidates, nutrientId, gapAmount, constraints, patientAllergens, recipes, recipeFoods, sortMode])

  return { suggestions, isLoading, error, totalCandidates }
}
