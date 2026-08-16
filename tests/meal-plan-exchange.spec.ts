import { expect, test } from "@playwright/test"

import {
  countImportedEntries,
  createMealPlanExchange,
  importedPlanSlotsToMealSlots,
  parseMealPlanExchange,
} from "@/lib/meal-plan-exchange"
import type { DailyMealPlan } from "@/lib/types"

const plan: DailyMealPlan = {
  id: "plan-source",
  date: "2026-08-16",
  patientId: "patient-a",
  status: "approved",
  approvedAt: "2026-08-16T09:00:00.000Z",
  approvedBy: "dietitian-a",
  title: "Testplan",
  slots: [
    {
      type: "fruehstueck",
      entries: [{ id: "entry-a", type: "food", referenceId: "food-a", amount: 120 }],
    },
  ],
}

test("exports only portable draft content and restores fresh entry ids", () => {
  const exchange = createMealPlanExchange(plan, new Date("2026-08-16T10:00:00.000Z"))
  const imported = parseMealPlanExchange(exchange)
  const slots = importedPlanSlotsToMealSlots(imported.plan)

  expect(imported).toMatchObject({ kind: "inari-meal-plan", schemaVersion: 1 })
  expect(imported.plan).not.toHaveProperty("patientId")
  expect(imported.plan).not.toHaveProperty("approvedAt")
  expect(countImportedEntries(imported.plan)).toBe(1)
  expect(slots[0]?.entries[0]?.id).not.toBe("entry-a")
})

test("rejects a file with an unsupported exchange version", () => {
  expect(() =>
    parseMealPlanExchange({
      kind: "inari-meal-plan",
      schemaVersion: 2,
      exportedAt: "2026-08-16T10:00:00.000Z",
      plan: { slots: [] },
    }),
  ).toThrow()
})
