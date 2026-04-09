import { ID, Timestamped } from "./common";
import { MealSlotType } from "./meal-plan";

export type ProtocolType =
  | "ernaehrungsprotokoll"
  | "24h_recall"
  | "food_frequency";

export interface ProtocolEntry {
  id: ID;
  foodId: ID;
  amount: number; // grams
  mealSlot: MealSlotType;
  time?: string; // HH:mm
  notes?: string;
}

export interface ProtocolDay {
  date: string; // ISO date YYYY-MM-DD
  entries: ProtocolEntry[];
}

export interface NutritionProtocol extends Timestamped {
  id: ID;
  patientId: ID;
  title: string;
  type: ProtocolType;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
  days: ProtocolDay[];
  notes?: string;
}
