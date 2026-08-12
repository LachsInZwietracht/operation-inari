import { expect, test } from "@playwright/test";

import {
  countReached,
  formatMicroAmount,
  nutrientCoverage,
  rowsByShortfall,
  summarizeMicronutrients,
  summarizeNutrientTrends,
  trendLimits,
  trendsByShortfall,
} from "@/lib/client-micronutrients";
import { collectClientDayParts } from "@/lib/client-food-log";
import type { ClientFoodLogEntry, Food, NutrientValue } from "@/lib/types";

/**
 * The rules behind the micronutrient panel.
 *
 * Coverage is the part that matters most. A scanned product carries calories
 * and no iron value; summed with a catalog food it looks exactly like a food
 * containing no iron. Every claim the panel makes has to know the difference,
 * because the wrong answer accuses someone of a deficiency that is really a
 * hole in the database.
 */

/** Full BLS-style record: energy and iron both known. */
const SPINACH = {
  id: "spinach",
  name: "Spinat",
  baseAmount: 100,
  nutrients: [
    { nutrientId: "energie", amount: 100 },
    { nutrientId: "eisen", amount: 4 },
  ],
} as unknown as Food;

/** A typical barcode product: macros only, no micronutrients at all. */
const BAR = {
  id: "bar",
  name: "Proteinriegel",
  baseAmount: 100,
  nutrients: [{ nutrientId: "energie", amount: 300 }],
} as unknown as Food;

const foods = new Map<string, Food>([
  [SPINACH.id, SPINACH],
  [BAR.id, BAR],
]);

function logEntry(overrides: Partial<ClientFoodLogEntry> = {}): ClientFoodLogEntry {
  return {
    id: "log-1",
    dayId: "day-1",
    slotType: "mittagessen",
    sourceType: "food",
    foodId: SPINACH.id,
    amount: 100,
    loggedAt: "2026-08-12T12:00:00Z",
    sortOrder: 0,
    ...overrides,
  };
}

test.describe("how much of the day a number describes", () => {
  test("a day of foods that all carry the nutrient is fully covered", () => {
    const parts = collectClientDayParts({ entries: [logEntry()], foods });
    expect(nutrientCoverage(parts).get("eisen")).toBe(1);
  });

  test("energy from a product without the value lowers the coverage", () => {
    // 100 kcal of spinach (iron known) against 300 kcal of bar (not known).
    const parts = collectClientDayParts({
      entries: [logEntry(), logEntry({ id: "log-2", foodId: BAR.id })],
      foods,
    });
    expect(nutrientCoverage(parts).get("eisen")).toBeCloseTo(0.25, 5);
    // Energy itself is always known where energy came from.
    expect(nutrientCoverage(parts).get("energie")).toBe(1);
  });

  test("coverage is weighted by energy, not by number of entries", () => {
    // Ten sprinkles of spinach are still a rounding error next to the bar.
    const entries = Array.from({ length: 10 }, (_, index) =>
      logEntry({ id: `sprinkle-${index}`, amount: 5 }),
    );
    const parts = collectClientDayParts({
      entries: [...entries, logEntry({ id: "bar", foodId: BAR.id })],
      foods,
    });
    // 10 × 5 kcal against 300 kcal.
    expect(nutrientCoverage(parts).get("eisen")).toBeCloseTo(50 / 350, 5);
  });

  test("an empty day makes no claim rather than claiming zero", () => {
    expect(nutrientCoverage([]).size).toBe(0);
    expect(nutrientCoverage(collectClientDayParts({ entries: [], foods })).size).toBe(0);
  });
});

test.describe("the rows themselves", () => {
  const references = new Map([
    ["eisen", 15],
    ["calcium", 1000],
    ["zucker", 50],
  ]);

  function totals(values: NutrientValue[]) {
    return summarizeMicronutrients({
      totals: values,
      references,
      coverage: new Map([["eisen", 1]]),
    });
  }

  test("a nutrient nobody has a reference for is left out, not shown bare", () => {
    // Chlorid is in the database and in nobody's head; the reference table is
    // what keeps the list to things a person could act on.
    const rows = totals([{ nutrientId: "chlorid", amount: 800 }]);
    expect(rows.map((row) => row.nutrientId)).not.toContain("chlorid");
  });

  test("progress is capped, because there is no over-budget state", () => {
    const [iron] = totals([{ nutrientId: "eisen", amount: 30 }]).filter(
      (row) => row.nutrientId === "eisen",
    );
    expect(iron.percent).toBe(100);
  });

  test("sugar is a ceiling, iron is a goal", () => {
    const rows = totals([{ nutrientId: "eisen", amount: 5 }]);
    expect(rows.find((row) => row.nutrientId === "zucker")?.kind).toBe("limit");
    expect(rows.find((row) => row.nutrientId === "eisen")?.kind).toBe("reach");
  });

  test("a nutrient nothing was eaten of still reports its missing coverage", () => {
    const calcium = totals([]).find((row) => row.nutrientId === "calcium");
    expect(calcium?.value).toBe(0);
    expect(calcium?.coverage).toBe(0);
  });

  test("ceilings stay out of the shortfall list", () => {
    // "You are furthest from your sugar limit" is not a to-do.
    const rows = rowsByShortfall(totals([{ nutrientId: "eisen", amount: 15 }]));
    expect(rows.map((row) => row.nutrientId)).toEqual(["calcium", "eisen"]);
  });

  test("the folded summary counts only what there is to reach", () => {
    const rows = totals([
      { nutrientId: "eisen", amount: 15 },
      { nutrientId: "zucker", amount: 200 },
    ]);
    // Two goals, one of them met; the sugar ceiling counts for neither.
    expect(countReached(rows)).toEqual({ reached: 1, total: 2 });
  });
});

