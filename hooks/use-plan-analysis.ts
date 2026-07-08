"use client"

import { useCallback, useMemo } from "react"

import type { WeekBoardTarget } from "@/components/meal-plan-week-board"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import { checkAllergenConflicts } from "@/lib/allergen-warnings"
import { summarizePlanAllergenConflicts } from "@/lib/allergen-warnings"
import { MEAL_SLOT_TARGET_FRACTIONS } from "@/lib/constants"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { REFERENCE_VALUES } from "@/lib/mock-data/reference-values"
import {
  calculateEntryNutrients,
  chooseOptimizationSlot,
  complianceBadge,
  type DietLineComplianceItem,
} from "@/lib/meal-plan-calc"
import {
  calculatePerServing,
  calculateRecipeNutrients,
  getBroteinheiten,
  getNutrientValue,
  scaleNutrients,
  sumNutrients,
} from "@/lib/nutrients"
import { evaluatePlanSustainability } from "@/lib/sustainability"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  MealSlotType,
  NutrientValue,
  Patient,
  PatientAllergenEntry,
  Recipe,
} from "@/lib/types"

export interface OptimizationSuggestion {
  id: string
  type: "food" | "recipe"
  referenceId: string
  name: string
  slotType: MealSlotType
  amount: number
  nutrientId: string
  targetLabel: string
  unit: string
  deficit: number
  contribution: number
  allergens?: string[]
}

interface UsePlanAnalysisOptions {
  plan: DailyMealPlan
  foods: Food[]
  foodMap: Map<string, Food>
  recipes: Recipe[]
  recipeMap: Map<string, Recipe>
  dietLine?: DietLinePreset
  patientAllergens: PatientAllergenEntry[]
  patientId?: string
  patient?: Patient
}

/**
 * The planner's analytical core: derives nutrient totals, target/DGE
 * compliance, allergen conflicts, clinical release review, sustainability
 * and optimization suggestions from the current day plan.
 */
