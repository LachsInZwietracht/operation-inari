import type { DailyMealPlan, Food, NutrientValue, Recipe } from "@/lib/types";
import {
  calculateMealEntryNutrients,
  getBroteinheiten,
  getNutrientValue,
  sumNutrients,
} from "@/lib/nutrients";

export interface PlanTotals {
  /** Same id as the source DailyMealPlan — used as the React key in the table. */
  planId: string;
  date: string;
  title?: string;
  status?: DailyMealPlan["status"];
  /** Total entry count across all slots — surfaced in the picker for empty-plan
   *  detection. Plans with zero entries still appear in stats (as zeros). */
  entryCount: number;
  totals: NutrientValue[];
}

export interface PlanStatRow {
  nutrientId: string;
  /** Ordered values aligned with the plans array supplied to `buildPlanStatistics`. */
  values: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  /**
   * Sample standard deviation (n-1 divisor) when n > 1. Returns 0 for a single
   * plan — there is no spread to describe and using a population SD would
   * silently report 0 in a way that looks meaningful. The chart and table both
   * suppress SD chips when only one plan is selected; this is the data-side
   * mirror of that decision.
   */
  stddev: number;
  /**
   * Coefficient of variation (stddev / mean) — handy for comparing spread
   * across nutrients on very different scales (e.g. kcal vs. mg vitamin D).
   * 0 when the mean is 0 to avoid Infinity/NaN leaks into the UI.
   */
  cv: number;
}

export interface PlanStatistics {
  plans: PlanTotals[];
  rows: PlanStatRow[];
}

/**
 * Computes total daily nutrients for a single plan using the same per-entry
 * resolution as the planner view (food entries scaled per-100g, recipe entries
 * scaled by serving count). Centralized here so the comparison view never
 * drifts from the planner's headline numbers.
 */
export function aggregatePlanNutrients(
  plan: DailyMealPlan,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): NutrientValue[] {
  return sumNutrients(
    plan.slots.flatMap((slot) =>
      slot.entries.map((entry) =>
        calculateMealEntryNutrients(entry, foodMap, recipeMap, foods),
      ),
    ),
  );
}

function countEntries(plan: DailyMealPlan): number {
  return plan.slots.reduce((acc, slot) => acc + slot.entries.length, 0);
}

/**
 * Returns the nutrient amount as displayed by the planner, including the
 * derived Broteinheiten value. Pulling this from one place keeps the
 * comparison column for `broteinheiten` consistent with the rest of the UI
 * (kohlenhydrate / 12) without duplicating the divisor.
 */
function pickNutrientAmount(nutrients: NutrientValue[], nutrientId: string): number {
  if (nutrientId === "broteinheiten") {
    return getBroteinheiten(getNutrientValue(nutrients, "kohlenhydrate"));
  }
  return getNutrientValue(nutrients, nutrientId);
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.reduce(
    (acc, value) => acc + (value - mean) * (value - mean),
    0,
  );
  return Math.sqrt(squaredDiffs / (values.length - 1));
}

/**
 * Builds the dataset that drives the comparison table and bar charts.
 *
 * Plans are reported in input order — callers (typically the picker) decide
 * the visual ordering by sorting before passing them in. Nutrient rows mirror
 * the order of `nutrientIds`, so the same array drives both row layout and
 * the chart's nutrient picker without an extra sort step.
 */
export function buildPlanStatistics(
  plans: DailyMealPlan[],
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
  nutrientIds: readonly string[],
): PlanStatistics {
  const totals: PlanTotals[] = plans.map((plan) => ({
    planId: plan.id,
    date: plan.date,
    title: plan.title,
    status: plan.status,
    entryCount: countEntries(plan),
    totals: aggregatePlanNutrients(plan, foodMap, recipeMap, foods),
  }));

  const rows: PlanStatRow[] = nutrientIds.map((nutrientId) => {
    const values = totals.map((total) => pickNutrientAmount(total.totals, nutrientId));

    if (values.length === 0) {
      return {
        nutrientId,
        values,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stddev: 0,
        cv: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;
    const median = computeMedian(sorted);
    const stddev = computeStdDev(values, mean);
    const cv = mean !== 0 ? stddev / mean : 0;

    return { nutrientId, values, min, max, mean, median, stddev, cv };
  });

  return { plans: totals, rows };
}
