import { ID, Timestamped } from "./common";
import { MealSlotType } from "./meal-plan";
import type { Gender } from "./patient";

// Digital protocol patient submissions

export interface SubmissionEntry {
  mealSlot: string;
  freeText: string;
  time?: string;
}

export interface SubmissionDay {
  date: string; // ISO date YYYY-MM-DD
  entries: SubmissionEntry[];
}

export interface DigitalProtocolSubmission extends Timestamped {
  id: ID;
  linkId: ID;
  patientId: ID;
  submittedAt: string;
  days: SubmissionDay[];
  notes?: string;
  status: "new" | "reviewed" | "converted";
  convertedProtocolId?: ID;
}

export type ProtocolType =
  | "ernaehrungsprotokoll"
  | "24h_recall"
  | "food_frequency"
  | "household";

export type AssessmentMethod =
  | "24h_recall"
  | "ffq"
  | "diet_diary"
  | "dietary_history"
  | "household"
  | "freiburg"
  | "vegetarian"
  | "vegan";

export interface ProtocolHouseholdMeasurement {
  unitId: string;
  unitLabel: string;
  gramsPerUnit: number;
  quantity: number;
  estimatedGrams: number;
}

export interface ProtocolMetadata {
  assessmentMethod?: AssessmentMethod;
  documentedDays?: number;
  participantAge?: number;
  participantGender?: Gender;
  templateId?: string;
  householdModeEnabled?: boolean;
}

export interface ProtocolEntry {
  id: ID;
  foodId: ID;
  amount: number; // grams
  mealSlot: MealSlotType;
  time?: string; // HH:mm
  notes?: string;
  measurementMode?: "grams" | "household";
  householdMeasurement?: ProtocolHouseholdMeasurement;
}

export interface ProtocolDay {
  date: string; // ISO date YYYY-MM-DD
  entries: ProtocolEntry[];
}

export interface NutritionProtocol extends Timestamped {
  id: ID;
  legacyId?: ID;
  patientId: ID;
  title: string;
  type: ProtocolType;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
  days: ProtocolDay[];
  notes?: string;
  metadata?: ProtocolMetadata;
}
