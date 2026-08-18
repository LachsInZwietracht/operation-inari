import { expect, test } from "@playwright/test";

import {
  buildClientDayFactRows,
  compareClientMetrics,
  MIN_BUCKET_DAYS,
  MIN_PAIRED_DAYS,
  resolveBuckets,
  type ClientDayFactInput,
} from "@/lib/client-checkin";
import { getClientMetric } from "@/lib/client-metrics";
import type { NutrientValue } from "@/lib/types";

/**
 * The rules that decide what a day is allowed to say about itself.
 *
 * Nearly every assertion here is about absence: a day with nothing logged has
 * no calories rather than zero, a nutrient the sources could not describe is
 * missing rather than low, and a bucket with three days is empty rather than
 * confident. Those are the claims the whole evaluation rests on, and they are
 * the ones that would fail silently.
 */

function part(values: Record<string, number>): NutrientValue[] {
  return Object.entries(values).map(([nutrientId, amount]) => ({ nutrientId, amount }));
}

/** A source that knows its energy and macros but carries no fibre or sugar. */
function barcodePart(kcal: number): NutrientValue[] {
  return part({ energie: kcal, eiweiss: 10, fett: 10, kohlenhydrate: 20 });
}

/** A catalog food: energy, macros, and the nutrients a barcode product lacks. */
function catalogPart(kcal: number, fiber = 10, sugar = 20): NutrientValue[] {
  return part({
    energie: kcal,
    eiweiss: 20,
    fett: 15,
    kohlenhydrate: 60,
    ballaststoffe: fiber,
    zucker: sugar,
  });
}

test.describe("what a day says about itself", () => {
  test("a day with nothing logged has no calories, not zero of them", () => {
    const [row] = buildClientDayFactRows([{ date: "2026-08-10", parts: [] }]);

    // The distinction the whole average depends on: an empty diary must not
    // enter a comparison as a day of fasting.
    expect(row.facts.kcal).toBeUndefined();
    expect(row.facts.meal_count).toBeUndefined();
  });

  test("an unanswered score stays unanswered rather than becoming a low one", () => {
    const [row] = buildClientDayFactRows([
      {
        date: "2026-08-10",
        checkin: { id: "a", date: "2026-08-10", wellbeing: 7 },
      },
    ]);

    expect(row.facts.wellbeing).toBe(7);
    expect(row.facts.mood).toBeUndefined();
    expect(row.facts.sleep_minutes).toBeUndefined();
  });

  test("fibre is dropped when most of the day could not describe it", () => {
    // 700 of 1000 kcal come from a source without fibre: 30 % coverage.
    const [row] = buildClientDayFactRows([
      { date: "2026-08-10", parts: [catalogPart(300), barcodePart(700)], mealCount: 3 },
    ]);

    expect(row.facts.kcal).toBe(1000);
    expect(row.facts.fiber_g).toBeUndefined();
    expect(row.facts.sugar_g).toBeUndefined();
  });

  test("fibre counts when nearly the whole day could describe it", () => {
    const [row] = buildClientDayFactRows([
      { date: "2026-08-10", parts: [catalogPart(900), barcodePart(100)], mealCount: 3 },
    ]);

    expect(row.facts.fiber_g).toBe(10);
    expect(row.facts.sugar_g).toBe(20);
  });

  test("a rest day trained zero minutes, a session without a duration did not", () => {
    const rows = buildClientDayFactRows([
      { date: "2026-08-10", hasTraining: false },
      { date: "2026-08-11", hasTraining: true, trainingMinutes: 45, trainingKcal: 300 },
      { date: "2026-08-12", hasTraining: true },
    ]);

    expect(rows[0].facts.training_day).toBe(0);
    expect(rows[0].facts.training_minutes).toBe(0);
    expect(rows[1].facts.training_minutes).toBe(45);
    // Trained, but nobody wrote down for how long — not a zero-minute session.
    expect(rows[2].facts.training_day).toBe(1);
    expect(rows[2].facts.training_minutes).toBeUndefined();
  });

  test("water tracked as zero is a statement, water untracked is not", () => {
    const rows = buildClientDayFactRows([
      { date: "2026-08-10", waterMl: 0 },
      { date: "2026-08-11" },
    ]);

    expect(rows[0].facts.water_ml).toBe(0);
    expect(rows[1].facts.water_ml).toBeUndefined();
  });
});

