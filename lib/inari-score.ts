import { getNutrientValue } from "@/lib/nutrients"
import type { NutrientValue } from "@/lib/types"

export type InariScoreRating = "A" | "B" | "C" | "D" | "E"

export interface InariScoreDriver {
  id: string
  label: string
  value: number
  unit: string
  impact: number
  trend: "positive" | "negative"
  description: string
}

export interface InariScoreResult {
  score: number
  rating: InariScoreRating
  badge: InariScoreBadge
  summary: string
  drivers: InariScoreDriver[]
}

export interface InariScoreBadge {
  label: InariScoreRating | "–"
  color: string
  description: string
}

const BADGES: Record<InariScoreRating, Omit<InariScoreBadge, "label">> = {
  A: { color: "bg-emerald-100 text-emerald-900", description: "Optimal ausgewogen" },
  B: { color: "bg-lime-100 text-lime-900", description: "Sehr gute Qualität" },
  C: { color: "bg-amber-100 text-amber-900", description: "Ausgewogen" },
  D: { color: "bg-orange-100 text-orange-900", description: "Verbesserungspotenzial" },
  E: { color: "bg-red-100 text-red-900", description: "Unausgewogen" },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalize(value: number, target: number): number {
  if (target <= 0) return 0
  return clamp(value / target, 0, 1)
}

const SUMMARY_BY_RATING: Record<InariScoreRating, string> = {
  A: "Sehr hohe Nährstoffdichte bei geringer Belastung",
  B: "Hohe Qualität mit wenigen Risiken",
  C: "Solide Basisversorgung – Details prüfen",
  D: "Mehr Ballaststoffe & Mikronährstoffe empfohlen",
  E: "Therapiekritisch – Rezeptur prüfen",
}

export function calculateInariScore(nutrients: NutrientValue[]): InariScoreResult {
  const energy = getNutrientValue(nutrients, "energie")
  const protein = getNutrientValue(nutrients, "eiweiss")
  const fiber = getNutrientValue(nutrients, "ballaststoffe")
  const satFat = getNutrientValue(nutrients, "gesaettigte_fettsaeuren")
  const unsatFat = getNutrientValue(nutrients, "ungesaettigte_fettsaeuren")
  const sugar = getNutrientValue(nutrients, "zucker")
  const sodium = getNutrientValue(nutrients, "natrium")
  const vitaminC = getNutrientValue(nutrients, "vitamin_c")
  const calcium = getNutrientValue(nutrients, "calcium")
  const iron = getNutrientValue(nutrients, "eisen")
  const magnesium = getNutrientValue(nutrients, "magnesium")

  const unsatRatio = satFat > 0 ? unsatFat / satFat : unsatFat > 0 ? 2 : 1
  const microDensity = (normalize(vitaminC, 80) + normalize(calcium, 1000) + normalize(iron, 18) + normalize(magnesium, 400)) / 4
  const energyDensity = energy > 0 ? energy / 100 : 0

  const driverConfigs = [
    { id: "fiber", label: "Ballaststoffe", value: fiber, unit: "g", trend: "positive" as const, weight: 22, score: normalize(fiber, 30), description: "≥ 30 g pro Tag" },
    { id: "protein", label: "Proteinqualität", value: protein, unit: "g", trend: "positive" as const, weight: 18, score: normalize(protein, 25), description: "Mind. 25 g je Mahlzeit" },
    { id: "unsat", label: "Fettsäure-Verhältnis", value: unsatRatio, unit: ":1", trend: "positive" as const, weight: 12, score: normalize(unsatRatio, 2), description: "Ungesättigte ≥ 2× gesättigte" },
    { id: "micros", label: "Mikronährstoffdichte", value: microDensity * 100, unit: "%", trend: "positive" as const, weight: 10, score: microDensity, description: "Vit. C, Ca, Mg, Fe decken Zielwerte" },
    { id: "satFat", label: "Ges. Fettsäuren", value: satFat, unit: "g", trend: "negative" as const, weight: 18, score: normalize(satFat, 20), description: "< 20 g / Tag" },
    { id: "sugar", label: "Freier Zucker", value: sugar, unit: "g", trend: "negative" as const, weight: 12, score: normalize(sugar, 50), description: "< 50 g / Tag" },
    { id: "sodium", label: "Natrium", value: sodium, unit: "mg", trend: "negative" as const, weight: 10, score: normalize(sodium, 2000), description: "< 2 g Natrium" },
    { id: "energy", label: "Energiedichte", value: energyDensity, unit: "kcal/100g", trend: "negative" as const, weight: 8, score: normalize(energyDensity, 2.5), description: "≤ 250 kcal je 100 g" },
  ]

  let positiveImpact = 0
  let negativeImpact = 0

  const drivers: InariScoreDriver[] = driverConfigs.map((config) => {
    const rawImpact = config.score * config.weight
    if (config.trend === "positive") {
      positiveImpact += rawImpact
    } else {
      negativeImpact += rawImpact
    }
    return {
      id: config.id,
      label: config.label,
      value: config.value,
      unit: config.unit,
      impact: config.trend === "positive" ? rawImpact : -rawImpact,
      trend: config.trend,
      description: config.description,
    }
  })

  const base = 55
  const score = clamp(base + positiveImpact - negativeImpact, 5, 100)

  const rating: InariScoreRating = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E"

  return {
    score,
    rating,
    badge: getInariScoreBadge(score),
    summary: SUMMARY_BY_RATING[rating],
    drivers,
  }
}

export function getInariScoreBadge(score?: number): InariScoreBadge {
  if (score === undefined) {
    return { label: "–", color: "bg-slate-200 text-slate-900", description: "Keine Daten" }
  }
  const rating: InariScoreRating = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E"
  const badge = BADGES[rating]
  return { label: rating, color: badge.color, description: badge.description }
}
