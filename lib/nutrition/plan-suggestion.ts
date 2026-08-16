import { checkAllergenConflicts } from "@/lib/allergen-warnings"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { DailyMealPlan, MealSlotType, Patient, PatientAllergenEntry, Recipe } from "@/lib/types"

export interface PlanSuggestionResult {
  slots: DailyMealPlan["slots"]
  notes: string[]
  blockedReasons: string[]
}

const SLOTS: MealSlotType[] = ["fruehstueck", "mittagessen", "abendessen"]

/**
 * Builds a conservative first draft from recipes with known nutrition data.
 * It refuses to guess when a diet style or exclusion cannot be verified from
 * the recipe data. A clinician reviews the returned draft before it is saved.
 */
export function buildSafePlanSuggestion({
  patient,
  recipes,
  patientAllergens,
}: {
  patient: Patient
  recipes: Recipe[]
  patientAllergens: PatientAllergenEntry[]
}): PlanSuggestionResult {
  const blockedReasons: string[] = []
  if (patient.dietStyle && patient.dietStyle !== "omnivor") {
    blockedReasons.push("Die Ernährungsform muss zuerst mit eindeutig gekennzeichneten Rezepten geprüft werden.")
  }
  if (patient.nutritionPreferences?.length) {
    blockedReasons.push("Die persönlichen Ausschlüsse müssen zuerst mit eindeutig gekennzeichneten Rezepten geprüft werden.")
  }
  if (blockedReasons.length) return { slots: [], notes: [], blockedReasons }

  const hardAllergens = patientAllergens.filter(
    (entry) => entry.type === "allergy" || entry.type === "intolerance",
  )
  const suitableRecipes = recipes
    .filter((recipe) => Number.isFinite(recipe.cachedKcalPerPortion) && (recipe.cachedKcalPerPortion ?? 0) > 0)
    .filter((recipe) => checkAllergenConflicts(recipe.allergens ?? [], hardAllergens).length === 0)
    .sort((a, b) => (b.cachedProteinPerPortion ?? 0) - (a.cachedProteinPerPortion ?? 0) || a.name.localeCompare(b.name, "de"))

  if (suitableRecipes.length < SLOTS.length) {
    return {
      slots: [],
      notes: [],
      blockedReasons: ["Es gibt nicht genug geprüfte Rezepte für einen sicheren Vorschlag."],
    }
  }

  const targetKcal = patient.dailyCalorieGoal ?? 2000
  const slotTarget = targetKcal / SLOTS.length
  const selected = SLOTS.map((slot, index) => {
    const recipe = suitableRecipes[index % suitableRecipes.length]
    const portions = Math.max(0.5, Math.min(2, Math.round((slotTarget / recipe.cachedKcalPerPortion!) * 4) / 4))
    return {
      type: slot,
      entries: [{ id: `suggestion-${slot}-${recipe.id}`, type: "recipe" as const, referenceId: recipe.id, amount: portions }],
    }
  })

  return {
    slots: selected,
    notes: selected.map((slot) => `${MEAL_SLOT_LABELS[slot.type]} wurde als Entwurf vorbereitet.`),
    blockedReasons: [],
  }
}