/**
 * The window view, whose framing is the opposite of a habit tracker's.
 *
 * Reference intakes are averages over days, not daily quotas — so the number
 * that means something is the average, and a day the database could not
 * describe is not evidence of a low day.
 */
test.describe("micronutrients over a window", () => {
  const references = new Map([
    ["eisen", 15],
    ["zucker", 50],
  ]);

  function day(date: string, entries: ClientFoodLogEntry[]) {
    return { date, parts: collectClientDayParts({ entries, foods }) };
  }

  test("the headline is the average, not how many days were hit", () => {
    // 100 g and 200 g of spinach: 4 mg and 8 mg of iron, mean 6.
    const trends = summarizeNutrientTrends({
      days: [
        day("2026-08-10", [logEntry({ amount: 100 })]),
        day("2026-08-11", [logEntry({ id: "b", amount: 200 })]),
      ],
      references,
    });

    const iron = trends.find((trend) => trend.nutrientId === "eisen");
    expect(iron?.average).toBeCloseTo(6, 5);
    expect(iron?.percent).toBe(40);
    expect(iron?.daysCounted).toBe(2);
  });

  test("a day the data cannot describe is left out, not counted as a low day", () => {
    // The bar day carries no iron value at all — counting it as 0 mg would
    // halve the average on the strength of a hole in the database.
    const trends = summarizeNutrientTrends({
      days: [
        day("2026-08-10", [logEntry({ amount: 100 })]),
        day("2026-08-11", [logEntry({ id: "b", foodId: BAR.id })]),
      ],
      references,
    });

    const iron = trends.find((trend) => trend.nutrientId === "eisen");
    expect(iron?.average).toBeCloseTo(4, 5);
    expect(iron?.daysCounted).toBe(1);
    // Both days were logged, which is what makes the gap worth mentioning.
    expect(iron?.daysLogged).toBe(2);
    expect(iron?.points[1].value).toBeUndefined();
  });

  test("an untracked day leaves a gap rather than a zero bar", () => {
    const trends = summarizeNutrientTrends({
      days: [day("2026-08-10", [logEntry()]), { date: "2026-08-11", parts: [] }],
      references,
    });

    const iron = trends.find((trend) => trend.nutrientId === "eisen");
    expect(iron?.points).toHaveLength(2);
    expect(iron?.points[1].value).toBeUndefined();
    expect(iron?.daysLogged).toBe(1);
  });

  test("a nutrient no day could describe stays out of the list entirely", () => {
    const trends = summarizeNutrientTrends({
      days: [day("2026-08-10", [logEntry({ foodId: BAR.id })])],
      references,
    });
    expect(trends.map((trend) => trend.nutrientId)).not.toContain("eisen");
  });

  test("goals cap at full, ceilings keep their real overshoot", () => {
    const overshoot = summarizeNutrientTrends({
      days: [
        {
          date: "2026-08-10",
          parts: [
            [
              { nutrientId: "energie", amount: 500 },
              { nutrientId: "eisen", amount: 30 },
              { nutrientId: "zucker", amount: 100 },
            ],
          ],
        },
      ],
      references,
    });

    expect(overshoot.find((trend) => trend.nutrientId === "eisen")?.percent).toBe(100);
    // "200 % of your sugar limit" is the fact and must not be flattened to 100.
    expect(overshoot.find((trend) => trend.nutrientId === "zucker")?.percent).toBe(200);
  });

  test("ceilings are ranked separately from goals", () => {
    const trends = summarizeNutrientTrends({
      days: [
        {
          date: "2026-08-10",
          parts: [
            [
              { nutrientId: "energie", amount: 500 },
              { nutrientId: "eisen", amount: 3 },
              { nutrientId: "zucker", amount: 60 },
            ],
          ],
        },
      ],
      references,
    });

    expect(trendsByShortfall(trends).map((trend) => trend.nutrientId)).toEqual(["eisen"]);
    expect(trendLimits(trends).map((trend) => trend.nutrientId)).toEqual(["zucker"]);
  });
});

test.describe("reading the numbers", () => {
  test("small amounts keep the digits that carry the meaning", () => {
    expect(formatMicroAmount(0.9, "mg")).toBe("0,90 mg");
    expect(formatMicroAmount(4.2, "mg")).toBe("4,2 mg");
    expect(formatMicroAmount(1240, "mg")).toBe("1240 mg");
  });
});
