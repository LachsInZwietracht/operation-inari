"use client"

import { useCallback, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { MealPlanWeekBoard } from "@/components/meal-plan-week-board"
import { Button } from "@/components/ui/button"
import {
  calculateEntryNutrients,
  getEntryLabel,
} from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  MealEntry,
  MealSlotType,
  Recipe,
} from "@/lib/types"

interface PlanWeekViewProps {
  weekPlans: DailyMealPlan[]
  weekRangeLabel: string
  onPrevWeek: () => void
  onNextWeek: () => void
  dietLine?: DietLinePreset
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  activeDate: string
  energyTarget?: number
  onSelectDay: (date: string) => void
  onOpenDay: (date: string) => void
  onCopyCurrentToDay: (date: string) => void
  onCopyToNextDay: (date: string) => void
  onClearDay: (date: string) => void
  onDrop: (
    date: string,
    slotType: MealSlotType,
    payload: { type: MealEntry["type"]; referenceId: string },
  ) => void
  onRemoveEntry: (date: string, slotType: MealSlotType, entryId: string) => void
}

/** Week tab: week navigation and the drag/drop week board. */
export function PlanWeekView({
  weekPlans,
  weekRangeLabel,
  onPrevWeek,
  onNextWeek,
  dietLine,
  foods,
  foodMap,
  recipeMap,
  activeDate,
  energyTarget,
  onSelectDay,
  onOpenDay,
  onCopyCurrentToDay,
  onCopyToNextDay,
  onClearDay,
  onDrop,
  onRemoveEntry,
}: PlanWeekViewProps) {
  const aggregatePlanNutrients = useCallback(
    (plan: DailyMealPlan) =>
      sumNutrients(
        plan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      ),
    [foodMap, foods, recipeMap],
  )

  const weekEntryLabel = useCallback(
    (entry: MealEntry) => getEntryLabel(entry, foodMap, recipeMap),
    [foodMap, recipeMap],
  )

  const weekSummaries = useMemo(() => {
    return weekPlans.map((plan) => ({ plan, totals: aggregatePlanNutrients(plan) }))
  }, [aggregatePlanNutrients, weekPlans])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Vorherige Woche</span>
        </Button>
        <div className="text-sm font-medium">{weekRangeLabel}</div>
        <Button variant="outline" size="icon" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Nächste Woche</span>
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          Bezug: {dietLine?.name ?? "Zielprofil auswählen"}
        </div>
      </div>

      <MealPlanWeekBoard
        days={weekSummaries.map(({ plan, totals }) => ({
          plan,
          kcal: getNutrientValue(totals, "energie"),
        }))}
        activeDate={activeDate}
        energyTarget={energyTarget}
        getEntryLabel={weekEntryLabel}
        onSelectDay={onSelectDay}
        onOpenDay={onOpenDay}
        onCopyCurrentToDay={onCopyCurrentToDay}
        onCopyToNextDay={onCopyToNextDay}
        onClearDay={onClearDay}
        onDrop={onDrop}
        onRemoveEntry={onRemoveEntry}
      />
    </div>
  )
}
