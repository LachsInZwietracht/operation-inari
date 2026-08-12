import { expect, test } from "@playwright/test";

import {
  calculateClientDayNutrients,
  calculateClientLogNutrients,
  calculatePlannedNutrients,
  collectRecentEntries,
  eatenAmount,
  formatPlanAmount,
  logEntryKcal,
  planEntryNutrients,
} from "@/lib/client-food-log";
import { getNutrientValue } from "@/lib/nutrients";
import type {
  ClientFoodLogDay,
  ClientFoodLogEntry,
  ClientMealCompletion,
  ClientPlanEntry,
  ClientPlanEntryFacts,
  Food,
} from "@/lib/types";

/**
 * The arithmetic that decides what a day "was".
 *
 * The case worth pinning hardest is the one that used to be wrong: a client
 * who follows their plan and ticks every meal off has eaten real food, and the
 * day's totals have to say so even though the diary itself is empty.
 */

const OATS = {
  id: "food-oats",
  name: "Haferflocken",
  baseAmount: 100,
  nutrients: [
    { nutrientId: "energie", amount: 370 },
    { nutrientId: "eiweiss", amount: 13 },
  ],
} as unknown as Food;

const foods = new Map<string, Food>([[OATS.id, OATS]]);

function logEntry(overrides: Partial<ClientFoodLogEntry> = {}): ClientFoodLogEntry {
  return {
    id: "log-1",
    dayId: "day-1",
    slotType: "fruehstueck",
    sourceType: "food",
    foodId: OATS.id,
    amount: 50,
    loggedAt: "2026-08-11T07:00:00Z",
    sortOrder: 0,
    ...overrides,
  };
}

function planEntry(overrides: Partial<ClientPlanEntry> = {}): ClientPlanEntry {
  return {
    id: "plan-entry-1",
    slotType: "mittagessen",
    entryType: "recipe",
    referenceId: "recipe-1",
    amount: 1,
    ...overrides,
  };
}

function completion(overrides: Partial<ClientMealCompletion> = {}): ClientMealCompletion {
  return {
    id: "completion-1",
    mealPlanId: "plan-1",
    mealEntryId: "plan-entry-1",
    skipped: false,
    completedAt: "2026-08-11T12:00:00Z",
    ...overrides,
  };
}

/** 420 kcal and 20 g protein per portion. */
const SOUP: ClientPlanEntryFacts = {
  perUnit: [
    { nutrientId: "energie", amount: 420 },
    { nutrientId: "eiweiss", amount: 20 },
  ],
  label: "Linsensuppe",
  unit: "portion",
};

test.describe("logged entries", () => {
  test("catalog entries scale from the food's base amount", () => {
    const totals = calculateClientLogNutrients([logEntry()], foods);
    expect(getNutrientValue(totals, "energie")).toBe(185);
  });

  test("custom entries carry their own per-100 g values", () => {
    const totals = calculateClientLogNutrients(
      [
        logEntry({
          sourceType: "custom",
          foodId: undefined,
          customName: "Riegel",
          customNutrients: [{ nutrientId: "energie", amount: 400 }],
          amount: 25,
        }),
      ],
      foods,
    );
    expect(getNutrientValue(totals, "energie")).toBe(100);
  });
});

test.describe("a ticked plan counts", () => {
  test("an empty diary plus an eaten plan is not an empty day", () => {
    // The defect this whole change exists for.
    const totals = calculateClientDayNutrients({
      entries: [],
      foods,
      planEntries: [planEntry()],
      completions: new Map([["plan-entry-1", completion()]]),
      planFacts: new Map([["plan-entry-1", SOUP]]),
    });

    expect(getNutrientValue(totals, "energie")).toBe(420);
    expect(getNutrientValue(totals, "eiweiss")).toBe(20);
  });

  test("diary and plan add up together", () => {
    const totals = calculateClientDayNutrients({
      entries: [logEntry()],
      foods,
      planEntries: [planEntry()],
      completions: new Map([["plan-entry-1", completion()]]),
      planFacts: new Map([["plan-entry-1", SOUP]]),
    });
    expect(getNutrientValue(totals, "energie")).toBe(605);
  });

  test("an unanswered plan entry counts for nothing", () => {
    // Planned is not eaten. Anything else would credit food nobody had.
    const totals = calculateClientDayNutrients({
      entries: [],
      foods,
      planEntries: [planEntry()],
      completions: new Map(),
      planFacts: new Map([["plan-entry-1", SOUP]]),
    });
    expect(getNutrientValue(totals, "energie")).toBe(0);
  });

  test("a skipped entry counts for nothing either", () => {
    const totals = calculateClientDayNutrients({
      entries: [],
      foods,
      planEntries: [planEntry()],
      completions: new Map([["plan-entry-1", completion({ skipped: true })]]),
      planFacts: new Map([["plan-entry-1", SOUP]]),
    });
    expect(getNutrientValue(totals, "energie")).toBe(0);
  });

  test("a corrected amount wins over the planned one", () => {
    const totals = calculateClientDayNutrients({
      entries: [],
      foods,
      planEntries: [planEntry()],
      completions: new Map([["plan-entry-1", completion({ amount: 1.5 })]]),
      planFacts: new Map([["plan-entry-1", SOUP]]),
    });
    expect(getNutrientValue(totals, "energie")).toBe(630);
  });

  test("an entry that could not be priced adds nothing rather than a wrong zero-cost line", () => {
    const totals = calculateClientDayNutrients({
      entries: [],
      foods,
      planEntries: [planEntry()],
      completions: new Map([["plan-entry-1", completion()]]),
      planFacts: new Map(),
    });
    expect(getNutrientValue(totals, "energie")).toBe(0);
  });
});

