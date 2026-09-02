import type { MealPlanTemplate, MealPlanTemplateDayBlock } from "@/lib/types"

export type MealPlanTemplateDuration =
  | "all"
  | "day"
  | "two-to-three"
  | "four-to-six"
  | "seven-plus"

export const MEAL_PLAN_TEMPLATE_DURATION_LABELS: Record<
  MealPlanTemplateDuration,
  string
> = {
  all: "Alle",
  day: "1 Tag",
  "two-to-three": "2–3 Tage",
  "four-to-six": "4–6 Tage",
  "seven-plus": "7+ Tage",
}

export function getMealPlanTemplateBlocks(
  template: Pick<MealPlanTemplate, "dayBlocks" | "slots">,
): MealPlanTemplateDayBlock[] {
  return template.dayBlocks?.length
    ? [...template.dayBlocks].sort((a, b) => a.offsetDays - b.offsetDays)
    : [{ offsetDays: 0, slots: template.slots }]
}

/** Calendar span, deliberately including unfilled days between stored blocks. */
export function getMealPlanTemplateSpanDays(
  template: Pick<MealPlanTemplate, "dayBlocks" | "slots">,
): number {
  const blocks = getMealPlanTemplateBlocks(template)
  return Math.max(...blocks.map((block) => block.offsetDays)) + 1
}

export function matchesMealPlanTemplateDuration(
  spanDays: number,
  duration: MealPlanTemplateDuration,
): boolean {
  if (duration === "all") return true
  if (duration === "day") return spanDays === 1
  if (duration === "two-to-three") return spanDays >= 2 && spanDays <= 3
  if (duration === "four-to-six") return spanDays >= 4 && spanDays <= 6
  return spanDays >= 7
}
