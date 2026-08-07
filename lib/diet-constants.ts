import type { DietExclusion, DietStyle } from "@/lib/types/patient";

/**
 * Diet vocabulary shared by the patient workspace, the public intake form, and
 * plan principles. Mirrors `lib/allergen-constants.ts`.
 *
 * A style is a single choice ("how do you eat?"). An exclusion is one of many
 * ("what is off the table?"). Medical allergies and intolerances are not listed
 * here — those live in `patient_allergens` so warning logic stays centralized.
 */

export const DIET_STYLES: DietStyle[] = [
  "omnivor",
  "vegetarisch",
  "vegan",
  "pescetarisch",
  "low_carb",
  "keto",
  "carnivore",
  "mediterran",
];

export const DIET_EXCLUSIONS: DietExclusion[] = [
  "no_dairy",
  "no_pork",
  "no_red_meat",
  "no_alcohol",
  "no_gluten_by_choice",
  "halal",
  "kosher",
];

export const DIET_STYLE_LABELS: Record<DietStyle, string> = {
  omnivor: "Alles (omnivor)",
  vegetarisch: "Vegetarisch",
  vegan: "Vegan",
  pescetarisch: "Pescetarisch",
  low_carb: "Low Carb",
  keto: "Ketogen",
  carnivore: "Carnivore",
  mediterran: "Mediterran",
};

export const DIET_STYLE_DESCRIPTIONS: Record<DietStyle, string> = {
  omnivor: "keine grundsätzliche Einschränkung",
  vegetarisch: "ohne Fleisch und Fisch",
  vegan: "ohne tierische Zutaten",
  pescetarisch: "ohne Fleisch, mit Fisch",
  low_carb: "kohlenhydratarm",
  keto: "sehr kohlenhydratarm, fettbetont",
  carnivore: "überwiegend tierische Lebensmittel",
  mediterran: "Gemüse, Olivenöl, Fisch, Hülsenfrüchte",
};

export const DIET_EXCLUSION_LABELS: Record<DietExclusion, string> = {
  no_dairy: "Keine Milchprodukte",
  no_pork: "Kein Schweinefleisch",
  no_red_meat: "Kein rotes Fleisch",
  no_alcohol: "Kein Alkohol",
  no_gluten_by_choice: "Glutenfrei (freiwillig)",
  halal: "Halal",
  kosher: "Koscher",
};

/** Legacy `nutrition_preferences` values that became `diet_style`. */
const LEGACY_STYLE_VALUES: Record<string, DietStyle> = {
  vegetarian: "vegetarisch",
  vegan: "vegan",
  keto: "keto",
  low_carb: "low_carb",
};

/**
 * Reads a diet style from a patient whose row predates the style/exclusion
 * split, so clients still render correctly if the backfill has not run yet.
 */
export function resolveDietStyle(
  dietStyle: DietStyle | undefined,
  nutritionPreferences: readonly string[] | undefined,
): DietStyle | undefined {
  if (dietStyle) return dietStyle;
  if (!nutritionPreferences?.length) return undefined;

  for (const legacy of ["vegan", "vegetarian", "keto", "low_carb"]) {
    if (nutritionPreferences.includes(legacy)) {
      return LEGACY_STYLE_VALUES[legacy];
    }
  }

  return undefined;
}

export function isDietExclusion(value: string): value is DietExclusion {
  return (DIET_EXCLUSIONS as string[]).includes(value);
}
