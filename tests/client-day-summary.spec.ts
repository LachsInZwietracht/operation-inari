import { expect, test } from "@playwright/test";

import { hasEnoughToJudge, summarizeDay } from "@/lib/client-day-summary";
import type { ClientMicronutrientRow } from "@/lib/client-micronutrients";
import type { ClientDayTarget } from "@/lib/client-targets";

/**
 * The one part of the diary that has an opinion.
 *
 * Two properties matter more than any individual sentence: it never says
 * something it cannot stand behind, and it never says anything at all rather
 * than reaching for a generic compliment. A day summary that praises a gap in
 * the food database is worse than an empty card.
 */

const TARGET: ClientDayTarget = {
  source: "goal",
  kcal: 2000,
  protein: 100,
  fat: 70,
  carbs: 250,
};

function micro(overrides: Partial<ClientMicronutrientRow> = {}): ClientMicronutrientRow {
  return {
    nutrientId: "eisen",
    label: "Eisen",
    unit: "mg",
    group: "mineralstoffe",
    value: 15,
    target: 15,
    percent: 100,
    kind: "reach",
    coverage: 1,
    ...overrides,
  };
}

function day(overrides: Parameters<typeof summarizeDay>[0] | object = {}) {
  return summarizeDay({
    totals: [],
    target: null,
    micronutrients: [],
    entryCount: 5,
    isPast: false,
    ...overrides,
  } as Parameters<typeof summarizeDay>[0]);
}

test.describe("when there is anything to say at all", () => {
  test("a morning with one entry is not a day worth judging", () => {
    expect(hasEnoughToJudge({ entryCount: 1, isPast: false })).toBe(false);
    expect(hasEnoughToJudge({ entryCount: 3, isPast: false })).toBe(true);
  });

  test("a finished day is judged on whatever is in it", () => {
    // Yesterday's diary is as complete as it will ever be.
    expect(hasEnoughToJudge({ entryCount: 1, isPast: true })).toBe(true);
    expect(hasEnoughToJudge({ entryCount: 0, isPast: true })).toBe(false);
  });

  test("nothing good to report means no card, not an empty compliment", () => {
    expect(day({ totals: [{ nutrientId: "energie", amount: 900 }] })).toEqual([]);
  });
});

test.describe("what it will and will not celebrate", () => {
  test("all three macros near target reads as balanced", () => {
    const highlights = day({
      target: TARGET,
      totals: [
        { nutrientId: "energie", amount: 2000 },
        { nutrientId: "eiweiss", amount: 95 },
        { nutrientId: "fett", amount: 68 },
        { nutrientId: "kohlenhydrate", amount: 240 },
      ],
    });
    expect(highlights.map((entry) => entry.id)).toContain("balanced");
  });

  test("a kcal-only target is never called balanced", () => {
    // Without a macro preset there is no split to have hit; saying otherwise
    // would be a claim about something nobody ever set.
    const highlights = day({
      target: { source: "goal", kcal: 2000 } as ClientDayTarget,
      totals: [
        { nutrientId: "energie", amount: 2000 },
        { nutrientId: "eiweiss", amount: 95 },
      ],
    });
    expect(highlights.map((entry) => entry.id)).not.toContain("balanced");
    expect(highlights.map((entry) => entry.id)).toContain("energy");
  });

  test("a micronutrient the day had no data for is not praised", () => {
    // 100 % of a value derived from a quarter of the day is not an achievement,
    // it is a hole in the database wearing an achievement's clothes.
    const highlights = day({
      micronutrients: [micro({ coverage: 0.2 })],
    });
    expect(highlights).toEqual([]);
  });

  test("a well-covered micronutrient is named", () => {
    const highlights = day({ micronutrients: [micro()] });
    expect(highlights[0].text).toContain("Eisen");
  });

  test("nutrients that are in everything are not worth a compliment", () => {
    // "You hit your phosphorus" is praise for having eaten.
    const highlights = day({
      micronutrients: [micro({ nutrientId: "phosphor", label: "Phosphor" })],
    });
    expect(highlights).toEqual([]);
  });

  test("a ceiling is never a highlight", () => {
    const highlights = day({
      micronutrients: [
        micro({ nutrientId: "natrium", label: "Natrium", kind: "limit", percent: 180 }),
      ],
    });
    expect(highlights).toEqual([]);
  });

  test("a plan followed all the way through leads", () => {
    const highlights = day({
      plan: { planned: 4, eaten: 4 },
      micronutrients: [micro()],
    });
    expect(highlights[0].id).toBe("plan");
  });

  test("a plan only partly answered is not a plan followed", () => {
    const highlights = day({ plan: { planned: 4, eaten: 3 } });
    expect(highlights.map((entry) => entry.id)).not.toContain("plan");
  });

  test("at most three, so it reads as a fact and not as flattery", () => {
    const highlights = day({
      target: TARGET,
      totals: [
        { nutrientId: "energie", amount: 2000 },
        { nutrientId: "eiweiss", amount: 95 },
        { nutrientId: "fett", amount: 68 },
        { nutrientId: "kohlenhydrate", amount: 240 },
      ],
      plan: { planned: 3, eaten: 3 },
      waterMl: 2500,
      micronutrients: [
        micro(),
        micro({ nutrientId: "calcium", label: "Calcium" }),
        micro({ nutrientId: "ballaststoffe", label: "Ballaststoffe", value: 32 }),
      ],
    });
    expect(highlights).toHaveLength(3);
  });
});
