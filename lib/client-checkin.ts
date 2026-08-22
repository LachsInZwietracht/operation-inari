import { addDays, format, parseISO } from "date-fns";

import { nutrientCoverage } from "@/lib/client-micronutrients";
import {
  getClientMetric,
  type ClientBucketRule,
  type ClientMetric,
  type ClientMetricKey,
} from "@/lib/client-metrics";
import { getNutrientValue, sumNutrients } from "@/lib/nutrients";
import type { ClientCheckin, NutrientValue } from "@/lib/types";

/**
 * One day, described by every metric that has something to say about it.
 *
 * This is the layer where the check-in, the diary, the training log and the
 * scale stop being four modules and become one row per date — and where the
 * split between `client_daily_checkins` and `client_food_log_days` (water and
 * the day note stayed there) becomes invisible to everything above.
 *
 * The rule that runs through all of it: a metric is present when the day
 * actually says something about it, and absent otherwise. Nothing here ever
 * substitutes a zero for a missing answer, because a day with no diary entries
 * is not a day of no calories.
 */
export type ClientDayFacts = Partial<Record<ClientMetricKey, number>>;

/**
 * The share of a day's energy that has to carry a nutrient before that
 * nutrient is allowed to describe the day.
 *
 * Branded barcode products routinely carry no fibre and no sugar, and summed
 * with catalog foods the result is indistinguishable from a day containing
 * none. Below this bar the day has no opinion on that nutrient rather than a
 * wrong one. Energy and the three macros are exempt: they are present on
 * essentially every source, and gating them would throw away most days.
 */
export const NUTRIENT_COVERAGE_MIN = 0.8;

const COVERED_NUTRIENTS: { key: ClientMetricKey; nutrientId: string }[] = [
  { key: "sugar_g", nutrientId: "zucker" },
  { key: "fiber_g", nutrientId: "ballaststoffe" },
];

const UNGATED_NUTRIENTS: { key: ClientMetricKey; nutrientId: string }[] = [
  { key: "kcal", nutrientId: "energie" },
  { key: "protein_g", nutrientId: "eiweiss" },
  { key: "fat_g", nutrientId: "fett" },
  { key: "carbs_g", nutrientId: "kohlenhydrate" },
];

export type ClientDayFactInput = {
  date: string;
  /** The check-in row, if the day was answered at all. */
  checkin?: ClientCheckin;
  /** The day's food as unsummed parts — diary and ticked-off plan together. */
  parts?: NutrientValue[][];
  /** How many meals of the day had something in them. */
  mealCount?: number;
  /** Millilitres. Undefined is "not tracked", which is not zero. */
  waterMl?: number;
  /** Minutes from sessions that carry a duration; undefined when none do. */
  trainingMinutes?: number;
  trainingKcal?: number;
  /** Whether any session was logged. False is a fact, not a gap. */
  hasTraining?: boolean;
  /** Only on days that were actually weighed — never carried forward. */
  weightKg?: number;
};

function assignIfNumber(facts: ClientDayFacts, key: ClientMetricKey, value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return;
  facts[key] = value;
}

