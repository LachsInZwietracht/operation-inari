"use client"

import { useState, useMemo, useCallback } from "react"
import type { Food } from "@/lib/types"
import { fuzzySearchFoods, normalizeText } from "@/lib/search"
import { getFoodGroupDescendants } from "@/lib/mock-data/food-groups"

export type SearchMode = "name" | "code" | "group" | "browse"

interface UseFoodSearchReturn {
  filteredFoods: Array<Food & { searchScore: number; matchType: string }>
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedCategoryId: string | null
  setSelectedCategoryId: (categoryId: string | null) => void
  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void
  selectedFoodGroupId: string | null
  setSelectedFoodGroupId: (groupId: string | null) => void
  resultCount: number
}

export function useFoodSearch(foods: Food[]): UseFoodSearchReturn {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<SearchMode>("name")
  const [selectedFoodGroupId, setSelectedFoodGroupId] = useState<string | null>(null)

  const handleSetSearchMode = useCallback((mode: SearchMode) => {
    setSearchMode(mode)
    setSearchQuery("")
    setSelectedFoodGroupId(null)
  }, [])

  const filteredFoods = useMemo(() => {
    let results: Array<Food & { searchScore: number; matchType: string }>

    const query = searchQuery.trim()

    switch (searchMode) {
      case "name": {
        // Fuzzy/phonetic name search
        if (!query) {
          results = foods.map((f) => ({ ...f, searchScore: 1, matchType: "none" }))
        } else {
          results = fuzzySearchFoods(query, foods)
        }
        break
      }

      case "code": {
        // Search by BLS code or other database codes
        if (!query) {
          results = foods.map((f) => ({ ...f, searchScore: 1, matchType: "none" }))
        } else {
          const normQuery = normalizeText(query)
          results = foods
            .filter((f) => {
              const code = f.blsCode?.toLowerCase() ?? ""
              const id = f.id.toLowerCase()
              return code.includes(normQuery) || id.includes(normQuery)
            })
            .map((f) => {
              const code = f.blsCode?.toLowerCase() ?? ""
              const isExact = code === normQuery
              const isPrefix = code.startsWith(normQuery)
              return {
                ...f,
                searchScore: isExact ? 1.0 : isPrefix ? 0.9 : 0.7,
                matchType: isExact ? "exact" : isPrefix ? "prefix" : "contains",
              }
            })
            .sort((a, b) => b.searchScore - a.searchScore)
        }
        break
      }

      case "group": {
        // Filter by food group hierarchy
        if (!selectedFoodGroupId) {
          results = foods.map((f) => ({ ...f, searchScore: 1, matchType: "none" }))
        } else {
          const groupIds = new Set(getFoodGroupDescendants(selectedFoodGroupId))
          results = foods
            .filter((f) => f.foodGroupId && groupIds.has(f.foodGroupId))
            .map((f) => ({ ...f, searchScore: 1, matchType: "group" }))
        }
        // Additionally filter by text query within the group
        if (query) {
          results = fuzzySearchFoods(query, results)
        }
        break
      }

      case "browse": {
        // Full database browse — show all, optionally filtered by text
        if (!query) {
          results = foods.map((f) => ({ ...f, searchScore: 1, matchType: "none" }))
        } else {
          results = fuzzySearchFoods(query, foods)
        }
        break
      }

      default:
        results = foods.map((f) => ({ ...f, searchScore: 1, matchType: "none" }))
    }

    // Apply category filter across all modes
    if (selectedCategoryId) {
      results = results.filter((f) => f.categoryId === selectedCategoryId)
    }

    return results
  }, [foods, searchQuery, selectedCategoryId, searchMode, selectedFoodGroupId])

  return {
    filteredFoods,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    searchMode,
    setSearchMode: handleSetSearchMode,
    selectedFoodGroupId,
    setSelectedFoodGroupId,
    resultCount: filteredFoods.length,
  }
}
