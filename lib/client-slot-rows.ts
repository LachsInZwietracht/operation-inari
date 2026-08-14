import {
  calculateClientLogNutrients,
  clientLogEntryLabel,
  eatenAmount,
  planEntryNutrients,
} from "@/lib/client-food-log";
import { getNutrientValue } from "@/lib/nutrients";
import type {
  ClientFoodLogEntry,
  ClientMealCompletion,
  ClientPlanEntry,
  ClientPlanEntryFacts,
  Food,
  NutrientValue,
} from "@/lib/types";

/**
 * One slot as a single list: what was planned and what was eaten, in order.
 *
 * The plan and the diary used to be two lists stacked in the same card, which
 * reads like homework above a journal. Merging them is a display decision, but
 * one rule in here is not cosmetic: **a replacement takes the place of the row
 * it replaced.**
 *
 * That only works because replacing is explicit. Nothing infers which planned
 * row a logged food stands in for — there is no rule that could choose between
 * two planned items when a third thing is logged, and a wrong guess erases the
 * only thing the plan exists to measure. An entry is a replacement when it says
 * so, and an addition otherwise.
 */

interface PlannedRow {
  kind: "planned";
  key: string;
  planEntryId: string;
  label: string;
  amount: number;
  unit: "g" | "portion";
  kcal?: number;
  isEaten: boolean;
  isSkipped: boolean;
}

interface LoggedRow {
  kind: "logged";
  key: string;
  entry: ClientFoodLogEntry;
  label: string;
  amount: number;
  unit: "g" | "portion";
  kcal?: number;
  /** The planned meal this stands in for, when it was an explicit swap. */
  replacesLabel?: string;
}

export type ClientSlotRow = PlannedRow | LoggedRow;

export function buildSlotRows(input: {
  planEntries: ClientPlanEntry[];
  planFacts: Map<string, ClientPlanEntryFacts>;
  completions: Map<string, ClientMealCompletion>;
  entries: ClientFoodLogEntry[];
  foods: Map<string, Food>;
  recipeFacts?: Map<string, NutrientValue[]>;
  recipeNames?: Map<string, string>;
}): ClientSlotRow[] {
  const rows: ClientSlotRow[] = [];

  const replacementsByPlanEntry = new Map<string, ClientFoodLogEntry>();
  for (const entry of input.entries) {
    if (entry.replacesMealEntryId) replacementsByPlanEntry.set(entry.replacesMealEntryId, entry);
  }

  for (const planEntry of input.planEntries) {
    const facts = input.planFacts.get(planEntry.id);
    const replacement = replacementsByPlanEntry.get(planEntry.id);

    // The swap stands where the plan row stood, so the slot keeps the shape
    // the plan gave it instead of growing a hole and an orphan.
    if (replacement) {
      rows.push(loggedRow(replacement, input, planLabel(planEntry, facts)));
      continue;
    }

    const completion = input.completions.get(planEntry.id);
    const isSkipped = completion?.skipped === true;
    const isEaten = completion !== undefined && !isSkipped;
    const amount = isEaten ? eatenAmount(planEntry, completion) : planEntry.amount;
    const nutrients = planEntryNutrients(facts, amount);

    rows.push({
      kind: "planned",
      key: `plan:${planEntry.id}`,
      planEntryId: planEntry.id,
      label: planLabel(planEntry, facts),
      amount,
      unit: facts?.unit ?? "g",
      kcal: nutrients.length > 0 ? Math.round(getNutrientValue(nutrients, "energie")) : undefined,
      isEaten,
      isSkipped,
    });
  }

  // Everything logged that is not standing in for a planned row is simply
  // something else that was eaten.
  for (const entry of input.entries) {
    if (entry.replacesMealEntryId) continue;
    rows.push(loggedRow(entry, input));
  }

  return rows;
}

function planLabel(entry: ClientPlanEntry, facts?: ClientPlanEntryFacts): string {
  return facts?.label ?? (entry.entryType === "recipe" ? "Rezept" : "Lebensmittel");
}

function loggedRow(
  entry: ClientFoodLogEntry,
  input: {
    foods: Map<string, Food>;
    recipeFacts?: Map<string, NutrientValue[]>;
    recipeNames?: Map<string, string>;
  },
  replacesLabel?: string,
): LoggedRow {
  const nutrients = calculateClientLogNutrients([entry], input.foods, input.recipeFacts);

  return {
    kind: "logged",
    key: `entry:${entry.id}`,
    entry,
    label: clientLogEntryLabel(entry, input.foods, input.recipeNames),
    amount: entry.amount,
    unit: entry.sourceType === "recipe" ? "portion" : "g",
    kcal: nutrients.length > 0 ? Math.round(getNutrientValue(nutrients, "energie")) : undefined,
    replacesLabel,
  };
}
