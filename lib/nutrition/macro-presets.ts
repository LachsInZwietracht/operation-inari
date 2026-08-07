export interface MacroPreset {
  id: string;
  label: string;
  /** Percent of total energy. The three values always sum to 100. */
  carbs: number;
  fat: number;
  protein: number;
}

/**
 * Macro distribution presets referenced by `patients.macro_preset`.
 * Shared by the Kalorienrechner and the plan principles so both derive the same
 * gram targets from the same numbers.
 */
export const MACRO_PRESETS: MacroPreset[] = [
  { id: "balanced", label: "Ausgewogen", carbs: 50, fat: 30, protein: 20 },
  { id: "lowcarb", label: "Low Carb", carbs: 30, fat: 40, protein: 30 },
  { id: "protein", label: "Eiweißreich", carbs: 35, fat: 30, protein: 35 },
  { id: "keto", label: "Ketogen", carbs: 5, fat: 70, protein: 25 },
];

export const MACRO_KCAL_PER_GRAM = {
  carbs: 4,
  fat: 9,
  protein: 4,
} as const;

export function findMacroPreset(presetId?: string): MacroPreset | undefined {
  if (!presetId) return undefined;
  return MACRO_PRESETS.find((preset) => preset.id === presetId);
}
