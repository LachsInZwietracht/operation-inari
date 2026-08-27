import { ID } from "./common";

export type MealSlotType =
  | "fruehstueck"
  | "snack_vormittag"
  | "mittagessen"
  | "snack_nachmittag"
  | "abendessen";

export interface MealEntry {
  id: ID;
  type: "food" | "recipe";
  referenceId: ID; // foodId or recipeId
  amount: number; // grams for food, servings for recipe
}

export interface MealSlot {
  type: MealSlotType;
  entries: MealEntry[];
}

export type MealPlanStatus = "draft" | "active" | "approved" | "archived";

export interface DailyMealPlan {
  id: ID;
  legacyId?: ID;
  date: string; // ISO date string YYYY-MM-DD
  patientId?: ID;
  title?: string;
  status?: MealPlanStatus;
  notes?: string;
  targetProfileId?: ID;
  dietLineId?: string;
  approvedAt?: string;
  approvedBy?: ID;
  /** Monotonic stand number within one patient/date handoff chain. */
  revisionNumber?: number;
  /** Released stand this draft was created from. */
  supersedesPlanId?: ID;
  /** Set on a formerly released stand once a successor is handed off. */
  replacedAt?: string;
  slots: MealSlot[];
}

export interface MealPlanVersion {
  id: ID;
  mealPlanId: ID;
  versionNumber: number;
  reason: "approved" | "manual" | "reopened";
  createdBy?: ID;
  createdAt: string;
  snapshot: {
    title?: string;
    notes?: string;
    status?: MealPlanStatus;
    targetProfileId?: ID;
    dietLineId?: string;
    approvedAt?: string;
    approvedBy?: ID;
    slots: MealSlot[];
  };
}

export interface MealPlanTemplate {
  id: ID;
  legacyId?: ID;
  userId?: ID;
  /** Set only for a personal template deliberately bound to one patient. */
  patientId?: ID;
  name: string;
  description: string;
  indication?: string;
  dietLineId?: string;
  targetProfileId?: ID;
  slots: MealSlot[];
  /**
   * Optional multi-day blueprint. `offsetDays` is relative to the first
   * selected day, so a template can preserve deliberate gaps (for example
   * weekday-only plans) without carrying a patient date.
   */
  dayBlocks?: MealPlanTemplateDayBlock[];
  notes?: string;
  sourceType: "personal" | "system";
  createdAt?: string;
  updatedAt?: string;
}

export interface MealPlanTemplateDayBlock {
  offsetDays: number;
  slots: MealSlot[];
}

export interface DietLinePreset {
  id: ID;
  name: string;
  description: string;
  userId?: ID;
  isSystem?: boolean;
  targets: Array<{
    nutrientId: string;
    label: string;
    unit: string;
    min?: number;
    max?: number;
  }>;
}
