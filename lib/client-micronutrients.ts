import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { getNutrientValue, sumNutrients } from "@/lib/nutrients";
import type { NutrientGroup, NutrientValue } from "@/lib/types";

/**
 * The day's micronutrients, and how much of the day they actually describe.
 *
 * Deliberately free of React and of any query: the statistics tab will need
 * exactly this over a thirty-day window, and a chart of "did I hit my iron"
 * built on a second, slightly different calculation would be worse than none.
 *
 * The hard part is not the arithmetic, it is honesty about the data. Catalog
 * foods (BLS) carry iron; scanned Open Food Facts products essentially never
 * do. Summed together, a food with no iron value is indistinguishable from a
 * food with no iron — so a day built half from barcode scans reads as a
 * deficiency that is really a gap in the database. Every row therefore carries
 * the share of the day's energy that had a value for it at all, and a row that
 * only describes half the day says so instead of quietly accusing someone of
 * eating badly.
 */

/** Nutrients worth carrying into the client surface beyond the four macros. */
export const CLIENT_MICRO_NUTRIENT_IDS = [
  "ballaststoffe",
  "zucker",
  "gesaettigte_fettsaeuren",
  "vitamin_a",
  "vitamin_b1",
  "vitamin_b2",
  "vitamin_b6",
  "vitamin_b12",
  "vitamin_c",
  "vitamin_d",
  "vitamin_e",
  "folsaeure",
  "niacin",
  "calcium",
  "eisen",
  "magnesium",
  "kalium",
  "natrium",
  "zink",
  "phosphor",
  "jod",
];

/**
 * Nutrients where the reference value is a ceiling, not a goal.
 *
 * They get a number and no progress bar. A bar that fills up teaches people to
 * reach their sugar target, which is the opposite of what the number is for.
 */
export const MICRO_LIMIT_NUTRIENT_IDS = new Set([
  "zucker",
  "gesaettigte_fettsaeuren",
  "natrium",
  "salz",
]);

/** Below this share of the day's energy, a value is flagged as partial. */
export const COVERAGE_WARN_THRESHOLD = 0.8;

export interface ClientMicronutrientRow {
  nutrientId: string;
  label: string;
  unit: string;
  group: NutrientGroup;
  /** What the day added up to. */
  value: number;
  /** The daily reference, when one is known for this person. */
  target?: number;
  /** value / target as a percentage, capped at 100. Undefined without a target. */
  percent?: number;
  /** "reach" fills a bar; "limit" is a ceiling and gets none. */
  kind: "reach" | "limit";
  /** Share of the day's energy that came from sources carrying this nutrient. */
  coverage: number;
}

const DEFINITIONS = new Map(NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition]));

/**
 * How much of the day each nutrient actually describes.
 *
 * Weighted by energy rather than by number of entries: a 5 g sprinkle of chia
 * with full BLS data does not make up for a 600 kcal ready meal that carries
 * nothing but macros.
 *
 * Within a recipe this is measured at the recipe, not at its ingredients — a
 * recipe whose per-portion nutrients include iron counts as covered even if
 * one of its ingredients contributed none. That is a coarser claim than the
 * per-entry one, and the honest limit of what this can see.
 */
export function nutrientCoverage(parts: NutrientValue[][]): Map<string, number> {
  const coverage = new Map<string, number>();

  const totalKcal = parts.reduce((sum, part) => sum + getNutrientValue(part, "energie"), 0);
  // Nothing eaten yet: no claim either way, rather than a confident 0 %.
  if (totalKcal <= 0) return coverage;

  const known = new Map<string, number>();
  for (const part of parts) {
    const kcal = getNutrientValue(part, "energie");
    if (kcal <= 0) continue;
    for (const nutrient of part) {
      known.set(nutrient.nutrientId, (known.get(nutrient.nutrientId) ?? 0) + kcal);
    }
  }

  for (const [nutrientId, kcal] of known) {
    coverage.set(nutrientId, Math.min(1, kcal / totalKcal));
  }
  return coverage;
}

/**
 * One row per micronutrient the day can say something about.
 *
 * A nutrient with no reference value is left out entirely rather than shown
 * bare. Chlorid and Fluorid are in the database and in nobody's head; the
 * reference table is the filter that keeps the list to things a person could
 * act on, and it grows on its own as reference data is imported.
 */
/**
 * How much of the day carries micronutrient data at all.
 *
 * One number for the whole panel, because in practice a food either has the
 * full BLS record or nothing: repeating "only 58 % of the day has values for
 * this" under eighteen rows says the same thing eighteen times, and a caveat
 * repeated that often stops being read. The per-nutrient figure stays on each
 * row for the cases that genuinely differ from this one.
 */
