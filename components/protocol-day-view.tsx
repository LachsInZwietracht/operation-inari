import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatDate, formatNumber } from "@/lib/format"
import { getNutrientValue, scaleNutrients, sumNutrients } from "@/lib/nutrients"
import { FOODS } from "@/lib/mock-data"
import type { ProtocolDay, MealSlotType } from "@/lib/types"

interface ProtocolDayViewProps {
  day: ProtocolDay
}

const MEAL_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

const foodMap = new Map(FOODS.map((f) => [f.id, f]))

export function ProtocolDayView({ day }: ProtocolDayViewProps) {
  const entriesBySlot = new Map<MealSlotType, typeof day.entries>()
  for (const entry of day.entries) {
    const existing = entriesBySlot.get(entry.mealSlot) ?? []
    existing.push(entry)
    entriesBySlot.set(entry.mealSlot, existing)
  }

  const dayNutrients = sumNutrients(
    day.entries.map((entry) => {
      const food = foodMap.get(entry.foodId)
      if (!food) return []
      return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
    }),
  )

  const dayKcal = getNutrientValue(dayNutrients, "energie")
  const dayProtein = getNutrientValue(dayNutrients, "eiweiss")
  const dayFat = getNutrientValue(dayNutrients, "fett")
  const dayCarbs = getNutrientValue(dayNutrients, "kohlenhydrate")

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{formatDate(day.date)}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{formatNumber(dayKcal, 0)} kcal</Badge>
            <Badge variant="secondary">E {formatNumber(dayProtein, 0)} g</Badge>
            <Badge variant="secondary">F {formatNumber(dayFat, 0)} g</Badge>
            <Badge variant="secondary">KH {formatNumber(dayCarbs, 0)} g</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mahlzeit</TableHead>
              <TableHead>Lebensmittel</TableHead>
              <TableHead className="text-right">Menge (g)</TableHead>
              <TableHead className="text-right">kcal</TableHead>
              <TableHead className="text-right">Uhrzeit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MEAL_ORDER.map((slot) => {
              const slotEntries = entriesBySlot.get(slot)
              if (!slotEntries?.length) return null
              return slotEntries.map((entry, idx) => {
                const food = foodMap.get(entry.foodId)
                const entryKcal = food
                  ? getNutrientValue(
                      scaleNutrients(food.nutrients, food.baseAmount, entry.amount),
                      "energie",
                    )
                  : 0
                const measurement = entry.householdMeasurement

                return (
                  <TableRow key={entry.id}>
                    {idx === 0 && (
                      <TableCell rowSpan={slotEntries.length} className="font-medium align-top">
                        {MEAL_SLOT_LABELS[slot]}
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <p>{food?.name ?? "Unbekannt"}</p>
                        {measurement && (
                          <p className="text-xs text-muted-foreground">
                            {measurement.quantity}× {measurement.unitLabel} (~
                            {Math.round(measurement.estimatedGrams)} g)
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(entry.amount, 0)}</TableCell>
                    <TableCell className="text-right">{formatNumber(entryKcal, 0)}</TableCell>
                    <TableCell className="text-right">{entry.time ?? "–"}</TableCell>
                  </TableRow>
                )
              })
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
