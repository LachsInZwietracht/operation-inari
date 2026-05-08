"use client"

import { useCallback, useEffect, useState } from "react"
import type { MealPlanTemplate, MealSlot } from "@/lib/types"
import {
  fetchMealPlanTemplatesClient,
  saveMealPlanTemplate,
  deleteMealPlanTemplate,
} from "@/lib/data/meal-plan-templates-client"
import { useAuth } from "@/hooks/use-auth"

interface UseMealPlanTemplatesOptions {
  initialTemplates?: MealPlanTemplate[]
}

interface SaveTemplateInput {
  id?: string
  name: string
  description?: string
  indication?: string
  dietLineId?: string
  targetProfileId?: string
  slots: MealSlot[]
  notes?: string
}

export function useMealPlanTemplates(options: UseMealPlanTemplatesOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [templates, setTemplates] = useState<MealPlanTemplate[]>(options.initialTemplates ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await fetchMealPlanTemplatesClient()
      setTemplates(next)
    } catch (err) {
      console.error("Failed to load meal plan templates:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return
    void refresh()
  }, [authLoading, isAuthenticated, refresh])

  const saveTemplate = useCallback(
    async (input: SaveTemplateInput): Promise<MealPlanTemplate> => {
      const saved = await saveMealPlanTemplate(input)
      setTemplates((prev) => {
        const existing = prev.findIndex((template) => template.id === saved.id)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = saved
          return next
        }
        return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, "de"))
      })
      return saved
    },
    [],
  )

  const removeTemplate = useCallback(async (id: string) => {
    await deleteMealPlanTemplate(id)
    setTemplates((prev) => prev.filter((template) => template.id !== id))
  }, [])

  return {
    templates,
    isLoading,
    error,
    refresh,
    saveTemplate,
    removeTemplate,
  }
}
