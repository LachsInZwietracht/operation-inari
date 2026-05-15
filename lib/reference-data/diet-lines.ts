import type { DietLinePreset } from "@/lib/types";

export const DIET_LINES: DietLinePreset[] = [
  {
    id: "diet_normal",
    name: "Normalernährung",
    description: "Ausgewogene Vollkost gemäß DGE.",
    targets: [
      { nutrientId: "energie", label: "Energie", unit: "kcal", min: 1800, max: 2200 },
      { nutrientId: "eiweiss", label: "Eiweiß", unit: "g", min: 60, max: 90 },
      { nutrientId: "kohlenhydrate", label: "Kohlenhydrate", unit: "g", min: 200, max: 320 },
      { nutrientId: "fett", label: "Fett", unit: "g", min: 50, max: 80 },
      { nutrientId: "natrium", label: "Natrium", unit: "mg", max: 2000 },
    ],
  },
  {
    id: "diet_diabetes",
    name: "Diabetes",
    description: "Kohlenhydratbewusst mit BE/KE-Steuerung.",
    targets: [
      { nutrientId: "energie", label: "Energie", unit: "kcal", min: 1600, max: 2000 },
      { nutrientId: "kohlenhydrate", label: "Kohlenhydrate", unit: "g", max: 180 },
      // Daily BE upper bound is set; no min so the optimization assistant does
      // not try to push a diabetic patient toward *more* carbs to hit a floor.
      { nutrientId: "broteinheiten", label: "Broteinheiten", unit: "BE", max: 15 },
      { nutrientId: "ballaststoffe", label: "Ballaststoffe", unit: "g", min: 30 },
      { nutrientId: "fett", label: "Fett", unit: "g", max: 70 },
      { nutrientId: "zucker", label: "Zucker", unit: "g", max: 40 },
    ],
  },
  {
    id: "diet_renal",
    name: "Niereninsuffizienz",
    description: "Eiweiß- und elektrolytangepasst.",
    targets: [
      { nutrientId: "eiweiss", label: "Eiweiß", unit: "g", max: 55 },
      { nutrientId: "kalium", label: "Kalium", unit: "mg", max: 2000 },
      { nutrientId: "phosphor", label: "Phosphor", unit: "mg", max: 800 },
      { nutrientId: "natrium", label: "Natrium", unit: "mg", max: 1500 },
      { nutrientId: "energie", label: "Energie", unit: "kcal", min: 1900 },
    ],
  },
];
