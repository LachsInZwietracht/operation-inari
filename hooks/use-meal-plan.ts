"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { addDays, subDays, format, parseISO } from "date-fns"
import type { DailyMealPlan, Food, MealSlotType, MealEntry, MealSlot } from "@/lib/types"
import { normalizeMealPlanFoodReferences } from "@/lib/data/food-reference-normalization"
import { fetchMealPlansClient, persistMealPlan } from "@/lib/data/meal-plans-client"
import { getLocalMealPlansRecord, saveLocalMealPlansRecord } from "@/lib/data/local-meal-plans"
import { isLocalMigrationCandidate } from "@/lib/data/local-records"
import { useAuth } from "@/hooks/use-auth"

const ALL_SLOT_TYPES: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

type MealPlanMetadataPatch = Partial<
  Pick<
    DailyMealPlan,
    | "patientId"
    | "title"
    | "status"
    | "notes"
    | "targetProfileId"
    | "dietLineId"
    | "approvedAt"
    | "approvedBy"
  >
>

function createEmptyPlan(date: string, defaults: MealPlanMetadataPatch = {}): DailyMealPlan {
  return {
    id: `plan_${date}`,
    date,
    status: "draft",
    ...defaults,
    slots: ALL_SLOT_TYPES.map((type) => ({ type, entries: [] })),
  }
}

function generateId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function cloneEntry(entry: MealEntry): MealEntry {
  return {
    ...entry,
    id: generateId(),
  }
}

