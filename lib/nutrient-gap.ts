import { checkAllergenConflicts, type AllergenWarning } from "@/lib/allergen-warnings"
import { getNutrientValue, scaleNutrients } from "@/lib/nutrients"
import type { Food, PatientAllergenEntry } from "@/lib/types"

/** Secondary condition evaluated at the computed portion, not per 100 g. */
export interface NutrientGapConstraint {
  id: string
  nutrientId: string
  /** "max" = portion must stay at or below `amount`, "min" = reach at least `amount`. */
  bound: "max" | "min"
  amount: number
  /** Hard constraints exclude a food, soft ones only lower its score. */
  mode: "hard" | "soft"
}

export interface NutrientGapConstraintResult {
  constraint: NutrientGapConstraint
  /** Amount of the constraint nutrient contained in the suggested portion. */
  value: number
  violated: boolean
}

export interface NutrientGapSuggestion {
  food: Food
  /** Suggested portion in grams (rounded; identical to the amount added to the plan). */
  grams: number
  /** Amount of the target nutrient in the suggested portion. */
  covered: number
  /** covered / gap; 1 in research mode (no gap amount given). */
  coverage: number
  /** True when the realistic portion cap kept the portion from closing the gap. */
  capped: boolean
  densityPer100g: number
  /** Energy (kcal) added by the suggested portion. */
  kcal: number
  constraintResults: NutrientGapConstraintResult[]
  score: number
  /** Non-severe allergen conflicts; severe ones exclude the food entirely. */
  allergenWarnings: AllergenWarning[]
}

export interface NutrientGapParams {
  nutrientId: string
  /** Missing amount in the nutrient's canonical unit; null = pure research mode. */
  gapAmount: number | null
  constraints: NutrientGapConstraint[]
  patientAllergens: PatientAllergenEntry[]
}

const CAP_MIN_GRAMS = 20
const CAP_MAX_GRAMS = 400
const RESEARCH_PORTION_GRAMS = 100
const SOFT_PENALTY_WEIGHT = 0.35

/**
 * Realistic upper bound for a single portion so nutrient-dense but
 * implausible foods (dried spices, seaweed, …) don't dominate the ranking.
 * Curated portions win; otherwise energy density is a rough proxy for how
 * much of a food anyone actually eats at once.
 */
export function getPortionCap(food: Food): number {
  const portionMax = food.portionSizes?.length
    ? Math.max(...food.portionSizes.map((portion) => portion.amount))
    : 0
  if (portionMax > 0) {
    return Math.min(Math.max(portionMax, CAP_MIN_GRAMS), CAP_MAX_GRAMS)
  }

  const kcalPer100g = getNutrientValue(
    scaleNutrients(food.nutrients, food.baseAmount, 100),
    "energie",
  )
  if (kcalPer100g > 400) return 50
  if (kcalPer100g > 250) return 100
  if (kcalPer100g > 120) return 200
  return 300
}

/** Rounds a portion to kitchen-friendly gram steps. */
function roundGrams(grams: number): number {
  if (grams < 10) return Math.max(1, Math.round(grams))
  if (grams <= 100) return Math.round(grams / 5) * 5
  return Math.round(grams / 10) * 10
}

/**
 * Ranks candidate foods by how well a realistic portion closes the given
 * nutrient gap. Pure function: server-side candidate narrowing and fetching
 * happen elsewhere; this only does deterministic portion math.
 */
export function computeGapSuggestions(
  candidates: Food[],
  params: NutrientGapParams,
): NutrientGapSuggestion[] {
  const { nutrientId, gapAmount, constraints, patientAllergens } = params
  const suggestions: NutrientGapSuggestion[] = []

  for (const food of candidates) {
    const per100g = scaleNutrients(food.nutrients, food.baseAmount, 100)
    const density = getNutrientValue(per100g, nutrientId)
    // Sparse nutrient table: no row means no data — skip instead of ranking at 0.
    if (density <= 0) continue

    const allergenConflicts = checkAllergenConflicts(food.allergens ?? [], patientAllergens)
    if (allergenConflicts.some((warning) => warning.severity === "severe")) continue

    const cap = getPortionCap(food)
    const rawGrams = gapAmount != null ? (gapAmount / density) * 100 : RESEARCH_PORTION_GRAMS
    const capped = rawGrams > cap
    const grams = Math.max(1, Math.min(roundGrams(Math.min(rawGrams, cap)), cap))

    // Everything downstream uses the rounded portion so display and add-amount match.
    const portionNutrients = scaleNutrients(food.nutrients, food.baseAmount, grams)
    const covered = (density * grams) / 100
    const coverage = gapAmount != null && gapAmount > 0 ? covered / gapAmount : 1

    let softPenalty = 0
    let hardViolation = false
    const constraintResults: NutrientGapConstraintResult[] = []

    for (const constraint of constraints) {
      const value = getNutrientValue(portionNutrients, constraint.nutrientId)
      const violated =
        constraint.bound === "max" ? value > constraint.amount : value < constraint.amount
      constraintResults.push({ constraint, value, violated })

      if (!violated) continue
      if (constraint.mode === "hard") {
        hardViolation = true
        break
      }
      const reference = Math.max(Math.abs(constraint.amount), 1e-6)
      softPenalty +=
        SOFT_PENALTY_WEIGHT * Math.min(1, Math.abs(value - constraint.amount) / reference)
    }

    if (hardViolation) continue

    suggestions.push({
      food,
      grams,
      covered,
      coverage,
      capped,
      densityPer100g: density,
      kcal: getNutrientValue(portionNutrients, "energie"),
      constraintResults,
      score: Math.min(coverage, 1) - softPenalty,
      allergenWarnings: allergenConflicts,
    })
  }

  return suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      a.grams - b.grams ||
      a.food.name.localeCompare(b.food.name, "de"),
  )
}