export function usePlanAnalysis({
  plan,
  foods,
  foodMap,
  recipes,
  recipeMap,
  dietLine,
  patientAllergens,
  patientId,
  patient,
}: UsePlanAnalysisOptions) {
  const planAllergenSummary = useMemo(
    () => summarizePlanAllergenConflicts(plan, patientAllergens, foodMap, recipeMap),
    [plan, foodMap, recipeMap, patientAllergens],
  )

  const entryAllergenWarnings = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [entryId, warnings] of planAllergenSummary.byEntry) {
      map.set(entryId, warnings.map((warning) => warning.allergenLabel))
    }
    return map
  }, [planAllergenSummary])

  const dailyNutrients = useMemo(() => {
    const allEntryNutrients: NutrientValue[][] = []
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        allEntryNutrients.push(calculateEntryNutrients(entry, foodMap, foods, recipeMap))
      }
    }
    return sumNutrients(allEntryNutrients)
  }, [plan, foodMap, foods, recipeMap])

  const totalKcal = getNutrientValue(dailyNutrients, "energie")
  const totalProtein = getNutrientValue(dailyNutrients, "eiweiss")
  const totalFat = getNutrientValue(dailyNutrients, "fett")
  const totalCarbs = getNutrientValue(dailyNutrients, "kohlenhydrate")
  const totalBE = getBroteinheiten(totalCarbs)

  const planSustainability = useMemo(
    () => evaluatePlanSustainability(plan, foods, recipes),
    [plan, foods, recipes],
  )

  const { getResolvedConfig, officialRows, customProfiles, userPreference, patientAssignments } =
    useReferenceProfiles()
  // `getResolvedConfig` is a stable callback that reads the reference store at
  // call time, so it never changes identity when the store's rows load
  // asynchronously. Depend on the store snapshots directly so this memo
  // re-resolves once the DGE rows / profiles / assignments arrive — otherwise
  // an empty first-render resolve would freeze and the micronutrient targets
  // (which are driven entirely by these reference values) would go missing.
  const refConfig = useMemo(
    () =>
      getResolvedConfig({
        patientId,
        dateOfBirth: patient?.dateOfBirth ?? "1990-01-01",
        gender: patient?.gender ?? "w",
      }),
    // getResolvedConfig reads these store snapshots internally, so they must
    // stay in the dep list for the resolve to refresh when the reference data
    // loads asynchronously — the linter can't see that call-time read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      getResolvedConfig,
      officialRows,
      customProfiles,
      userPreference,
      patientAssignments,
      patient?.dateOfBirth,
      patient?.gender,
      patientId,
    ],
  )

  const referenceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of refConfig.values) {
      map.set(v.nutrientId, v.amount)
    }
    return map
  }, [refConfig.values])

  const nutrientDefMap = useMemo(() => {
    return new Map(NUTRIENT_DEFINITIONS.map((nd) => [nd.id, nd]))
  }, [])

  const slotCompliance = useMemo(() => {
    const map = {} as Record<MealSlotType, { label: string; status: "ok" | "low" | "high" }[]>
    if (!dietLine) return map

    // Per-slot evaluation only fires for macronutrient targets. Vitamin /
    // mineral targets are daily-aggregate by clinical convention and would
    // produce noise when scaled to a single meal.
    const macroTargets = dietLine.targets.filter((target) => {
      const definition = nutrientDefMap.get(target.nutrientId)
      return definition?.group === "makronaehrstoffe"
    })

    if (macroTargets.length === 0) return map

    for (const slot of plan.slots) {
      if (slot.entries.length === 0) {
        map[slot.type] = []
        continue
      }

      const fraction = MEAL_SLOT_TARGET_FRACTIONS[slot.type] ?? 1 / (plan.slots.length || 1)
      const summed = sumNutrients(
        slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
      )

      map[slot.type] = macroTargets.map((target) => {
        const value =
          target.nutrientId === "broteinheiten"
            ? getBroteinheiten(getNutrientValue(summed, "kohlenhydrate"))
            : getNutrientValue(summed, target.nutrientId)
        const perSlotMin = typeof target.min === "number" ? target.min * fraction : undefined
        const perSlotMax = typeof target.max === "number" ? target.max * fraction : undefined
        return {
          label: target.label,
          status: complianceBadge(value, perSlotMin, perSlotMax),
        }
      })
    }

    return map
  }, [plan.slots, dietLine, foodMap, foods, nutrientDefMap, recipeMap])

  const dietLineCompliance = useMemo(() => {
    if (!dietLine) return [] as DietLineComplianceItem[]

    return dietLine.targets.map((target) => {
      const value =
        target.nutrientId === "broteinheiten"
          ? getBroteinheiten(getNutrientValue(dailyNutrients, "kohlenhydrate"))
          : getNutrientValue(dailyNutrients, target.nutrientId)
      return {
        nutrientId: target.nutrientId,
        label: target.label,
        status: complianceBadge(value, target.min, target.max),
        value,
        unit: target.unit,
        min: target.min,
        max: target.max,
      }
    })
  }, [dailyNutrients, dietLine])

  // The Tagesziele glance/detail grid only shows the energy-yielding macros.
  // Ballaststoffe and any minerals carried on the diet line (e.g. Natrium)
  // are surfaced with the micronutrient coverage instead.
  const isDockMacro = useCallback(
    (nutrientId: string) =>
      nutrientDefMap.get(nutrientId)?.group === "makronaehrstoffe" &&
      nutrientId !== "ballaststoffe",
    [nutrientDefMap],
  )

  const dietLineMacros = useMemo(
    () => dietLineCompliance.filter((target) => isDockMacro(target.nutrientId)),
    [dietLineCompliance, isDockMacro],
  )

  // Micronutrient reference amounts, with a guaranteed non-empty source. The
  // resolved profile is preferred, but it comes back empty whenever the patient
  // resolves to a demographic the bundled reference rows don't cover (e.g. an
  // uncovered age group or standard). In that case fall back to the standard
  // adult DGE values (gender-matched) so the micronutrient coverage never
  // collapses to just the diet-line entries.
  const microReferenceValues = useMemo(() => {
    const hasResolvedMicros = refConfig.values.some((ref) => {
      const definition = nutrientDefMap.get(ref.nutrientId)
      return (
        definition?.group === "vitamine" ||
        definition?.group === "mineralstoffe" ||
        ref.nutrientId === "ballaststoffe"
      )
    })
    if (hasResolvedMicros) return refConfig.values
    return REFERENCE_VALUES.filter((ref) => ref.gender === refConfig.gender).map((ref) => ({
      nutrientId: ref.nutrientId,
      amount: ref.amount,
    }))
  }, [refConfig.values, refConfig.gender, nutrientDefMap])

  // Vitamin / mineral coverage against the patient's resolved DGE reference
  // values — the daily-aggregate micronutrient half of the Tagesziele. Non-macro
  // targets tracked directly on the diet line (Natrium, Ballaststoffe, …) lead
  // the list; the rest is driven by the reference profile so it adapts to the
  // patient and lists every micronutrient we have a reference for.
  const micronutrientCompliance = useMemo(() => {
    const shownIds = new Set(dietLine?.targets.map((target) => target.nutrientId) ?? [])
    const items: DietLineComplianceItem[] = dietLineCompliance.filter(
      (target) => !isDockMacro(target.nutrientId),
    )

    for (const ref of microReferenceValues) {
      if (shownIds.has(ref.nutrientId) || !(ref.amount > 0)) continue
      const definition = nutrientDefMap.get(ref.nutrientId)
      if (!definition) continue
      const isMicro =
        definition.group === "vitamine" ||
        definition.group === "mineralstoffe" ||
        ref.nutrientId === "ballaststoffe"
      if (!isMicro) continue

      const value = getNutrientValue(dailyNutrients, ref.nutrientId)
      items.push({
        nutrientId: ref.nutrientId,
        label: definition.name,
        status: complianceBadge(value, ref.amount, undefined),
        value,
        unit: definition.unit,
        min: ref.amount,
        max: undefined,
      })
    }

    items.sort(
      (a, b) =>
        (nutrientDefMap.get(a.nutrientId)?.sortOrder ?? 0) -
        (nutrientDefMap.get(b.nutrientId)?.sortOrder ?? 0),
    )
    return items
  }, [microReferenceValues, dietLine, dietLineCompliance, isDockMacro, nutrientDefMap, dailyNutrients])

  const energyTargetValue = useMemo(() => {
    const target = dietLine?.targets.find((item) => item.nutrientId === "energie")
    return target?.min ?? target?.max
  }, [dietLine])

  const weekBoardTargets = useMemo<WeekBoardTarget[]>(() => {
    return dietLineCompliance
      .filter((target) => target.nutrientId !== "energie")
      .slice(0, 6)
      .map((target) => ({
        nutrientId: target.nutrientId,
        label: target.label,
        value: target.value,
        target: target.min ?? target.max,
        unit: target.unit,
        status: target.status,
      }))
  }, [dietLineCompliance])

  const optimizationSuggestions = useMemo(() => {
    if (!dietLine) return [] as OptimizationSuggestion[]

    const existingKeys = new Set(
      plan.slots.flatMap((slot) =>
        slot.entries.map((entry) => `${entry.type}:${entry.referenceId}`),
      ),
    )

    const rankedSuggestions = dietLineCompliance
      .filter((target) => target.status === "low" && typeof target.min === "number")
      .flatMap((target) => {
        const deficit = Math.max(0, (target.min ?? 0) - target.value)
        if (deficit <= 0) return [] as OptimizationSuggestion[]

        const slotType = chooseOptimizationSlot(target.nutrientId, plan)
        // BE is a derived display nutrient — a food's BE contribution = its
        // carb contribution / 12. Translate the lookup so suggestions still
        // rank correctly if a custom preset ever defines a BE minimum.
        const lookupNutrientId =
          target.nutrientId === "broteinheiten" ? "kohlenhydrate" : target.nutrientId
        const projectContribution = (raw: number) =>
          target.nutrientId === "broteinheiten" ? getBroteinheiten(raw) : raw
        const foodSuggestions = foods
          .filter((food) => !existingKeys.has(`food:${food.id}`) && food.nutrients.length > 0)
          .map((food) => {
            const contribution = projectContribution(
              getNutrientValue(
                scaleNutrients(food.nutrients, food.baseAmount, 100),
                lookupNutrientId,
              ),
            )
            const severeConflict =
              patientAllergens.length > 0 && food.allergens?.length
                ? checkAllergenConflicts(food.allergens, patientAllergens).some((warning) => warning.severity === "severe")
                : false
            return {
              id: `food-${target.nutrientId}-${food.id}`,
              type: "food" as const,
              referenceId: food.id,
              name: food.name,
              slotType,
              amount: 100,
              nutrientId: target.nutrientId,
              targetLabel: target.label,
              unit: target.unit,
              deficit,
              contribution,
              allergens: food.allergens,
              severeConflict,
            }
          })

        const recipeSuggestions = recipes
          .filter((recipe) => !existingKeys.has(`recipe:${recipe.id}`))
          .map((recipe) => {
            const perServing = calculatePerServing(calculateRecipeNutrients(recipe, foods), recipe.servings)
            const contribution = projectContribution(getNutrientValue(perServing, lookupNutrientId))
            const severeConflict =
              patientAllergens.length > 0 && recipe.allergens?.length
                ? checkAllergenConflicts(recipe.allergens, patientAllergens).some((warning) => warning.severity === "severe")
                : false
            return {
              id: `recipe-${target.nutrientId}-${recipe.id}`,
              type: "recipe" as const,
              referenceId: recipe.id,
              name: recipe.name,
              slotType,
              amount: 1,
              nutrientId: target.nutrientId,
              targetLabel: target.label,
              unit: target.unit,
              deficit,
              contribution,
              allergens: recipe.allergens,
              severeConflict,
            }
          })

        return [...foodSuggestions, ...recipeSuggestions]
          .filter((suggestion) => suggestion.contribution > 0 && !suggestion.severeConflict)
          .sort((a, b) => {
            const aCoverage = Math.min(a.contribution, a.deficit) / a.deficit
            const bCoverage = Math.min(b.contribution, b.deficit) / b.deficit
            return bCoverage - aCoverage
          })
          .slice(0, 2)
      })
      .sort((a, b) => b.deficit - a.deficit)

    const seenSuggestions = new Set<string>()
    return rankedSuggestions
      .filter((suggestion) => {
        const key = `${suggestion.type}:${suggestion.referenceId}`
        if (seenSuggestions.has(key)) return false
        seenSuggestions.add(key)
        return true
      })
      .slice(0, 4)
  }, [plan, dietLine, dietLineCompliance, foods, patientAllergens, recipes])

  return {
    planAllergenSummary,
    entryAllergenWarnings,
    dailyNutrients,
    totalKcal,
    totalProtein,
    totalFat,
    totalCarbs,
    totalBE,
    planSustainability,
    refConfig,
    referenceMap,
    nutrientDefMap,
    slotCompliance,
    dietLineCompliance,
    dietLineMacros,
    micronutrientCompliance,
    energyTargetValue,
    weekBoardTargets,
    optimizationSuggestions,
  }
}
