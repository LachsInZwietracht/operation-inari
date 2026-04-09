"use client"

import { useState, useMemo } from "react"
import type { Food } from "@/lib/types"

interface UseFoodSearchReturn {
  filteredFoods: Food[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedCategoryId: string | null
  setSelectedCategoryId: (categoryId: string | null) => void
}

export function useFoodSearch(foods: Food[]): UseFoodSearchReturn {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const filteredFoods = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return foods.filter((food) => {
      if (query && !food.name.toLowerCase().includes(query)) {
        return false
      }
      if (selectedCategoryId && food.categoryId !== selectedCategoryId) {
        return false
      }
      return true
    })
  }, [foods, searchQuery, selectedCategoryId])

  return {
    filteredFoods,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
  }
}
