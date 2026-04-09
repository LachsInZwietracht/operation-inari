import type { LabValueEntry } from "@/lib/types";

const ts = (date: string) => ({ createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` });

export const LAB_VALUES: LabValueEntry[] = [
  // Patient 1 - Maria Schneider
  { id: "lv_1_1", patientId: "patient_1", parameterId: "lab_cholesterin", date: "2026-01-15", value: 235, ...ts("2026-01-15") },
  { id: "lv_1_2", patientId: "patient_1", parameterId: "lab_ldl", date: "2026-01-15", value: 155, ...ts("2026-01-15") },
  { id: "lv_1_3", patientId: "patient_1", parameterId: "lab_hdl", date: "2026-01-15", value: 48, ...ts("2026-01-15") },
  { id: "lv_1_4", patientId: "patient_1", parameterId: "lab_triglyceride", date: "2026-01-15", value: 175, ...ts("2026-01-15") },
  { id: "lv_1_5", patientId: "patient_1", parameterId: "lab_glucose", date: "2026-01-15", value: 102, ...ts("2026-01-15") },
  { id: "lv_1_6", patientId: "patient_1", parameterId: "lab_vitamin_d", date: "2026-01-15", value: 22, ...ts("2026-01-15") },
  { id: "lv_1_7", patientId: "patient_1", parameterId: "lab_cholesterin", date: "2026-04-09", value: 218, ...ts("2026-04-09") },
  { id: "lv_1_8", patientId: "patient_1", parameterId: "lab_ldl", date: "2026-04-09", value: 138, ...ts("2026-04-09") },
  { id: "lv_1_9", patientId: "patient_1", parameterId: "lab_hdl", date: "2026-04-09", value: 52, ...ts("2026-04-09") },
  { id: "lv_1_10", patientId: "patient_1", parameterId: "lab_triglyceride", date: "2026-04-09", value: 155, ...ts("2026-04-09") },
  { id: "lv_1_11", patientId: "patient_1", parameterId: "lab_glucose", date: "2026-04-09", value: 95, ...ts("2026-04-09") },
  { id: "lv_1_12", patientId: "patient_1", parameterId: "lab_vitamin_d", date: "2026-04-09", value: 28, ...ts("2026-04-09") },

  // Patient 2 - Thomas Weber (Diabetes)
  { id: "lv_2_1", patientId: "patient_2", parameterId: "lab_hba1c", date: "2026-01-20", value: 7.8, ...ts("2026-01-20") },
  { id: "lv_2_2", patientId: "patient_2", parameterId: "lab_glucose", date: "2026-01-20", value: 145, ...ts("2026-01-20") },
  { id: "lv_2_3", patientId: "patient_2", parameterId: "lab_cholesterin", date: "2026-01-20", value: 248, ...ts("2026-01-20") },
  { id: "lv_2_4", patientId: "patient_2", parameterId: "lab_ldl", date: "2026-01-20", value: 162, ...ts("2026-01-20") },
  { id: "lv_2_5", patientId: "patient_2", parameterId: "lab_triglyceride", date: "2026-01-20", value: 210, ...ts("2026-01-20") },
  { id: "lv_2_6", patientId: "patient_2", parameterId: "lab_kreatinin", date: "2026-01-20", value: 1.0, ...ts("2026-01-20") },
  { id: "lv_2_7", patientId: "patient_2", parameterId: "lab_hba1c", date: "2026-03-17", value: 7.2, ...ts("2026-03-17") },
  { id: "lv_2_8", patientId: "patient_2", parameterId: "lab_glucose", date: "2026-03-17", value: 128, ...ts("2026-03-17") },
  { id: "lv_2_9", patientId: "patient_2", parameterId: "lab_cholesterin", date: "2026-03-17", value: 230, ...ts("2026-03-17") },
  { id: "lv_2_10", patientId: "patient_2", parameterId: "lab_ldl", date: "2026-03-17", value: 148, ...ts("2026-03-17") },
  { id: "lv_2_11", patientId: "patient_2", parameterId: "lab_triglyceride", date: "2026-03-17", value: 185, ...ts("2026-03-17") },

  // Patient 3 - Lisa Hoffmann (Zöliakie)
  { id: "lv_3_1", patientId: "patient_3", parameterId: "lab_ferritin", date: "2026-02-01", value: 18, ...ts("2026-02-01") },
  { id: "lv_3_2", patientId: "patient_3", parameterId: "lab_vitamin_d", date: "2026-02-01", value: 18, ...ts("2026-02-01") },
  { id: "lv_3_3", patientId: "patient_3", parameterId: "lab_tsh", date: "2026-02-01", value: 2.5, ...ts("2026-02-01") },
  { id: "lv_3_4", patientId: "patient_3", parameterId: "lab_ferritin", date: "2026-04-01", value: 24, ...ts("2026-04-01") },
  { id: "lv_3_5", patientId: "patient_3", parameterId: "lab_vitamin_d", date: "2026-04-01", value: 32, ...ts("2026-04-01") },

  // Patient 4 - Jürgen Fischer (Adipositas)
  { id: "lv_4_1", patientId: "patient_4", parameterId: "lab_cholesterin", date: "2026-01-10", value: 265, ...ts("2026-01-10") },
  { id: "lv_4_2", patientId: "patient_4", parameterId: "lab_ldl", date: "2026-01-10", value: 178, ...ts("2026-01-10") },
  { id: "lv_4_3", patientId: "patient_4", parameterId: "lab_hdl", date: "2026-01-10", value: 38, ...ts("2026-01-10") },
  { id: "lv_4_4", patientId: "patient_4", parameterId: "lab_triglyceride", date: "2026-01-10", value: 245, ...ts("2026-01-10") },
  { id: "lv_4_5", patientId: "patient_4", parameterId: "lab_glucose", date: "2026-01-10", value: 108, ...ts("2026-01-10") },
  { id: "lv_4_6", patientId: "patient_4", parameterId: "lab_hba1c", date: "2026-01-10", value: 6.1, ...ts("2026-01-10") },
  { id: "lv_4_7", patientId: "patient_4", parameterId: "lab_cholesterin", date: "2026-04-07", value: 242, ...ts("2026-04-07") },
  { id: "lv_4_8", patientId: "patient_4", parameterId: "lab_ldl", date: "2026-04-07", value: 158, ...ts("2026-04-07") },
  { id: "lv_4_9", patientId: "patient_4", parameterId: "lab_hdl", date: "2026-04-07", value: 42, ...ts("2026-04-07") },
  { id: "lv_4_10", patientId: "patient_4", parameterId: "lab_triglyceride", date: "2026-04-07", value: 210, ...ts("2026-04-07") },
  { id: "lv_4_11", patientId: "patient_4", parameterId: "lab_glucose", date: "2026-04-07", value: 98, ...ts("2026-04-07") },
];
