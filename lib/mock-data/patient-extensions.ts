import type {
  DiagnosisEntry,
  MedicationEntry,
  ActivityEntry,
  TherapySetting,
  ScreeningResult,
  ProcamResult,
  DigitalProtocolLink,
} from "@/lib/types";

const baseTs = (date: string) => ({
  createdAt: `${date}T00:00:00Z`,
  updatedAt: `${date}T00:00:00Z`,
});

export const DIAGNOSES: DiagnosisEntry[] = [
  {
    id: "diag_patient1_obesity",
    patientId: "patient_1",
    diagnosis: "Adipositas Grad II",
    icdCode: "E66.01",
    startDate: "2024-09-05",
    notes: "BMI 35, Begleitdiagnose Hypertonie.",
    ...baseTs("2024-09-05"),
  },
  {
    id: "diag_patient2_diabetes",
    patientId: "patient_2",
    diagnosis: "Diabetes mellitus Typ 2",
    icdCode: "E11.90",
    startDate: "2023-05-10",
    notes: "HbA1c zuletzt 7,2 %",
    ...baseTs("2023-05-10"),
  },
  {
    id: "diag_patient3_zoeliakie",
    patientId: "patient_3",
    diagnosis: "Zöliakie",
    icdCode: "K90.0",
    startDate: "2020-02-14",
    notes: "Duodenalbiopsie positiv.",
    ...baseTs("2020-02-14"),
  },
];

export const MEDICATIONS: MedicationEntry[] = [
  {
    id: "med_metformin",
    patientId: "patient_2",
    name: "Metformin",
    dosage: "1000 mg",
    schedule: "2× täglich",
    startDate: "2023-05-10",
    reason: "Blutzuckerregulation",
    ...baseTs("2023-05-10"),
  },
  {
    id: "med_glp1",
    patientId: "patient_1",
    name: "Semaglutid",
    dosage: "1 mg",
    schedule: "1× wöchentlich",
    startDate: "2025-09-01",
    notes: "Gute Verträglichkeit",
    ...baseTs("2025-09-01"),
  },
  {
    id: "med_antihypertensive",
    patientId: "patient_4",
    name: "Ramipril",
    dosage: "5 mg",
    schedule: "1× täglich",
    startDate: "2022-03-12",
    reason: "Hypertonie",
    ...baseTs("2022-03-12"),
  },
];

export const ACTIVITIES: ActivityEntry[] = [
  {
    id: "act_walk",
    patientId: "patient_1",
    date: "2026-03-11",
    type: "Spaziergang",
    durationMinutes: 45,
    intensity: "moderat",
    pal: 1.6,
    energyKcal: 180,
    ...baseTs("2026-03-11"),
  },
  {
    id: "act_cycling",
    patientId: "patient_2",
    date: "2026-03-10",
    type: "Ergometer",
    durationMinutes: 30,
    intensity: "hoch",
    pal: 1.8,
    energyKcal: 220,
    ...baseTs("2026-03-10"),
  },
  {
    id: "act_yoga",
    patientId: "patient_3",
    date: "2026-03-08",
    type: "Yoga",
    durationMinutes: 60,
    intensity: "leicht",
    pal: 1.4,
    energyKcal: 150,
    ...baseTs("2026-03-08"),
  },
];

export const THERAPY_SETTINGS: TherapySetting[] = [
  {
    id: "therapy_diabetes",
    patientId: "patient_2",
    module: "diabetes",
    status: "active",
    targets: {
      beProMeal: "4-5",
      glucoseFasting: "90-120 mg/dl",
      keFactor: "12 g",
    },
    notes: "Sensor-gestütztes Monitoring",
    ...baseTs("2026-02-20"),
  },
  {
    id: "therapy_keto",
    patientId: "patient_5",
    module: "ketogen",
    status: "paused",
    targets: {
      ratio: "3:1",
      carbsMax: "20 g",
    },
    ...baseTs("2025-11-12"),
  },
  {
    id: "therapy_allergens",
    patientId: "patient_3",
    module: "allergen",
    status: "active",
    targets: {
      avoid: "Gluten, Weizen, Gerste",
    },
    notes: "Cross-contamination briefing durchgeführt",
    ...baseTs("2024-06-03"),
  },
];

export const SCREENINGS: ScreeningResult[] = [
  {
    id: "screen_must",
    patientId: "patient_4",
    tool: "MUST",
    score: 2,
    riskLevel: "medium",
    answers: [
      { question: "BMI", answer: "21-18.5" },
      { question: "Gewichtsverlust", answer: "5-10 %" },
      { question: "Akute Erkrankung", answer: "Ja" },
    ],
    ...baseTs("2026-01-22"),
  },
  {
    id: "screen_nrs",
    patientId: "patient_2",
    tool: "NRS-2002",
    score: 3,
    riskLevel: "high",
    answers: [
      { question: "BMI < 20.5?", answer: "Nein" },
      { question: "Gewichtsverlust?", answer: "Ja, 3 kg" },
      { question: "Ernährungsaufnahme reduziert?", answer: "Ja" },
      { question: "Schwere der Erkrankung", answer: "Moderat" },
    ],
    ...baseTs("2026-02-18"),
  },
];

export const PROCAM_RESULTS: ProcamResult[] = [
  {
    id: "procam_patient2",
    patientId: "patient_2",
    score: 62,
    category: "high",
    age: 61,
    ldl: 165,
    hdl: 38,
    systolic: 150,
    smoker: true,
    ...baseTs("2026-02-18"),
  },
  {
    id: "procam_patient4",
    patientId: "patient_4",
    score: 38,
    category: "moderate",
    age: 71,
    ldl: 145,
    hdl: 42,
    systolic: 138,
    smoker: false,
    ...baseTs("2026-01-22"),
  },
];

export const DIGITAL_PROTOCOL_LINKS: DigitalProtocolLink[] = [
  {
    id: "dpl_patient1",
    patientId: "patient_1",
    method: "Digitales 24h Recall",
    status: "pending",
    url: "https://prodi.app/protokoll/patient_1",
    qrCode: "QR1",
    expiresAt: "2026-03-20",
    ...baseTs("2026-03-12"),
  },
  {
    id: "dpl_patient2",
    patientId: "patient_2",
    method: "FFQ",
    status: "received",
    url: "https://prodi.app/protokoll/patient_2",
    qrCode: "QR2",
    ...baseTs("2026-03-10"),
  },
];
