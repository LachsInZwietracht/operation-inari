import { expect, test } from "@playwright/test"

import { analyseDayPlan } from "@/lib/day-plan-analysis"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  ResolvedReferenceConfig,
} from "@/lib/types"

function food(id: string, nutrients: Food["nutrients"]): Food {
  return {
    id,
    name: id,
    categoryId: "test",
    source: "test",
    nutrients,
    baseAmount: 100,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }
}

function plan(...foodIds: string[]): DailyMealPlan {
  return {
    id: "plan-test",
    date: "2026-09-02",
    slots: [
      {
        type: "fruehstueck",
        entries: foodIds.map((referenceId, index) => ({
          id: `entry-${index}`,
          type: "food" as const,
          referenceId,
          amount: 100,
        })),
      },
    ],
  }
}

const refConfig: ResolvedReferenceConfig = {
  standardId: "dge",
  standardName: "DGE",
  ageGroupId: "adult",
  ageGroupLabel: "Erwachsene",
  gender: "w",
  lifeStage: "none",
  values: [],
}

function analyse({
  foods,
  dietLine,
  patientEnergyTarget,
}: {
  foods: Food[]
  dietLine?: DietLinePreset
  patientEnergyTarget?: number
}) {
  return analyseDayPlan({
    plan: plan(...foods.map((item) => item.id)),
    foods,
    foodMap: new Map(foods.map((item) => [item.id, item])),
    recipeMap: new Map(),
    dietLine,
    refConfig,
    referenceValues: [{ nutrientId: "vitamin_c", amount: 95 }],
    patientEnergyTarget,
  })
}

test.describe("Tagesanalyse", () => {
  test("uses the patient energy corridor and the established reference fallback", () => {
    const result = analyse({
      foods: [food("complete", [
        { nutrientId: "energie", amount: 2200 },
        { nutrientId: "vitamin_c", amount: 100 },
      ])],
      patientEnergyTarget: 2000,
    })

    expect(result.nutrients.find((item) => item.definition.id === "energie")).toMatchObject({
      status: "high",
      targetSource: "Patientenziel",
      energyCorridor: true,
    })
    expect(result.nutrients.find((item) => item.definition.id === "vitamin_c")).toMatchObject({
      status: "ok",
      min: 95,
      targetSource: "Referenzwert",
    })
  })

  test("lets a Kostform override a reference and only flags an explicit maximum", () => {
    const result = analyse({
      foods: [food("high-sodium", [
        { nutrientId: "natrium", amount: 1500 },
        { nutrientId: "vitamin_c", amount: 180 },
      ])],
      dietLine: {
        id: "diet-test",
        name: "Testkost",
        description: "",
        targets: [
          { nutrientId: "vitamin_c", label: "Vitamin C", unit: "mg", min: 120 },
          { nutrientId: "natrium", label: "Natrium", unit: "mg", max: 1000 },
        ],
      },
    })

    expect(result.nutrients.find((item) => item.definition.id === "vitamin_c")).toMatchObject({
      status: "ok",
      min: 120,
      targetSource: "Kostform",
    })
    expect(result.nutrients.find((item) => item.definition.id === "natrium")).toMatchObject({
      status: "high",
      max: 1000,
      targetSource: "Kostform",
    })
  })

  test("marks an aggregate as unavailable when one entry lacks the nutrient", () => {
    const foods = [
      food("with-vitamin", [{ nutrientId: "vitamin_c", amount: 70 }]),
      food("without-vitamin", [{ nutrientId: "energie", amount: 300 }]),
    ]
    const result = analyseDayPlan({
      plan: plan("with-vitamin", "without-vitamin"),
      foods,
      foodMap: new Map(foods.map((item) => [item.id, item])),
      recipeMap: new Map(),
      refConfig,
      referenceValues: [{ nutrientId: "vitamin_c", amount: 95 }],
    })

    expect(result.nutrients.find((item) => item.definition.id === "vitamin_c")).toMatchObject({
      value: 70,
      evaluable: false,
      status: "unavailable",
    })
  })
})
