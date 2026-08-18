"use client"

import { useEffect, useState } from "react"

import { FoodsProvider } from "@/components/foods-provider"
import { MealPlanPlanner } from "@/components/meal-plan-planner"
import { PatientMealPlansTab } from "@/components/patient-meal-plans-tab"
import { fetchRecipesClient } from "@/lib/data/recipes-client"
import type { DailyMealPlan, Food, Patient, Recipe } from "@/lib/types"

interface PatientMealPlanTabProps {
  patient: Patient
  plans: DailyMealPlan[]
  /** Foods referenced by this patient's plans; the planner hydrates the rest. */
  foods: Food[]
  /** Recipes referenced by this patient's plans, used until the full set lands. */
  recipes: Recipe[]
}

/**
 * The planner, inside the patient record.
 *
 * A meal plan only ever exists for one patient, so the plan belongs in the
 * record rather than on a route of its own where the patient has to be picked
 * again. The planner keeps its Strategie/Tag/Woche views and gains the
 * patient's plan list as a fourth.
 *
 * Nothing here is loaded by the patient route: the tab mounts lazily, and its
 * recipes and food index are fetched on that mount. Putting them in the route's
 * server payload would have made every visit to the overview pay for a planner
 * nobody opened.
 */
export function PatientMealPlanTab({ patient, plans, foods, recipes }: PatientMealPlanTabProps) {
  // The library needs the whole catalogue, not just what this patient's plans
  // already reference — the referenced ones are only a head start.
  const [allRecipes, setAllRecipes] = useState<Recipe[]>(recipes)

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

  return (
    <FoodsProvider foods={foods}>
      <MealPlanPlanner
        embedded
        patientId={patient.id}
        recipes={allRecipes}
        initialPlans={plans}
        extraTab={{
          value: "plans",
          label: "Pläne",
          render: ({ openDay }) => (
            <PatientMealPlansTab
              patient={patient}
              initialPlans={plans}
              foods={foods}
              recipes={allRecipes}
              onOpenPlan={(plan) => openDay(plan.date)}
              onCreatePlan={() => openDay(new Date().toISOString().slice(0, 10))}
            />
          ),
        }}
      />
    </FoodsProvider>
  )
}
