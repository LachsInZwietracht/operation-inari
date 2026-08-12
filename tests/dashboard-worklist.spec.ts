import { expect, test } from "@playwright/test"

import { buildDashboardWorklist } from "@/lib/dashboard-worklist"
import type { Patient, PatientIntakeSubmission } from "@/lib/types"

const patient: Patient = {
  id: "patient-1",
  firstName: "Fabian",
  lastName: "Beispiel",
  dateOfBirth: "1990-01-01",
  gender: "m",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

test("stellt offene Fragebogen vor Kontaktaufgaben", () => {
  const submission: PatientIntakeSubmission = {
    id: "submission-1",
    linkId: "link-1",
    submittedAt: "2026-08-10T00:00:00.000Z",
    status: "new",
    payload: {
      person: { firstName: "Nora", lastName: "Neu", dateOfBirth: "1995-01-01", gender: "w" },
      goal: { primaryGoal: "gesuender_essen" },
      body: { heightCm: 170, weightKg: 70 },
      consent: { dataProcessing: true },
    },
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  }

  const items = buildDashboardWorklist({
    patients: [patient],
    plans: [{
      id: "plan-1",
      title: "Plan Fabian",
      date: "2026-01-01",
      patientId: patient.id,
      status: "approved",
      slots: [],
    }],
    appointments: [],
    sessions: [],
    submissions: [submission],
    now: new Date("2026-08-12T12:00:00.000Z"),
  })

  expect(items[0].kind).toBe("intake")
  expect(items.some((item) => item.kind === "contact")).toBeTruthy()
})

test("meldet keinen ausstehenden Kontakt bei einem künftigen Termin", () => {
  const items = buildDashboardWorklist({
    patients: [patient],
    plans: [{
      id: "plan-1",
      title: "Plan Fabian",
      date: "2026-01-01",
      patientId: patient.id,
      status: "approved",
      slots: [],
    }],
    appointments: [{
      id: "appointment-1",
      title: "Kontrolle",
      date: "2026-08-13",
      startTime: "10:00",
      endTime: "10:30",
      patientId: patient.id,
      type: "kontrolle",
    }],
    sessions: [],
    submissions: [],
    now: new Date("2026-08-12T12:00:00.000Z"),
  })

  expect(items.some((item) => item.kind === "contact")).toBeFalsy()
})
