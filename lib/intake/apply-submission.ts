import { ALLERGEN_MAP } from "@/lib/allergen-constants";
import { isDietExclusion } from "@/lib/diet-constants";
import { INTAKE_FOOD_PREFERENCE_MAP } from "@/lib/intake-food-preferences";
import {
  INTAKE_PRIMARY_GOAL_LABELS,
  readPrimaryGoals,
  isKnownAllergenId,
  isKnownFoodKey,
  type IntakePayloadInput,
} from "@/lib/intake/schema";

/**
 * Pure mapping from a validated intake payload to the rows that get written on
 * apply. Keeping it free of I/O keeps the route thin and the mapping testable.
 *
 * Two rules govern everything here:
 *  - Unknown catalog ids are dropped, never fatal. A stale phone tab must not
 *    block the practitioner from applying an otherwise good submission.
 *  - Patient-reported data never overwrites an existing non-empty value on the
 *    practitioner's record, including identity data (see `mergePatientUpdate`).
 */

export interface IntakePatientFields {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "m" | "w" | "d";
  email: string | null;
  phone: string | null;
  diet_style: string | null;
  nutrition_preferences: string[];
  patient_goals: string | null;
  intake_reason: string | null;
  goal_weight: number | null;
  digital_protocol_consent: boolean;
}

export interface IntakeAllergenRow {
  allergen_id: string;
  type: "allergy" | "intolerance";
  severity: "mild" | "moderate" | "severe";
  notes: string;
}

export interface IntakeFoodPreferenceRow {
  food_key: string;
  rating: "gerne" | "geht" | "nie";
}

export interface IntakeAnthropometrics {
  date: string;
  weight: number;
  height: number;
  bmi: number;
  notes: string;
}

export interface IntakeApplyPlan {
  patientFields: IntakePatientFields;
  allergens: IntakeAllergenRow[];
  foodPreferences: IntakeFoodPreferenceRow[];
  anthropometrics: IntakeAnthropometrics;
  /** Activity factor implied by the patient's answers, when they gave any. */
  palValue?: number;
}

/**
 * Patient-reported allergies are unconfirmed until the practitioner reviews
 * them. These defaults are a starting point, not a clinical judgement — the
 * note makes the provenance explicit in the patient record.
 */
const DEFAULT_SEVERITY: Record<"allergy" | "intolerance", "moderate" | "mild"> = {
  allergy: "moderate",
  intolerance: "mild",
};

const SELF_REPORTED_NOTE = "Selbstauskunft aus dem Onboarding, ärztlich nicht bestätigt.";

function goalLabels(payload: IntakePayloadInput): string {
  return readPrimaryGoals(payload.goal)
    .map((goal) => INTAKE_PRIMARY_GOAL_LABELS[goal])
    .join(", ");
}

function buildPatientGoals(payload: IntakePayloadInput): string | null {
  const goals = readPrimaryGoals(payload.goal);
  const parts = [`${goals.length > 1 ? "Ziele" : "Ziel"}: ${goalLabels(payload)}`];

  if (payload.goal.timeframe) {
    parts.push(`Zeithorizont: ${payload.goal.timeframe}`);
  }
  if (payload.goal.motivation) {
    parts.push(`Motivation: ${payload.goal.motivation}`);
  }

  return parts.join("\n");
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * The activity factor the patient's own answers imply.
 *
 * The intake asks what someone does at work and how often they train, then the
 * answers sat in the submission unread while a counselor picked a PAL by hand
 * from the same two facts. The ladder below is the one offered everywhere else
 * in the app (`PAL_LEVELS`), so a derived value and a picked one are the same
 * kind of number.
 *
 * Deliberately coarse. A PAL is a bracket, not a measurement, and pretending to
 * two decimals from a questionnaire would be false precision.
 */
export function derivePalFromActivity(activity?: {
  jobActivity?: "sitzend" | "stehend" | "koerperlich";
  trainingDaysPerWeek?: number;
}): number | undefined {
  if (!activity?.jobActivity && activity?.trainingDaysPerWeek === undefined) {
    return undefined;
  }

  const base =
    activity.jobActivity === "koerperlich"
      ? 1.6
      : activity.jobActivity === "stehend"
        ? 1.4
        : 1.2;

  // Training adds one step from three sessions a week, two from six.
  const days = activity.trainingDaysPerWeek ?? 0;
  const bump = days >= 6 ? 0.4 : days >= 3 ? 0.2 : 0;

  return Math.min(2.0, Math.round((base + bump) * 10) / 10);
}

export function buildIntakeApplyPlan(
  payload: IntakePayloadInput,
  submittedAt: string,
): IntakeApplyPlan {
  const exclusions = (payload.diet?.exclusions ?? []).filter((value) =>
    isDietExclusion(value),
  );

  const allergens: IntakeAllergenRow[] = [];
  const seenAllergens = new Set<string>();
  for (const entry of payload.allergens ?? []) {
    if (!isKnownAllergenId(entry.allergenId)) continue;
    if (seenAllergens.has(entry.allergenId)) continue;
    seenAllergens.add(entry.allergenId);
    allergens.push({
      allergen_id: entry.allergenId,
      type: entry.type,
      severity: DEFAULT_SEVERITY[entry.type],
      notes: SELF_REPORTED_NOTE,
    });
  }

  const foodPreferences: IntakeFoodPreferenceRow[] = [];
  const seenFoodKeys = new Set<string>();
  for (const entry of payload.foodPreferences ?? []) {
    if (!isKnownFoodKey(entry.foodKey)) continue;
    if (seenFoodKeys.has(entry.foodKey)) continue;
    seenFoodKeys.add(entry.foodKey);
    foodPreferences.push({ food_key: entry.foodKey, rating: entry.rating });
  }

  const submissionDate = submittedAt.slice(0, 10);

  return {
    palValue: derivePalFromActivity(payload.activity),
    patientFields: {
      first_name: payload.person.firstName,
      last_name: payload.person.lastName,
      date_of_birth: payload.person.dateOfBirth,
      gender: payload.person.gender,
      email: payload.person.email ?? null,
      phone: payload.person.phone ?? null,
      diet_style: payload.diet?.style ?? null,
      nutrition_preferences: exclusions,
      patient_goals: buildPatientGoals(payload),
      intake_reason: goalLabels(payload),
      goal_weight: payload.body.goalWeightKg ?? null,
      digital_protocol_consent: payload.consent.dataProcessing,
    },
    allergens,
    foodPreferences,
    anthropometrics: {
      date: submissionDate,
      weight: payload.body.weightKg,
      height: payload.body.heightCm,
      bmi: calculateBmi(payload.body.weightKg, payload.body.heightCm),
      notes: "Selbstauskunft aus dem Onboarding.",
    },
  };
}

/**
 * Builds the update set for an existing patient. A field the practitioner has
 * already filled in wins over the submitted value, including the person's
 * identity; empty submitted values never clear existing data.
 */
export function mergePatientUpdate(
  fields: IntakePatientFields,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  const isEmpty = (value: unknown) =>
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  for (const [column, value] of Object.entries(fields)) {
    if (isEmpty(value)) continue;
    if (!isEmpty(existing[column])) continue;
    update[column] = value;
  }

  return update;
}

/** Human-readable label for a catalog id, for the review UI. */
export function describeAllergen(allergenId: string): string {
  return ALLERGEN_MAP.get(allergenId)?.label ?? allergenId;
}

export function describeFoodKey(foodKey: string): string {
  return INTAKE_FOOD_PREFERENCE_MAP.get(foodKey)?.label ?? foodKey;
}
