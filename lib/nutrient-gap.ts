import { checkAllergenConflicts, type AllergenWarning } from "@/lib/allergen-warnings"
import {
  calculatePerServing,
  calculateRecipeNutrients,
  getNutrientValue,
  scaleNutrients,
} from "@/lib/nutrients"
import type { Food, NutrientValue, PatientAllergenEntry, Recipe } from "@/lib/types"

/** Secondary condition evaluated at the computed portion, not per 100 g. */
export interface NutrientGapConstraint {
  id: string
  nutrientId: string
  /** "max" = portion must stay at or below `amount`, "min" = reach at least `amount`. */
  bound: "max" | "min"
  amount: number
  /** Hard constraints exclude an item, soft ones only lower its score. */
  mode: "hard" | "soft"
}

export interface NutrientGapConstraintResult {
  constraint: NutrientGapConstraint
  /** Amount of the constraint nutrient contained in the suggested portion. */
  value: number
  violated: boolean
}

export interface NutrientGapSuggestion {
  type: "food" | "recipe"
  referenceId: string
  name: string
  /** Suggested portion: grams for foods, servings for recipes. */
  amount: number
  /** Amount of the target nutrient in the suggested portion. */
  covered: number
  /** covered / gap; 1 in research mode (no gap amount given). */
  coverage: number
  /** True when the realistic portion cap kept the portion from closing the gap. */
  capped: boolean
  /** Target nutrient per 100 g (foods) or per serving (recipes). */
  density: number
  /** Energy (kcal) added by the suggested portion. */
  kcal: number
  constraintResults: NutrientGapConstraintResult[]
  score: number
  /** Non-severe allergen conflicts; severe ones exclude the item entirely. */
  allergenWarnings: AllergenWarning[]
  /** Raw allergen strings, forwarded to the guarded add workflow. */
  allergens?: string[]
}

export interface NutrientGapParams {
  nutrientId: string
  /** Missing amount in the nutrient's canonical unit; null = pure research mode. */
  gapAmount: number | null
  constraints: NutrientGapConstraint[]
  patientAllergens: PatientAllergenEntry[]
}

export type NutrientGapSortMode = "score" | "kcal" | "coverage"

const CAP_MIN_GRAMS = 20
const CAP_MAX_GRAMS = 400
const RESEARCH_PORTION_GRAMS = 100
const MAX_RECIPE_SERVINGS = 2
const MIN_RECIPE_SERVINGS = 0.5
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
 * Evaluates the shared tail of both candidate kinds: severe-allergen
 * exclusion, constraints at the computed portion, and the final score.
 * Returns null when the candidate must be excluded.
 */
