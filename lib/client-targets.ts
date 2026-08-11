import { findMacroPreset, MACRO_KCAL_PER_GRAM } from "@/lib/nutrition/macro-presets";
import { getNutrientValue } from "@/lib/nutrients";
import type { NutrientValue } from "@/lib/types";

/**
 * What "enough" means for one day.
 *
 * Three sources, in descending order of how specific they are to the day in
 * question:
 *
 *   plan      the meals the counselor put together *for this date* — the most
 *             concrete answer there is, and the one the client can see
 *   goal      `patients.daily_calorie_goal`, a deliberate target
 *   bedarf    basal rate × PAL, maintenance derived from the body
 *
 * and a fourth possibility that has to stay respectable: none of them. A diary
 * without a counselor still has to work, and inventing a target from thin air
 * for someone nobody is treating would be the wrong kind of confidence.
 */

export type ClientTargetSource = "plan" | "goal" | "bedarf";

export interface ClientEnergyReference {
  dailyCalorieGoal?: number;
  macroPreset?: string;
  pal?: number;
  basalKcal?: number;
}

export interface ClientDayTarget {
  source: ClientTargetSource;
  kcal: number;
  /** Only present where a macro split is known; grams. */
  protein?: number;
  fat?: number;
  carbs?: number;
}

/** Macro grams from an energy budget and a percentage split. */
export function macroGramsFromKcal(kcal: number, presetId?: string): Pick<
  ClientDayTarget,
  "protein" | "fat" | "carbs"
> {
  const preset = findMacroPreset(presetId);
  if (!preset || kcal <= 0) return {};

  return {
    protein: Math.round((kcal * preset.protein) / 100 / MACRO_KCAL_PER_GRAM.protein),
    fat: Math.round((kcal * preset.fat) / 100 / MACRO_KCAL_PER_GRAM.fat),
    carbs: Math.round((kcal * preset.carbs) / 100 / MACRO_KCAL_PER_GRAM.carbs),
  };
}

export function resolveClientDayTarget(input: {
  /** Everything the plan prescribes for the day, answered or not. */
  plannedNutrients?: NutrientValue[];
  energy?: ClientEnergyReference | null;
}): ClientDayTarget | null {
  const plannedKcal = input.plannedNutrients
    ? Math.round(getNutrientValue(input.plannedNutrients, "energie"))
    : 0;

  // A plan is the day's own answer, so its macros come from the plan itself
  // rather than from a percentage split of its energy.
  if (plannedKcal > 0) {
    return {
      source: "plan",
      kcal: plannedKcal,
      protein: round(getNutrientValue(input.plannedNutrients!, "eiweiss")),
      fat: round(getNutrientValue(input.plannedNutrients!, "fett")),
      carbs: round(getNutrientValue(input.plannedNutrients!, "kohlenhydrate")),
    };
  }

  const energy = input.energy;
  if (!energy) return null;

  if (energy.dailyCalorieGoal && energy.dailyCalorieGoal > 0) {
    const kcal = Math.round(energy.dailyCalorieGoal);
    return { source: "goal", kcal, ...macroGramsFromKcal(kcal, energy.macroPreset) };
  }

  if (energy.basalKcal && energy.basalKcal > 0 && energy.pal && energy.pal > 0) {
    const kcal = Math.round(energy.basalKcal * energy.pal);
    return { source: "bedarf", kcal, ...macroGramsFromKcal(kcal, energy.macroPreset) };
  }

  return null;
}

function round(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

export const TARGET_SOURCE_LABELS: Record<ClientTargetSource, string> = {
  plan: "dein Plan für heute",
  goal: "dein Tagesziel",
  bedarf: "dein Tagesbedarf",
};

/**
 * Progress against a target, capped for the bar's width but not for the label.
 *
 * Deliberately has no notion of "too much". A diary that turns red when a
 * person eats is a diary that gets deleted, and the clinical judgement about
 * an overshoot belongs to the counselor, not to a progress bar.
 */
export function targetProgress(value: number, target?: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}
