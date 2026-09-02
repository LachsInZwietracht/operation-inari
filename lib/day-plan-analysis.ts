import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import {
  calculateEntryNutrients,
  complianceBadge,
  getEnergyTargetStatus,
  isMealEntryNutrientEvaluable,
  type ComplianceStatus,
} from "@/lib/meal-plan-calc"
import { getBroteinheiten, getNutrientValue, sumNutrients } from "@/lib/nutrients"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  NutrientDefinition,
  Recipe,
  ReferenceNutrientValue,
  ResolvedReferenceConfig,
} from "@/lib/types"

export type DayAnalysisStatus = ComplianceStatus | "neutral" | "unavailable"

export interface DayAnalysisNutrient {
  definition: NutrientDefinition
  value: number
  evaluable: boolean
  /** A Kostform target deliberately replaces the demographic reference. */
  min?: number
  max?: number
  targetSource?: "Kostform" | "Referenzwert" | "Patientenziel"
  status: DayAnalysisStatus
  derived?: boolean
  energyCorridor?: boolean
}

export interface DayPlanAnalysis {
  nutrients: DayAnalysisNutrient[]
  hasEntries: boolean
  unavailableCount: number
  attention: DayAnalysisNutrient[]
  evaluatedCount: number
}

/**
 * One detailed daily assessment, built from the same entry scaling and
 * evaluability checks that drive the planner workspace and weekly balance.
 * A reference value is a minimum by definition; only an explicit Kostform
 * target is allowed to introduce a maximum.
 */
export function analyseDayPlan({
  plan,
  foods,
  foodMap,
  recipeMap,
  dietLine,
  refConfig,
  referenceValues,
  patientEnergyTarget,
}: {
  plan: DailyMealPlan
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  dietLine?: DietLinePreset
  refConfig: ResolvedReferenceConfig
  /** Resolved micro references, including the planner's established DGE fallback. */
  referenceValues?: ReferenceNutrientValue[]
  patientEnergyTarget?: number
}): DayPlanAnalysis {
  const entries = plan.slots.flatMap((slot) => slot.entries)
  const totals = sumNutrients(
    entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
  )
  const dietTargets = new Map(dietLine?.targets.map((target) => [target.nutrientId, target]) ?? [])
  const referenceTargets = new Map(
    (referenceValues ?? refConfig.values)
      // Energy needs an individual target/corridor. A generic demographic
      // reference must not turn a clearly excessive day into an `ok` result.
      .filter((target) => target.nutrientId !== "energie")
      .map((target) => [target.nutrientId, target.amount]),
  )
  const presentIds = new Set(totals.map((item) => item.nutrientId))
  const allIds = new Set([...presentIds, ...dietTargets.keys(), ...referenceTargets.keys()])

  // BE is virtual: its only source is fully evaluable carbohydrate data.
  const carbsEvaluable = entries.length > 0 && entries.every((entry) =>
    isMealEntryNutrientEvaluable(entry, "kohlenhydrate", foodMap, recipeMap),
  )
  if (carbsEvaluable || dietTargets.has("broteinheiten")) allIds.add("broteinheiten")

  const definitions = new Map(NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition]))
  const nutrients = Array.from(allIds)
    .flatMap((nutrientId) => {
      const definition = definitions.get(nutrientId)
      if (!definition) return []
      const dietTarget = dietTargets.get(nutrientId)
      const reference = referenceTargets.get(nutrientId)
      const derived = nutrientId === "broteinheiten"
      const evaluable = derived
        ? carbsEvaluable
        : entries.length > 0 && entries.every((entry) =>
          isMealEntryNutrientEvaluable(entry, nutrientId, foodMap, recipeMap),
        )
      const value = derived
        ? getBroteinheiten(getNutrientValue(totals, "kohlenhydrate"))
        : getNutrientValue(totals, nutrientId)
      // The Kostform is the clinical decision for this plan. References fill
      // only gaps and remain lower bounds, never accidental upper limits.
      const usesPatientEnergyTarget = nutrientId === "energie" && !dietTarget && Boolean(patientEnergyTarget && patientEnergyTarget > 0)
      const min = dietTarget?.min ?? (dietTarget ? undefined : usesPatientEnergyTarget ? patientEnergyTarget : reference)
      const max = dietTarget?.max
      const targetSource = dietTarget ? "Kostform" as const : usesPatientEnergyTarget ? "Patientenziel" as const : reference != null ? "Referenzwert" as const : undefined
      const status: DayAnalysisStatus = !evaluable
        ? "unavailable"
        : min == null && max == null
          ? "neutral"
          : usesPatientEnergyTarget
            ? ({ "in-range": "ok", low: "low", high: "high", "no-target": "neutral" }[getEnergyTargetStatus(value, patientEnergyTarget)] as DayAnalysisStatus)
            : complianceBadge(value, min, max)
      return [{ definition, value, evaluable, min, max, targetSource, status, derived, energyCorridor: usesPatientEnergyTarget }]
    })
    .sort((a, b) => a.definition.sortOrder - b.definition.sortOrder)

  const attention = nutrients.filter((nutrient) => nutrient.status === "low" || nutrient.status === "high")
  return {
    nutrients,
    hasEntries: entries.length > 0,
    unavailableCount: nutrients.filter((nutrient) => nutrient.status === "unavailable").length,
    attention,
    evaluatedCount: nutrients.filter((nutrient) => nutrient.status === "ok").length,
  }
}
