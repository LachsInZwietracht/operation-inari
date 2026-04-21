import type { PatientAllergenEntry } from "@/lib/types";

const ts = { createdAt: "2026-04-10T08:00:00Z", updatedAt: "2026-04-10T08:00:00Z" };

export const PATIENT_ALLERGENS: PatientAllergenEntry[] = [
  {
    id: "mock_allergen_patient_3_gluten",
    patientId: "patient_3",
    allergenId: "gluten",
    type: "allergy",
    severity: "severe",
    diagnosedDate: "2020-02-01",
    notes: "Zöliakie, strikt glutenfrei.",
    ...ts,
  },
  {
    id: "mock_allergen_patient_5_nuts",
    patientId: "patient_5",
    allergenId: "schalenfrüchte",
    type: "allergy",
    severity: "severe",
    diagnosedDate: "2024-05-12",
    notes: "Anaphylaxie-Risiko.",
    ...ts,
  },
  {
    id: "mock_allergen_patient_5_sellerie",
    patientId: "patient_5",
    allergenId: "sellerie",
    type: "allergy",
    severity: "moderate",
    diagnosedDate: "2024-05-12",
    ...ts,
  },
];
