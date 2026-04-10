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

export interface DiagnosisEntry extends Timestamped {
  id: ID;
  patientId: ID;
  diagnosis: string;
  icdCode?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface MedicationEntry extends Timestamped {
  id: ID;
  patientId: ID;
  name: string;
  dosage: string;
  schedule: string;
  startDate: string;
  endDate?: string;
  reason?: string;
  notes?: string;
}

export interface ActivityEntry extends Timestamped {
  id: ID;
  patientId: ID;
  date: string;
  type: string;
  durationMinutes: number;
  intensity?: string;
  pal?: number;
  energyKcal?: number;
}

export interface TherapySetting extends Timestamped {
  id: ID;
  patientId: ID;
  module: "diabetes" | "ketogen" | "allergen" | "intoleranz";
  status: "active" | "paused";
  targets?: Record<string, string | number>;
  notes?: string;
}

export interface ScreeningResult extends Timestamped {
  id: ID;
  patientId: ID;
  tool: "MUST" | "NRS-2002";
  score: number;
  riskLevel: "low" | "medium" | "high";
  answers: { question: string; answer: string }[];
}

export interface ProcamResult extends Timestamped {
  id: ID;
  patientId: ID;
  score: number;
  category: "low" | "moderate" | "high";
  age: number;
  ldl: number;
  hdl: number;
  systolic: number;
  smoker: boolean;
}

export interface DigitalProtocolLink extends Timestamped {
  id: ID;
  patientId: ID;
  method: string;
  status: "pending" | "received" | "expired";
  url: string;
  qrCode: string;
  expiresAt?: string;
}
