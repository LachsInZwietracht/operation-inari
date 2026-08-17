import { z } from "zod";

import { ALLERGEN_DEFINITIONS } from "@/lib/allergen-constants";
import { DIET_EXCLUSIONS, DIET_STYLES } from "@/lib/diet-constants";
import { INTAKE_FOOD_PREFERENCES } from "@/lib/intake-food-preferences";
import type { DietExclusion, DietStyle } from "@/lib/types/patient";

/**
 * Runtime contract for the public intake form at `/onboarding/[linkId]`.
 * This is the authoritative validation for untrusted input, so every string and
 * array carries an explicit bound.
 */

const dietStyleSchema = z.enum(DIET_STYLES as [DietStyle, ...DietStyle[]]);
const dietExclusionSchema = z.enum(
  DIET_EXCLUSIONS as [DietExclusion, ...DietExclusion[]],
);

export const INTAKE_PRIMARY_GOALS = [
  "abnehmen",
  "zunehmen",
  "gewicht_halten",
  "muskelaufbau",
  "gesuender_essen",
  "mehr_energie",
  "leistung_steigern",
  "beschwerden_lindern",
] as const;

export const INTAKE_PRIMARY_GOAL_LABELS: Record<
  (typeof INTAKE_PRIMARY_GOALS)[number],
  string
> = {
  abnehmen: "Abnehmen",
  zunehmen: "Zunehmen",
  gewicht_halten: "Gewicht halten",
  muskelaufbau: "Muskeln aufbauen",
  gesuender_essen: "Gesünder essen",
  mehr_energie: "Mehr Energie im Alltag",
  leistung_steigern: "Sportliche Leistung steigern",
  beschwerden_lindern: "Beschwerden lindern",
};

/** How often someone eats breakfast. "Manchmal" is the honest middle answer. */
export const INTAKE_BREAKFAST_FREQUENCIES = ["ja", "manchmal", "nein"] as const;

export type IntakeBreakfastFrequency = (typeof INTAKE_BREAKFAST_FREQUENCIES)[number];

export const INTAKE_BREAKFAST_LABELS: Record<IntakeBreakfastFrequency, string> = {
  ja: "Ja",
  manchmal: "Manchmal",
  nein: "Nein",
};

/** Conditions offered as chips. Free text stays available for anything else. */
export const INTAKE_CONDITION_OPTIONS = [
  "Diabetes Typ 2",
  "Bluthochdruck",
  "Erhöhte Blutfette",
  "Reizdarm",
  "Schilddrüse",
  "PCOS",
  "Gicht",
  "Migräne",
  "Sodbrennen",
  "Nierenerkrankung",
] as const;

