"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { addDays, subDays, format, parseISO } from "date-fns"
import type { DailyMealPlan, Food, MealSlotType, MealEntry, MealSlot } from "@/lib/types"
import { normalizeMealPlanFoodReferences } from "@/lib/data/food-reference-normalization"
import { fetchMealPlansClient, persistMealPlan } from "@/lib/data/meal-plans-client"
import { getLocalMealPlansRecord, saveLocalMealPlansRecord } from "@/lib/data/local-meal-plans"

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
  const lastPersistedState = useRef<string>("")
  const hasLoadedPersistedPlans = useRef(false)
  const [currentDate, setCurrentDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  )
  const [plans, setPlans] = useState<Record<string, DailyMealPlan>>(() =>
    buildInitialPlans(initialPlans, foods)
  )

  useEffect(() => {
    saveLocalMealPlansRecord(plans, foods)
  }, [foods, plans])

  useEffect(() => {
    let cancelled = false

    async function loadPersistedPlans() {
      try {
        const persistedPlans = await fetchMealPlansClient()
        if (cancelled) return

        setPlans((prev) => {
          const next = { ...prev }
          for (const plan of persistedPlans) {
            next[plan.date] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
          }
          lastPersistedState.current = JSON.stringify(next)
          return next
        })
      } catch (error) {
        console.error("Failed to load meal plans from Supabase:", error)
        lastPersistedState.current = JSON.stringify(plans)
      } finally {
        if (!cancelled) {
          hasLoadedPersistedPlans.current = true
        }
      }
    }

    void loadPersistedPlans()

    return () => {
      cancelled = true
    }
  }, [foods])

  useEffect(() => {
    if (!hasLoadedPersistedPlans.current) return

    const serializedPlans = JSON.stringify(plans)
    if (serializedPlans === lastPersistedState.current) return
    lastPersistedState.current = serializedPlans

    let cancelled = false

    async function persistPlans() {
      const localFallback: Record<string, DailyMealPlan> = {}

      for (const plan of Object.values(plans)) {
        try {
          await persistMealPlan(plan)
          if (cancelled) return
        } catch (error) {
          const message = error instanceof Error ? error.message : ""
          if (message && message !== "AUTH_REQUIRED") {
            console.error(`Failed to persist meal plan ${plan.date}:`, error)
          }
          localFallback[plan.date] = plan
        }
      }

      if (!cancelled) {
        saveLocalMealPlansRecord(localFallback, foods)
      }
    }

    void persistPlans()

    return () => {
      cancelled = true
    }
  }, [foods, plans])

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

        return {
          ...prev,
          [currentDate]: { ...plan, slots: newSlots },
        }
      })
    },
    [currentDate]
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

        return {
          ...prev,
          [currentDate]: { ...plan, slots: newSlots },
        }
      })
    },
    [currentDate]
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

        return {
          ...prev,
          [currentDate]: { ...plan, slots: newSlots },
        }
      })
    },
    [currentDate]
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
  }
}
