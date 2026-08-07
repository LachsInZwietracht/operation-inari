import { DIET_STYLE_LABELS } from "@/lib/diet-constants";
import { MACRO_KCAL_PER_GRAM, findMacroPreset } from "@/lib/nutrition/macro-presets";
import type { DietExclusion, DietStyle } from "@/lib/types";

/**
 * Turns a patient's targets into a handful of sentences they can act on without
 * the plan in front of them — the strategy layer above the day-by-day tactics.
 *
 * Every number is derived from data already on the record (calorie goal, macro
 * preset, diet line targets) so a principle can always be traced back to its
 * source. Nothing here invents a recommendation the app does not already hold.
 */

export type PrincipleComparison = "min" | "max" | "around";

export interface Principle {
  id: string;
  /** Patient-facing sentence. */
  text: string;
  /** Nutrient id this principle is checked against, when it has one. */
  metricKey?: string;
  targetValue?: number;
  unit?: string;
  comparison?: PrincipleComparison;
  /** Where the number came from, shown as a tooltip/subline for the dietitian. */
  source: string;
}

export interface PrincipleInput {
  calorieGoal?: number;
  macroPreset?: string;
  dietStyle?: DietStyle;
  exclusions?: DietExclusion[];
  weightKg?: number;
  /** Targets from the active diet line, used before generic fallbacks. */
  dietLineTargets?: Array<{
    nutrientId: string;
    label: string;
    unit: string;
    min?: number;
    max?: number;
  }>;
}

/** DGE reference intake for adults. */
const FIBER_TARGET_G = 30;

/**
 * Fallback protein target when no macro split is available. 1.5 g per kg body
 * weight sits inside the range German guidance uses for active adults and is
 * only applied when nothing more specific exists on the record.
 */
const FALLBACK_PROTEIN_G_PER_KG = 1.5;

const MAX_PRINCIPLES = 5;

/** Diet line targets are a fallback, not the headline. */
const MAX_DIET_LINE_PRINCIPLES = 2;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