function clonePlanForDate(plan: DailyMealPlan, date: string): DailyMealPlan {
  return {
    ...plan,
    id: `plan_${date}`,
    date,
    status: plan.status === "approved" ? "draft" : plan.status,
    approvedAt: undefined,
    approvedBy: undefined,
    slots: ensureAllSlots(plan).slots.map((slot) => ({
      ...slot,
      entries: slot.entries.map(cloneEntry),
    })),
  }
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

export function useMealPlan(
  initialPlans: DailyMealPlan[] = [],
  foods: Food[] = [],
  defaultMetadata: MealPlanMetadataPatch = {},
  initialDate?: string,
) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [currentDate, setCurrentDate] = useState(() =>
    initialDate ?? format(new Date(), "yyyy-MM-dd")
  )
  const [plans, setPlans] = useState<Record<string, DailyMealPlan>>(() =>
    buildInitialPlans(initialPlans, foods)
  )
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const plansRef = useRef(plans)

  useEffect(() => {
    plansRef.current = plans
  }, [plans])

  useEffect(() => {
    const localPlans = Object.fromEntries(
      Object.entries(plans).filter(([, plan]) => isLocalMigrationCandidate(plan))
    )
    saveLocalMealPlansRecord(localPlans, foods)
  }, [foods, plans])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function loadPersistedPlans() {
      try {
        const persistedPlans = await fetchMealPlansClient()
        if (cancelled) return

        const nextPlans: Record<string, DailyMealPlan> = {}
        for (const plan of initialPlans) {
          nextPlans[plan.date] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
        }
        for (const plan of persistedPlans) {
          nextPlans[plan.date] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
        }

        const localCandidates = Object.values(plansRef.current).filter(isLocalMigrationCandidate)
        for (const plan of localCandidates) {
          if (!nextPlans[plan.date]) {
            nextPlans[plan.date] = ensureAllSlots(plan)
          }
        }

        setPlans(nextPlans)

        if (!migrationDone.current) {
          migrationDone.current = true
          for (const plan of localCandidates) {
            if (!plan.slots.some((slot) => slot.entries.length > 0)) continue

            try {
              const persistedPlan = await persistMealPlan(plan)
              if (cancelled) return

              setPlans((prev) => ({
                ...prev,
                [persistedPlan.date]: ensureAllSlots(normalizeMealPlanFoodReferences(persistedPlan, foods)),
              }))
            } catch (err) {
              console.error(`Failed to migrate meal plan for ${plan.date}:`, err)
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
  }, [isAuthenticated, authLoading, foods, initialPlans])

  const getPlanForDate = useCallback(
    (date: string): DailyMealPlan => {
      const existing = plans[date]
      if (existing) return ensureAllSlots(existing)
      return createEmptyPlan(date, defaultMetadata)
    },
    [defaultMetadata, plans],
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

  const syncPlanToSupabase = useCallback(
    async (plan: DailyMealPlan) => {
      if (!isAuthenticated) return

      try {
        const persistedPlan = await persistMealPlan(plan)
        setPlans((prev) => ({
          ...prev,
          [persistedPlan.date]: ensureAllSlots(normalizeMealPlanFoodReferences(persistedPlan, foods)),
        }))
      } catch (err) {
        console.error(`Failed to sync meal plan for ${plan.date}:`, err)
      }
    },
    [foods, isAuthenticated]
  )

  const updateCurrentPlan = useCallback(
    (updater: (plan: DailyMealPlan) => DailyMealPlan) => {
      let updatedPlan: DailyMealPlan | null = null

      setPlans((prev) => {
        const currentPlan = prev[currentDate]
          ? ensureAllSlots(prev[currentDate])
          : createEmptyPlan(currentDate, defaultMetadata)
        updatedPlan = updater(currentPlan)

        return {
          ...prev,
          [currentDate]: updatedPlan,
        }
      })

      if (updatedPlan) {
        void syncPlanToSupabase(updatedPlan)
      }
    },
    [currentDate, defaultMetadata, syncPlanToSupabase]
  )

  const updatePlanForDate = useCallback(
    (date: string, updater: (plan: DailyMealPlan) => DailyMealPlan) => {
      let updatedPlan: DailyMealPlan | null = null

      setPlans((prev) => {
        const basePlan = prev[date]
          ? ensureAllSlots(prev[date])
          : createEmptyPlan(date, defaultMetadata)
        updatedPlan = updater(basePlan)

        return {
          ...prev,
          [date]: updatedPlan,
        }
      })

      if (updatedPlan) {
        void syncPlanToSupabase(updatedPlan)
      }
    },
    [defaultMetadata, syncPlanToSupabase],
  )

  const addEntry = useCallback(
    (slotType: MealSlotType, entry: Omit<MealEntry, "id">) => {
      updateCurrentPlan((plan) => {
        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: [...slot.entries, { ...entry, id: generateId() }],
          }
        })

        return { ...plan, slots: newSlots }
      })
    },
    [updateCurrentPlan]
  )

  const removeEntry = useCallback(
    (slotType: MealSlotType, entryId: string) => {
      updateCurrentPlan((plan) => {
        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: slot.entries.filter((e) => e.id !== entryId),
          }
        })

        return { ...plan, slots: newSlots }
      })
    },
    [updateCurrentPlan]
  )

  const updateEntryAmount = useCallback(
    (slotType: MealSlotType, entryId: string, amount: number) => {
      updateCurrentPlan((plan) => {
        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: slot.entries.map((e) =>
              e.id === entryId ? { ...e, amount } : e
            ),
          }
        })

        return { ...plan, slots: newSlots }
      })
    },
    [updateCurrentPlan]
  )

  const replaceEntry = useCallback(
    (slotType: MealSlotType, entryId: string, entry: Omit<MealEntry, "id">) => {
      updateCurrentPlan((plan) => {
        const newSlots = plan.slots.map((slot) => {
          if (slot.type !== slotType) return slot
          return {
            ...slot,
            entries: slot.entries.map((existing) =>
              existing.id === entryId ? { ...entry, id: generateId() } : existing
            ),
          }
        })

        return { ...plan, slots: newSlots }
      })
    },
    [updateCurrentPlan],
  )

  const copyPlanToDate = useCallback(
    (sourceDate: string, targetDate: string) => {
      const sourcePlan = getPlanForDate(sourceDate)
      const copiedPlan = clonePlanForDate(sourcePlan, targetDate)

      setPlans((prev) => ({
        ...prev,
        [targetDate]: copiedPlan,
      }))

      void syncPlanToSupabase(copiedPlan)
    },
    [getPlanForDate, syncPlanToSupabase],
  )

  const clearPlanForDate = useCallback(
    (date: string) => {
      updatePlanForDate(date, (plan) => ({
        ...plan,
        slots: ensureAllSlots(plan).slots.map((slot) => ({ ...slot, entries: [] })),
      }))
    },
    [updatePlanForDate],
  )

  const updatePlanMetadata = useCallback(
    (date: string, metadata: MealPlanMetadataPatch) => {
      updatePlanForDate(date, (plan) => ({
        ...plan,
        ...metadata,
      }))
    },
    [updatePlanForDate],
  )

  const applyTemplateToDate = useCallback(
    (
      date: string,
      slots: MealSlot[],
      metadata: MealPlanMetadataPatch = {},
    ) => {
      updatePlanForDate(date, (plan) => {
        const cloned: MealSlot[] = ALL_SLOT_TYPES.map((type) => {
          const incoming = slots.find((slot) => slot.type === type)
          return {
            type,
            entries: (incoming?.entries ?? []).map((entry) => cloneEntry(entry)),
          }
        })
        return {
          ...plan,
          ...metadata,
          status: metadata.status ?? "draft",
          approvedAt: undefined,
          approvedBy: undefined,
          slots: cloned,
        }
      })
    },
    [updatePlanForDate],
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
    replaceEntry,
    copyPlanToDate,
    clearPlanForDate,
    updatePlanMetadata,
    applyTemplateToDate,
    setDate,
    goToNextDay,
    goToPreviousDay,
    isLoadingRemote
  }
}
