"use client"

import { useCallback } from "react"
import { X, Plus } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { FOODS, RECIPES } from "@/lib/mock-data"
import { scaleNutrients, getNutrientValue, calculateRecipeNutrients, calculatePerServing } from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import type { MealSlot, MealSlotType, MealEntry } from "@/lib/types"

interface MealSlotProps {
  slot: MealSlot
  onAddEntry: (slotType: MealSlotType) => void
  onRemoveEntry: (slotType: MealSlotType, entryId: string) => void
  onUpdateAmount: (slotType: MealSlotType, entryId: string, amount: number) => void
}

function getEntryName(entry: MealEntry): string {
  if (entry.type === "food") {
    return FOODS.find((f) => f.id === entry.referenceId)?.name ?? "Unbekannt"
  }
  return RECIPES.find((r) => r.id === entry.referenceId)?.name ?? "Unbekannt"
}

function getEntryKcal(entry: MealEntry): number {
  if (entry.type === "food") {
    const food = FOODS.find((f) => f.id === entry.referenceId)
    if (!food) return 0
    const scaled = scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
    return getNutrientValue(scaled, "energie")
  }

  const recipe = RECIPES.find((r) => r.id === entry.referenceId)
  if (!recipe) return 0
  const totalNutrients = calculateRecipeNutrients(recipe, FOODS)
  const perServing = calculatePerServing(totalNutrients, recipe.servings)
  const scaled = scaleNutrients(perServing, 1, entry.amount)
  return getNutrientValue(scaled, "energie")
}

export function MealSlotCard({ slot, onAddEntry, onRemoveEntry, onUpdateAmount }: MealSlotProps) {
  const totalKcal = slot.entries.reduce((sum, entry) => sum + getEntryKcal(entry), 0)

  const handleAmountChange = useCallback(
    (entryId: string, rawValue: string) => {
      const parsed = parseFloat(rawValue.replace(",", "."))
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateAmount(slot.type, entryId, parsed)
      }
    },
    [onUpdateAmount, slot.type]
  )

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{MEAL_SLOT_LABELS[slot.type]}</CardTitle>
        <Badge variant="secondary">{formatNumber(Math.round(totalKcal))} kcal</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {slot.entries.length === 0 && (
          <p className="text-muted-foreground text-sm">Noch keine Einträge.</p>
        )}
        {slot.entries.map((entry) => {
          const kcal = getEntryKcal(entry)
          const unitLabel = entry.type === "food" ? "g" : entry.amount === 1 ? "Portion" : "Portionen"

          return (
            <div key={entry.id}>
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium">
                  {getEntryName(entry)}
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-7 w-16 px-1.5 text-right text-xs"
                    defaultValue={entry.amount.toString()}
                    onBlur={(e) => handleAmountChange(entry.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAmountChange(entry.id, e.currentTarget.value)
                        e.currentTarget.blur()
                      }
                    }}
                  />
                  <span className="text-muted-foreground w-16 text-xs">{unitLabel}</span>
                </div>
                <span className="text-muted-foreground w-16 text-right text-xs">
                  {formatNumber(Math.round(kcal))} kcal
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRemoveEntry(slot.type, entry.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Entfernen</span>
                </Button>
              </div>
              <Separator className="mt-2" />
            </div>
          )
        })}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() => onAddEntry(slot.type)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Hinzufügen
        </Button>
      </CardContent>
    </Card>
  )
}
