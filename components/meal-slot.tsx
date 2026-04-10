"use client"

import { useCallback, useState, type DragEvent } from "react"
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
import { cn } from "@/lib/utils"

export const MEAL_PLAN_DRAG_TYPE = "application/prodi-entry-type"
export const MEAL_PLAN_DRAG_ID = "application/prodi-entry-id"

type DragPayload = { type: MealEntry["type"]; referenceId: string }

type ComplianceIndicator = {
  label: string
  status: "ok" | "low" | "high"
}

interface MealSlotProps {
  slot: MealSlot
  onAddEntry: (slotType: MealSlotType) => void
  onRemoveEntry: (slotType: MealSlotType, entryId: string) => void
  onUpdateAmount: (slotType: MealSlotType, entryId: string, amount: number) => void
  onDropPayload?: (slotType: MealSlotType, payload: DragPayload) => void
  complianceIndicators?: ComplianceIndicator[]
  onOpenExchange?: (slotType: MealSlotType) => void
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

const STATUS_STYLES: Record<ComplianceIndicator["status"], string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200",
  low: "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-500/10 dark:text-amber-200",
  high: "bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-500/10 dark:text-rose-200",
}

export function MealSlotCard({
  slot,
  onAddEntry,
  onRemoveEntry,
  onUpdateAmount,
  onDropPayload,
  complianceIndicators,
  onOpenExchange,
}: MealSlotProps) {
  const totalKcal = slot.entries.reduce((sum, entry) => sum + getEntryKcal(entry), 0)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleAmountChange = useCallback(
    (entryId: string, rawValue: string) => {
      const parsed = parseFloat(rawValue.replace(",", "."))
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateAmount(slot.type, entryId, parsed)
      }
    },
    [onUpdateAmount, slot.type]
  )

  const dropEnabled = Boolean(onDropPayload)

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!dropEnabled) return
      event.preventDefault()
      setIsDragOver(false)
      const entryType = event.dataTransfer.getData(MEAL_PLAN_DRAG_TYPE) as MealEntry["type"]
      const referenceId = event.dataTransfer.getData(MEAL_PLAN_DRAG_ID)
      if (!entryType || !referenceId) return
      onDropPayload?.(slot.type, { type: entryType, referenceId })
    },
    [dropEnabled, onDropPayload, slot.type],
  )

  return (
    <Card
      className={cn(
        isDragOver &&
          "border-primary/60 bg-primary/5 shadow-inner ring-1 ring-primary/30 dark:border-primary/60",
      )}
      onDragOver={(event) => {
        if (!dropEnabled) return
        event.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={(event) => {
        if (!dropEnabled) return
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setIsDragOver(false)
      }}
      onDrop={handleDrop}
    >
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{MEAL_SLOT_LABELS[slot.type]}</CardTitle>
          {complianceIndicators && complianceIndicators.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {complianceIndicators.map((indicator) => (
                <Badge
                  key={indicator.label}
                  variant="outline"
                  className={cn("text-[11px]", STATUS_STYLES[indicator.status])}
                >
                  {indicator.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onOpenExchange && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onOpenExchange(slot.type)}
            >
              Austauschliste
            </Button>
          )}
          <Badge variant="secondary">{formatNumber(Math.round(totalKcal))} kcal</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {slot.entries.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Noch keine Einträge. {dropEnabled ? "Ziehe Rezepte aus der Bibliothek hierher oder" : ""}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
              onClick={() => onAddEntry(slot.type)}
            >
              wähle ein Lebensmittel
            </Button>
            .
          </p>
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
        {dropEnabled && (
          <p className="text-muted-foreground text-xs">
            Tipp: Rezepte aus der Liste rechts können direkt hierher gezogen werden.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
