"use client"

import { useCallback, useMemo, useState, useSyncExternalStore } from "react"

import {
  createDemoWeek,
  dayNutrients,
  DEMO_ITEM_MAP,
  DEMO_MACRO_TARGETS,
  DEMO_MICRO_TARGETS,
  DEMO_SLOT_ORDER,
  DEMO_TEMPLATES,
  emptyDay,
  nextEntryId,
  planAdditives,
  planAllergenConflicts,
  readTargets,
  slotNutrients,
  type DayIndex,
  type DemoDay,
  type DemoSlotType,
} from "./demo-data"

/**
 * Shared state for the three design drafts.
 *
 * Each draft owns its own instance, so a colleague can rearrange the plan in
 * one draft and still find the seed week untouched in the next. Everything is
 * in-memory; nothing is persisted.
 */
export function useDemoPlan(initialDay: DayIndex = 3) {
  const [week, setWeek] = useState<Record<DayIndex, DemoDay>>(() => createDemoWeek())
  const [activeDay, setActiveDay] = useState<DayIndex>(initialDay)

  const day = week[activeDay]

  const mutateDay = useCallback(
    (dayIndex: DayIndex, update: (current: DemoDay) => DemoDay) => {
      setWeek((current) => ({ ...current, [dayIndex]: update(current[dayIndex]) }))
    },
    [],
  )

  const addItem = useCallback(
    (slot: DemoSlotType, itemId: string, amount?: number, dayIndex: DayIndex = activeDay) => {
      const item = DEMO_ITEM_MAP.get(itemId)
      if (!item) return
      mutateDay(dayIndex, (current) => ({
        ...current,
        [slot]: [...current[slot], { id: nextEntryId(), itemId, amount: amount ?? item.step }],
      }))
    },
    [activeDay, mutateDay],
  )

  const removeEntry = useCallback(
    (slot: DemoSlotType, entryId: string, dayIndex: DayIndex = activeDay) => {
      mutateDay(dayIndex, (current) => ({
        ...current,
        [slot]: current[slot].filter((entry) => entry.id !== entryId),
      }))
    },
    [activeDay, mutateDay],
  )

  const setAmount = useCallback(
    (slot: DemoSlotType, entryId: string, amount: number, dayIndex: DayIndex = activeDay) => {
      mutateDay(dayIndex, (current) => ({
        ...current,
        [slot]: current[slot].map((entry) =>
          entry.id === entryId ? { ...entry, amount: Math.max(1, Math.round(amount)) } : entry,
        ),
      }))
    },
    [activeDay, mutateDay],
  )

  const moveEntry = useCallback(
    (from: DemoSlotType, to: DemoSlotType, entryId: string, dayIndex: DayIndex = activeDay) => {
      if (from === to) return
      mutateDay(dayIndex, (current) => {
        const entry = current[from].find((candidate) => candidate.id === entryId)
        if (!entry) return current
        return {
          ...current,
          [from]: current[from].filter((candidate) => candidate.id !== entryId),
          [to]: [...current[to], entry],
        }
      })
    },
    [activeDay, mutateDay],
  )

  const clearDay = useCallback(
    (dayIndex: DayIndex = activeDay) => mutateDay(dayIndex, () => emptyDay()),
    [activeDay, mutateDay],
  )

  const duplicateDay = useCallback(
    (from: DayIndex, to: DayIndex) => {
      setWeek((current) => ({
        ...current,
        [to]: Object.fromEntries(
          DEMO_SLOT_ORDER.map((slot) => [
            slot,
            current[from][slot].map((entry) => ({ ...entry, id: nextEntryId() })),
          ]),
        ) as DemoDay,
      }))
    },
    [],
  )

  const applyTemplate = useCallback(
    (templateId: string, dayIndex: DayIndex = activeDay) => {
      const template = DEMO_TEMPLATES.find((candidate) => candidate.id === templateId)
      if (!template) return
      const next = emptyDay()
      for (const slot of template.slots) {
        next[slot.type] = slot.entries.map((entry) => ({
          id: nextEntryId(),
          itemId: entry.itemId,
          amount: entry.amount,
        }))
      }
      mutateDay(dayIndex, () => next)
    },
    [activeDay, mutateDay],
  )

  const totals = useMemo(() => dayNutrients(day), [day])
  const macroReadings = useMemo(() => readTargets(DEMO_MACRO_TARGETS, totals), [totals])
  const microReadings = useMemo(() => readTargets(DEMO_MICRO_TARGETS, totals), [totals])

  const slotTotals = useMemo(
    () => new Map(DEMO_SLOT_ORDER.map((slot) => [slot, slotNutrients(day[slot])])),
    [day],
  )

  const weekKcal = useMemo(
    () =>
      ([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).map((index) => ({
        index,
        kcal: dayNutrients(week[index]).kcal,
        entries: DEMO_SLOT_ORDER.reduce((count, slot) => count + week[index][slot].length, 0),
      })),
    [week],
  )

  const conflicts = useMemo(() => planAllergenConflicts(day), [day])
  const additives = useMemo(() => planAdditives(day), [day])
  const entryCount = useMemo(
    () => DEMO_SLOT_ORDER.reduce((count, slot) => count + day[slot].length, 0),
    [day],
  )

  return {
    week,
    day,
    activeDay,
    setActiveDay,
    addItem,
    removeEntry,
    setAmount,
    moveEntry,
    clearDay,
    duplicateDay,
    applyTemplate,
    totals,
    macroReadings,
    microReadings,
    slotTotals,
    weekKcal,
    conflicts,
    additives,
    entryCount,
  }
}

export type DemoPlanApi = ReturnType<typeof useDemoPlan>

/**
 * False during server render and hydration, true afterwards.
 *
 * The drafts show real dates, but the server's UTC "today" and the browser's
 * Berlin "today" can disagree across a midnight boundary. Rendering a fixed
 * fallback week until hydration finishes keeps the first client render
 * identical to the server's.
 */
const subscribeNever = () => () => {}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
}

/** Fallback anchor while hydrating — a Monday, so the week starts cleanly. */
const FALLBACK_MONDAY = new Date(2026, 7, 17)

/** Monday-first dates of the current week. */
export function useDemoWeekDates(): Date[] {
  const hydrated = useHydrated()

  return useMemo(() => {
    const now = hydrated ? new Date() : FALLBACK_MONDAY
    const offset = (now.getDay() + 6) % 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return date
    })
  }, [hydrated])
}

/** Index of today inside the demo week, or null while the fallback is shown. */
export function useTodayIndex(): DayIndex | null {
  const hydrated = useHydrated()
  return useMemo(
    () => (hydrated ? (((new Date().getDay() + 6) % 7) as DayIndex) : null),
    [hydrated],
  )
}
