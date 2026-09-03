import { calculateEntryNutrients, isMealEntryNutrientEvaluable } from "@/lib/meal-plan-calc";
import { getMealPlanTemplateBlocks, getMealPlanTemplateSpanDays } from "@/lib/meal-plan-template-utils";
import { getNutrientValue, sumNutrients } from "@/lib/nutrients";
import type { Food, MealPlanTemplate, Recipe } from "@/lib/types";

// Matches the nutrients hydrated by the template overview. A missing source
// value must not become a seemingly complete comparison total.
export const TEMPLATE_COMPARISON_NUTRIENTS = [
  { id: "energie", label: "Energie", unit: "kcal" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
  { id: "ballaststoffe", label: "Ballaststoffe", unit: "g" },
  { id: "zucker", label: "Zucker", unit: "g" },
  { id: "natrium", label: "Natrium", unit: "mg" },
] as const;

export function summarizeTemplateForComparison(
  template: MealPlanTemplate,
  foods: Food[],
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
) {
  const days = getMealPlanTemplateBlocks(template);
  const entries = days.flatMap((day) => day.slots.flatMap((slot) => slot.entries));
  const filledDays = days.filter((day) => day.slots.some((slot) => slot.entries.length > 0)).length;
  const spanDays = getMealPlanTemplateSpanDays(template);
  const totals = sumNutrients(entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)));
  const nutrients = new Map<string, number | null>();

  for (const { id } of TEMPLATE_COMPARISON_NUTRIENTS) {
    const amount = getNutrientValue(totals, id);
    const evaluable = entries.length > 0 && Number.isFinite(amount) && entries.every((entry) =>
      isMealEntryNutrientEvaluable(entry, id, foodMap, recipeMap),
    );
    nutrients.set(id, evaluable ? amount : null);
  }

  return { template, days, spanDays, filledDays, emptyDays: spanDays - filledDays, entryCount: entries.length, nutrients };
}

export type TemplateComparisonSummary = ReturnType<typeof summarizeTemplateForComparison>;

export function templateComparisonValue(
  summary: TemplateComparisonSummary,
  nutrientId: string,
  basis: "average" | "total",
): number | null {
  const total = summary.nutrients.get(nutrientId);
  if (total == null || summary.filledDays === 0) return null;
  return basis === "average" ? total / summary.filledDays : total;
}
