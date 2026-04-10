"use client"

import { useState, useCallback, useEffect } from "react"
import { addDays, subDays, format, parseISO } from "date-fns"
import type { DailyMealPlan, MealSlotType, MealEntry, MealSlot } from "@/lib/types"
import { MEAL_PLANS } from "@/lib/mock-data"

const STORAGE_KEY = "prodi_meal_plans"

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

function loadFromStorage(): Record<string, DailyMealPlan> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as Record<string, DailyMealPlan>
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function buildInitialPlans(): Record<string, DailyMealPlan> {
  const stored = loadFromStorage()

  // Merge mock plans (stored takes precedence)
  const merged: Record<string, DailyMealPlan> = {}
  for (const plan of MEAL_PLANS) {
    merged[plan.date] = ensureAllSlots(plan)
  }
  for (const [date, plan] of Object.entries(stored)) {
    merged[date] = ensureAllSlots(plan)
  }

  return merged
}

export function useMealPlan() {
  const [currentDate, setCurrentDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  )
  const [plans, setPlans] = useState<Record<string, DailyMealPlan>>(buildInitialPlans)

  // Persist to localStorage on every plans change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
    } catch {
      // Ignore quota errors
    }
  }, [plans])

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
