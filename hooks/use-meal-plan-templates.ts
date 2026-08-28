"use client"

import { useCallback, useEffect, useState } from "react"
import type { MealPlanTemplate, MealPlanTemplateDayBlock, MealSlot } from "@/lib/types"
import {
  fetchMealPlanTemplatesClient,
  saveMealPlanTemplate,
  deleteMealPlanTemplate,
} from "@/lib/data/meal-plan-templates-client"
import { useAuth } from "@/hooks/use-auth"

interface UseMealPlanTemplatesOptions {
  initialTemplates?: MealPlanTemplate[]
  patientId?: string
}

interface SaveTemplateInput {
  id?: string
  name: string
  description?: string
  indication?: string
  dietLineId?: string
  targetProfileId?: string
  slots: MealSlot[]
  dayBlocks?: MealPlanTemplateDayBlock[]
  notes?: string
  patientId?: string
}

export function useMealPlanTemplates(options: UseMealPlanTemplatesOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const isLocalTemplateTesting =
    process.env.NODE_ENV !== "production" &&
    (process.env.NEXT_PUBLIC_USE_LOCAL_MEAL_PLAN_TEMPLATE_FIXTURES === "true" ||
      process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true")
  const [templates, setTemplates] = useState<MealPlanTemplate[]>(options.initialTemplates ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await fetchMealPlanTemplatesClient({ patientId: options.patientId })
      setTemplates(next)
    } catch (err) {
      console.error("Failed to load meal plan templates:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [options.patientId])

  useEffect(() => {
    if (isLocalTemplateTesting) return
    if (authLoading) return
    if (!isAuthenticated) return
    void refresh()
  }, [authLoading, isAuthenticated, isLocalTemplateTesting, refresh])

  const saveTemplate = useCallback(
    async (input: SaveTemplateInput): Promise<MealPlanTemplate> => {
      const saved = isLocalTemplateTesting
        ? {
            ...input,
            id: input.id ?? `mock_saved_${globalThis.crypto.randomUUID()}`,
            description: input.description ?? "",
            sourceType: "personal" as const,
            patientId: input.patientId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : await saveMealPlanTemplate(input)
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
    [isLocalTemplateTesting],
  )

  const removeTemplate = useCallback(async (id: string) => {
    if (!isLocalTemplateTesting) await deleteMealPlanTemplate(id)
    setTemplates((prev) => prev.filter((template) => template.id !== id))
  }, [isLocalTemplateTesting])

  return {
    templates,
    isLoading,
    error,
    refresh,
    saveTemplate,
    removeTemplate,
  }
}