export function micronutrientDataShare(parts: NutrientValue[][]): number {
  const totalKcal = parts.reduce((sum, part) => sum + getNutrientValue(part, "energie"), 0);
  if (totalKcal <= 0) return 1;

  const described = parts.reduce((sum, part) => {
    const kcal = getNutrientValue(part, "energie");
    if (kcal <= 0) return sum;
    const hasMicros = part.some(
      (nutrient) =>
        CLIENT_MICRO_NUTRIENT_IDS.includes(nutrient.nutrientId) &&
        !MICRO_LIMIT_NUTRIENT_IDS.has(nutrient.nutrientId),
    );
    return hasMicros ? sum + kcal : sum;
  }, 0);

  return described / totalKcal;
}

export function summarizeMicronutrients(input: {
  totals: NutrientValue[];
  /** Daily reference intake by nutrient id, as resolved for this person. */
  references: Map<string, number>;
  coverage: Map<string, number>;
}): ClientMicronutrientRow[] {
  const rows: ClientMicronutrientRow[] = [];

  for (const nutrientId of CLIENT_MICRO_NUTRIENT_IDS) {
    const definition = DEFINITIONS.get(nutrientId);
    const target = input.references.get(nutrientId);
    if (!definition || target === undefined || target <= 0) continue;

    const value = getNutrientValue(input.totals, nutrientId);
    rows.push({
      nutrientId,
      label: definition.name,
      unit: definition.unit,
      group: definition.group,
      value,
      target,
      percent: Math.min(100, Math.round((value / target) * 100)),
      kind: MICRO_LIMIT_NUTRIENT_IDS.has(nutrientId) ? "limit" : "reach",
      coverage: input.coverage.get(nutrientId) ?? 0,
    });
  }

  return rows;
}

/**
 * The rows that are the point of opening the panel: furthest from target first.
 *
 * Sorting by shortfall is what turns eighteen bars into "today it's iron,
 * folate and vitamin D". Ceilings are excluded — "you are furthest from your
 * sugar limit" is not a to-do.
 */
export function rowsByShortfall(rows: ClientMicronutrientRow[]): ClientMicronutrientRow[] {
  return rows
    .filter((row) => row.kind === "reach")
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));
}

/** Rows in the order the nutrient tables use, for the full list. */
export function rowsByGroup(rows: ClientMicronutrientRow[]): ClientMicronutrientRow[] {
  return [...rows].sort((a, b) => {
    const orderA = DEFINITIONS.get(a.nutrientId)?.sortOrder ?? 0;
    const orderB = DEFINITIONS.get(b.nutrientId)?.sortOrder ?? 0;
    return orderA - orderB;
  });
}

/** "11 von 18 erreicht" — the one line that stands in for the folded panel. */
export function countReached(rows: ClientMicronutrientRow[]): { reached: number; total: number } {
  const reach = rows.filter((row) => row.kind === "reach");
  return {
    reached: reach.filter((row) => (row.percent ?? 0) >= 100).length,
    total: reach.length,
  };
}

/**
 * Below this share, a day says nothing usable about a nutrient and is left out
 * of the average rather than counted as a low day.
 *
 * Lower than the day view's flag on purpose: there the threshold decides
 * whether to add a caveat, here it decides whether a day is evidence at all,
 * and throwing away half-covered days would empty the chart for anyone who
 * scans a product now and then.
 */
export const TREND_MIN_COVERAGE = 0.5;

export interface ClientNutrientTrendPoint {
  date: string;
  /** Undefined where the day was not logged or carried too little data. */
  value?: number;
}

export interface ClientNutrientTrend {
  nutrientId: string;
  label: string;
  unit: string;
  group: NutrientGroup;
  kind: "reach" | "limit";
  target: number;
  /** Mean over the days that had usable data — not over the window. */
  average: number;
  /** average / target as a percentage, capped at 100 for goals. */
  percent: number;
  /** How many days the average stands on, and how many were logged at all. */
  daysCounted: number;
  daysLogged: number;
  points: ClientNutrientTrendPoint[];
}

/**
 * Each nutrient over the window, as an average rather than a streak.
 *
 * The framing is the whole point. Micronutrient intake is spiky — one portion
 * of liver is ten days of vitamin A — and the reference values are defined as
 * averages over days, not as a daily quota. "You hit iron on 4 of 14 days" is
 * therefore both wrong and discouraging; the average against the reference is
 * the number that means something, with the daily values kept as context.
 *
 * A day with too little data is excluded rather than counted as a low day, the
 * same reasoning as `averageOfLoggedDays`: the number should describe the food,
 * not punish the gaps in what the database knows about it.
 */
