import { z } from "zod"

import type { DailyMealPlan, MealSlot } from "@/lib/types"

export const MEAL_PLAN_EXCHANGE_KIND = "inari-meal-plan" as const
export const MEAL_PLAN_EXCHANGE_VERSION = 1 as const

const slotTypes = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
] as const

const mealEntrySchema = z.object({
  type: z.enum(["food", "recipe"]),
  referenceId: z.string().min(1),
  amount: z.number().finite().positive().max(10_000),
})

const mealSlotSchema = z.object({
  type: z.enum(slotTypes),
  entries: z.array(mealEntrySchema).max(100),
})

const importedPlanSchema = z.object({
  title: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(10_000).optional(),
  targetProfileId: z.string().min(1).max(200).optional(),
  dietLineId: z.string().min(1).max(200).optional(),
  slots: z.array(mealSlotSchema).max(slotTypes.length),
})

export const mealPlanExchangeSchema = z.object({
  kind: z.literal(MEAL_PLAN_EXCHANGE_KIND),
  schemaVersion: z.literal(MEAL_PLAN_EXCHANGE_VERSION),
  exportedAt: z.string().datetime(),
  plan: importedPlanSchema,
})

export type MealPlanExchange = z.infer<typeof mealPlanExchangeSchema>
export type ImportedMealPlan = MealPlanExchange["plan"]

/**
 * Builds a minimal, portable plan file. It deliberately excludes patient data,
 * record ids, approval state and dates: imports are always new drafts.
 */
export function createMealPlanExchange(plan: DailyMealPlan, exportedAt = new Date()): MealPlanExchange {
  return {
    kind: MEAL_PLAN_EXCHANGE_KIND,
    schemaVersion: MEAL_PLAN_EXCHANGE_VERSION,
    exportedAt: exportedAt.toISOString(),
    plan: {
      title: plan.title,
      notes: plan.notes,
      targetProfileId: plan.targetProfileId,
      dietLineId: plan.dietLineId,
      slots: plan.slots.map((slot) => ({
        type: slot.type,
        entries: slot.entries.map((entry) => ({
          type: entry.type,
          referenceId: entry.referenceId,
          amount: entry.amount,
        })),
      })),
    },
  }
}

/** Parses an external plan file without trusting any data from it. */
export function parseMealPlanExchange(value: unknown): MealPlanExchange {
  return mealPlanExchangeSchema.parse(value)
}

/** Restores the editor's entry ids only after an import is explicitly applied. */
export function importedPlanSlotsToMealSlots(plan: ImportedMealPlan): MealSlot[] {
  return plan.slots.map((slot, slotIndex) => ({
    type: slot.type,
    entries: slot.entries.map((entry, entryIndex) => ({
      ...entry,
      id: `import_${slot.type}_${slotIndex}_${entryIndex}_${crypto.randomUUID()}`,
    })),
  }))
}

export function countImportedEntries(plan: ImportedMealPlan): number {
  return plan.slots.reduce((count, slot) => count + slot.entries.length, 0)
}