const ALLERGEN_IDS = ALLERGEN_DEFINITIONS.map((definition) => definition.id);
const FOOD_KEYS = INTAKE_FOOD_PREFERENCES.map((item) => item.id);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const intakePayloadSchema = z.object({
  person: z.object({
    firstName: z.string().trim().min(1, "Vorname ist erforderlich").max(100),
    lastName: z.string().trim().min(1, "Nachname ist erforderlich").max(100),
    dateOfBirth: z
      .string()
      .regex(ISO_DATE, "Bitte ein gültiges Geburtsdatum angeben")
      .refine((value) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        const now = new Date();
        const earliest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
        return parsed <= now && parsed >= earliest;
      }, "Bitte ein gültiges Geburtsdatum angeben"),
    gender: z.enum(["m", "w", "d"]),
    email: z
      .union([z.string().trim().email().max(200), z.literal("")])
      .optional()
      .transform((value) => (value ? value : undefined)),
    phone: optionalText(50),
  }),
  goal: z.object({
    /**
     * The first of {@link primaryGoals}, kept because every submission already
     * in the database has it and several readers still index labels by it.
     * New writers must set both.
     */
    primaryGoal: z.enum(INTAKE_PRIMARY_GOALS),
    primaryGoals: z.array(z.enum(INTAKE_PRIMARY_GOALS)).min(1).max(INTAKE_PRIMARY_GOALS.length).optional(),
    motivation: optionalText(2_000),
    timeframe: optionalText(100),
  }),
  body: z.object({
    heightCm: z.number().min(50).max(260),
    weightKg: z.number().min(20).max(400),
    goalWeightKg: z.number().min(20).max(400).optional(),
  }),
  activity: z
    .object({
      jobActivity: z.enum(["sitzend", "stehend", "koerperlich"]).optional(),
      trainingDaysPerWeek: z.number().int().min(0).max(14).optional(),
      trainingType: optionalText(300),
    })
    .optional(),
  health: z
    .object({
      conditions: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
      medications: optionalText(2_000),
      digestion: optionalText(2_000),
      pregnantOrBreastfeeding: z.boolean().optional(),
    })
    .optional(),
  allergens: z
    .array(
      z.object({
        allergenId: z.string().trim().min(1).max(64),
        type: z.enum(["allergy", "intolerance"]),
      }),
    )
    .max(ALLERGEN_IDS.length)
    .optional(),
  diet: z
    .object({
      style: dietStyleSchema.optional(),
      exclusions: z.array(dietExclusionSchema).max(DIET_EXCLUSIONS.length).optional(),
    })
    .optional(),
  foodPreferences: z
    .array(
      z.object({
        foodKey: z.string().trim().min(1).max(64),
        rating: z.enum(["gerne", "geht", "nie"]),
      }),
    )
    .max(FOOD_KEYS.length)
    .optional(),
  habits: z
    .object({
      mealsPerDay: z.number().int().min(1).max(10).optional(),
      /** Legacy companion to {@link breakfastFrequency}; "manchmal" reads as true. */
      eatsBreakfast: z.boolean().optional(),
      breakfastFrequency: z.enum(INTAKE_BREAKFAST_FREQUENCIES).optional(),
      cookingSkill: z.enum(["wenig", "mittel", "viel"]).optional(),
      minutesPerMeal: z.number().int().min(0).max(240).optional(),
      eatsOutPerWeek: z.number().int().min(0).max(30).optional(),
      whoCooks: optionalText(200),
      budget: z.enum(["niedrig", "mittel", "hoch"]).optional(),
      snacking: optionalText(1_000),
      alcoholPerWeek: z.number().min(0).max(100).optional(),
      coffeePerDay: z.number().min(0).max(30).optional(),
      sleepHours: z.number().min(0).max(24).optional(),
      waterLitersPerDay: z.number().min(0).max(20).optional(),
    })
    .optional(),
  history: z
    .object({
      previousDiets: optionalText(2_000),
      whatWorked: optionalText(2_000),
      whatFailed: optionalText(2_000),
    })
    .optional(),
  consent: z.object({
    dataProcessing: z.literal(true, {
      message: "Ohne Einwilligung können wir die Daten nicht speichern.",
    }),
    notes: optionalText(2_000),
  }),
});

export const intakeSubmitRequestSchema = z.object({
  linkId: z.string().uuid(),
  payload: intakePayloadSchema,
});

export type IntakePayloadInput = z.infer<typeof intakePayloadSchema>;

/**
 * Reads the goals off a submission of any age.
 *
 * Submissions written before goals became multi-select carry only
 * `primaryGoal`. Both shapes live in the same table and always will, so every
 * reader goes through here rather than reaching for one field and getting it
 * wrong for half the records.
 */
export function readPrimaryGoals(goal: {
  primaryGoal: (typeof INTAKE_PRIMARY_GOALS)[number];
  primaryGoals?: readonly (typeof INTAKE_PRIMARY_GOALS)[number][];
}): (typeof INTAKE_PRIMARY_GOALS)[number][] {
  return goal.primaryGoals?.length ? [...goal.primaryGoals] : [goal.primaryGoal];
}

/** Same for breakfast, which used to be a yes/no boolean. */
export function readBreakfastFrequency(habits?: {
  eatsBreakfast?: boolean;
  breakfastFrequency?: IntakeBreakfastFrequency;
}): IntakeBreakfastFrequency | undefined {
  if (habits?.breakfastFrequency) return habits.breakfastFrequency;
  if (habits?.eatsBreakfast === undefined) return undefined;
  return habits.eatsBreakfast ? "ja" : "nein";
}

/** Unknown catalog ids are dropped rather than failing the whole submission. */
export function isKnownAllergenId(allergenId: string): boolean {
  return ALLERGEN_IDS.includes(allergenId);
}

export function isKnownFoodKey(foodKey: string): boolean {
  return FOOD_KEYS.includes(foodKey);
}

/** Counts answered sections for audit metadata without logging any content. */
export function countAnsweredSections(payload: IntakePayloadInput): number {
  const sections = [
    payload.person,
    payload.goal,
    payload.body,
    payload.activity,
    payload.health,
    payload.allergens?.length ? payload.allergens : undefined,
    payload.diet,
    payload.foodPreferences?.length ? payload.foodPreferences : undefined,
    payload.habits,
    payload.history,
    payload.consent,
  ];

  return sections.filter((section) => section !== undefined).length;
}
