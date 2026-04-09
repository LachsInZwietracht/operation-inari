import { ID, Timestamped } from "./common";

export type Gender = "m" | "w" | "d";

export interface Patient extends Timestamped {
  id: ID;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date YYYY-MM-DD
  gender: Gender;
  email?: string;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  indication?: string;
  notes?: string;
}

export interface AnthropometricEntry extends Timestamped {
  id: ID;
  patientId: ID;
  date: string; // ISO date YYYY-MM-DD
  weight: number; // kg
  height: number; // cm
  bmi: number;
  waistCircumference?: number; // cm
  hipCircumference?: number; // cm
  bodyFatPercentage?: number;
  notes?: string;
}
