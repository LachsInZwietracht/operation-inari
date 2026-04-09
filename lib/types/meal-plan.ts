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

export interface DailyMealPlan {
  id: ID;
  date: string; // ISO date string YYYY-MM-DD
  slots: MealSlot[];
}
