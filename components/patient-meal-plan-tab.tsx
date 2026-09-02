"use client"

import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { FoodsProvider } from "@/components/foods-provider"
import { MealPlanPlanner } from "@/components/meal-plan-planner"
import { PatientPlanStatus } from "@/components/patient-plan-status"
import type { PatientEnergyContext } from "@/components/plan-strategy-view"
import { PatientMealPlansTab } from "@/components/patient-meal-plans-tab"
import { Button } from "@/components/ui/button"
import { todayIsoDate } from "@/lib/client-mode"
import { fetchMealPlansClient } from "@/lib/data/meal-plans-client"
import { fetchRecipesClient } from "@/lib/data/recipes-client"
import type {
  AnthropometricEntry,
  DailyMealPlan,
  Food,
  Patient,
  PatientAllergenEntry,
  PracticeAppointment,
  Recipe,
} from "@/lib/types"

interface PatientMealPlanTabProps {
  patient: Patient
  plans: DailyMealPlan[]
  /** Foods referenced by this patient's plans; the planner hydrates the rest. */
  foods: Food[]
  /** Recipes referenced by this patient's plans, used until the full set lands. */
  recipes: Recipe[]
  anthropometrics: AnthropometricEntry[]
  appointments: PracticeAppointment[]
  patientAllergens: PatientAllergenEntry[]
  /**
   * Energy figures the record already computed. Passed down rather than
   * recomputed so the plan strategy and the overview cannot quote the patient
   * two different maintenance requirements.
   */
  energyContext?: PatientEnergyContext
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
  onOpenClientApp: () => void
}

function mergePlanSources(
  initialPlans: DailyMealPlan[],
  workspacePlans: DailyMealPlan[],
) {
  const merged = new Map(initialPlans.map((plan) => [plan.id, plan]))
  for (const plan of workspacePlans) merged.set(plan.id, plan)
  return Array.from(merged.values())
}

/**
 * The planner, inside the patient record.
 *
 * A meal plan only ever exists for one patient, so the plan belongs in the
 * record rather than on a route of its own where the patient has to be picked
 * again. The record owns strategy in Planstatus; its builder opens the week,
 * treats a day as contextual detail, and keeps the patient's plan-state list.
 *
 * Nothing here is loaded by the patient route: the tab mounts lazily, and its
 * recipes and food index are fetched on that mount. Putting them in the route's
 * server payload would have made every visit to the overview pay for a planner
 * nobody opened.
 */
export function PatientMealPlanTab({
  patient,
  plans,
  foods,
  recipes,
  anthropometrics,
  appointments,
  patientAllergens,
  energyContext,
  onSavePatient,
  onOpenClientApp,
}: PatientMealPlanTabProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  // The library needs the whole catalogue, not just what this patient's plans
  // already reference — the referenced ones are only a head start.
  const [allRecipes, setAllRecipes] = useState<Recipe[]>(recipes)
  const [statusPlans, setStatusPlans] = useState<DailyMealPlan[]>(plans)
  const requestedPlanView = searchParams.get("planView")
  const plannerView = requestedPlanView === "day" || requestedPlanView === "plans" || requestedPlanView === "analysis"
    ? requestedPlanView
    : "week"
  const workspace = requestedPlanView === "week" || requestedPlanView === "day" || requestedPlanView === "plans" || requestedPlanView === "analysis"
    ? "planner"
    : "status"
  const requestedDate = searchParams.get("planDate")
  const requestedTemplate = searchParams.get("template") ?? undefined
  const plannerDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : todayIsoDate()

  useEffect(() => {
    let cancelled = false
    fetchRecipesClient()
      .then((fetched) => {
        if (cancelled || fetched.length === 0) return
        setAllRecipes(fetched)
      })
      .catch((error) => {
        console.error("Failed to load recipes for the patient planner:", error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The builder owns its autosaving workspace, while releases and revisions
  // also happen in its plan list. Refresh the light cockpit projection when
  // returning to it so the coverage rail never depends on the route's older
  // server payload. A short defer lets the last blur/autosave finish first.
  useEffect(() => {
    if (workspace !== "status") return
    let cancelled = false
    const timeout = window.setTimeout(() => {
      fetchMealPlansClient({ patientId: patient.id })
        .then((nextPlans) => {
          if (!cancelled) setStatusPlans(nextPlans)
        })
        .catch((error) => {
          console.error("Failed to refresh patient plan status:", error)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [patient.id, workspace])

  const navigatePlan = (
    nextView: "status" | "week" | "day" | "analysis" | "plans",
    date?: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "ernaehrungsplan")
    if (nextView === "status") {
      params.delete("planView")
      params.delete("planDate")
    } else {
      params.set("planView", nextView)
      if (date) params.set("planDate", date)
    }
    const href = `${pathname}?${params.toString()}`
    router.push(href, { scroll: false })
  }

  const openPlanner = (date: string) => navigatePlan("week", date)

  // Status is where the tab lands and the builder is what it leads to, so the
  // two are one path, not two peers: the status screen's own call to action
  // opens the planner, and the planner offers the way back. A toggle above both
  // only restated a choice the page had already made.
  if (workspace === "status") {
    return (
      <PatientPlanStatus
        patient={patient}
        plans={statusPlans}
        anthropometrics={anthropometrics}
        appointments={appointments}
        energyContext={energyContext}
        patientAllergens={patientAllergens}
        onSavePatient={onSavePatient}
        onOpenPlanner={openPlanner}
        onOpenClientApp={onOpenClientApp}
      />
    )
  }

  return (
    <>
      <div className="mb-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2"
          onClick={() => navigatePlan("status")}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Zurück
        </Button>
      </div>

      <FoodsProvider foods={foods}>
        <MealPlanPlanner
          key={patient.id}
          embedded
          initialView={plannerView}
          initialDate={plannerDate}
          patientId={patient.id}
          energyContext={energyContext}
          recipes={allRecipes}
          initialPlans={statusPlans}
          initialApplyTemplateId={requestedTemplate}
          onApplyTemplateConsumed={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("template")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
          }}
          onViewChange={(nextView, date) => {
            if (nextView === "week" || nextView === "day" || nextView === "analysis" || nextView === "plans") {
              navigatePlan(nextView, date)
            }
          }}
          extraTab={{
            value: "plans",
            label: "Freigaben",
            render: ({ openDay, openWeek, workspacePlans }) => (
              <PatientMealPlansTab
                patient={patient}
                initialPlans={mergePlanSources(statusPlans, workspacePlans)}
                foods={foods}
                recipes={allRecipes}
                onOpenPlan={openWeek}
                onCreatePlan={() => openDay(todayIsoDate())}
              />
            ),
          }}
        />
      </FoodsProvider>
    </>
  )
}
