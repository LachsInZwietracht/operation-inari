"use client"

import { useCallback, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react"

import {
  MealPlanLibrary,
  MealPlanWeekBoard,
  type WeekBoardTarget,
} from "@/components/meal-plan-week-board"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import {
  calculateEntryNutrients,
  getEntryLabel,
  type DietLineComplianceItem,
} from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  FoodSearchItem,
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
  dietLineCompliance: DietLineComplianceItem[]
  foods: Food[]
  foodMap: Map<string, Food>
  recipes: Recipe[]
  recipeMap: Map<string, Recipe>
  libraryFoods: FoodSearchItem[]
  categoryLabels: Map<string, string>
  activeDate: string
  activeDayLabel: string
  energyValue: number
  energyTarget?: number
  barTargets: WeekBoardTarget[]
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
  isExporting: boolean
  onExportLehrkueche: () => void
}

/** Week tab: drag/drop week board, weekly averages, and teaching-kitchen preview. */
export function PlanWeekView({
  weekPlans,
  weekRangeLabel,
  onPrevWeek,
  onNextWeek,
  dietLine,
  dietLineCompliance,
  foods,
  foodMap,
  recipes,
  recipeMap,
  libraryFoods,
  categoryLabels,
  activeDate,
  activeDayLabel,
  energyValue,
  energyTarget,
  barTargets,
  onSelectDay,
  onOpenDay,
  onCopyCurrentToDay,
  onCopyToNextDay,
  onClearDay,
  onDrop,
  onRemoveEntry,
  isExporting,
  onExportLehrkueche,
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

  const teachingKitchenRows = useMemo(() => {
    return weekPlans.map((plan) => {
      const dateLabel = format(parseISO(plan.date), "EEE, dd.MM.", { locale: de })
      const lunch = plan.slots.find((slot) => slot.type === "mittagessen")
      const dinner = plan.slots.find((slot) => slot.type === "abendessen")
      return {
        dateLabel,
        lunch:
          lunch && lunch.entries[0]
            ? getEntryLabel(lunch.entries[0], foodMap, recipeMap)
            : "noch offen",
        dinner:
          dinner && dinner.entries[0]
            ? getEntryLabel(dinner.entries[0], foodMap, recipeMap)
            : "Snack-/Buffetplanung",
        kcal: formatNumber(Math.round(getNutrientValue(aggregatePlanNutrients(plan), "energie"))),
      }
    })
  }, [aggregatePlanNutrients, foodMap, recipeMap, weekPlans])

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

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <MealPlanLibrary
          foods={libraryFoods}
          fullFoods={foods}
          recipes={recipes}
          categoryLabels={categoryLabels}
        />
        <MealPlanWeekBoard
          days={weekSummaries.map(({ plan, totals }) => ({
            plan,
            kcal: getNutrientValue(totals, "energie"),
          }))}
          activeDate={activeDate}
          activeDayLabel={activeDayLabel}
          energyValue={energyValue}
          energyTarget={energyTarget}
          barTargets={barTargets}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wöchentliche Kennzahlen</CardTitle>
            <CardDescription>Vergleich mit {dietLine?.name ?? "Zielprofil"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {dietLineCompliance.map((target) => {
              const weekTotal = weekSummaries.reduce(
                (sum, { totals }) => sum + getNutrientValue(totals, target.nutrientId),
                0,
              )
              const divisor = weekSummaries.length || 1
              const weekAvg = weekTotal / divisor
              return (
                <div key={target.label} className="flex items-center justify-between">
                  <span>{target.label}</span>
                  <span className="text-right">
                    {formatNumber(weekAvg, 0)} {target.unit}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Lehrküchenplan</CardTitle>
              <CardDescription>Preview für Aushänge & Druck</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isExporting}
              onClick={onExportLehrkueche}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              PDF exportieren
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Mittag</TableHead>
                  <TableHead>Abend</TableHead>
                  <TableHead className="text-right">kcal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachingKitchenRows.map((row) => (
                  <TableRow key={row.dateLabel}>
                    <TableCell className="font-medium">{row.dateLabel}</TableCell>
                    <TableCell>{row.lunch}</TableCell>
                    <TableCell>{row.dinner}</TableCell>
                    <TableCell className="text-right">{row.kcal}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exchange-Listen Notizen</CardTitle>
            <CardDescription>Markierte Lebensmittel aus Austauschlisten</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Kombiniere Snack-Slots mit ballaststoffreichen Optionen aus den Austauschlisten.
            Tippe auf einen Slot im Tagesmodus, um Alternativen einzufügen.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
