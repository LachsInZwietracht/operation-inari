import { expect, test } from "@playwright/test";

import {
  estimateActivityEnergy,
  findActivity,
  matchActivityByName,
  MET_ACTIVITIES,
  normalizeIntensity,
} from "@/lib/energy-expenditure";

/**
 * The energy estimate is a number a client will read as a fact about their own
 * body, and one they may eat back. What is pinned here is less the arithmetic
 * than the two decisions that keep it from overstating: the figure is net of
 * resting metabolism, and a missing input produces no estimate rather than a
 * zero.
 */

test.describe("energy estimate", () => {
  test("net excludes the resting metabolism gross includes", () => {
    // 80 kg, one hour of moderate cycling (6.8 MET).
    const estimate = estimateActivityEnergy({
      activityId: "radfahren",
      intensity: "moderat",
      minutes: 60,
      weightKg: 80,
    })!;

    expect(estimate.met).toBe(6.8);
    expect(estimate.grossKcal).toBe(571); // 6.8 × 3.5 × 80 / 200 × 60
    expect(estimate.netKcal).toBe(487); // (6.8 − 1) × …
    // Roughly one MET-hour apart, which for 80 kg is about 84 kcal.
    expect(estimate.grossKcal - estimate.netKcal).toBeGreaterThan(80);
  });

  test("resistance training carries the widest range", () => {
    const strength = estimateActivityEnergy({
      activityId: "kraft",
      intensity: "moderat",
      minutes: 60,
      weightKg: 80,
    })!;

    const spread = (strength.highKcal - strength.lowKcal) / strength.netKcal;
    expect(spread).toBeCloseTo(0.6, 1);
    expect(strength.lowKcal).toBeLessThan(strength.netKcal);
    expect(strength.highKcal).toBeGreaterThan(strength.netKcal);
  });

  test("scales with body weight and duration", () => {
    const base = estimateActivityEnergy({
      activityId: "laufen",
      intensity: "moderat",
      minutes: 30,
      weightKg: 70,
    })!;
    const heavier = estimateActivityEnergy({
      activityId: "laufen",
      intensity: "moderat",
      minutes: 30,
      weightKg: 140,
    })!;
    const longer = estimateActivityEnergy({
      activityId: "laufen",
      intensity: "moderat",
      minutes: 60,
      weightKg: 70,
    })!;

    // Rounded to whole kcal at the end, so doubling can land a kcal apart.
    expect(Math.abs(heavier.netKcal - base.netKcal * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(longer.netKcal - base.netKcal * 2)).toBeLessThanOrEqual(1);
  });

  test("intensity moves the number in the right direction", () => {
    const forIntensity = (intensity: string) =>
      estimateActivityEnergy({ activityId: "laufen", intensity, minutes: 30, weightKg: 80 })!
        .netKcal;

    expect(forIntensity("leicht")).toBeLessThan(forIntensity("moderat"));
    expect(forIntensity("moderat")).toBeLessThan(forIntensity("intensiv"));
  });

  test("a missing input yields no estimate rather than a zero", () => {
    expect(estimateActivityEnergy({ activityId: "kraft", minutes: 60 })).toBeNull();
    expect(estimateActivityEnergy({ activityId: "kraft", weightKg: 80 })).toBeNull();
    expect(estimateActivityEnergy({ minutes: 0, weightKg: 80 })).toBeNull();
  });
});

test.describe("activity lookup", () => {
  test("unknown keys fall back instead of failing", () => {
    expect(findActivity("gibtsnicht").id).toBe("sonstiges");
    expect(findActivity(undefined).id).toBe("sonstiges");
  });

  test("reads the activity out of a free-text name", () => {
    expect(matchActivityByName("Spaziergang mit dem Hund").id).toBe("gehen");
    expect(matchActivityByName("Abends joggen").id).toBe("laufen");
    expect(matchActivityByName("Fahrrad zur Arbeit").id).toBe("radfahren");
    expect(matchActivityByName("Töpfern").id).toBe("sonstiges");
  });

  test("intensity is normalized to the three the table knows", () => {
    expect(normalizeIntensity("intensiv")).toBe("intensiv");
    expect(normalizeIntensity("sehr doll")).toBe("moderat");
    expect(normalizeIntensity(null)).toBe("moderat");
  });

  test("every entry is ordered and above resting metabolism", () => {
    for (const activity of MET_ACTIVITIES) {
      expect(activity.met.leicht).toBeGreaterThan(1);
      expect(activity.met.leicht).toBeLessThanOrEqual(activity.met.moderat);
      expect(activity.met.moderat).toBeLessThanOrEqual(activity.met.intensiv);
    }
  });
});
