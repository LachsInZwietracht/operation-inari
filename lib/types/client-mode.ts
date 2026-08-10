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
  consentedAt?: string;
  revokedAt?: string;
}

/** A link as the client sees it, with the counselor resolved to a name. */
export interface ClientLinkWithCounselor extends ClientLink {
  counselorName: string;
  patientName: string;
}

export type ClientFoodLogSourceType = "food" | "custom";

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
  amount: number; // grams
  notes?: string;
  loggedAt: string;
  sortOrder: number;
}

export interface ClientFoodLogDay {
  id: ID;
  date: string; // ISO date YYYY-MM-DD
  notes?: string;
  entries: ClientFoodLogEntry[];
}

/** A meal the client ticked off — or deliberately skipped. */
export interface ClientMealCompletion {
  id: ID;
  mealPlanId: ID;
  mealEntryId: ID;
  skipped: boolean;
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
