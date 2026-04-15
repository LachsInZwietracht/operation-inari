"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { addDays, subDays, format, parseISO } from "date-fns"
import type { DailyMealPlan, Food, MealSlotType, MealEntry, MealSlot } from "@/lib/types"
import { normalizeMealPlanFoodReferences } from "@/lib/data/food-reference-normalization"
import { fetchMealPlansClient, persistMealPlan } from "@/lib/data/meal-plans-client"
import { getLocalMealPlansRecord, saveLocalMealPlansRecord } from "@/lib/data/local-meal-plans"
import { useAuth } from "@/hooks/use-auth"

const ALL_SLOT_TYPES: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

function createEmptyPlan(date: string): DailyMealPlan {
  return {
    id: `plan_${date}`,
    date,
    slots: ALL_SLOT_TYPES.map((type) => ({ type, entries: [] })),
  }
}

function generateId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function ensureAllSlots(plan: DailyMealPlan): DailyMealPlan {
  const existingTypes = new Set(plan.slots.map((s) => s.type))
  const missingSlots: MealSlot[] = ALL_SLOT_TYPES.filter(
    (t) => !existingTypes.has(t)
  ).map((type) => ({ type, entries: [] }))

  if (missingSlots.length === 0) return plan

  return {
    ...plan,
    slots: [
      ...plan.slots,
      ...missingSlots,
    ].sort(
      (a, b) => ALL_SLOT_TYPES.indexOf(a.type) - ALL_SLOT_TYPES.indexOf(b.type)
    ),
  }
}

function buildInitialPlans(initialPlans: DailyMealPlan[], foods: Food[]): Record<string, DailyMealPlan> {
  const stored = getLocalMealPlansRecord(foods)

  const merged: Record<string, DailyMealPlan> = {}
  for (const plan of initialPlans) {
    merged[plan.date] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
  }
  for (const [date, plan] of Object.entries(stored)) {
    merged[date] = ensureAllSlots(plan)
  }

  return merged
}

export function useMealPlan(initialPlans: DailyMealPlan[] = [], foods: Food[] = []) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [currentDate, setCurrentDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  )
  const [plans, setPlans] = useState<Record<string, DailyMealPlan>>(() =>
    buildInitialPlans(initialPlans, foods)
  )
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)

  // Sync to local storage for offline/fallback
  useEffect(() => {
    saveLocalMealPlansRecord(plans, foods)
  }, [foods, plans])

  // Load from Supabase when authenticated
  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function loadPersistedPlans() {
      try {
        const persistedPlans = await fetchMealPlansClient()
        if (cancelled) return

        setPlans((prev) => {
          const next = { ...prev }
          for (const plan of persistedPlans) {
            next[plan.date] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
          }
          return next
        })

        // Migration of local-only plans
        if (!migrationDone.current) {
          migrationDone.current = true
          const localDates = Object.keys(plans)
          const remoteDates = new Set(persistedPlans.map(p => p.date))
          const datesToMigrate = localDates.filter(d => !remoteDates.has(d))
          
          for (const date of datesToMigrate) {
            const plan = plans[date]
            if (plan && plan.slots.some(s => s.entries.length > 0)) {
              void persistMealPlan(plan).catch(err => {
                console.error(`Failed to migrate meal plan for ${date}:`, err)
              })
            }
          }
        }
      } catch (error) {
        console.error("Failed to load meal plans from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void loadPersistedPlans()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading, foods])

  const getPlanForDate = useCallback(
    (date: string): DailyMealPlan => {
      const existing = plans[date]
      if (existing) return ensureAllSlots(existing)
      return createEmptyPlan(date)
    },
    [plans],
  )

  const getCurrentPlan = useCallback((): DailyMealPlan => {
    return getPlanForDate(currentDate)
  }, [getPlanForDate, currentDate])

  const getPlansInRange = useCallback(
    (startDate: string, days: number): DailyMealPlan[] => {
      const start = parseISO(startDate)
      return Array.from({ length: days }, (_, index) =>
        getPlanForDate(format(addDays(start, index), "yyyy-MM-dd")),
      )
    },
    [getPlanForDate],
  )

  const syncPlanToSupabase = useCallback((plan: DailyMealPlan) => {
    if (isAuthenticated) {
      void persistMealPlan(plan).catch(err => {
        console.error(`Failed to sync meal plan for ${plan.date}:`, err)
      })
    }
  }, [isAuthenticated])

  const addEntry = useCallback(
    (slotType: MealSlotType, entry: Omit<MealEntry, "id">) => {
      setPlans((prev) => {
        const plan = prev[currentDate]
          ? ensureAllSlots(prev[currentDate])
          : createEmptyPlan(currentDate)

        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: [...slot.entries, { ...entry, id: generateId() }],
          }
        })

        const updatedPlan = { ...plan, slots: newSlots }
        syncPlanToSupabase(updatedPlan)

        return {
          ...prev,
          [currentDate]: updatedPlan,
        }
      })
    },
    [currentDate, syncPlanToSupabase]
  )

  const removeEntry = useCallback(
    (slotType: MealSlotType, entryId: string) => {
      setPlans((prev) => {
        const plan = prev[currentDate]
        if (!plan) return prev

        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: slot.entries.filter((e) => e.id !== entryId),
          }
        })

        const updatedPlan = { ...plan, slots: newSlots }
        syncPlanToSupabase(updatedPlan)

        return {
          ...prev,
          [currentDate]: updatedPlan,
        }
      })
    },
    [currentDate, syncPlanToSupabase]
  )

  const updateEntryAmount = useCallback(
    (slotType: MealSlotType, entryId: string, amount: number) => {
      setPlans((prev) => {
        const plan = prev[currentDate]
        if (!plan) return prev

        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: slot.entries.map((e) =>
              e.id === entryId ? { ...e, amount } : e
            ),
          }
        })

        const updatedPlan = { ...plan, slots: newSlots }
        syncPlanToSupabase(updatedPlan)

        return {
          ...prev,
          [currentDate]: updatedPlan,
        }
      })
    },
    [currentDate, syncPlanToSupabase]
  )

  const setDate = useCallback((date: string) => {
    setCurrentDate(date)
  }, [])

  const goToNextDay = useCallback(() => {
    setCurrentDate((prev) => format(addDays(parseISO(prev), 1), "yyyy-MM-dd"))
  }, [])

  const goToPreviousDay = useCallback(() => {
    setCurrentDate((prev) => format(subDays(parseISO(prev), 1), "yyyy-MM-dd"))
  }, [])

  return {
    currentDate,
    currentPlan: getCurrentPlan(),
    getPlanForDate,
    getPlansInRange,
    addEntry,
    removeEntry,
    updateEntryAmount,
    setDate,
    goToNextDay,
    goToPreviousDay,
    isLoadingRemote
  }
}