function finishSuggestion(
  base: Pick<NutrientGapSuggestion, "type" | "referenceId" | "name" | "allergens">,
  amount: number,
  capped: boolean,
  density: number,
  covered: number,
  coverage: number,
  portionNutrients: NutrientValue[],
  params: NutrientGapParams,
): NutrientGapSuggestion | null {
  const allergenConflicts = checkAllergenConflicts(
    base.allergens ?? [],
    params.patientAllergens,
  )
  if (allergenConflicts.some((warning) => warning.severity === "severe")) return null

  let softPenalty = 0
  const constraintResults: NutrientGapConstraintResult[] = []

  for (const constraint of params.constraints) {
    const value = getNutrientValue(portionNutrients, constraint.nutrientId)
    const violated =
      constraint.bound === "max" ? value > constraint.amount : value < constraint.amount
    constraintResults.push({ constraint, value, violated })

    if (!violated) continue
    if (constraint.mode === "hard") return null
    const reference = Math.max(Math.abs(constraint.amount), 1e-6)
    softPenalty +=
      SOFT_PENALTY_WEIGHT * Math.min(1, Math.abs(value - constraint.amount) / reference)
  }

  return {
    ...base,
    amount,
    covered,
    coverage,
    capped,
    density,
    kcal: getNutrientValue(portionNutrients, "energie"),
    constraintResults,
    score: Math.min(coverage, 1) - softPenalty,
    allergenWarnings: allergenConflicts,
  }
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
  const { nutrientId, gapAmount } = params
  const suggestions: NutrientGapSuggestion[] = []

  for (const food of candidates) {
    const per100g = scaleNutrients(food.nutrients, food.baseAmount, 100)
    const density = getNutrientValue(per100g, nutrientId)
    // Sparse nutrient table: no row means no data — skip instead of ranking at 0.
    if (density <= 0) continue

    const cap = getPortionCap(food)
    const rawGrams = gapAmount != null ? (gapAmount / density) * 100 : RESEARCH_PORTION_GRAMS
    const capped = rawGrams > cap
    const grams = Math.max(1, Math.min(roundGrams(Math.min(rawGrams, cap)), cap))

    // Everything downstream uses the rounded portion so display and add-amount match.
    const suggestion = finishSuggestion(
      { type: "food", referenceId: food.id, name: food.name, allergens: food.allergens },
      grams,
      capped,
      density,
      (density * grams) / 100,
      gapAmount != null && gapAmount > 0 ? (density * grams) / 100 / gapAmount : 1,
      scaleNutrients(food.nutrients, food.baseAmount, grams),
      params,
    )
    if (suggestion) suggestions.push(suggestion)
  }

  return sortGapSuggestions(suggestions, "score")
}

/**
 * Ranks recipes from the loaded library by per-serving contribution. Recipe
 * portions are servings (matching MealEntry semantics), rounded to half
 * servings and capped at a realistic count per meal. Ingredient foods that
 * are not hydrated are skipped by `calculateRecipeNutrients`, mirroring the
 * optimizer's behavior.
 */
export function computeRecipeGapSuggestions(
  recipes: Recipe[],
  foods: Food[],
  params: NutrientGapParams,
): NutrientGapSuggestion[] {
  const { nutrientId, gapAmount } = params
  const suggestions: NutrientGapSuggestion[] = []

  for (const recipe of recipes) {
    const perServing = calculatePerServing(
      calculateRecipeNutrients(recipe, foods),
      recipe.servings,
    )
    const density = getNutrientValue(perServing, nutrientId)
    if (density <= 0) continue

    const rawServings = gapAmount != null ? gapAmount / density : 1
    const capped = rawServings > MAX_RECIPE_SERVINGS
    const servings = Math.min(
      Math.max(Math.round(Math.min(rawServings, MAX_RECIPE_SERVINGS) * 2) / 2, MIN_RECIPE_SERVINGS),
      MAX_RECIPE_SERVINGS,
    )

    const suggestion = finishSuggestion(
      { type: "recipe", referenceId: recipe.id, name: recipe.name, allergens: recipe.allergens },
      servings,
      capped,
      density,
      density * servings,
      gapAmount != null && gapAmount > 0 ? (density * servings) / gapAmount : 1,
      scaleNutrients(perServing, 1, servings),
      params,
    )
    if (suggestion) suggestions.push(suggestion)
  }

  return sortGapSuggestions(suggestions, "score")
}

/**
 * Orders mixed food/recipe suggestions. Grams and servings are not
 * comparable, so ties break on added energy (fewer calories first) instead
 * of portion size.
 */
export function sortGapSuggestions(
  suggestions: NutrientGapSuggestion[],
  mode: NutrientGapSortMode,
): NutrientGapSuggestion[] {
  const byName = (a: NutrientGapSuggestion, b: NutrientGapSuggestion) =>
    a.name.localeCompare(b.name, "de")

  return [...suggestions].sort((a, b) => {
    switch (mode) {
      case "kcal":
        return a.kcal - b.kcal || b.score - a.score || byName(a, b)
      case "coverage":
        return b.coverage - a.coverage || a.kcal - b.kcal || byName(a, b)
      default:
        return b.score - a.score || a.kcal - b.kcal || byName(a, b)
    }
  })
}
