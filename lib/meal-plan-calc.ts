import {
  calculatePerServing,
  calculateRecipeNutrients,
  scaleNutrients,
} from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import type {
  DailyMealPlan,
  Food,
  MealEntry,
  MealSlotType,
  NutrientValue,
  Recipe,
} from "@/lib/types"

export type ComplianceStatus = "ok" | "low" | "high"

/**
 * Energy targets are planning corridors, not a false exact daily cut-off.
 * The same corridor drives the week board and its weekly average.
 */
export const ENERGY_TARGET_TOLERANCE = 0.05

export type EnergyTargetStatus = "in-range" | "low" | "high" | "no-target"

export function getEnergyTargetStatus(
  value: number,
  target?: number,
  tolerance = ENERGY_TARGET_TOLERANCE,
): EnergyTargetStatus {
  if (!(target && target > 0)) return "no-target"
  if (value < target * (1 - tolerance)) return "low"
  if (value > target * (1 + tolerance)) return "high"
  return "in-range"
}

export interface DietLineComplianceItem {
  nutrientId: string
  label: string
  status: ComplianceStatus
  value: number
  unit: string
  min?: number
  max?: number
}

/** Nutrients contributed by a single plan entry (food scaled by grams, recipe by portions). */
export function calculateEntryNutrients(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  foods: Food[],
  recipeMap: Map<string, Recipe>,
): NutrientValue[] {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId)
    if (!food) return []
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
  }

  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return []
  const totalNutrients = calculateRecipeNutrients(recipe, foods)
  const perServing = calculatePerServing(totalNutrients, recipe.servings)
  return scaleNutrients(perServing, 1, entry.amount)
}

/**
 * True only when the loaded source data can support a statement about this
 * nutrient. Missing catalogue fields are different from a measured zero.
 */
export function isMealEntryNutrientEvaluable(
  entry: MealEntry,
  nutrientId: string,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): boolean {
  if (entry.type === "food") {
    return (
      foodMap
        .get(entry.referenceId)
        ?.nutrients.some((value) => value.nutrientId === nutrientId) ?? false
    )
  }

  const recipe = recipeMap.get(entry.referenceId)
  return Boolean(
    recipe?.ingredients.length &&
      recipe.ingredients.every((ingredient) =>
        foodMap
          .get(ingredient.foodId)
          ?.nutrients.some((value) => value.nutrientId === nutrientId),
      ),
  )
}

/** Human-readable label for a plan entry, e.g. "Haferflocken (60 g)". */
export function getEntryLabel(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId)
    if (!food) return "Lebensmittel"
    return `${food.name} (${formatNumber(entry.amount, 0)} g)`
  }
  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return "Rezept"
  const portions = entry.amount === 1 ? "Portion" : "Portionen"
  return `${recipe.name} (${formatNumber(entry.amount, 0)} ${portions})`
}

export function complianceBadge(value: number, min?: number, max?: number): ComplianceStatus {
  if (typeof min === "number" && value < min) return "low"
  if (typeof max === "number" && value > max) return "high"
  return "ok"
}

/** Picks the meal slot an optimization suggestion should target. */
export function chooseOptimizationSlot(nutrientId: string, plan: DailyMealPlan): MealSlotType {
  const openCoreSlot = plan.slots.find(
    (slot) =>
      ["mittagessen", "abendessen", "fruehstueck"].includes(slot.type) &&
      slot.entries.length === 0,
  )?.type

  if (openCoreSlot) return openCoreSlot
  if (["energie", "eiweiss", "fett", "kohlenhydrate"].includes(nutrientId)) return "mittagessen"
  if (["ballaststoffe", "vitamin_c", "calcium", "magnesium"].includes(nutrientId)) return "snack_nachmittag"
  return "abendessen"
}
