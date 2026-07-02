"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { addDays, subDays, format, parseISO } from "date-fns"
import type { DailyMealPlan, Food, MealSlotType, MealEntry, MealSlot, MealPlanVersion } from "@/lib/types"
import { normalizeMealPlanFoodReferences } from "@/lib/data/food-reference-normalization"
import { fetchMealPlansClient, persistMealPlan } from "@/lib/data/meal-plans-client"
import { snapshotMealPlanVersion } from "@/lib/data/meal-plan-versions-client"
import { getLocalMealPlansRecord, saveLocalMealPlansRecord } from "@/lib/data/local-meal-plans"
import { isLocalMigrationCandidate, isUuid } from "@/lib/data/local-records"
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

type MealPlanSnapshotReason = MealPlanVersion["reason"]

function createEmptyPlan(date: string, defaults: MealPlanMetadataPatch = {}): DailyMealPlan {
  return {
    id: `plan_${defaults.patientId ?? "unassigned"}_${date}`,
    date,
    status: "draft",
    ...defaults,
    slots: ALL_SLOT_TYPES.map((type) => ({ type, entries: [] })),
  }
}

function getPlanKey(date: string, patientId?: string | null): string {
  return `${patientId ?? "unassigned"}:${date}`
}

function getPlanContext(defaults: MealPlanMetadataPatch): string | undefined {
  return defaults.patientId ?? undefined
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
    merged[getPlanKey(plan.date, plan.patientId)] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
  }
  for (const [date, plan] of Object.entries(stored)) {
    merged[getPlanKey(plan.date ?? date, plan.patientId)] = ensureAllSlots(plan)
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
  const contextPatientId = getPlanContext(defaultMetadata)
  const [plans, setPlans] = useState<Record<string, DailyMealPlan>>(() =>
    buildInitialPlans(initialPlans, foods)
  )
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const plansRef = useRef(plans)
  const dirtyDatesRef = useRef(new Set<string>())

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
          nextPlans[getPlanKey(plan.date, plan.patientId)] = ensureAllSlots(normalizeMealPlanFoodReferences(plan, foods))
        }
        for (const plan of persistedPlans) {
          const key = getPlanKey(plan.date, plan.patientId)
          const dirtyPlan = dirtyDatesRef.current.has(key)
            ? plansRef.current[key]
            : undefined
          nextPlans[key] = ensureAllSlots(
            normalizeMealPlanFoodReferences(dirtyPlan ?? plan, foods),
          )
        }

        const localCandidates = Object.values(plansRef.current).filter(isLocalMigrationCandidate)
        for (const plan of localCandidates) {
          const key = getPlanKey(plan.date, plan.patientId)
          if (!nextPlans[key]) {
            nextPlans[key] = ensureAllSlots(plan)
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
                [getPlanKey(persistedPlan.date, persistedPlan.patientId)]: ensureAllSlots(normalizeMealPlanFoodReferences(persistedPlan, foods)),
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
      const existing = plans[getPlanKey(date, contextPatientId)]
      if (existing) return ensureAllSlots(existing)
      return createEmptyPlan(date, defaultMetadata)
    },
    [contextPatientId, defaultMetadata, plans],
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
    async (plan: DailyMealPlan, options: { snapshotReason?: MealPlanSnapshotReason } = {}) => {
      if (!isAuthenticated) return null

      try {
        const persistedPlan = await persistMealPlan(plan)
        setPlans((prev) => ({
          ...prev,
          [getPlanKey(persistedPlan.date, persistedPlan.patientId)]: ensureAllSlots(normalizeMealPlanFoodReferences(persistedPlan, foods)),
        }))

        if (options.snapshotReason && isUuid(persistedPlan.id)) {
          try {
            await snapshotMealPlanVersion(persistedPlan, { reason: options.snapshotReason })
          } catch (snapErr) {
            console.error(`Failed to snapshot meal plan ${persistedPlan.id}:`, snapErr)
          }
        }

        return persistedPlan
      } catch (err) {
        console.error(`Failed to sync meal plan for ${plan.date}:`, err)
        return null
      }
    },
    [foods, isAuthenticated]
  )

  const updateCurrentPlan = useCallback(
    (updater: (plan: DailyMealPlan) => DailyMealPlan) => {
      let updatedPlan: DailyMealPlan | null = null
      let snapshotReason: MealPlanSnapshotReason | undefined

      setPlans((prev) => {
        const key = getPlanKey(currentDate, contextPatientId)
        dirtyDatesRef.current.add(key)
        const currentPlan = prev[key]
          ? ensureAllSlots(prev[key])
          : createEmptyPlan(currentDate, defaultMetadata)
        updatedPlan = updater(currentPlan)
        snapshotReason =
          currentPlan.status !== "approved" && updatedPlan.status === "approved"
            ? "approved"
            : undefined

        return {
          ...prev,
          [getPlanKey(updatedPlan.date, updatedPlan.patientId)]: updatedPlan,
        }
      })

      if (updatedPlan) {
        void syncPlanToSupabase(updatedPlan, { snapshotReason })
      }
    },
    [contextPatientId, currentDate, defaultMetadata, syncPlanToSupabase]
  )

  const updatePlanForDate = useCallback(
    (date: string, updater: (plan: DailyMealPlan) => DailyMealPlan) => {
      let updatedPlan: DailyMealPlan | null = null
      let snapshotReason: MealPlanSnapshotReason | undefined

      setPlans((prev) => {
        const key = getPlanKey(date, contextPatientId)
        dirtyDatesRef.current.add(key)
        const basePlan = prev[key]
          ? ensureAllSlots(prev[key])
          : createEmptyPlan(date, defaultMetadata)
        updatedPlan = updater(basePlan)
        snapshotReason =
          basePlan.status !== "approved" && updatedPlan.status === "approved"
            ? "approved"
            : undefined

        return {
          ...prev,
          [getPlanKey(updatedPlan.date, updatedPlan.patientId)]: updatedPlan,
        }
      })

      if (updatedPlan) {
        void syncPlanToSupabase(updatedPlan, { snapshotReason })
      }
    },
    [contextPatientId, defaultMetadata, syncPlanToSupabase],
  )

  const isPlanLocked = useCallback(
    (date: string) => plans[getPlanKey(date, contextPatientId)]?.status === "approved",
    [contextPatientId, plans],
  )

  const addEntry = useCallback(
    (slotType: MealSlotType, entry: Omit<MealEntry, "id">) => {
      if (isPlanLocked(currentDate)) return
      updateCurrentPlan((plan) => {
        if (plan.status === "approved") return plan
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
    [currentDate, isPlanLocked, updateCurrentPlan]
  )

  const addEntryForDate = useCallback(
    (date: string, slotType: MealSlotType, entry: Omit<MealEntry, "id">) => {
      if (isPlanLocked(date)) return
      updatePlanForDate(date, (plan) => {
        if (plan.status === "approved") return plan
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
    [isPlanLocked, updatePlanForDate]
  )

  const removeEntryForDate = useCallback(
    (date: string, slotType: MealSlotType, entryId: string) => {
      if (isPlanLocked(date)) return
      updatePlanForDate(date, (plan) => {
        if (plan.status === "approved") return plan
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
    [isPlanLocked, updatePlanForDate]
  )

  const removeEntry = useCallback(
    (slotType: MealSlotType, entryId: string) => {
      if (isPlanLocked(currentDate)) return
      updateCurrentPlan((plan) => {
        if (plan.status === "approved") return plan
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
    [currentDate, isPlanLocked, updateCurrentPlan]
  )

  const updateEntryAmount = useCallback(
    (slotType: MealSlotType, entryId: string, amount: number) => {
      if (isPlanLocked(currentDate)) return
      updateCurrentPlan((plan) => {
        if (plan.status === "approved") return plan
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
    [currentDate, isPlanLocked, updateCurrentPlan]
  )

  const replaceEntry = useCallback(
    (slotType: MealSlotType, entryId: string, entry: Omit<MealEntry, "id">) => {
      if (isPlanLocked(currentDate)) return
      updateCurrentPlan((plan) => {
        if (plan.status === "approved") return plan
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
    [currentDate, isPlanLocked, updateCurrentPlan],
  )

  const moveEntry = useCallback(
    (
      sourceSlot: MealSlotType,
      sourceEntryId: string,
      targetSlot: MealSlotType,
      targetIndex?: number,
    ) => {
      if (isPlanLocked(currentDate)) return
      updateCurrentPlan((plan) => {
        if (plan.status === "approved") return plan

        const source = plan.slots.find((slot) => slot.type === sourceSlot)
        const movedEntry = source?.entries.find((entry) => entry.id === sourceEntryId)
        if (!source || !movedEntry) return plan

        if (sourceSlot === targetSlot) {
          const sourceIndex = source.entries.findIndex((entry) => entry.id === sourceEntryId)
          if (sourceIndex < 0) return plan

          const insertRequest = targetIndex ?? source.entries.length
          let insertAt = insertRequest
          if (insertAt > sourceIndex) insertAt -= 1
          if (insertAt === sourceIndex) return plan

          const nextEntries = [...source.entries]
          nextEntries.splice(sourceIndex, 1)
          nextEntries.splice(insertAt, 0, movedEntry)

          return {
            ...plan,
            slots: plan.slots.map((slot) =>
              slot.type === sourceSlot ? { ...slot, entries: nextEntries } : slot,
            ),
          }
        }

        return {
          ...plan,
          slots: plan.slots.map((slot) => {
            if (slot.type === sourceSlot) {
              return {
                ...slot,
                entries: slot.entries.filter((entry) => entry.id !== sourceEntryId),
              }
            }
            if (slot.type === targetSlot) {
              const insertAt = Math.min(targetIndex ?? slot.entries.length, slot.entries.length)
              const nextEntries = [...slot.entries]
              nextEntries.splice(insertAt, 0, movedEntry)
              return { ...slot, entries: nextEntries }
            }
            return slot
          }),
        }
      })
    },
    [currentDate, isPlanLocked, updateCurrentPlan],
  )

  const copyPlanToDate = useCallback(
    (sourceDate: string, targetDate: string) => {
      if (isPlanLocked(targetDate)) return
      const sourcePlan = getPlanForDate(sourceDate)
      const copiedPlan = clonePlanForDate(sourcePlan, targetDate)
      const copiedKey = getPlanKey(copiedPlan.date, copiedPlan.patientId)
      dirtyDatesRef.current.add(copiedKey)

      setPlans((prev) => ({
        ...prev,
        [copiedKey]: copiedPlan,
      }))

      void syncPlanToSupabase(copiedPlan)
    },
    [getPlanForDate, isPlanLocked, syncPlanToSupabase],
  )

  const clearPlanForDate = useCallback(
    (date: string) => {
      if (isPlanLocked(date)) return
      updatePlanForDate(date, (plan) => {
        if (plan.status === "approved") return plan
        return {
          ...plan,
          slots: ensureAllSlots(plan).slots.map((slot) => ({ ...slot, entries: [] })),
        }
      })
    },
    [isPlanLocked, updatePlanForDate],
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
      if (isPlanLocked(date)) return
      updatePlanForDate(date, (plan) => {
        if (plan.status === "approved") return plan
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
    [isPlanLocked, updatePlanForDate],
  )

  const createPlanCheckpoint = useCallback(
    async (date: string, reason: MealPlanSnapshotReason = "manual") => {
      const plan = getPlanForDate(date)
      if (!plan.slots.some((slot) => slot.entries.length > 0)) return false

      const persistedPlan = await syncPlanToSupabase(plan)
      if (!persistedPlan || !isUuid(persistedPlan.id)) return false

      try {
        return await snapshotMealPlanVersion(persistedPlan, { reason })
      } catch (error) {
        console.error(`Failed to create ${reason} checkpoint for meal plan ${persistedPlan.id}:`, error)
        return false
      }
    },
    [getPlanForDate, syncPlanToSupabase],
  )

  const savePlanForDate = useCallback(
    async (date: string, metadata: MealPlanMetadataPatch = {}) => {
      const plan = {
        ...getPlanForDate(date),
        ...metadata,
      }
      const key = getPlanKey(plan.date, plan.patientId)
      dirtyDatesRef.current.add(key)

      setPlans((prev) => ({
        ...prev,
        [key]: ensureAllSlots(plan),
      }))

      const persistedPlan = await syncPlanToSupabase(plan)
      if (isAuthenticated && !persistedPlan) return null
      return persistedPlan ?? plan
    },
    [getPlanForDate, isAuthenticated, syncPlanToSupabase],
  )

  const approvePlan = useCallback(
    async (
      date: string,
      metadata: Pick<DailyMealPlan, "approvedAt" | "approvedBy"> = {},
    ) => {
      let approvedPlan: DailyMealPlan | null = null

      setPlans((prev) => {
        const key = getPlanKey(date, contextPatientId)
        dirtyDatesRef.current.add(key)
        const basePlan = prev[key]
          ? ensureAllSlots(prev[key])
          : createEmptyPlan(date, defaultMetadata)
        approvedPlan = {
          ...basePlan,
          status: "approved",
          approvedAt: metadata.approvedAt ?? basePlan.approvedAt ?? new Date().toISOString(),
          approvedBy: metadata.approvedBy ?? basePlan.approvedBy,
        }

        return {
          ...prev,
          [getPlanKey(approvedPlan.date, approvedPlan.patientId)]: approvedPlan,
        }
      })

      if (!approvedPlan) return false

      const persistedPlan = await syncPlanToSupabase(approvedPlan)
      if (!persistedPlan || !isUuid(persistedPlan.id)) return false

      try {
        return await snapshotMealPlanVersion(persistedPlan, { reason: "approved" })
      } catch (error) {
        console.error(`Failed to approve snapshot meal plan ${persistedPlan.id}:`, error)
        return false
      }
    },
    [contextPatientId, defaultMetadata, syncPlanToSupabase],
  )

  const reopenPlan = useCallback(
    (date: string) => {
      let updatedPlan: DailyMealPlan | null = null
      let snapshotReason: MealPlanSnapshotReason | undefined

      setPlans((prev) => {
        const key = getPlanKey(date, contextPatientId)
        const basePlan = prev[key]
          ? ensureAllSlots(prev[key])
          : createEmptyPlan(date, defaultMetadata)
        snapshotReason = basePlan.status === "approved" ? "reopened" : undefined
        updatedPlan = {
          ...basePlan,
          status: "draft",
          approvedAt: undefined,
          approvedBy: undefined,
        }

        return {
          ...prev,
          [getPlanKey(updatedPlan.date, updatedPlan.patientId)]: updatedPlan,
        }
      })

      if (updatedPlan) {
        void syncPlanToSupabase(updatedPlan, { snapshotReason })
      }
    },
    [contextPatientId, defaultMetadata, syncPlanToSupabase],
  )

  const restorePlanVersion = useCallback(
    (date: string, snapshot: { slots: MealSlot[]; title?: string; notes?: string; targetProfileId?: string; dietLineId?: string }) => {
      if (isPlanLocked(date)) return
      updatePlanForDate(date, (plan) => {
        if (plan.status === "approved") return plan
        const cloned: MealSlot[] = ALL_SLOT_TYPES.map((type) => {
          const incoming = snapshot.slots.find((slot) => slot.type === type)
          return {
            type,
            entries: (incoming?.entries ?? []).map((entry) => cloneEntry(entry)),
          }
        })
        return {
          ...plan,
          title: snapshot.title ?? plan.title,
          notes: snapshot.notes ?? plan.notes,
          targetProfileId: snapshot.targetProfileId ?? plan.targetProfileId,
          dietLineId: snapshot.dietLineId ?? plan.dietLineId,
          status: "draft",
          approvedAt: undefined,
          approvedBy: undefined,
          slots: cloned,
        }
      })
    },
    [isPlanLocked, updatePlanForDate],
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
    addEntryForDate,
    removeEntry,
    removeEntryForDate,
    updateEntryAmount,
    replaceEntry,
    moveEntry,
    copyPlanToDate,
    clearPlanForDate,
    updatePlanMetadata,
    applyTemplateToDate,
    savePlanForDate,
    createPlanCheckpoint,
    approvePlan,
    reopenPlan,
    restorePlanVersion,
    isPlanLocked,
    setDate,
    goToNextDay,
    goToPreviousDay,
    isLoadingRemote
  }
}
