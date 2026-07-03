"use client"

import { useCallback, useMemo, useState } from "react"
import { addDays, addWeeks, format } from "date-fns"
import { de } from "date-fns/locale"
import { ChefHat, ChevronLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  complianceBadge,
  getEntryLabel,
} from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  MealEntry,
  Recipe,
} from "@/lib/types"

interface PlanCycleViewProps {
  /** Monday of the currently opened day's week; cycles page in 4-week steps from here. */
  baseWeekStart: Date
  getPlansInRange: (startDate: string, days: number) => DailyMealPlan[]
  dietLine?: DietLinePreset
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
}

/** 4-week-cycle tab: weekly averages against the diet line plus menu-rotation highlights. */
export function PlanCycleView({
  baseWeekStart,
  getPlansInRange,
  dietLine,
  foods,
  foodMap,
  recipeMap,
}: PlanCycleViewProps) {
  const [cycleOffset, setCycleOffset] = useState(0)

  const aggregatePlanNutrients = useCallback(
    (plan: DailyMealPlan) =>
      sumNutrients(
        plan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      ),
    [foodMap, foods, recipeMap],
  )

  const cycleStart = addWeeks(baseWeekStart, cycleOffset * 4)
  const cycleStartIso = format(cycleStart, "yyyy-MM-dd")
  const cyclePlans = useMemo(() => getPlansInRange(cycleStartIso, 28), [cycleStartIso, getPlansInRange])
  const cycleEnd = addDays(cycleStart, 27)
  const cycleRangeLabel = `${format(cycleStart, "d. MMM", { locale: de })} – ${format(cycleEnd, "d. MMM yyyy", { locale: de })}`

  const cycleWeekChunks = useMemo(() => {
    return Array.from({ length: 4 }, (_, index) => cyclePlans.slice(index * 7, index * 7 + 7))
  }, [cyclePlans])

  const cycleWeekStats = useMemo(() => {
    return cycleWeekChunks.map((days, index) => {
      const totalsPerDay = days.map((plan) => aggregatePlanNutrients(plan))
      const weeklyTotals = sumNutrients(totalsPerDay)
      const avgEnergy = getNutrientValue(weeklyTotals, "energie") / (days.length || 1)
      const avgProtein = getNutrientValue(weeklyTotals, "eiweiss") / (days.length || 1)
      const avgCarbs = getNutrientValue(weeklyTotals, "kohlenhydrate") / (days.length || 1)
      const highlights = Array.from(
        new Set(
          days
            .map((plan) => plan.slots.find((slot) => slot.type === "mittagessen")?.entries[0])
            .filter(Boolean)
            .map((entry) => getEntryLabel(entry as MealEntry, foodMap, recipeMap)),
        ),
      ).slice(0, 3)
      const energyTarget = dietLine?.targets.find((target) => target.nutrientId === "energie")
      const complianceState = complianceBadge(avgEnergy, energyTarget?.min, energyTarget?.max)
      return {
        weekLabel: `Woche ${index + 1}`,
        avgEnergy,
        avgProtein,
        avgCarbs,
        highlights,
        compliance: complianceState,
      }
    })
  }, [aggregatePlanNutrients, cycleWeekChunks, dietLine, foodMap, recipeMap])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setCycleOffset((prev) => prev - 1)}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Vorheriger Zyklus</span>
        </Button>
        <div className="text-sm font-medium">{cycleRangeLabel}</div>
        <Button variant="outline" size="icon" onClick={() => setCycleOffset((prev) => prev + 1)}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Nächster Zyklus</span>
        </Button>
        <Badge variant="secondary" className="ml-auto">
          {dietLine?.name ?? "Zielprofil"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wochensummen & Zielerreichung</CardTitle>
            <CardDescription>Durchschnittswerte pro Woche</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Woche</TableHead>
                  <TableHead>Ø kcal</TableHead>
                  <TableHead>Ø Eiweiß</TableHead>
                  <TableHead>Ø Kohlenhydrate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycleWeekStats.map((week) => (
                  <TableRow key={week.weekLabel}>
                    <TableCell className="font-medium">{week.weekLabel}</TableCell>
                    <TableCell>{formatNumber(week.avgEnergy, 0)}</TableCell>
                    <TableCell>{formatNumber(week.avgProtein, 0)} g</TableCell>
                    <TableCell>{formatNumber(week.avgCarbs, 0)} g</TableCell>
                    <TableCell>
                      <Badge
                        variant={week.compliance === "ok" ? "secondary" : "outline"}
                        className={
                          week.compliance === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : week.compliance === "low"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }
                      >
                        {week.compliance === "ok" ? "im Ziel" : week.compliance === "low" ? "unter Ziel" : "über Ziel"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Menürotation & Highlights</CardTitle>
            <CardDescription>
              Zeigt Signature-Dishes für Lehrküche und Stationsversorgung.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cycleWeekStats.map((week) => (
              <div key={week.weekLabel} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ChefHat className="h-4 w-4 text-muted-foreground" />
                  {week.weekLabel}
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
                  {week.highlights.length > 0 ? (
                    week.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)
                  ) : (
                    <li className="text-muted-foreground">Noch keine Highlights geplant.</li>
                  )}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
