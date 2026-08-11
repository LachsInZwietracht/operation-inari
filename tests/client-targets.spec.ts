import { expect, test } from "@playwright/test";

import {
  macroGramsFromKcal,
  resolveClientDayTarget,
  targetProgress,
} from "@/lib/client-targets";

/**
 * Which reference the diary measures a day against.
 *
 * The ordering is the substance here: a plan written for *this* date beats a
 * standing goal, which beats a derived requirement. And all three beat the
 * fourth case only when they actually exist — a client nobody is treating must
 * not be handed a target the app made up.
 */

const ENERGY = {
  dailyCalorieGoal: 1800,
  macroPreset: "balanced",
  pal: 1.4,
  basalKcal: 1500,
};

const PLANNED = [
  { nutrientId: "energie", amount: 2010.4 },
  { nutrientId: "eiweiss", amount: 96.2 },
  { nutrientId: "fett", amount: 70.8 },
  { nutrientId: "kohlenhydrate", amount: 240.1 },
];

test.describe("target precedence", () => {
  test("the day's own plan wins over a standing goal", () => {
    const target = resolveClientDayTarget({ plannedNutrients: PLANNED, energy: ENERGY });

    expect(target?.source).toBe("plan");
    expect(target?.kcal).toBe(2010);
    // A plan's macros come from the plan, not from a percentage split.
    expect(target?.protein).toBe(96);
    expect(target?.carbs).toBe(240);
  });

  test("without a plan, the counselor's goal applies", () => {
    const target = resolveClientDayTarget({ plannedNutrients: [], energy: ENERGY });

    expect(target?.source).toBe("goal");
    expect(target?.kcal).toBe(1800);
    // 50/30/20 of 1800 kcal.
    expect(target?.carbs).toBe(225);
    expect(target?.fat).toBe(60);
    expect(target?.protein).toBe(90);
  });

  test("without a goal, maintenance is basal rate × PAL", () => {
    const target = resolveClientDayTarget({
      energy: { ...ENERGY, dailyCalorieGoal: undefined },
    });

    expect(target?.source).toBe("bedarf");
    expect(target?.kcal).toBe(2100);
  });

  test("no reference at all is a valid answer", () => {
    expect(resolveClientDayTarget({ energy: null })).toBeNull();
    expect(resolveClientDayTarget({ plannedNutrients: [], energy: {} })).toBeNull();
    // Half the inputs is not enough to derive maintenance from.
    expect(resolveClientDayTarget({ energy: { basalKcal: 1500 } })).toBeNull();
    expect(resolveClientDayTarget({ energy: { pal: 1.4 } })).toBeNull();
  });

  test("an empty plan does not count as a plan", () => {
    const target = resolveClientDayTarget({
      plannedNutrients: [{ nutrientId: "energie", amount: 0 }],
      energy: ENERGY,
    });
    expect(target?.source).toBe("goal");
  });
});

test.describe("macro split", () => {
  test("splits energy by the preset's percentages", () => {
    // Keto: 5 / 70 / 25 of 2000 kcal.
    expect(macroGramsFromKcal(2000, "keto")).toEqual({ carbs: 25, fat: 156, protein: 125 });
  });

  test("an unknown or missing preset yields no macro targets", () => {
    expect(macroGramsFromKcal(2000, "gibtsnicht")).toEqual({});
    expect(macroGramsFromKcal(2000, undefined)).toEqual({});
  });
});

test.describe("progress", () => {
  test("caps at full instead of reporting an overshoot", () => {
    // Deliberate: the bar has no "too much" state.
    expect(targetProgress(2400, 2000)).toBe(100);
    expect(targetProgress(1000, 2000)).toBe(50);
  });

  test("no target means no progress to show", () => {
    expect(targetProgress(1000, undefined)).toBe(0);
    expect(targetProgress(1000, 0)).toBe(0);
  });
});
