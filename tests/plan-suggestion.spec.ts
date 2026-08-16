import { expect, test } from "@playwright/test"

import { buildSafePlanSuggestion } from "@/lib/nutrition/plan-suggestion"
import type { Patient, Recipe } from "@/lib/types"

const patient: Patient = { id: "patient-1", firstName: "Test", lastName: "Person", dateOfBirth: "1990-01-01", gender: "w", createdAt: "2026-01-01", updatedAt: "2026-01-01" }
const recipes: Recipe[] = ["Frühstück", "Mittag", "Abend"].map((name, index) => ({
  id: `recipe-${index}`, name, description: "", category: "", servings: 1, prepTime: 0, cookTime: 0,
  ingredients: [], instructions: [], cachedKcalPerPortion: 500, cachedProteinPerPortion: 20, createdAt: "2026-01-01", updatedAt: "2026-01-01",
}))

test.describe("safe plan suggestion", () => {
  test("uses only recipes without a hard allergen conflict", () => {
    const result = buildSafePlanSuggestion({ patient, recipes, patientAllergens: [{ id: "a", patientId: patient.id, allergenId: "gluten", type: "allergy", severity: "severe", createdAt: "2026-01-01", updatedAt: "2026-01-01" }] })
    expect(result.blockedReasons).toEqual([])
    expect(result.slots).toHaveLength(3)
  })

  test("refuses to guess unverified diet exclusions", () => {
    const result = buildSafePlanSuggestion({ patient: { ...patient, dietStyle: "vegan" }, recipes, patientAllergens: [] })
    expect(result.slots).toEqual([])
    expect(result.blockedReasons).toHaveLength(1)
  })
})
