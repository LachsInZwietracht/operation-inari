import { expect, test } from "@playwright/test"

import { intakeStatusLabel, intakeTimestampLabel } from "@/lib/intake-format"
import { buildIntakeApplyPlan, mergePatientUpdate } from "@/lib/intake/apply-submission"
import { intakePayloadSchema } from "@/lib/intake/schema"
import { buildIntakeRows, derivePatientIntakeStage } from "@/lib/patient-journey"
import type { Patient, PatientIntakeLink, PatientIntakeSubmission } from "@/lib/types"

const SUBMITTED_AT = "2026-08-13T09:30:00.000Z"
const REVIEWED_AT = "2026-08-16T10:15:00.000Z"
const NOW = new Date("2026-08-16T12:00:00.000Z")

function patient(): Patient {
  return {
    id: "patient-spuridon",
    firstName: "Spuridon",
    lastName: "Demir",
    dateOfBirth: "1986-03-12",
    gender: "m",
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
  }
}

function appliedSubmission(): PatientIntakeSubmission {
  return {
    id: "submission-spuridon",
    linkId: "link-spuridon",
    patientId: "patient-spuridon",
    appliedPatientId: "patient-spuridon",
    submittedAt: SUBMITTED_AT,
    reviewedAt: REVIEWED_AT,
    status: "applied",
    createdAt: SUBMITTED_AT,
    updatedAt: REVIEWED_AT,
    payload: {
      person: {
        firstName: "Spiros",
        lastName: "Demir",
        dateOfBirth: "1986-03-12",
        gender: "m",
      },
      goal: { primaryGoal: "gesuender_essen" },
      body: { heightCm: 180, weightKg: 82 },
      consent: { dataProcessing: true },
    },
  }
}

test("shows questionnaire arrival and today's review as separate plan events", () => {
  const [row] = buildIntakeRows({
    patients: [patient()],
    links: [],
    submissions: [appliedSubmission()],
    planSummaries: [],
    sessions: [],
    appointments: [],
    now: NOW,
  })

  expect(row.displayName).toBe("Demir, Spuridon")
  expect(row.stage).toBe("plan")
  expect(row.enteredStageAt).toBe(REVIEWED_AT)
  expect(row.questionnaireReceivedAt).toBe(SUBMITTED_AT)
  expect(row.intakeAppliedAt).toBe(REVIEWED_AT)
  expect(intakeTimestampLabel(row)).toContain("Eingegangen")
  expect(intakeStatusLabel(row)).toBe("Heute übernommen · Plan bereit")
})

test("keeps a stored patient identity when a questionnaire uses another name", () => {
  const payload = intakePayloadSchema.parse(appliedSubmission().payload)
  const plan = buildIntakeApplyPlan(payload, SUBMITTED_AT)
  const update = mergePatientUpdate(plan.patientFields, {
    first_name: "Spuridon",
    last_name: "Demir",
    date_of_birth: "1986-03-12",
    gender: "m",
  })

  expect(update).not.toHaveProperty("first_name")
  expect(update).not.toHaveProperty("last_name")
  expect(update).not.toHaveProperty("date_of_birth")
  expect(update).not.toHaveProperty("gender")
})

test("uses the intake phase colours' source of truth for a patient record", () => {
  const invitation: PatientIntakeLink = {
    id: "link-spuridon",
    patientId: "patient-spuridon",
    label: "Spuridon Demir",
    status: "received",
    url: "https://inari.test/onboarding/link-spuridon",
    createdAt: "2026-08-12T08:00:00.000Z",
    updatedAt: "2026-08-13T09:30:00.000Z",
  }

  expect(
    derivePatientIntakeStage({
      patient: patient(),
      links: [invitation],
      submissions: [appliedSubmission()],
      sessions: [],
      appointments: [],
      now: NOW,
    }),
  ).toBe("plan")
})