/** One day's facts from the four sources that describe it. */
export function buildClientDayFacts(input: ClientDayFactInput): ClientDayFacts {
  const facts: ClientDayFacts = {};

  assignIfNumber(facts, "energy", input.checkin?.energy);
  assignIfNumber(facts, "mood", input.checkin?.mood);
  assignIfNumber(facts, "digestion", input.checkin?.digestion);
  assignIfNumber(facts, "sleep_minutes", input.checkin?.sleepMinutes);
  assignIfNumber(facts, "sleep_quality", input.checkin?.sleepQuality);
  assignIfNumber(facts, "alcohol_units", input.checkin?.alcoholUnits);
  assignIfNumber(facts, "water_ml", input.waterMl);
  assignIfNumber(facts, "weight_kg", input.weightKg);

  // Nothing logged is not a zero-calorie day. The whole nutrition block stays
  // absent so it can never be averaged in as a day of fasting.
  const parts = input.parts ?? [];
  if (parts.length > 0) {
    const totals = sumNutrients(parts);
    for (const { key, nutrientId } of UNGATED_NUTRIENTS) {
      facts[key] = Math.round(getNutrientValue(totals, nutrientId));
    }

    const coverage = nutrientCoverage(parts);
    for (const { key, nutrientId } of COVERED_NUTRIENTS) {
      if ((coverage.get(nutrientId) ?? 0) < NUTRIENT_COVERAGE_MIN) continue;
      facts[key] = Math.round(getNutrientValue(totals, nutrientId));
    }

    assignIfNumber(facts, "meal_count", input.mealCount);
  }

  if (input.hasTraining !== undefined) {
    facts.training_day = input.hasTraining ? 1 : 0;
    // A rest day really is zero minutes. A session whose duration was never
    // entered is not — that stays absent rather than counting as a rest day.
    if (!input.hasTraining) {
      facts.training_minutes = 0;
      facts.training_kcal = 0;
    } else {
      assignIfNumber(facts, "training_minutes", input.trainingMinutes);
      assignIfNumber(facts, "training_kcal", input.trainingKcal);
    }
  }

  return facts;
}

export type ClientDayFactRow = { date: string; facts: ClientDayFacts };

