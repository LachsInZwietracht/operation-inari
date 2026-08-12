import { ID, Timestamped } from "./common";

export type Gender = "m" | "w" | "d";
export type PatientStatus = "active" | "inactive" | "archived" | "deceased";
export type PatientCareSetting = "ambulatory" | "inpatient" | "discharged";
export type PreferredContactChannel = "phone" | "email" | "mail" | "none";
/**
 * A single diet style. Exactly one applies per patient.
 * Persisted as `patients.diet_style`.
 */
export type DietStyle =
  | "omnivor"
  | "vegetarisch"
  | "vegan"
  | "pescetarisch"
  | "low_carb"
  | "keto"
  | "carnivore"
  | "mediterran";

/**
 * Non-medical exclusions. Several may apply per patient.
 * Persisted as `patients.nutrition_preferences`.
 * Medical allergies and intolerances live in `patient_allergens` instead.
 */
export type DietExclusion =
  | "no_dairy"
  | "no_pork"
  | "no_red_meat"
  | "no_alcohol"
  | "no_gluten_by_choice"
  | "halal"
  | "kosher";

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
  /** Single diet style, e.g. "vegan" or "keto". */
  dietStyle?: DietStyle;
  /** Non-medical exclusions, e.g. "no_dairy". */
  nutritionPreferences?: DietExclusion[];
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
  /**
   * Aufnahmen stage pinned by hand, overriding the derived one.
   *
   * Normally undefined: a stage is derived from plans, submissions and
   * sessions, so it cannot drift from the facts. This is the escape hatch for
   * a practitioner who knows something the records do not yet show. Typed as
   * a plain string here rather than importing IntakeStage, so the domain type
   * stays free of a dependency on the journey module.
   */
  intakeStageOverride?: "eingeladen" | "fragebogen" | "beratung" | "plan";
  /** When {@link intakeStageOverride} was set. */
  intakeStageOverrideAt?: string;
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

export type FoodPreferenceRating = "gerne" | "geht" | "nie";

export interface PatientFoodPreference extends Timestamped {
  id: ID;
  patientId: ID;
  /** Matches an `id` from `lib/intake-food-preferences.ts`. */
  foodKey: string;
  rating: FoodPreferenceRating;
}

export type PatientIntakeLinkStatus =
  | "pending"
  | "received"
  | "expired"
  | "revoked";

export interface PatientIntakeLink extends Timestamped {
  id: ID;
  /** Practitioner-facing label, e.g. "Max - Freund". */
  label: string;
  /** Null until the submission is applied, or when inviting a new person. */
  patientId?: ID;
  status: PatientIntakeLinkStatus;
  expiresAt?: string;
  /** Derived from the current origin; never persisted. */
  url: string;
}

export type PatientIntakeSubmissionStatus = "new" | "reviewed" | "applied" | "discarded";

export interface PatientIntakeSubmission extends Timestamped {
  id: ID;
  linkId: ID;
  patientId?: ID;
  submittedAt: string;
  payload: PatientIntakePayload;
  status: PatientIntakeSubmissionStatus;
  appliedPatientId?: ID;
  reviewerNotes?: string;
  reviewedAt?: string;
  reviewedBy?: ID;
}

export type IntakePrimaryGoal =
  | "abnehmen"
  | "gewicht_halten"
  | "muskelaufbau"
  | "gesuender_essen"
  | "mehr_energie"
  | "leistung_steigern"
  | "beschwerden_lindern";

/**
 * Shape of `patient_intake_submissions.payload`. The authoritative runtime
 * validation lives in `lib/intake/schema.ts`; this type is derived from it.
 */
export interface PatientIntakePayload {
  person: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    email?: string;
    phone?: string;
  };
  goal: {
    primaryGoal: IntakePrimaryGoal;
    motivation?: string;
    timeframe?: string;
  };
  body: {
    heightCm: number;
    weightKg: number;
    goalWeightKg?: number;
  };
  activity?: {
    jobActivity?: "sitzend" | "stehend" | "koerperlich";
    trainingDaysPerWeek?: number;
    trainingType?: string;
  };
  health?: {
    conditions?: string[];
    medications?: string;
    digestion?: string;
    pregnantOrBreastfeeding?: boolean;
  };
  allergens?: Array<{
    allergenId: string;
    type: "allergy" | "intolerance";
  }>;
  diet?: {
    style?: DietStyle;
    exclusions?: DietExclusion[];
  };
  foodPreferences?: Array<{
    foodKey: string;
    rating: FoodPreferenceRating;
  }>;
  habits?: {
    mealsPerDay?: number;
    eatsBreakfast?: boolean;
    cookingSkill?: "wenig" | "mittel" | "viel";
    minutesPerMeal?: number;
    eatsOutPerWeek?: number;
    whoCooks?: string;
    budget?: "niedrig" | "mittel" | "hoch";
    snacking?: string;
    alcoholPerWeek?: number;
    coffeePerDay?: number;
    sleepHours?: number;
    waterLitersPerDay?: number;
  };
  history?: {
    previousDiets?: string;
    whatWorked?: string;
    whatFailed?: string;
  };
  consent: {
    dataProcessing: boolean;
    notes?: string;
  };
}
