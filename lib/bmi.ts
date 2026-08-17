/**
 * BMI classification and the weight range that goes with it.
 *
 * The categories are the WHO cut-offs used in German clinical practice
 * (Untergewicht < 18,5 · Normalgewicht < 25 · Präadipositas < 30 · Adipositas
 * Grad I–III). They are collapsed to five bands here, because a scale that
 * separates Adipositas Grad II from Grad III costs the reader more attention
 * than it returns on a patient overview.
 *
 * Two things this module deliberately does:
 *
 * 1. It answers "and what would be sensible?" in kilograms, not just in BMI
 *    points. A practitioner talks to a patient about weight, so the target has
 *    to be expressed in the unit the patient stands on.
 *
 * 2. It shifts the healthy range upward from 65 years on (22,0–26,9 instead of
 *    18,5–24,9). That follows the DGE and ESPEN recommendation for older
 *    adults, where a low BMI carries the greater risk. Without the shift the
 *    app would flag a healthy 70-year-old as overweight.
 *
 * BMI itself says nothing about body composition. It is a screening number, and
 * every label here should be read as "worth a look", never as a diagnosis.
 */

export type BmiCategoryId =
  | "untergewicht"
  | "normalgewicht"
  | "uebergewicht"
  | "adipositas-1"
  | "adipositas-2";

export interface BmiCategory {
  id: BmiCategoryId;
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound; `Infinity` on the last band. */
  max: number;
  /** CSS colour, resolved from the theme so it follows dark mode. */
  color: string;
}

/** The visible span of the scale. Values outside it are clamped onto the ends. */
export const BMI_SCALE_MIN = 15;
export const BMI_SCALE_MAX = 40;

export const BMI_CATEGORIES: BmiCategory[] = [
  {
    id: "untergewicht",
    label: "Untergewicht",
    min: 0,
    max: 18.5,
    color: "var(--color-chart-2)",
  },
  {
    id: "normalgewicht",
    label: "Normalgewicht",
    min: 18.5,
    max: 25,
    color: "var(--color-chart-1)",
  },
  {
    id: "uebergewicht",
    label: "Präadipositas",
    min: 25,
    max: 30,
    color: "var(--color-chart-4)",
  },
  {
    id: "adipositas-1",
    label: "Adipositas I",
    min: 30,
    max: 35,
    color: "var(--color-chart-5)",
  },
  {
    id: "adipositas-2",
    label: "Adipositas II+",
    min: 35,
    max: Infinity,
    color: "var(--color-destructive)",
  },
];

export function bmiCategory(bmi: number): BmiCategory {
  return BMI_CATEGORIES.find((entry) => bmi < entry.max) ?? BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
}

export interface BmiRange {
  min: number;
  max: number;
  /** True when the range was raised because of the patient's age. */
  ageAdjusted: boolean;
}

/**
 * The BMI range to aim for. Above 65 the target moves up — see the module note.
 * `age` may be omitted, in which case the adult range is used.
 */
export function healthyBmiRange(age?: number): BmiRange {
  if (age !== undefined && age >= 65) {
    return { min: 22, max: 26.9, ageAdjusted: true };
  }
  return { min: 18.5, max: 24.9, ageAdjusted: false };
}

/** Body weight in kg that produces `bmi` at `heightCm`. */
export function weightForBmi(bmi: number, heightCm: number): number {
  const metres = heightCm / 100;
  return bmi * metres * metres;
}

/** The healthy range from {@link healthyBmiRange}, expressed in kilograms. */
export function healthyWeightRange(
  heightCm: number,
  age?: number,
): { min: number; max: number; ageAdjusted: boolean } | null {
  if (!heightCm || heightCm <= 0) return null;
  const range = healthyBmiRange(age);
  return {
    min: weightForBmi(range.min, heightCm),
    max: weightForBmi(range.max, heightCm),
    ageAdjusted: range.ageAdjusted,
  };
}

/** Position of `bmi` on the scale, as a percentage from its left edge. */
export function bmiScalePosition(bmi: number): number {
  const clamped = Math.min(Math.max(bmi, BMI_SCALE_MIN), BMI_SCALE_MAX);
  return ((clamped - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100;
}

/** Width of a category band on the scale, as a percentage. */
export function bmiBandWidth(category: BmiCategory): number {
  const from = Math.max(category.min, BMI_SCALE_MIN);
  const to = Math.min(category.max, BMI_SCALE_MAX);
  return ((to - from) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100;
}
