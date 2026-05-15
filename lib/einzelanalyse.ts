import type {
  DailyMealPlan,
  Food,
  MealEntry,
  MealSlotType,
  NutrientValue,
  Recipe,
} from "@/lib/types";
import {
  calculateMealEntryNutrients,
  getBroteinheiten,
  getNutrientValue,
} from "@/lib/nutrients";

export interface EinzelanalyseCell {
  /** Raw absolute amount in the nutrient's natural unit, prior to per-kg normalization. */
  absolute: number;
  /** Value the table should display — equals `absolute` unless a per-kg divisor is applied. */
  displayValue: number;
  /** Share of the column total (0–100). Falls back to 0 when the column total is 0. */
  percentOfTotal: number;
}

export interface EinzelanalyseRow {
  entryId: string;
  entryType: MealEntry["type"];
  /** Slot the entry belongs to — used for grouping/header rendering. */
  slot: MealSlotType;
  /** Display label, e.g. "Haferflocken (60 g)" or "Linsensuppe (1 Portion)". */
  label: string;
  /** Per-nutrient cells, keyed by the nutrientId supplied to the builder. */
  cells: Record<string, EinzelanalyseCell>;
}

export interface EinzelanalyseColumn {
  nutrientId: string;
  /** Sum across all rows in the natural unit. */
  total: number;
  /** Largest single-entry contribution — used to highlight the dominant food per nutrient. */
  maxAbsolute: number;
  /** ID of the row holding `maxAbsolute`, or null when the table is empty. */
  topEntryId: string | null;
}

export interface EinzelanalyseTable {
  rows: EinzelanalyseRow[];
  columns: EinzelanalyseColumn[];
  /** True when a per-kg divisor was applied (i.e. `perKgBodyWeight` was provided and > 0). */
  perKgApplied: boolean;
}

interface BuildOptions {
  /**
   * When provided and > 0, every cell's `displayValue` is divided by this weight.
   * Percentages still derive from `absolute`, so column shares are not distorted.
   */
  perKgBodyWeight?: number;
  /**
   * Custom label resolver. Defaults to "Name (amount g|Portion(en))". Supplying a
   * resolver lets callers swap in localized formatters without coupling this
   * module to a UI format library.
   */
  resolveLabel?: (entry: MealEntry, food?: Food, recipe?: Recipe) => string;
}

function defaultLabel(entry: MealEntry, food?: Food, recipe?: Recipe): string {
  if (entry.type === "food") {
    if (!food) return "Lebensmittel";
    return `${food.name} (${Math.round(entry.amount)} g)`;
  }
  if (!recipe) return "Rezept";
  const portionLabel = entry.amount === 1 ? "Portion" : "Portionen";
  return `${recipe.name} (${Math.round(entry.amount)} ${portionLabel})`;
}

/**
 * Returns a single nutrient amount for an entry, resolving the derived
 * `broteinheiten` virtual nutrient (kohlenhydrate / 12) consistently with the
 * rest of the plan UI.
 */
function pickNutrientAmount(nutrients: NutrientValue[], nutrientId: string): number {
  if (nutrientId === "broteinheiten") {
    return getBroteinheiten(getNutrientValue(nutrients, "kohlenhydrate"));
  }
  return getNutrientValue(nutrients, nutrientId);
}

/**
 * Builds the per-entry contribution table that powers the Einzelanalyse view.
 *
 * Rows mirror the order entries appear in the plan (slot order, then entry
 * order within each slot). Columns mirror the order of `nutrientIds`, so the
 * caller controls visual layout. Both `absolute` and `percentOfTotal` are
 * computed from the un-normalized values — only `displayValue` is affected by
 * `perKgBodyWeight`. This keeps the % share view stable when the toggle flips.
 */
export function buildEinzelanalyseTable(
  plan: DailyMealPlan,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
  nutrientIds: string[],
  options: BuildOptions = {},
): EinzelanalyseTable {
  const labelFn = options.resolveLabel ?? defaultLabel;
  const perKg =
    typeof options.perKgBodyWeight === "number" && options.perKgBodyWeight > 0
      ? options.perKgBodyWeight
      : undefined;

  const rowDrafts: Array<{
    row: Omit<EinzelanalyseRow, "cells">;
    nutrients: NutrientValue[];
  }> = [];

  for (const slot of plan.slots) {
    for (const entry of slot.entries) {
      const food = entry.type === "food" ? foodMap.get(entry.referenceId) : undefined;
      const recipe = entry.type === "recipe" ? recipeMap.get(entry.referenceId) : undefined;
      rowDrafts.push({
        row: {
          entryId: entry.id,
          entryType: entry.type,
          slot: slot.type,
          label: labelFn(entry, food, recipe),
        },
        nutrients: calculateMealEntryNutrients(entry, foodMap, recipeMap, foods),
      });
    }
  }

  const columns: EinzelanalyseColumn[] = nutrientIds.map((nutrientId) => ({
    nutrientId,
    total: 0,
    maxAbsolute: 0,
    topEntryId: null,
  }));

  // First pass — column totals + leader detection from absolute values.
  for (const { row, nutrients } of rowDrafts) {
    for (const column of columns) {
      const amount = pickNutrientAmount(nutrients, column.nutrientId);
      column.total += amount;
      if (amount > column.maxAbsolute) {
        column.maxAbsolute = amount;
        column.topEntryId = row.entryId;
      }
    }
  }

  // Second pass — fill cell values using the now-known column totals.
  const rows: EinzelanalyseRow[] = rowDrafts.map(({ row, nutrients }) => {
    const cells: Record<string, EinzelanalyseCell> = {};
    for (const column of columns) {
      const absolute = pickNutrientAmount(nutrients, column.nutrientId);
      const displayValue = perKg ? absolute / perKg : absolute;
      const percentOfTotal = column.total > 0 ? (absolute / column.total) * 100 : 0;
      cells[column.nutrientId] = { absolute, displayValue, percentOfTotal };
    }
    return { ...row, cells };
  });

  return { rows, columns, perKgApplied: perKg !== undefined };
}
