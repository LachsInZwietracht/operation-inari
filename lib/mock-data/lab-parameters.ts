import type { LabParameter } from "@/lib/types";

export const LAB_PARAMETERS: LabParameter[] = [
  { id: "lab_hba1c", name: "HbA1c", shortName: "HbA1c", unit: "%", referenceMin: 4.0, referenceMax: 5.6, description: "Langzeit-Blutzuckerwert (3 Monate)" },
  { id: "lab_cholesterin", name: "Gesamtcholesterin", shortName: "Chol", unit: "mg/dl", referenceMin: 0, referenceMax: 200, description: "Gesamtcholesterin im Blut" },
  { id: "lab_ldl", name: "LDL-Cholesterin", shortName: "LDL", unit: "mg/dl", referenceMin: 0, referenceMax: 115, description: "Low-Density-Lipoprotein" },
  { id: "lab_hdl", name: "HDL-Cholesterin", shortName: "HDL", unit: "mg/dl", referenceMin: 40, referenceMax: 200, description: "High-Density-Lipoprotein" },
  { id: "lab_triglyceride", name: "Triglyceride", shortName: "TG", unit: "mg/dl", referenceMin: 0, referenceMax: 150, description: "Blutfettwerte (nüchtern)" },
  { id: "lab_glucose", name: "Nüchternglucose", shortName: "Gluc", unit: "mg/dl", referenceMin: 70, referenceMax: 100, description: "Nüchtern-Blutzucker" },
  { id: "lab_tsh", name: "TSH", shortName: "TSH", unit: "mU/l", referenceMin: 0.27, referenceMax: 4.2, description: "Schilddrüsen-stimulierendes Hormon" },
  { id: "lab_ferritin", name: "Ferritin", shortName: "Ferr", unit: "µg/l", referenceMin: 15, referenceMax: 150, description: "Eisenspeicherwert" },
  { id: "lab_vitamin_d", name: "25-OH-Vitamin D", shortName: "Vit D", unit: "ng/ml", referenceMin: 30, referenceMax: 80, description: "Vitamin-D-Status" },
  { id: "lab_kreatinin", name: "Kreatinin", shortName: "Krea", unit: "mg/dl", referenceMin: 0.7, referenceMax: 1.2, description: "Nierenfunktionsmarker" },
];
