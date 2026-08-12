import { expect, test } from "@playwright/test"

import { findIntakeReviewWarnings } from "@/lib/intake/review-rules"
import type { PatientIntakePayload } from "@/lib/types"

function payload(
  overrides: Partial<PatientIntakePayload> = {},
): PatientIntakePayload {
  return {
    person: {
      firstName: "Fabian",
      lastName: "Beispiel",
      dateOfBirth: "1990-01-01",
      gender: "m",
    },
    goal: { primaryGoal: "gesuender_essen" },
    body: { heightCm: 180, weightKg: 80 },
    consent: { dataProcessing: true },
    ...overrides,
  }
}

test("findet vegane Milch-Widersprüche", () => {
  const warnings = findIntakeReviewWarnings(
    payload({
      diet: { style: "vegan" },
      foodPreferences: [{ foodKey: "milch", rating: "gerne" }],
    }),
  )

  expect(warnings).toHaveLength(1)
  expect(warnings[0].detail).toContain("Milch")
})

test("findet Halal-Schweinefleisch-Widersprüche", () => {
  const warnings = findIntakeReviewWarnings(
    payload({
      diet: { exclusions: ["halal"] },
      foodPreferences: [{ foodKey: "schwein", rating: "geht" }],
    }),
  )

  expect(warnings).toHaveLength(1)
  expect(warnings[0].detail).toContain("Schweinefleisch")
})

test("findet Krebstier-Garnelen-Widersprüche", () => {
  const warnings = findIntakeReviewWarnings(
    payload({
      allergens: [{ allergenId: "krebstiere", type: "intolerance" }],
      foodPreferences: [{ foodKey: "garnelen", rating: "gerne" }],
    }),
  )

  expect(warnings).toHaveLength(1)
  expect(warnings[0].title).toContain("geklärt")
})

test("meldet Lebensmittel mit Bewertung Nie nicht als Widerspruch", () => {
  const warnings = findIntakeReviewWarnings(
    payload({
      diet: { style: "vegan" },
      foodPreferences: [{ foodKey: "milch", rating: "nie" }],
    }),
  )

  expect(warnings).toHaveLength(0)
})