test.describe("buckets", () => {
  test("fixed edges group sleep the way people talk about it", () => {
    const buckets = resolveBuckets(getClientMetric("sleep_minutes"), []);

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "< 6 h",
      "6–7 h",
      "7–8 h",
      "> 8 h",
    ]);
    expect(buckets[0].contains(300)).toBe(true);
    expect(buckets[1].contains(360)).toBe(true);
    expect(buckets[2].contains(479)).toBe(true);
    expect(buckets[3].contains(480)).toBe(true);
  });

  test("quartile buckets are labelled with the range they cover", () => {
    const values = [1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
    const buckets = resolveBuckets(getClientMetric("kcal"), values);

    expect(buckets).toHaveLength(4);
    // "Q2" is not something anyone can compare a day against.
    expect(buckets[0].label).toContain("kcal");
    expect(buckets[0].label).toMatch(/^1600–/);
    expect(buckets[3].label).toMatch(/–3000 kcal$/);
    // Nobody falls off the top edge.
    expect(buckets[3].contains(3000)).toBe(true);
  });

  test("a metric that is a level rather than a day has no buckets at all", () => {
    expect(resolveBuckets(getClientMetric("weight_kg"), [80, 81, 82, 83])).toEqual([]);
  });
});

test.describe("comparing two metrics", () => {
  function sleepDay(date: string, minutes: number, wellbeing: number): ClientDayFactInput {
    return { date, checkin: { id: date, date, sleepMinutes: minutes, wellbeing } };
  }

  test("groups by the first metric and averages the second", () => {
    const rows = buildClientDayFactRows([
      ...[1, 2, 3, 4].map((n) => sleepDay(`2026-08-0${n}`, 300, 4)),
      ...[5, 6, 7, 8].map((n) => sleepDay(`2026-08-0${n}`, 450, 8)),
      ...[10, 11, 12, 13, 14, 15].map((n) => sleepDay(`2026-08-${n}`, 500, 7)),
    ]);

    const comparison = compareClientMetrics({ rows, xKey: "sleep_minutes", yKey: "wellbeing" });

    expect(comparison.pairedDays).toBe(14);
    expect(comparison.hasEnoughData).toBe(true);
    expect(comparison.buckets[0]).toMatchObject({ label: "< 6 h", count: 4, average: 4 });
    expect(comparison.buckets[2]).toMatchObject({ label: "7–8 h", count: 4, average: 8 });
    expect(comparison.buckets[3]).toMatchObject({ label: "> 8 h", count: 6, average: 7 });
  });

  test("a bucket too thin to describe is shown without a value, never dropped", () => {
    const rows = buildClientDayFactRows([
      ...Array.from({ length: 13 }, (_, index) =>
        sleepDay(`2026-08-${String(index + 1).padStart(2, "0")}`, 450, 7),
      ),
      // Two days of short sleep: below the floor, and a hidden bucket would be
      // a lie about the shape of the window.
      sleepDay("2026-08-20", 300, 3),
      sleepDay("2026-08-21", 300, 3),
    ]);

    const comparison = compareClientMetrics({ rows, xKey: "sleep_minutes", yKey: "wellbeing" });
    const short = comparison.buckets[0];

    expect(short.count).toBe(2);
    expect(short.count).toBeLessThan(MIN_BUCKET_DAYS);
    expect(short.average).toBeNull();
  });

  test("below the floor of paired days the comparison refuses to state anything", () => {
    const rows = buildClientDayFactRows(
      Array.from({ length: MIN_PAIRED_DAYS - 1 }, (_, index) =>
        sleepDay(`2026-08-${String(index + 1).padStart(2, "0")}`, 450, 7),
      ),
    );

    const comparison = compareClientMetrics({ rows, xKey: "sleep_minutes", yKey: "wellbeing" });
    expect(comparison.pairedDays).toBe(MIN_PAIRED_DAYS - 1);
    expect(comparison.hasEnoughData).toBe(false);
  });

  test("a shift pairs a day with an earlier one and costs the days at the edge", () => {
    const rows = buildClientDayFactRows([
      { date: "2026-08-01", checkin: { id: "1", date: "2026-08-01", sleepMinutes: 300 } },
      { date: "2026-08-02", checkin: { id: "2", date: "2026-08-02", sleepMinutes: 300 } },
      { date: "2026-08-03", checkin: { id: "3", date: "2026-08-03", wellbeing: 4 } },
      { date: "2026-08-04", checkin: { id: "4", date: "2026-08-04", wellbeing: 5 } },
    ]);

    // Same day: sleep and wellbeing never fall on the same date here.
    expect(compareClientMetrics({ rows, xKey: "sleep_minutes", yKey: "wellbeing" }).pairedDays).toBe(
      0,
    );

    // Two days earlier: both pairs exist.
    const shifted = compareClientMetrics({
      rows,
      xKey: "sleep_minutes",
      yKey: "wellbeing",
      shiftDays: 2,
    });
    expect(shifted.pairedDays).toBe(2);
    expect(shifted.shiftDays).toBe(2);
  });
});
