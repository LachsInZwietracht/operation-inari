import type { AnthropometricEntry } from "@/lib/types";

function bmi(weight: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weight / (heightM * heightM)) * 10) / 10;
}

const ts = (date: string) => ({ createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` });

export const ANTHROPOMETRIC_DATA: AnthropometricEntry[] = [
  // Patient 1 - Maria Schneider (Adipositas)
  { id: "anthro_1_1", patientId: "patient_1", date: "2026-01-15", weight: 92, height: 168, bmi: bmi(92, 168), waistCircumference: 98, hipCircumference: 112, bodyFatPercentage: 38, ...ts("2026-01-15") },
  { id: "anthro_1_2", patientId: "patient_1", date: "2026-02-12", weight: 89.5, height: 168, bmi: bmi(89.5, 168), waistCircumference: 96, hipCircumference: 110, bodyFatPercentage: 37, ...ts("2026-02-12") },
  { id: "anthro_1_3", patientId: "patient_1", date: "2026-03-12", weight: 87, height: 168, bmi: bmi(87, 168), waistCircumference: 94, hipCircumference: 108, bodyFatPercentage: 35.5, ...ts("2026-03-12") },
  { id: "anthro_1_4", patientId: "patient_1", date: "2026-04-09", weight: 85.2, height: 168, bmi: bmi(85.2, 168), waistCircumference: 92, hipCircumference: 107, bodyFatPercentage: 34.5, ...ts("2026-04-09") },

  // Patient 2 - Thomas Weber (Diabetes Typ 2)
  { id: "anthro_2_1", patientId: "patient_2", date: "2026-01-20", weight: 98, height: 180, bmi: bmi(98, 180), waistCircumference: 108, ...ts("2026-01-20") },
  { id: "anthro_2_2", patientId: "patient_2", date: "2026-02-17", weight: 96.5, height: 180, bmi: bmi(96.5, 180), waistCircumference: 106, ...ts("2026-02-17") },
  { id: "anthro_2_3", patientId: "patient_2", date: "2026-03-17", weight: 95, height: 180, bmi: bmi(95, 180), waistCircumference: 104, ...ts("2026-03-17") },

  // Patient 3 - Lisa Hoffmann (Zöliakie)
  { id: "anthro_3_1", patientId: "patient_3", date: "2026-02-01", weight: 58, height: 165, bmi: bmi(58, 165), ...ts("2026-02-01") },
  { id: "anthro_3_2", patientId: "patient_3", date: "2026-03-01", weight: 59, height: 165, bmi: bmi(59, 165), ...ts("2026-03-01") },
  { id: "anthro_3_3", patientId: "patient_3", date: "2026-04-01", weight: 59.5, height: 165, bmi: bmi(59.5, 165), ...ts("2026-04-01") },

  // Patient 4 - Jürgen Fischer (Adipositas, schwer)
  { id: "anthro_4_1", patientId: "patient_4", date: "2026-01-10", weight: 118, height: 175, bmi: bmi(118, 175), waistCircumference: 125, hipCircumference: 120, bodyFatPercentage: 42, ...ts("2026-01-10") },
  { id: "anthro_4_2", patientId: "patient_4", date: "2026-02-10", weight: 115, height: 175, bmi: bmi(115, 175), waistCircumference: 122, hipCircumference: 118, bodyFatPercentage: 41, ...ts("2026-02-10") },
  { id: "anthro_4_3", patientId: "patient_4", date: "2026-03-10", weight: 112, height: 175, bmi: bmi(112, 175), waistCircumference: 119, hipCircumference: 116, bodyFatPercentage: 39.5, ...ts("2026-03-10") },
  { id: "anthro_4_4", patientId: "patient_4", date: "2026-04-07", weight: 109.5, height: 175, bmi: bmi(109.5, 175), waistCircumference: 116, hipCircumference: 114, bodyFatPercentage: 38, ...ts("2026-04-07") },

  // Patient 5 - Anna Müller (Nahrungsmittelallergie)
  { id: "anthro_5_1", patientId: "patient_5", date: "2026-02-05", weight: 62, height: 170, bmi: bmi(62, 170), ...ts("2026-02-05") },
  { id: "anthro_5_2", patientId: "patient_5", date: "2026-03-05", weight: 62.5, height: 170, bmi: bmi(62.5, 170), ...ts("2026-03-05") },
  { id: "anthro_5_3", patientId: "patient_5", date: "2026-04-05", weight: 63, height: 170, bmi: bmi(63, 170), ...ts("2026-04-05") },

  // Patient 6 - Klaus Becker (Diabetes Typ 2)
  { id: "anthro_6_1", patientId: "patient_6", date: "2026-02-20", weight: 88, height: 178, bmi: bmi(88, 178), waistCircumference: 100, ...ts("2026-02-20") },
  { id: "anthro_6_2", patientId: "patient_6", date: "2026-03-20", weight: 86, height: 178, bmi: bmi(86, 178), waistCircumference: 98, ...ts("2026-03-20") },
  { id: "anthro_6_3", patientId: "patient_6", date: "2026-04-08", weight: 84.5, height: 178, bmi: bmi(84.5, 178), waistCircumference: 96, ...ts("2026-04-08") },

  // Patient 7 - Sophie Klein (Adipositas)
  { id: "anthro_7_1", patientId: "patient_7", date: "2026-03-01", weight: 86, height: 164, bmi: bmi(86, 164), waistCircumference: 94, bodyFatPercentage: 36, ...ts("2026-03-01") },
  { id: "anthro_7_2", patientId: "patient_7", date: "2026-04-01", weight: 84, height: 164, bmi: bmi(84, 164), waistCircumference: 92, bodyFatPercentage: 35, ...ts("2026-04-01") },
];
