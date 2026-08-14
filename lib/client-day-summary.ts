import { COVERAGE_WARN_THRESHOLD, type ClientMicronutrientRow } from "@/lib/client-micronutrients";
import type { ClientDayTarget } from "@/lib/client-targets";
import { getNutrientValue } from "@/lib/nutrients";
import type { NutrientValue } from "@/lib/types";

/**
 * What went well today.
 *
 * Only what went well. A diary that reports on your shortcomings is a diary
 * people stop opening, and judging a day is the counselor's job — this is the
 * app noticing the thing you did right, which is the part nobody else will.
 *
 * Two rules keep it from becoming noise. It says nothing rather than something
 * generic: a day with no honest highlight gets no card at all. And it never
 * celebrates a number it cannot stand behind — a micronutrient only counts
 * when the day actually had data for it, or the praise is for a gap in the
 * database rather than for what someone ate.
 */

export interface ClientDayHighlight {
  id: string;
  text: string;
}

/**
 * Micronutrients worth mentioning by name.
 *
 * Phosphorus and potassium are in almost everything, so "you hit your
 * phosphorus" is praise for eating at all. These are the ones people actually
 * miss, which makes reaching one worth saying out loud.
 */
export const NOTABLE_MICRO_NUTRIENT_IDS = [
  "eisen",
  "calcium",
  "vitamin_d",
  "vitamin_b12",
  "folsaeure",
  "jod",
  "zink",
  "magnesium",
  "vitamin_c",
];

/** How far a macro may sit from its target and still count as on point. */
const BALANCED_TOLERANCE = 0.15;
const ENERGY_TOLERANCE = 0.1;
const WATER_GOAL_ML = 2000;

/**
 * Whether the day has enough in it to be worth summarizing.
 *
 * A verdict after one breakfast entry is not a verdict. Past days are judged
 * whatever is in them — they are finished, and their diary is as complete as
 * it is ever going to be.
 */
export function hasEnoughToJudge(input: { entryCount: number; isPast: boolean }): boolean {
  return input.isPast ? input.entryCount > 0 : input.entryCount >= 3;
}

export function summarizeDay(input: {
  totals: NutrientValue[];
  target: ClientDayTarget | null;
  micronutrients: ClientMicronutrientRow[];
  waterMl?: number;
  /** Answered planned meals, when there was a plan for the day. */
  plan?: { planned: number; eaten: number };
  entryCount: number;
  isPast: boolean;
}): ClientDayHighlight[] {
  if (!hasEnoughToJudge(input)) return [];

  const highlights: ClientDayHighlight[] = [];
  const kcal = getNutrientValue(input.totals, "energie");

  // Ordered by how much each is worth hearing, and cut to three — a list of
  // eight compliments reads as a machine being nice rather than as a fact.

  if (input.plan && input.plan.planned > 0 && input.plan.eaten === input.plan.planned) {
    highlights.push({
      id: "plan",
      text: "Du hast deinen Plan heute komplett umgesetzt.",
    });
  }

  if (input.target) {
    const withinEnergy =
      Math.abs(kcal - input.target.kcal) <= input.target.kcal * ENERGY_TOLERANCE;

    // A target without a macro preset is kcal only. Calling such a day
    // "balanced" would be a claim about a split nobody ever set.
    const macros: [number, number | undefined][] = [
      [getNutrientValue(input.totals, "eiweiss"), input.target.protein],
      [getNutrientValue(input.totals, "fett"), input.target.fat],
      [getNutrientValue(input.totals, "kohlenhydrate"), input.target.carbs],
    ];
    const balanced = macros.every(
      ([value, goal]) =>
        goal !== undefined && goal > 0 && Math.abs(value - goal) <= goal * BALANCED_TOLERANCE,
    );

    if (balanced) {
      highlights.push({
        id: "balanced",
        text: "Eiweiß, Fett und Kohlenhydrate lagen heute alle im Rahmen — sehr ausgewogen.",
      });
    } else if (withinEnergy) {
      highlights.push({
        id: "energy",
        text: `Mit ${Math.round(kcal)} kcal bist du nah an deinem Richtwert.`,
      });
    }

    const protein = getNutrientValue(input.totals, "eiweiss");
    const proteinGoal = input.target.protein;
    if (!balanced && proteinGoal !== undefined && proteinGoal > 0 && protein >= proteinGoal) {
      highlights.push({
        id: "protein",
        text: `${Math.round(protein)} g Eiweiß — dein Eiweißziel ist erreicht.`,
      });
    }
  }

  // Only nutrients the day can actually vouch for, and only the ones people
  // genuinely miss.
  const reachedNotable = input.micronutrients
    .filter(
      (row) =>
        row.kind === "reach" &&
        (row.percent ?? 0) >= 100 &&
        row.coverage >= COVERAGE_WARN_THRESHOLD &&
        NOTABLE_MICRO_NUTRIENT_IDS.includes(row.nutrientId),
    )
    .sort(
      (a, b) =>
        NOTABLE_MICRO_NUTRIENT_IDS.indexOf(a.nutrientId) -
        NOTABLE_MICRO_NUTRIENT_IDS.indexOf(b.nutrientId),
    );

  if (reachedNotable.length >= 2) {
    highlights.push({
      id: "micros",
      text: `${reachedNotable[0].label} und ${reachedNotable[1].label} hast du heute voll abgedeckt.`,
    });
  } else if (reachedNotable.length === 1) {
    highlights.push({
      id: "micros",
      text: `Dein ${reachedNotable[0].label} ist heute komplett gedeckt.`,
    });
  }

  const fibre = input.micronutrients.find((row) => row.nutrientId === "ballaststoffe");
  if (fibre && (fibre.percent ?? 0) >= 100 && fibre.coverage >= COVERAGE_WARN_THRESHOLD) {
    highlights.push({
      id: "fibre",
      text: `${Math.round(fibre.value)} g Ballaststoffe — das schaffen die wenigsten.`,
    });
  }

  if ((input.waterMl ?? 0) >= WATER_GOAL_ML) {
    highlights.push({
      id: "water",
      text: `${((input.waterMl ?? 0) / 1000).toFixed(1).replace(".", ",")} l getrunken.`,
    });
  }

  return highlights.slice(0, 3);
}