export function summarizeNutrientTrends(input: {
  /** The window, oldest first. Days with nothing logged carry no parts. */
  days: { date: string; parts: NutrientValue[][] }[];
  references: Map<string, number>;
  minCoverage?: number;
}): ClientNutrientTrend[] {
  const minCoverage = input.minCoverage ?? TREND_MIN_COVERAGE;

  const perDay = input.days.map((day) => ({
    date: day.date,
    totals: sumNutrients(day.parts),
    coverage: nutrientCoverage(day.parts),
    hasFood: day.parts.length > 0,
  }));

  const daysLogged = perDay.filter((day) => day.hasFood).length;
  const trends: ClientNutrientTrend[] = [];

  for (const nutrientId of CLIENT_MICRO_NUTRIENT_IDS) {
    const definition = DEFINITIONS.get(nutrientId);
    const target = input.references.get(nutrientId);
    if (!definition || target === undefined || target <= 0) continue;

    const points: ClientNutrientTrendPoint[] = perDay.map((day) => {
      if (!day.hasFood) return { date: day.date };
      if ((day.coverage.get(nutrientId) ?? 0) < minCoverage) return { date: day.date };
      return { date: day.date, value: getNutrientValue(day.totals, nutrientId) };
    });

    const counted = points.filter((point) => point.value !== undefined);
    // No usable day is not a zero — the nutrient simply has nothing to report.
    if (counted.length === 0) continue;

    const average =
      counted.reduce((sum, point) => sum + (point.value ?? 0), 0) / counted.length;
    const kind = MICRO_LIMIT_NUTRIENT_IDS.has(nutrientId) ? "limit" : "reach";
    const rawPercent = Math.round((average / target) * 100);

    trends.push({
      nutrientId,
      label: definition.name,
      unit: definition.unit,
      group: definition.group,
      kind,
      target,
      average,
      // A ceiling keeps its real number: "160 % of the limit" is the fact.
      percent: kind === "reach" ? Math.min(100, rawPercent) : rawPercent,
      daysCounted: counted.length,
      daysLogged,
      points,
    });
  }

  return trends;
}

/** Goals, furthest from target first — the same order as the day panel. */
export function trendsByShortfall(trends: ClientNutrientTrend[]): ClientNutrientTrend[] {
  return trends
    .filter((trend) => trend.kind === "reach")
    .sort((a, b) => a.percent - b.percent);
}

/** Ceilings, worst overshoot first. They are a separate question. */
export function trendLimits(trends: ClientNutrientTrend[]): ClientNutrientTrend[] {
  return trends.filter((trend) => trend.kind === "limit").sort((a, b) => b.percent - a.percent);
}

export interface MicroContribution {
  nutrientId: string;
  label: string;
  /** Share of the daily reference this portion covers, uncapped. */
  percent: number;
}

/**
 * What this portion is actually good for, shown before it is logged.
 *
 * The day panel tells you where you stand; this tells you what the thing in
 * your hand would do about it, which is the moment the information can still
 * change a decision. Ceilings are left out — a line that reads as praise must
 * not quietly include "and 60 % of your sugar limit".
 */
export function topContributions(input: {
  /** Nutrients of the portion being logged, not per 100 g. */
  nutrients: NutrientValue[];
  references: Map<string, number>;
  limit?: number;
  /** Below this, a contribution is noise not news. */
  minPercent?: number;
}): MicroContribution[] {
  const minPercent = input.minPercent ?? 15;

  return input.nutrients
    .filter(
      (nutrient) =>
        !MICRO_LIMIT_NUTRIENT_IDS.has(nutrient.nutrientId) &&
        CLIENT_MICRO_NUTRIENT_IDS.includes(nutrient.nutrientId),
    )
    .map((nutrient) => {
      const target = input.references.get(nutrient.nutrientId);
      const definition = DEFINITIONS.get(nutrient.nutrientId);
      if (!target || target <= 0 || !definition) return null;
      return {
        nutrientId: nutrient.nutrientId,
        label: definition.name,
        percent: Math.round((nutrient.amount / target) * 100),
      };
    })
    .filter((entry): entry is MicroContribution => entry !== null && entry.percent >= minPercent)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, input.limit ?? 3);
}

/** Rounds to as many digits as the magnitude deserves — 0.9 mg, not 1 mg. */
export function formatMicroAmount(value: number, unit: string): string {
  // Nothing eaten is "0", not "0,00" — the extra digits imply a measurement.
  if (value === 0) return `0 ${unit}`;
  const digits = value < 1 ? 2 : value < 10 ? 1 : 0;
  return `${value.toFixed(digits).replace(".", ",")} ${unit}`;
}

/** "Vitamin B1 (Thiamin)" → "Vitamin B1". The gloss belongs in the full list. */
export function shortNutrientLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, "");
}
