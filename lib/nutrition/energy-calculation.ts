import type { MacroPreset } from "@/lib/nutrition/macro-presets"

export type EnergySex = "male" | "female" | "diverse"
export type EnergyFormula = "mifflin" | "harris"

export const KCAL_PER_KG_WEIGHT_CHANGE = 7700

/**
 * The formula the patient record calculates with.
 *
 * Shared so the energy panel, the overview card and any projection built on top
 * of them cannot drift onto different equations and quote a patient two
 * different Grundumsatz values on two tabs.
 */
export const PATIENT_ENERGY_FORMULA: EnergyFormula = "mifflin"

/**
 * The activity factors offered anywhere a PAL can be picked.
 *
 * Shared so the patient overview and the Aktivität tab cannot drift onto two
 * different ladders and describe 1,6 as two different lives.
 */
export const PAL_LEVELS = [
  { value: "1.2", short: "Ruhig / Büro", label: "1.2 · Ruhig/Büro" },
  { value: "1.4", short: "Leichte Aktivität", label: "1.4 · Leichte Aktivität" },
  { value: "1.6", short: "Aktiv (Pflege, Handel)", label: "1.6 · Aktiv (Pflege, Handel)" },
  { value: "1.8", short: "Sportlich", label: "1.8 · Sportlich" },
  { value: "2.0", short: "Leistungssport", label: "2.0 · Leistungssport" },
] as const

export interface EnergyCalculationInput {
  sex: EnergySex
  formula: EnergyFormula
  weightKg: number
  heightCm: number
  ageYears: number
  pal: number
  calorieDelta?: number
  macroPreset?: MacroPreset
}

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Calculates the resting energy requirement from valid body measurements.
 * The diverse value is the midpoint of the binary reference formulas. It is a
 * transparent estimate, not a clinical statement about an individual person.
 */
export function calculateBasalMetabolicRate(
  sex: EnergySex,
  formula: EnergyFormula,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const weight = Math.max(0, finite(weightKg, 0))
  const height = Math.max(0, finite(heightCm, 0))
  const age = Math.max(0, finite(ageYears, 0))

  if (formula === "harris") {
    const male = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
    const female = 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age
    return sex === "male" ? male : sex === "female" ? female : (male + female) / 2
  }

  const base = 10 * weight + 6.25 * height - 5 * age
  return sex === "male" ? base + 5 : sex === "female" ? base - 161 : base - 78
}

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  const weight = finite(weightKg, 0)
  const height = finite(heightCm, 0)
  if (weight <= 0 || height <= 0) return null
  return weight / (height / 100) ** 2
}

export function calculateEnergy(input: EnergyCalculationInput) {
  const basalMetabolicRate = Math.max(
    0,
    calculateBasalMetabolicRate(
      input.sex,
      input.formula,
      input.weightKg,
      input.heightCm,
      input.ageYears,
    ),
  )
  const pal = Math.max(0, finite(input.pal, 0))
  const calorieDelta = finite(input.calorieDelta ?? 0, 0)
  const totalEnergyExpenditure = basalMetabolicRate * pal
  const targetEnergy = Math.max(0, totalEnergyExpenditure + calorieDelta)
  const bmi = calculateBmi(input.weightKg, input.heightCm)
  const weeklyWeightChangeKg = (calorieDelta * 7) / KCAL_PER_KG_WEIGHT_CHANGE
  const macros = input.macroPreset
    ? (["carbs", "fat", "protein"] as const).map((key) => {
        const kcalPerGram = key === "fat" ? 9 : 4
        const percentage = input.macroPreset![key]
        const kcal = (targetEnergy * percentage) / 100
        return { key, percentage, kcal, grams: kcal / kcalPerGram }
      })
    : []

  return {
    basalMetabolicRate,
    totalEnergyExpenditure,
    targetEnergy,
    weeklyWeightChangeKg,
    bmi,
    macros,
  }
}

/** Keeps a radial chart readable for very low and very high target values. */
export function energyGaugeMaximum(targetEnergy: number, totalEnergyExpenditure: number): number {
  const reference = Math.max(0, finite(targetEnergy, 0), finite(totalEnergyExpenditure, 0))
  return Math.max(2000, Math.ceil(reference / 500) * 500)
}
