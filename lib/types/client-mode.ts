import { ID, Timestamped } from "./common";
import { MealSlotType } from "./meal-plan";
import { NutrientValue } from "./nutrients";

/** Which surface the user is currently working in. Preference, not permission. */
export type AppMode = "counselor" | "client";

export type ClientLinkStatus = "invited" | "active" | "revoked";

/**
 * Binds a counselor-owned patient record to the client's own account.
 * `clientUserId` stays undefined until the invite is redeemed.
 */
export interface ClientLink extends Timestamped {
  id: ID;
  patientId: ID;
  counselorUserId: ID;
  clientUserId?: ID;
  inviteCode: string;
  inviteExpiresAt?: string;
  status: ClientLinkStatus;
  consentNutrition: boolean;
  consentTraining: boolean;
  /** Whether the counselor may see check-in data at all. */
  consentWellbeing: boolean;
  consentedAt?: string;
  revokedAt?: string;
}

/** A link as the client sees it, with the counselor resolved to a name. */
export interface ClientLinkWithCounselor extends ClientLink {
  counselorName: string;
  patientName: string;
}

export type ClientFoodLogSourceType = "food" | "custom" | "recipe";

export interface ClientFoodLogEntry {
  id: ID;
  dayId: ID;
  slotType: MealSlotType;
  sourceType: ClientFoodLogSourceType;
  /** Set when sourceType is "food". */
  foodId?: ID;
  /** Set when sourceType is "custom" — a product the catalog does not know. */
  customName?: string;
  /** Per 100 g, same convention as `foods.baseAmount`. */
  customNutrients?: NutrientValue[];
  /** Set when sourceType is "recipe"; `amount` is then portions, not grams. */
  recipeId?: ID;
  amount: number;
  notes?: string;
  /**
   * The planned meal entry this was eaten instead of.
   *
   * Set only when the client answered a plan row with "anders gegessen". The
   * plan entry is marked skipped as before — this is the evidence of what took
   * its place, not a third adherence state.
   */
  replacesMealEntryId?: ID;
  loggedAt: string;
  sortOrder: number;
}

export interface ClientFoodLogDay {
  id: ID;
  date: string; // ISO date YYYY-MM-DD
  notes?: string;
  /** Fluid intake in millilitres. Undefined is "not tracked", not zero. */
  waterMl?: number;
  entries: ClientFoodLogEntry[];
}

/**
 * One self-reported day.
 *
 * Every value is optional and an absent one means "not answered" — never a
 * zero and never a low value. `sleepMinutes` belongs to the night ONTO
 * `date`, which is what the check-in labels and what keeps the evaluation
 * from mixing "slept badly, then ate" with "ate, then slept badly".
 */
export type ClientCheckin = {
  id: ID;
  date: string; // ISO date YYYY-MM-DD
  wellbeing?: number;
  energy?: number;
  mood?: number;
  digestion?: number;
  sleepMinutes?: number;
  sleepQuality?: number;
  /** Standardgläser à 10 g ethanol. A quantity, never an energy. */
  alcoholUnits?: number;
};

/** The three switches a client sets per metric. Absent rows are defaults. */
export type ClientMetricPreferenceRow = {
  metricKey: string;
  tracked: boolean;
  shown: boolean;
  shared: boolean;
};

/** One component of a saved meal — the same shape as a diary entry. */
export interface ClientSavedMealItem {
  id: ID;
  sourceType: ClientFoodLogSourceType;
  foodId?: ID;
  customName?: string;
  customNutrients?: NutrientValue[];
  amount: number; // grams
  sortOrder: number;
}

/**
 * "Mein übliches Frühstück": a named set of foods, not a recipe.
 *
 * No servings, no instructions, no nutrient targets — those make a recipe a
 * counselor artefact and a chore for a client to assemble. This is the named
 * version of "wie gestern".
 */
export interface ClientSavedMeal {
  id: ID;
  name: string;
  createdAt: string;
  items: ClientSavedMealItem[];
}

/**
 * What a plan entry costs and how it reads, resolved once per day.
 *
 * `perUnit` is deliberately per *one* unit — one gram for a food, one portion
 * for a recipe — so the same value serves the planned amount and whatever the
 * client actually ate.
 */
export interface ClientPlanEntryFacts {
  perUnit: NutrientValue[];
  label: string;
  unit: "g" | "portion";
}

/** A meal the client ticked off — or deliberately skipped. */
export interface ClientMealCompletion {
  id: ID;
  mealPlanId: ID;
  mealEntryId: ID;
  skipped: boolean;
  /** Amount actually eaten, in the plan entry's unit. Undefined = as planned. */
  amount?: number;
  note?: string;
  completedAt: string;
}

export interface ClientPlanEntry {
  id: ID; // meal_entries.id
  slotType: MealSlotType;
  entryType: "food" | "recipe";
  referenceId: ID;
  amount: number;
}

/** The counselor's plan for one day, as the client sees it. */
export interface ClientPlanDay {
  id: ID; // daily_meal_plans.id
  date: string;
  title?: string;
  entries: ClientPlanEntry[];
}

export interface ClientWorkoutSet {
  id: ID;
  sessionId: ID;
  exerciseName: string;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  notes?: string;
}

export interface ClientWorkoutSession {
  id: ID;
  date: string; // ISO date YYYY-MM-DD
  title: string;
  notes?: string;
  /** Inputs of the energy estimate; the kcal figure itself is derived. */
  durationMinutes?: number;
  activityKind?: string;
  intensity?: string;
  /** Body weight at logging time — an old session keeps an old weight. */
  bodyWeightKg?: number;
  sets: ClientWorkoutSet[];
}

/** Best set of an exercise in one week — the "did I get stronger" line. */
export interface ClientExerciseProgressPoint {
  weekStart: string; // ISO date of the Monday
  bestWeightKg?: number;
  bestReps?: number;
  /** Epley estimate of the week's strongest set; absent for bodyweight work. */
  bestOneRepMaxKg?: number;
  /** Tonnage: Σ reps × kg. Sets without a weight contribute nothing. */
  volumeKg: number;
  totalSets: number;
}

export interface ClientExerciseProgress {
  exerciseName: string;
  points: ClientExerciseProgressPoint[];
}

/** Which measure the progress chart plots. */
export type ClientProgressMetric = "oneRepMax" | "volume" | "weight";

/** The best set ever recorded for one exercise. */
export interface ClientPersonalRecord {
  exerciseName: string;
  oneRepMaxKg: number;
  reps?: number;
  weightKg?: number;
  setId: ID;
  date: string;
}

/** One session's worth of a single exercise — the detail view's row. */
export interface ClientExerciseHistoryEntry {
  sessionId: ID;
  date: string;
  title: string;
  sets: ClientWorkoutSet[];
}

/** Per-day adherence for the counselor: how much of the plan was answered. */
export interface ClientAdherenceDay {
  date: string;
  planned: number;
  completed: number;
  skipped: number;
}

/**
 * The same answers cut by meal instead of by day.
 *
 * "80 % Adhärenz" is a number to nod at; "the evening meal has been skipped
 * eleven times in a fortnight" is something to talk about in a session.
 */
export interface ClientAdherenceSlot {
  slotType: MealSlotType;
  planned: number;
  completed: number;
  skipped: number;
}

export interface ClientAdherenceSummary {
  byDay: ClientAdherenceDay[];
  bySlot: ClientAdherenceSlot[];
}
