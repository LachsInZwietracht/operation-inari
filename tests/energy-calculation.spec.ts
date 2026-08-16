import { expect, test } from "@playwright/test"

import { MACRO_PRESETS } from "@/lib/nutrition/macro-presets"
import {
  calculateBasalMetabolicRate,
  calculateBmi,
  calculateEnergy,
  energyGaugeMaximum,
} from "@/lib/nutrition/energy-calculation"

test.describe("energy calculation", () => {
  test("calculates Mifflin-St Jeor and Harris-Benedict deterministically", () => {
    expect(calculateBasalMetabolicRate("male", "mifflin", 80, 180, 40)).toBe(1730)
    expect(calculateBasalMetabolicRate("female", "harris", 60, 165, 30)).toBeCloseTo(1383.683, 3)
  })

  test("derives target energy, BMI, weekly change, and macro grams together", () => {
    const result = calculateEnergy({
      sex: "female",
      formula: "mifflin",
      weightKg: 70,
      heightCm: 170,
      ageYears: 35,
      pal: 1.4,
      calorieDelta: -500,
      macroPreset: MACRO_PRESETS[0],
    })

    expect(result.basalMetabolicRate).toBe(1426.5)
    expect(result.totalEnergyExpenditure).toBeCloseTo(1997.1, 3)
    expect(result.targetEnergy).toBeCloseTo(1497.1, 3)
    expect(result.weeklyWeightChangeKg).toBeCloseTo(-0.4545, 3)
    expect(result.bmi).toBeCloseTo(24.22, 2)
    expect(result.macros[0]).toMatchObject({ key: "carbs", percentage: 50 })
    expect(result.macros[0]?.grams).toBeCloseTo(187.1375, 4)
    expect(result.macros[1]?.grams).toBeCloseTo(49.9033, 4)
    expect(result.macros[2]?.grams).toBeCloseTo(74.855, 4)
  })

  test("does not create a BMI from missing measurements and scales the gauge", () => {
    expect(calculateBmi(70, 0)).toBeNull()
    expect(energyGaugeMaximum(4_850, 4_600)).toBe(5_000)
    expect(energyGaugeMaximum(1_300, 1_800)).toBe(2_000)
  })
})
