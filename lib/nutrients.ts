import type { Food, MealEntry, NutrientValue, Recipe } from "@/lib/types";
import { BE_GRAMS_PER_UNIT } from "@/lib/constants";

export const BROTEINHEITEN_NUTRIENT_ID = "broteinheiten";

/**
 * Scales nutrient values from a base amount to a target amount.
 * E.g., scale nutrients from per-100g values to 250g.
 */
export function scaleNutrients(
  nutrients: NutrientValue[],
  baseAmount: number,
  targetAmount: number,
): NutrientValue[] {
  if (baseAmount === 0) return nutrients;
  const factor = targetAmount / baseAmount;
  return nutrients.map((nv) => ({
    nutrientId: nv.nutrientId,
    amount: nv.amount * factor,
  }));
}

/**
 * Sums multiple nutrient value arrays into one combined array.
 * Nutrient IDs present in any input will appear in the output.
 */
export function sumNutrients(nutrientArrays: NutrientValue[][]): NutrientValue[] {
  const totals = new Map<string, number>();

  for (const nutrients of nutrientArrays) {
    for (const nv of nutrients) {
      totals.set(nv.nutrientId, (totals.get(nv.nutrientId) ?? 0) + nv.amount);
    }
  }

  return Array.from(totals.entries()).map(([nutrientId, amount]) => ({
    nutrientId,
    amount,
  }));
}

/**
 * Returns the amount for a specific nutrient, or 0 if not found.
 */
export function getNutrientValue(nutrients: NutrientValue[], nutrientId: string): number {
  return nutrients.find((nv) => nv.nutrientId === nutrientId)?.amount ?? 0;
}

/**
 * Calculates total nutrients for a recipe by summing the scaled
 * nutrient values of all ingredients.
 */
export function calculateRecipeNutrients(recipe: Recipe, foods: Food[]): NutrientValue[] {
  if (!foods || foods.length === 0) return [];
  const foodMap = new Map(foods.map((f) => [f.id, f]));

  const scaledArrays: NutrientValue[][] = [];

  for (const ingredient of recipe.ingredients) {
    const food = foodMap.get(ingredient.foodId);
    if (!food) continue;
    scaledArrays.push(scaleNutrients(food.nutrients, food.baseAmount, ingredient.amount));
  }

  return sumNutrients(scaledArrays);
}

/**
 * Divides all nutrient amounts by the number of servings.
 */
export function calculatePerServing(
  nutrients: NutrientValue[],
  servings: number,
): NutrientValue[] {
  if (servings <= 0) return nutrients;
  return nutrients.map((nv) => ({
    nutrientId: nv.nutrientId,
    amount: nv.amount / servings,
  }));
}

/**
 * Calculates what percentage a value represents of a reference value.
 * Returns 0 if the reference value is 0.
 */
export function percentOfReference(value: number, referenceValue: number): number {
  if (referenceValue === 0) return 0;
  return (value / referenceValue) * 100;
}

/**
 * Derives Broteinheiten (BE) from a carbohydrate amount in grams.
 *
 * BE is a derived display value, not stored in nutrient arrays — keeping it
 * out of `NutrientValue[]` avoids confusing it with ingested BLS/SFK data and
 * lets the divisor stay tunable (DDG default 12 g/BE; some legacy clinics 10).
 */
export function getBroteinheiten(
  carbsInGrams: number,
  gramsPerUnit: number = BE_GRAMS_PER_UNIT,
): number {
  if (gramsPerUnit <= 0) return 0;
  return carbsInGrams / gramsPerUnit;
}

/**
 * Convenience for nutrient arrays. Looks up `kohlenhydrate` and divides by BE.
 */
export function getBroteinheitenFromNutrients(
  nutrients: NutrientValue[],
  gramsPerUnit?: number,
): number {
  return getBroteinheiten(getNutrientValue(nutrients, "kohlenhydrate"), gramsPerUnit);
}

/**
 * Resolves a single meal-plan entry to its nutrient contribution. Food entries
 * scale per-100g BLS data to the entered grams; recipe entries scale the
 * recipe's per-serving totals by the entered serving count.
 */
export function calculateMealEntryNutrients(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): NutrientValue[] {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId);
    if (!food) return [];
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount);
  }

  const recipe = recipeMap.get(entry.referenceId);
  if (!recipe) return [];
  const totalNutrients = calculateRecipeNutrients(recipe, foods);
  const perServing = calculatePerServing(totalNutrients, recipe.servings);
  return scaleNutrients(perServing, 1, entry.amount);
}
