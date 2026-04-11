import type { EgkCardData, EgkScanEvent } from "@/lib/types"

const baseTs = (date: string) => ({
  createdAt: `${date}T08:00:00Z`,
  updatedAt: `${date}T08:00:00Z`,
})

export const EGK_CARDS: EgkCardData[] = [
  {
    firstName: "Max",
    lastName: "Mustermann",
    dateOfBirth: "1985-04-17",
    gender: "m",
    insuranceProvider: "AOK Rheinland/Hamburg",
    insuranceNumber: "AOK-44556677",
    street: "Domstraße 12",
    zip: "50667",
    city: "Köln",
  },
  {
    firstName: "Julia",
    lastName: "Neumann",
    dateOfBirth: "1990-10-05",
    gender: "w",
    insuranceProvider: "Techniker Krankenkasse",
    insuranceNumber: "TK-99887766",
    street: "Marktplatz 8",
    zip: "70173",
    city: "Stuttgart",
  },
  {
    firstName: "Luca",
    lastName: "Brunner",
    dateOfBirth: "2007-02-11",
    gender: "m",
    insuranceProvider: "DAK-Gesundheit",
    insuranceNumber: "DAK-12332144",
    street: "Goethestraße 3",
    zip: "80331",
    city: "München",
  },
  {
    firstName: "Amelie",
    lastName: "Fischer",
    dateOfBirth: "1978-12-03",
    gender: "w",
    insuranceProvider: "BARMER",
    insuranceNumber: "BAR-66778822",
    street: "Hafenstraße 4",
    zip: "20457",
    city: "Hamburg",
  },
]

export const EGK_SCAN_EVENTS: EgkScanEvent[] = [
  {
    id: "egk_evt_1",
    source: "webserial",
    status: "matched",
    card: EGK_CARDS[0],
    patientId: "patient_1",
    notes: "Regelmäßige Kontrolle",
    ...baseTs("2026-03-10"),
  },
  {
    id: "egk_evt_2",
    source: "companion",
    status: "pending",
    card: EGK_CARDS[3],
    notes: "Neue Patientin am Empfang",
    ...baseTs("2026-03-12"),
  },
]
