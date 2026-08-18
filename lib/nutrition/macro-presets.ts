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

/**
 * Prefix marking a split the counselor typed rather than picked.
 *
 * `patients.macro_preset` is a plain TEXT column with no enum behind it, so a
 * custom split rides in the same field as the preset ids: `custom:50/30/20`,
 * carbs/fat/protein. That keeps one source of truth for "what split applies to
 * this patient" — the RPC that feeds the client's diary passes the column
 * through untouched, and every consumer resolves it through
 * {@link findMacroPreset}.
 */
const CUSTOM_PREFIX = "custom:";

export const CUSTOM_MACRO_LABEL = "Individuell";

export interface MacroSplit {
  carbs: number;
  fat: number;
  protein: number;
}

/** True when the three shares are whole percentages adding up to 100. */
export function isValidMacroSplit(split: MacroSplit): boolean {
  const values = [split.carbs, split.fat, split.protein];
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
    return false;
  }
  return values.reduce((sum, value) => sum + value, 0) === 100;
}

/** Encodes a hand-set split for `patients.macro_preset`. */
export function serializeMacroSplit(split: MacroSplit): string {
  return `${CUSTOM_PREFIX}${split.carbs}/${split.fat}/${split.protein}`;
}

export function isCustomMacroPreset(presetId?: string): boolean {
  return Boolean(presetId?.startsWith(CUSTOM_PREFIX));
}

function parseCustomMacroPreset(presetId: string): MacroPreset | undefined {
  const parts = presetId.slice(CUSTOM_PREFIX.length).split("/");
  if (parts.length !== 3) return undefined;
  const [carbs, fat, protein] = parts.map((part) => Number.parseInt(part, 10));
  const split = { carbs, fat, protein };
  if (!isValidMacroSplit(split)) return undefined;
  return { id: presetId, label: CUSTOM_MACRO_LABEL, ...split };
}

/**
 * Resolves a stored macro preset id — a named preset or a hand-set split.
 *
 * Returns undefined for anything it cannot read, so a malformed value falls
 * back to "no split known" rather than to a made-up one.
 */
export function findMacroPreset(presetId?: string): MacroPreset | undefined {
  if (!presetId) return undefined;
  if (isCustomMacroPreset(presetId)) return parseCustomMacroPreset(presetId);
  return MACRO_PRESETS.find((preset) => preset.id === presetId);
}