export function buildPrinciples(input: PrincipleInput): Principle[] {
  const principles: Principle[] = [];
  const preset = findMacroPreset(input.macroPreset);

  // 1. Energy
  if (input.calorieGoal && input.calorieGoal > 0) {
    const target = roundTo(input.calorieGoal, 10);
    principles.push({
      id: "energie",
      text: `Rund ${formatNumber(target)} kcal am Tag.`,
      metricKey: "energie",
      targetValue: target,
      unit: "kcal",
      comparison: "around",
      source: "Kalorienziel des Patienten",
    });
  }

  // 2. Protein — from the macro split when both parts exist, else per kg.
  if (preset && input.calorieGoal) {
    const grams = roundTo(
      (input.calorieGoal * preset.protein) / 100 / MACRO_KCAL_PER_GRAM.protein,
      5,
    );
    principles.push({
      id: "eiweiss",
      text: `Mindestens ${formatNumber(grams)} g Eiweiß am Tag — auf alle Mahlzeiten verteilt.`,
      metricKey: "eiweiss",
      targetValue: grams,
      unit: "g",
      comparison: "min",
      source: `Makroverteilung "${preset.label}" (${preset.protein} % der Energie)`,
    });
  } else if (input.weightKg && input.weightKg > 0) {
    const grams = roundTo(input.weightKg * FALLBACK_PROTEIN_G_PER_KG, 5);
    principles.push({
      id: "eiweiss",
      text: `Mindestens ${formatNumber(grams)} g Eiweiß am Tag — auf alle Mahlzeiten verteilt.`,
      metricKey: "eiweiss",
      targetValue: grams,
      unit: "g",
      comparison: "min",
      source: `${FALLBACK_PROTEIN_G_PER_KG} g je kg Körpergewicht`,
    });
  }

  // 3. Carbohydrates, only when the split makes them the deciding lever.
  if (preset && input.calorieGoal && preset.carbs <= 35) {
    const grams = roundTo(
      (input.calorieGoal * preset.carbs) / 100 / MACRO_KCAL_PER_GRAM.carbs,
      5,
    );
    principles.push({
      id: "kohlenhydrate",
      text: `Höchstens ${formatNumber(grams)} g Kohlenhydrate am Tag.`,
      metricKey: "kohlenhydrate",
      targetValue: grams,
      unit: "g",
      comparison: "max",
      source: `Makroverteilung "${preset.label}" (${preset.carbs} % der Energie)`,
    });
  }

  // 4. Diet line targets fill the gaps the patient's own numbers left. Capped at
  //    two: a wall of "Mindestens X g Y" reads like a lab report, not a rule
  //    somebody can hold in their head.
  let dietLineUsed = 0;
  for (const target of input.dietLineTargets ?? []) {
    if (dietLineUsed >= MAX_DIET_LINE_PRINCIPLES) break;
    if (principles.length >= MAX_PRINCIPLES - 1) break;
    if (principles.some((principle) => principle.metricKey === target.nutrientId)) continue;

    // "1.800 kcal Energie" reads wrong; energy needs no noun after the unit.
    const subject = target.nutrientId === "energie" ? "" : ` ${target.label}`;

    if (target.min !== undefined) {
      principles.push({
        id: `dietline_${target.nutrientId}`,
        text: `Mindestens ${formatNumber(target.min)} ${target.unit}${subject} am Tag.`,
        metricKey: target.nutrientId,
        targetValue: target.min,
        unit: target.unit,
        comparison: "min",
        source: "Kostform-Zielwert",
      });
      dietLineUsed += 1;
    } else if (target.max !== undefined) {
      principles.push({
        id: `dietline_${target.nutrientId}`,
        text: `Höchstens ${formatNumber(target.max)} ${target.unit}${subject} am Tag.`,
        metricKey: target.nutrientId,
        targetValue: target.max,
        unit: target.unit,
        comparison: "max",
        source: "Kostform-Zielwert",
      });
      dietLineUsed += 1;
    }
  }

  // 5. Fiber supports the rules above; on its own it is a generic DGE default,
  //    not a strategy, so it never becomes the only principle shown.
  if (
    principles.length > 0 &&
    principles.length < MAX_PRINCIPLES &&
    !principles.some((principle) => principle.metricKey === "ballaststoffe") &&
    input.dietStyle !== "keto" &&
    input.dietStyle !== "carnivore"
  ) {
    principles.push({
      id: "ballaststoffe",
      text: `Mindestens ${FIBER_TARGET_G} g Ballaststoffe — Gemüse, Hülsenfrüchte, Vollkorn.`,
      metricKey: "ballaststoffe",
      targetValue: FIBER_TARGET_G,
      unit: "g",
      comparison: "min",
      source: "DGE-Referenzwert für Erwachsene",
    });
  }

  return principles.slice(0, MAX_PRINCIPLES);
}

/**
 * One-line description of the constraints a plan must respect. Rendered next to
 * the principles so a swap is judged against the same rules.
 */
export function describeDietFrame(
  dietStyle?: DietStyle,
  exclusions?: DietExclusion[],
  exclusionLabels?: Record<DietExclusion, string>,
): string | undefined {
  const parts: string[] = [];

  if (dietStyle) {
    parts.push(DIET_STYLE_LABELS[dietStyle]);
  }

  for (const exclusion of exclusions ?? []) {
    parts.push(exclusionLabels?.[exclusion] ?? exclusion);
  }

  return parts.length ? parts.join(" · ") : undefined;
}

/** Checks a principle against the value actually reached on a plan day. */
export function isPrincipleMet(principle: Principle, actualValue: number): boolean {
  if (principle.targetValue === undefined) return true;

  switch (principle.comparison) {
    case "min":
      return actualValue >= principle.targetValue;
    case "max":
      return actualValue <= principle.targetValue;
    case "around":
      // ±10 % is the band the plan comparison views already treat as on target.
      return Math.abs(actualValue - principle.targetValue) <= principle.targetValue * 0.1;
    default:
      return true;
  }
}