/** The window, oldest first, one row per date whether or not it was filled. */
export function buildClientDayFactRows(inputs: ClientDayFactInput[]): ClientDayFactRow[] {
  return inputs
    .map((input) => ({ date: input.date, facts: buildClientDayFacts(input) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Comparing two metrics
//
// Everything below is descriptive on purpose. It groups days and averages
// them; it does not test, rank, score or search. The pair and the shift are
// chosen by the person looking at their own data. This keeps the comparison
// descriptive instead of turning it into an automated recommendation.
// ============================================================================

/** Below this many paired days the comparison is not shown at all. */
export const MIN_PAIRED_DAYS = 14;

/** Below this many days in a bucket, the bucket is shown without a value. */
export const MIN_BUCKET_DAYS = 3;

/** How far either way the shift control reaches. */
export const MAX_SHIFT_DAYS = 3;

export type ClientMetricBucket = {
  label: string;
  /** How many paired days fell into this bucket. */
  count: number;
  /**
   * The average of the second metric over those days, or null when the bucket
   * is too thin to state one. Null buckets are rendered, never dropped: a
   * hidden bucket is a lie about the shape of the data.
   */
  average: number | null;
};

export type ClientMetricComparison = {
  xKey: ClientMetricKey;
  yKey: ClientMetricKey;
  shiftDays: number;
  /** Days where both metrics had a value under the chosen shift. */
  pairedDays: number;
  /** Days in the window overall, so the shortfall is legible. */
  windowDays: number;
  buckets: ClientMetricBucket[];
  /** False while `pairedDays` is under `MIN_PAIRED_DAYS`. */
  hasEnoughData: boolean;
};

function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function formatEdge(metric: ClientMetric, value: number): string {
  if (metric.key === "sleep_minutes") {
    return `${(value / 60).toFixed(1).replace(".", ",")} h`;
  }
  const rounded = metric.decimals > 0 ? value.toFixed(metric.decimals) : String(Math.round(value));
  return rounded.replace(".", ",");
}

type ResolvedBucket = { label: string; contains: (value: number) => boolean };

/**
 * The buckets for one metric over one window.
 *
 * Quartile buckets are labelled with the range they actually cover ("1750–2050
 * kcal"), because "Q2" is not something anyone can compare their day against.
 */
export function resolveBuckets(
  metric: ClientMetric,
  values: number[],
): ResolvedBucket[] {
  const rule: ClientBucketRule | null = metric.buckets;
  if (!rule) return [];

  if (rule.kind === "binary") {
    return [
      { label: rule.falseLabel, contains: (value) => value < 0.5 },
      { label: rule.trueLabel, contains: (value) => value >= 0.5 },
    ];
  }

  if (rule.kind === "ordinal") {
    return rule.groups.map((group) => ({
      label: group.label,
      contains: (value: number) => value >= group.min && value <= group.max,
    }));
  }

  if (rule.kind === "fixed") {
    return rule.labels.map((label, index) => {
      const lower = index === 0 ? -Infinity : rule.edges[index - 1];
      const upper = index === rule.labels.length - 1 ? Infinity : rule.edges[index];
      return { label, contains: (value: number) => value >= lower && value < upper };
    });
  }

  const pool = (rule.positiveOnly ? values.filter((value) => value > 0) : values)
    .slice()
    .sort((a, b) => a - b);
  if (pool.length < 4) return [];

  const edges = [quantile(pool, 0.25), quantile(pool, 0.5), quantile(pool, 0.75)];
  const bounds = [pool[0], ...edges, pool[pool.length - 1]];

  const buckets: ResolvedBucket[] = [];
  for (let index = 0; index < 4; index++) {
    const lower = index === 0 ? -Infinity : edges[index - 1];
    const upper = index === 3 ? Infinity : edges[index];
    buckets.push({
      label: `${formatEdge(metric, bounds[index])}–${formatEdge(metric, bounds[index + 1])}${
        metric.unit ? ` ${metric.unit}` : ""
      }`,
      contains: (value: number) => value >= lower && value < upper,
    });
  }

  // Days sitting exactly on the maximum belong in the top bucket, not nowhere.
  const top = buckets[3];
  buckets[3] = { ...top, contains: (value: number) => value >= edges[2] };
  return buckets;
}

/**
 * Group the days by the first metric and average the second over each group.
 *
 * `shiftDays` moves the first metric into the past: a shift of 2 compares what
 * happened two days earlier with the day being rated. It is offered because a
 * delayed relationship is invisible in a same-day comparison — not because the
 * app has an opinion about which shift is right. It never picks one.
 *
 * Note that no shift is needed for the natural reading of sleep: the check-in
 * stores it against the day it was slept onto, so same-day is already
 * "last night's sleep against today".
 */
export function compareClientMetrics(input: {
  rows: ClientDayFactRow[];
  xKey: ClientMetricKey;
  yKey: ClientMetricKey;
  shiftDays?: number;
}): ClientMetricComparison {
  const shift = Math.max(-MAX_SHIFT_DAYS, Math.min(MAX_SHIFT_DAYS, input.shiftDays ?? 0));
  const xMetric = getClientMetric(input.xKey);
  const byDate = new Map(input.rows.map((row) => [row.date, row.facts]));

  const pairs: { x: number; y: number }[] = [];
  for (const row of input.rows) {
    const y = row.facts[input.yKey];
    const x = byDate.get(shiftDate(row.date, -shift))?.[input.xKey];
    if (x === undefined || y === undefined) continue;
    pairs.push({ x, y });
  }

  const buckets = resolveBuckets(
    xMetric,
    pairs.map((pair) => pair.x),
  ).map((bucket) => {
    const matching = pairs.filter((pair) => bucket.contains(pair.x));
    return {
      label: bucket.label,
      count: matching.length,
      average:
        matching.length >= MIN_BUCKET_DAYS
          ? Math.round(
              (matching.reduce((sum, pair) => sum + pair.y, 0) / matching.length) * 10,
            ) / 10
          : null,
    };
  });

  return {
    xKey: input.xKey,
    yKey: input.yKey,
    shiftDays: shift,
    pairedDays: pairs.length,
    windowDays: input.rows.length,
    buckets,
    hasEnoughData: pairs.length >= MIN_PAIRED_DAYS,
  };
}

/** Which metrics have enough of a presence in the window to be worth offering. */
export function metricsWithData(rows: ClientDayFactRow[]): Set<ClientMetricKey> {
  const present = new Set<ClientMetricKey>();
  for (const row of rows) {
    for (const key of Object.keys(row.facts) as ClientMetricKey[]) present.add(key);
  }
  return present;
}