test.describe("the plan as a reference", () => {
  test("the prescription counts every entry, answered or not", () => {
    const planned = calculatePlannedNutrients(
      [planEntry(), planEntry({ id: "plan-entry-2", amount: 2 })],
      new Map([
        ["plan-entry-1", SOUP],
        ["plan-entry-2", SOUP],
      ]),
    );
    expect(getNutrientValue(planned, "energie")).toBe(1260);
  });
});

test.describe("small pieces", () => {
  test("eatenAmount falls back to the planned amount", () => {
    expect(eatenAmount(planEntry({ amount: 2 }), completion())).toBe(2);
    expect(eatenAmount(planEntry({ amount: 2 }), completion({ amount: 0.5 }))).toBe(0.5);
    expect(eatenAmount(planEntry({ amount: 2 }), undefined)).toBe(0);
    expect(eatenAmount(planEntry({ amount: 2 }), completion({ skipped: true }))).toBe(0);
  });

  test("planEntryNutrients refuses to invent a negative or empty portion", () => {
    expect(planEntryNutrients(SOUP, 0)).toEqual([]);
    expect(planEntryNutrients(undefined, 2)).toEqual([]);
  });

  test("amounts read in their own unit", () => {
    expect(formatPlanAmount(60, "g")).toBe("60 g");
    expect(formatPlanAmount(1, "portion")).toBe("1 Portion");
    expect(formatPlanAmount(1.5, "portion")).toBe("1.5 Portionen");
  });
});

/**
 * The list the add dialog opens on.
 *
 * Two orderings share one list, and getting them the wrong way round is what
 * would make it useless: this slot's habits first, everything else by when it
 * was last eaten.
 */
test.describe("what this person has been eating", () => {
  function logDay(date: string, entries: ClientFoodLogEntry[]): ClientFoodLogDay {
    return { id: `day-${date}`, date, entries };
  }

  test("this slot's habits come before anything else, most frequent first", () => {
    const days = [
      logDay("2026-08-10", [
        logEntry({ id: "a", foodId: "bread", slotType: "fruehstueck" }),
        logEntry({ id: "b", foodId: "oats", slotType: "fruehstueck" }),
      ]),
      logDay("2026-08-11", [logEntry({ id: "c", foodId: "oats", slotType: "fruehstueck" })]),
      // Eaten more recently, but at dinner — it must not outrank breakfast.
      logDay("2026-08-12", [logEntry({ id: "d", foodId: "pasta", slotType: "abendessen" })]),
    ];

    expect(collectRecentEntries(days, "fruehstueck").map((row) => row.entry.foodId)).toEqual([
      "oats",
      "bread",
      "pasta",
    ]);
  });

  test("outside the slot, the most recent thing comes first", () => {
    const days = [
      logDay("2026-08-09", [logEntry({ id: "a", foodId: "rice", slotType: "abendessen" })]),
      logDay("2026-08-12", [logEntry({ id: "b", foodId: "pasta", slotType: "abendessen" })]),
    ];

    expect(collectRecentEntries(days, "fruehstueck").map((row) => row.entry.foodId)).toEqual([
      "pasta",
      "rice",
    ]);
  });

  test("the amount offered is the one used last, not the first ever", () => {
    const days = [
      logDay("2026-08-10", [logEntry({ id: "a", amount: 40 })]),
      logDay("2026-08-12", [logEntry({ id: "b", amount: 80 })]),
    ];

    const [oats] = collectRecentEntries(days, "fruehstueck");
    expect(oats.entry.amount).toBe(80);
    expect(oats.count).toBe(2);
    expect(oats.lastDate).toBe("2026-08-12");
  });

  test("something eaten in both slots is offered with this slot's portion", () => {
    const days = [
      // Newest first in the scan, so the dinner portion is seen before breakfast's.
      logDay("2026-08-12", [
        logEntry({ id: "a", amount: 200, slotType: "abendessen" }),
      ]),
      logDay("2026-08-11", [
        logEntry({ id: "b", amount: 50, slotType: "fruehstueck" }),
      ]),
    ];

    const [oats] = collectRecentEntries(days, "fruehstueck");
    expect(oats.inSlot).toBe(true);
    // 200 g of oats is dinner's answer to a breakfast question.
    expect(oats.entry.amount).toBe(50);
  });

  test("two different recipes stay two entries", () => {
    // Keyed as foods they would share an empty food id and collapse into one
    // row that claims to have been eaten twice.
    const days = [
      logDay("2026-08-12", [
        logEntry({ id: "a", sourceType: "recipe", foodId: undefined, recipeId: "soup" }),
        logEntry({ id: "b", sourceType: "recipe", foodId: undefined, recipeId: "curry" }),
      ]),
    ];

    expect(collectRecentEntries(days, "mittagessen")).toHaveLength(2);
  });

  test("an unpriceable row reports no energy rather than a free lunch", () => {
    expect(logEntryKcal(logEntry({ amount: 50 }), foods)).toBe(185);
    expect(logEntryKcal(logEntry({ foodId: "unknown-food" }), foods)).toBeUndefined();
  });
});
