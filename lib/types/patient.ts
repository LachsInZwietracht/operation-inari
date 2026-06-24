import { ID, Timestamped } from "./common";

export type Gender = "m" | "w" | "d";
export type PatientStatus = "active" | "inactive" | "archived" | "deceased";
export type PatientCareSetting = "ambulatory" | "inpatient" | "discharged";
export type PreferredContactChannel = "phone" | "email" | "mail" | "none";
export type NutritionPreference = "vegetarian" | "vegan" | "keto" | "low_carb";

export interface Patient extends Timestamped {
  id: ID;
  legacyId?: ID;
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
  indications?: string[];
  notes?: string;
  amputations?: string[];
  /** Chosen daily calorie target (kcal), e.g. from the Kalorienrechner. */
  dailyCalorieGoal?: number;
  /** Goal/target body weight in kg. */
  goalWeight?: number;
  /** Selected macro distribution preset id (e.g. "balanced", "lowcarb"). */
  macroPreset?: string;
  nutritionPreferences?: NutritionPreference[];
  nutritionPreferenceNotes?: string;
  status?: PatientStatus;
  careSetting?: PatientCareSetting;
  externalPatientNumber?: string;
  caseNumber?: string;
  preferredContactChannel?: PreferredContactChannel;
  preferredLanguage?: string;
  communicationConsent?: boolean;
  digitalProtocolConsent?: boolean;
  referrerName?: string;
  department?: string;
  intakeReason?: string;
  patientGoals?: string;
  clinicalNotes?: string;
  adminNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

export interface EgkCardData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  insuranceProvider: string;
  insuranceNumber: string;
  street: string;
  zip: string;
  city: string;
}

export interface EgkScanEvent extends Timestamped {
  id: ID;
  status: "pending" | "matched" | "archived" | "error";
  source: "webserial" | "companion" | "simulation";
  card: EgkCardData;
  patientId?: ID;
  notes?: string;
}

export interface BirthdayReminder extends Timestamped {
  id: ID;
  patientId: ID;
  dueDate: string;
  channel: "mail" | "call" | "sms";
  status: "open" | "sent";
}

export interface MailMergeDocument {
  patientId: ID;
  subject: string;
  body: string;
}

export interface MailMergeBatch extends Timestamped {
  id: ID;
  templateId?: string;
  templateName: string;
  recipientCount: number;
  documentSample?: MailMergeDocument;
  status: "ready" | "exported";
  downloadName: string;
}

export interface MailMergeTemplate {
  id: string;
  name: string;
  category: "termin" | "zusammenfassung" | "geburtstag" | "custom";
  subject: string;
  body: string;
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
  fatFreeMassKg?: number;
  subcutaneousFatPercentage?: number;
  visceralFatRating?: number;
  bodyWaterPercentage?: number;
  muscleMassKg?: number;
  skeletalMusclePercentage?: number;
  boneMassKg?: number;
  proteinPercentage?: number;
  bmrKcal?: number;
  metabolicAgeYears?: number;
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

export interface TherapyDeviceIntegration extends Timestamped {
  id: ID;
  patientId: ID;
  type: "cgm" | "pump" | "allergen";
  status: "connected" | "pending" | "error";
  vendor: string;
  lastSync?: string;
}

export interface ScreeningResult extends Timestamped {
  id: ID;
  patientId: ID;
  tool: "MUST" | "NRS-2002" | "MNA" | "SGA";
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

export interface PatientAllergenEntry extends Timestamped {
  id: ID;
  patientId: ID;
  allergenId: string;
  type: "allergy" | "intolerance" | "preference";
  severity: "mild" | "moderate" | "severe";
  diagnosedDate?: string;
  notes?: string;
}

export interface DigitalProtocolLink extends Timestamped {
  id: ID;
  patientId: ID;
  method: string;
  status: "pending" | "received" | "expired";
  url: string;
  expiresAt?: string;
}
