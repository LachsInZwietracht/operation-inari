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
  slots: MealSlot[];
}

export interface MealPlanTemplate {
  id: ID;
  legacyId?: ID;
  userId?: ID;
  name: string;
  description: string;
  indication?: string;
  dietLineId?: string;
  targetProfileId?: ID;
  slots: MealSlot[];
  notes?: string;
  sourceType: "personal" | "system";
  createdAt?: string;
  updatedAt?: string;
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
