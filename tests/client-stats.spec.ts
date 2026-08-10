import { expect, test } from "@playwright/test";

import { averageOfLoggedDays, buildKcalSeries } from "@/lib/client-stats";

/**
 * The statistics module stores nothing and has no schema, so there is no RLS
 * to test here — it reads the other modules' tables, which have their own
 * specs. What is worth pinning is the arithmetic behind the two numbers a
 * client will read as fact.
 */

test.describe("client statistics", () => {
  test("fills untracked days instead of compressing the axis", () => {
    const series = buildKcalSeries(new Map([["2026-08-07", 1800]]), "2026-08-10", 5);

    expect(series.map((day) => day.date)).toEqual([
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
    expect(series.map((day) => day.kcal)).toEqual([0, 1800, 0, 0, 0]);
  });

  test("ignores days outside the window", () => {
    const series = buildKcalSeries(
      new Map([
        ["2026-07-01", 9999],
        ["2026-08-10", 2100],
      ]),
      "2026-08-10",
      3,
    );

    expect(series).toHaveLength(3);
    expect(series.map((day) => day.kcal)).toEqual([0, 0, 2100]);
  });

  test("averages logged days only, not the whole window", () => {
    // The trap this guards: dividing by the window would report 800 kcal for
    // someone who logged two ordinary days, making a gap in the diary look
    // like starvation.
    const series = buildKcalSeries(
      new Map([
        ["2026-08-09", 2000],
        ["2026-08-10", 2400],
      ]),
      "2026-08-10",
      5,
    );

    expect(averageOfLoggedDays(series)).toBe(2200);
  });

  test("reports nothing rather than zero when nothing is logged", () => {
    expect(averageOfLoggedDays(buildKcalSeries(new Map(), "2026-08-10", 5))).toBe(0);
  });
});
