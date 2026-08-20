"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { toast } from "sonner"

import {
  archiveMealPlanRevisionClient,
  beginMealPlanRevisionClient,
  deleteMealPlanClient,
  fetchMealPlansClient,
  persistMealPlan,
  releaseMealPlanRevisionClient,
} from "@/lib/data/meal-plans-client"
import { useAuth } from "@/hooks/use-auth"
import type { DailyMealPlan, MealEntry, Patient } from "@/lib/types"

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
  const priority = (plan: DailyMealPlan) => {
    if (plan.status === "draft") return 0
    if (plan.status === "active" || plan.status === "approved") return 1
    if (plan.replacedAt) return 2
    return 3
  }
  return [...plans].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      priority(a) - priority(b) ||
      (b.revisionNumber ?? 1) - (a.revisionNumber ?? 1),
  )
}

function isPatientPlan(plan: DailyMealPlan, patientId: string, patientLegacyId?: string) {
  return plan.patientId === patientId || Boolean(patientLegacyId && plan.patientId === patientLegacyId)
}

export function usePatientMealPlans(
  patient: Patient,
  initialPlans?: DailyMealPlan[],
) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const patientId = patient.id
  const patientLegacyId = patient.legacyId
  const [plans, setPlans] = useState<DailyMealPlan[]>(() => sortPlans(initialPlans ?? []))
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)

  useEffect(() => {
    if (initialPlans) {
      setPlans(sortPlans(initialPlans))
    }
  }, [initialPlans])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function syncPlans() {
      try {
        const remotePlans = await fetchMealPlansClient()
        if (cancelled) return
        setPlans(
          sortPlans(
            remotePlans.filter((plan) => isPatientPlan(plan, patientId, patientLegacyId)),
          ),
        )
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
  }, [authLoading, isAuthenticated, patientId, patientLegacyId])

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status === "active" || plan.status === "approved"),
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
        const persisted = await archiveMealPlanRevisionClient(plan.id)
        setPlans((prev) => sortPlans(prev.map((item) => (item.id === plan.id ? persisted : item))))
        toast.success("Planvorlage archiviert.")
      } catch (error) {
        console.error("Failed to archive meal plan:", error)
        setPlans((prev) => sortPlans(prev.map((item) => (item.id === plan.id ? plan : item))))
        toast.error("Planvorlage konnte nicht archiviert werden.")
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
        patientId,
        title: `${plan.title ?? "Planvorlage"} (Kopie)`,
        status: "draft",
        approvedAt: undefined,
        approvedBy: undefined,
        revisionNumber: undefined,
        supersedesPlanId: undefined,
        replacedAt: undefined,
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
        toast.success("Planvorlage dupliziert.")
        return persisted
      } catch (error) {
        console.error("Failed to duplicate meal plan:", error)
        setPlans((prev) => prev.filter((item) => item.id !== duplicatedPlan.id))
        toast.error("Planvorlage konnte nicht dupliziert werden.")
        return null
      }
    },
    [patientId, plans],
  )

  const copyPlanToPatient = useCallback(
    async (
      plan: DailyMealPlan,
      targetPatient: Patient,
      targetDate: string,
      options: { includeNotes: boolean; includeDietLine: boolean },
    ) => {
      if (!targetDate) {
        toast.error("Bitte ein Datum für die Kopie wählen.")
        return null
      }

      try {
        const remotePlans = isAuthenticated ? await fetchMealPlansClient() : plans
        const targetHasPlanOnDate = remotePlans.some(
          (item) =>
            isPatientPlan(item, targetPatient.id, targetPatient.legacyId) &&
            item.date === targetDate &&
            item.status !== "archived",
        )

        if (targetHasPlanOnDate) {
          toast.error("Der Zielpatient hat an diesem Datum bereits eine Planvorlage.")
          return null
        }
      } catch (error) {
        console.error("Failed to check target patient meal plans:", error)
        toast.error("Zielpatient konnte nicht geprüft werden.")
        return null
      }

      const copiedPlan: DailyMealPlan = {
        ...plan,
        id: `plan_${targetPatient.id}_${targetDate}_${Date.now()}`,
        legacyId: undefined,
        date: targetDate,
        patientId: targetPatient.id,
        title: `${plan.title ?? "Planvorlage"} (Kopie)`,
        status: "draft",
        notes: options.includeNotes ? plan.notes : undefined,
        dietLineId: options.includeDietLine ? plan.dietLineId : undefined,
        approvedAt: undefined,
        approvedBy: undefined,
        revisionNumber: undefined,
        supersedesPlanId: undefined,
        replacedAt: undefined,
        slots: plan.slots.map((slot) => ({
          ...slot,
          entries: slot.entries.map(cloneEntry),
        })),
      }

      try {
        const persisted = await persistMealPlan(copiedPlan)
        if (isPatientPlan({ ...persisted, patientId: targetPatient.id }, patientId, patientLegacyId)) {
          setPlans((prev) => sortPlans([persisted, ...prev]))
        }
        toast.success(`Planvorlage wurde für ${targetPatient.firstName} ${targetPatient.lastName} kopiert.`)
        return persisted
      } catch (error) {
        console.error("Failed to copy meal plan to patient:", error)
        toast.error("Planvorlage konnte nicht kopiert werden.")
        return null
      }
    },
    [isAuthenticated, patientId, patientLegacyId, plans],
  )

  const deletePlan = useCallback(
    async (plan: DailyMealPlan) => {
      if (
        plan.status === "approved" ||
        plan.status === "active" ||
        plan.approvedAt ||
        plan.replacedAt
      ) {
        toast.error("Übergebene Planstände bleiben als nachvollziehbare Historie erhalten.")
        return false
      }

      setPlans((prev) => prev.filter((item) => item.id !== plan.id))

      if (!isAuthenticated) {
        toast.success("Planvorlage gelöscht.")
        return true
      }

      try {
        await deleteMealPlanClient(plan.id)
        toast.success("Planvorlage gelöscht.")
        return true
      } catch (error) {
        console.error("Failed to delete meal plan:", error)
        setPlans((prev) => sortPlans([plan, ...prev]))
        toast.error("Planvorlage konnte nicht gelöscht werden.")
        return false
      }
    },
    [isAuthenticated],
  )

  const releasePlan = useCallback(async (plan: DailyMealPlan) => {
    try {
      const released = await releaseMealPlanRevisionClient(plan.id)
      setPlans((prev) =>
        sortPlans(
          prev.map((item) => {
            if (item.id === released.id) return released
            const sameHandoff =
              item.patientId === released.patientId &&
              item.date === released.date &&
              (item.status === "active" || item.status === "approved")
            return sameHandoff
              ? { ...item, status: "archived", replacedAt: released.approvedAt }
              : item
          }),
        ),
      )
      toast.success("Plan freigegeben und für den Klienten sichtbar.")
      return released
    } catch (error) {
      console.error("Failed to release meal plan:", error)
      const message = error instanceof Error && error.message.includes("EMPTY_PLAN")
        ? "Ein leerer Plan kann nicht freigegeben werden."
        : "Plan konnte nicht freigegeben werden."
      toast.error(message)
      return null
    }
  }, [])

  const beginRevision = useCallback(async (plan: DailyMealPlan) => {
    try {
      const draft = await beginMealPlanRevisionClient(plan.id)
      setPlans((prev) =>
        sortPlans([draft, ...prev.filter((item) => item.id !== draft.id)]),
      )
      toast.success("Änderungsentwurf angelegt. Der freigegebene Stand bleibt gültig.")
      return draft
    } catch (error) {
      console.error("Failed to begin meal plan revision:", error)
      toast.error("Änderungsentwurf konnte nicht angelegt werden.")
      return null
    }
  }, [])

  return {
    plans,
    activePlans,
    latestPlan,
    isLoadingRemote,
    archivePlan,
    duplicatePlan,
    copyPlanToPatient,
    deletePlan,
    releasePlan,
    beginRevision,
  }
}
