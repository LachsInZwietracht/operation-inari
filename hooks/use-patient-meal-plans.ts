"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { toast } from "sonner"

import { fetchMealPlansClient, persistMealPlan } from "@/lib/data/meal-plans-client"
import { useAuth } from "@/hooks/use-auth"
import type { DailyMealPlan, MealEntry, Patient } from "@/lib/types"

function matchesPatient(plan: DailyMealPlan, patient: Patient) {
  return plan.patientId === patient.id || Boolean(patient.legacyId && plan.patientId === patient.legacyId)
}

function generateEntryId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function cloneEntry(entry: MealEntry): MealEntry {
  return {
    ...entry,
    id: generateEntryId(),
  }
}

function nextAvailableDate(sourceDate: string, plans: DailyMealPlan[]) {
  const occupied = new Set(plans.map((plan) => plan.date))
  let candidate = addDays(parseISO(sourceDate), 1)

  for (let index = 0; index < 60; index += 1) {
    const iso = format(candidate, "yyyy-MM-dd")
    if (!occupied.has(iso)) return iso
    candidate = addDays(candidate, 1)
  }

  return format(candidate, "yyyy-MM-dd")
}

function sortPlans(plans: DailyMealPlan[]) {
  return [...plans].sort((a, b) => b.date.localeCompare(a.date))
}

export function usePatientMealPlans(
  patient: Patient,
  initialPlans?: DailyMealPlan[],
) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [plans, setPlans] = useState<DailyMealPlan[]>(() => sortPlans(initialPlans ?? []))
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)

  useEffect(() => {
    if (initialPlans) {
      setPlans(sortPlans(initialPlans))
    }
  }, [initialPlans])

  useEffect(() => {
    if (initialPlans) return
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function syncPlans() {
      try {
        const remotePlans = await fetchMealPlansClient()
        if (cancelled) return
        setPlans(sortPlans(remotePlans.filter((plan) => matchesPatient(plan, patient))))
      } catch (error) {
        console.error("Failed to load patient meal plans:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncPlans()

    return () => {
      cancelled = true
    }
  }, [authLoading, initialPlans, isAuthenticated, patient])

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status !== "archived"),
    [plans],
  )

  const latestPlan = activePlans[0] ?? plans[0] ?? null

  const archivePlan = useCallback(
    async (plan: DailyMealPlan) => {
      const nextPlan: DailyMealPlan = {
        ...plan,
        status: "archived",
      }
      setPlans((prev) => sortPlans(prev.map((item) => (item.id === plan.id ? nextPlan : item))))
      try {
        const persisted = await persistMealPlan(nextPlan)
        setPlans((prev) => sortPlans(prev.map((item) => (item.id === plan.id ? persisted : item))))
        toast.success("Ernährungsplan archiviert.")
      } catch (error) {
        console.error("Failed to archive meal plan:", error)
        setPlans((prev) => sortPlans(prev.map((item) => (item.id === plan.id ? plan : item))))
        toast.error("Ernährungsplan konnte nicht archiviert werden.")
      }
    },
    [],
  )

  const duplicatePlan = useCallback(
    async (plan: DailyMealPlan) => {
      const date = nextAvailableDate(plan.date, plans)
      const duplicatedPlan: DailyMealPlan = {
        ...plan,
        id: `plan_${date}_${Date.now()}`,
        legacyId: undefined,
        date,
        patientId: patient.id,
        title: `${plan.title ?? "Ernährungsplan"} (Kopie)`,
        status: "draft",
        approvedAt: undefined,
        approvedBy: undefined,
        slots: plan.slots.map((slot) => ({
          ...slot,
          entries: slot.entries.map(cloneEntry),
        })),
      }

      setPlans((prev) => sortPlans([duplicatedPlan, ...prev]))
      try {
        const persisted = await persistMealPlan(duplicatedPlan)
        setPlans((prev) =>
          sortPlans(prev.map((item) => (item.id === duplicatedPlan.id ? persisted : item))),
        )
        toast.success("Ernährungsplan dupliziert.")
        return persisted
      } catch (error) {
        console.error("Failed to duplicate meal plan:", error)
        setPlans((prev) => prev.filter((item) => item.id !== duplicatedPlan.id))
        toast.error("Ernährungsplan konnte nicht dupliziert werden.")
        return null
      }
    },
    [patient.id, plans],
  )

  return {
    plans,
    activePlans,
    latestPlan,
    isLoadingRemote,
    archivePlan,
    duplicatePlan,
  }
}
