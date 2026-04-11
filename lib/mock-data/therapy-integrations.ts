import type { TherapyDeviceIntegration } from "@/lib/types"

const baseTs = (date: string) => ({
  createdAt: `${date}T09:00:00Z`,
  updatedAt: `${date}T09:00:00Z`,
})

export const THERAPY_INTEGRATIONS: TherapyDeviceIntegration[] = [
  {
    id: "integration_patient2_cgm",
    patientId: "patient_2",
    type: "cgm",
    status: "connected",
    vendor: "Dexcom G7",
    lastSync: "2026-03-12T06:45:00Z",
    ...baseTs("2025-08-01"),
  },
  {
    id: "integration_patient3_allergen",
    patientId: "patient_3",
    type: "allergen",
    status: "pending",
    vendor: "LMIV Allergen Hub",
    ...baseTs("2026-02-18"),
  },
]
