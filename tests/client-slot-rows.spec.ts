import { expect, test } from "@playwright/test";

import { buildSlotRows } from "@/lib/client-slot-rows";
import type {
  ClientFoodLogEntry,
  ClientMealCompletion,
  ClientPlanEntry,
  ClientPlanEntryFacts,
  Food,
} from "@/lib/types";

/**
 * The plan and the diary as one list.
 *
 * The rule under test is the one that made the merge safe: a replacement takes
 * the place of the row it replaced, and *only* an explicit replacement does.
 * An addition must never consume a planned row — there is no rule that could
 * pick which of two planned items a third thing stood in for, and a wrong
 * guess erases the only thing the plan exists to measure.
 */

const OATS = {
  id: "food-oats",
  name: "Haferflocken",
  baseAmount: 100,
  nutrients: [{ nutrientId: "energie", amount: 350 }],
} as unknown as Food;

const foods = new Map<string, Food>([[OATS.id, OATS]]);

function planEntry(overrides: Partial<ClientPlanEntry> = {}): ClientPlanEntry {
  return {
    id: "plan-1",
    slotType: "fruehstueck",
    entryType: "food",
    referenceId: OATS.id,
    amount: 60,
    ...overrides,
  } as ClientPlanEntry;
}

function facts(label: string): ClientPlanEntryFacts {
  return { perUnit: [{ nutrientId: "energie", amount: 3.5 }], label, unit: "g" };
}

function logEntry(overrides: Partial<ClientFoodLogEntry> = {}): ClientFoodLogEntry {
  return {
    id: "log-1",
    dayId: "day-1",
    slotType: "fruehstueck",
    sourceType: "food",
    foodId: OATS.id,
    amount: 50,
    loggedAt: "2026-08-14T07:00:00Z",
    sortOrder: 0,
    ...overrides,
  };
}

function build(input: {
  planEntries?: ClientPlanEntry[];
  planFacts?: Map<string, ClientPlanEntryFacts>;
  completions?: Map<string, ClientMealCompletion>;
  entries?: ClientFoodLogEntry[];
}) {
  return buildSlotRows({
    planEntries: input.planEntries ?? [],
    planFacts: input.planFacts ?? new Map(),
    completions: input.completions ?? new Map(),
    entries: input.entries ?? [],
    foods,
  });
}

test.describe("the plan drawn into the day", () => {
  test("an unanswered planned meal is a row of its own, not yet eaten", () => {
    const rows = build({
      planEntries: [planEntry()],
      planFacts: new Map([["plan-1", facts("Haferflocken")]]),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("planned");
    expect(rows[0].kind === "planned" && rows[0].isEaten).toBe(false);
    // Grey in the evening is itself the answer, so it needs no third state.
    expect(rows[0].kind === "planned" && rows[0].isSkipped).toBe(false);
  });

  test("ticking it off shows the amount actually eaten", () => {
    const rows = build({
      planEntries: [planEntry()],
      planFacts: new Map([["plan-1", facts("Haferflocken")]]),
      completions: new Map([
        ["plan-1", { mealEntryId: "plan-1", skipped: false, amount: 30 } as ClientMealCompletion],
      ]),
    });

    expect(rows[0].kind === "planned" && rows[0].isEaten).toBe(true);
    expect(rows[0].amount).toBe(30);
  });
});

test.describe("what may and may not consume a planned row", () => {
  test("an addition leaves the plan alone", () => {
    // The common case: you ate the planned breakfast and an apple as well.
    const rows = build({
      planEntries: [planEntry()],
      planFacts: new Map([["plan-1", facts("Haferflocken")]]),
      entries: [logEntry({ id: "apple" })],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("planned");
    expect(rows[1].kind).toBe("logged");
  });

  test("an explicit replacement stands where the planned row stood", () => {
    const rows = build({
      planEntries: [planEntry()],
      planFacts: new Map([["plan-1", facts("Linsensuppe")]]),
      entries: [logEntry({ id: "doener", replacesMealEntryId: "plan-1" })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("logged");
    // And it says what it stands in for, or it reads as an extra meal.
    expect(rows[0].kind === "logged" && rows[0].replacesLabel).toBe("Linsensuppe");
  });

  test("two planned rows and one addition keep all three apart", () => {
    // This is the case that makes automatic overwriting impossible: nothing
    // could say which of the two planned items the third thing replaced.
    const rows = build({
      planEntries: [planEntry(), planEntry({ id: "plan-2" })],
      planFacts: new Map([
        ["plan-1", facts("Haferflocken")],
        ["plan-2", facts("Banane")],
      ]),
      entries: [logEntry({ id: "roll" })],
    });

    expect(rows.map((row) => row.kind)).toEqual(["planned", "planned", "logged"]);
  });

  test("a replacement only takes the row it names", () => {
    const rows = build({
      planEntries: [planEntry(), planEntry({ id: "plan-2" })],
      planFacts: new Map([
        ["plan-1", facts("Haferflocken")],
        ["plan-2", facts("Banane")],
      ]),
      entries: [logEntry({ id: "roll", replacesMealEntryId: "plan-2" })],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("planned");
    expect(rows[1].kind === "logged" && rows[1].replacesLabel).toBe("Banane");
  });
});
