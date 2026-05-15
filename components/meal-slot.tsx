"use client"

import { useCallback, useMemo, useState, type DragEvent } from "react"
import { X, Plus, AlertTriangle, Replace, GripVertical } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import {
  scaleNutrients,
  getNutrientValue,
  calculateRecipeNutrients,
  calculatePerServing,
  getBroteinheiten,
} from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import type { MealSlot, MealSlotType, MealEntry, Food, Recipe } from "@/lib/types"
import { cn } from "@/lib/utils"
import { createRecipeLookup } from "@/lib/recipes"

export const MEAL_PLAN_DRAG_TYPE = "application/prodi-entry-type"
export const MEAL_PLAN_DRAG_ID = "application/prodi-entry-id"
export const MEAL_PLAN_DRAG_SOURCE_SLOT = "application/prodi-source-slot"
export const MEAL_PLAN_DRAG_SOURCE_ENTRY = "application/prodi-source-entry"

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
  onMoveEntry?: (
    sourceSlot: MealSlotType,
    sourceEntryId: string,
    targetSlot: MealSlotType,
    targetIndex?: number,
  ) => void
  complianceIndicators?: ComplianceIndicator[]
  onOpenExchange?: (slotType: MealSlotType, entryId?: string) => void
  foods: Food[]
  recipes: Recipe[]
  allergenWarnings?: Map<string, string[]>
  isLocked?: boolean
}

function getEntryName(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string {
  if (entry.type === "food") {
    return foodMap.get(entry.referenceId)?.name ?? "Unbekannt"
  }
  return recipeMap.get(entry.referenceId)?.name ?? "Unbekannt"
}

function getEntryNutrients(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
) {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId)
    if (!food) return []
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
  }

  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return []
  const totalNutrients = calculateRecipeNutrients(recipe, foods)
  const perServing = calculatePerServing(totalNutrients, recipe.servings)
  return scaleNutrients(perServing, 1, entry.amount)
}

function getEntryKcal(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): number {
  return getNutrientValue(getEntryNutrients(entry, foodMap, recipeMap, foods), "energie")
}

function getEntryCarbs(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): number {
  return getNutrientValue(getEntryNutrients(entry, foodMap, recipeMap, foods), "kohlenhydrate")
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
  onMoveEntry,
  complianceIndicators,
  onOpenExchange,
  foods,
  recipes,
  allergenWarnings,
  isLocked = false,
}: MealSlotProps) {
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes])
  const totalKcal = slot.entries.reduce(
    (sum, entry) => sum + getEntryKcal(entry, foodMap, recipeMap, foods),
    0,
  )
  const totalSlotCarbs = slot.entries.reduce(
    (sum, entry) => sum + getEntryCarbs(entry, foodMap, recipeMap, foods),
    0,
  )
  const totalSlotBE = getBroteinheiten(totalSlotCarbs)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null)
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null)

  const handleAmountChange = useCallback(
    (entryId: string, rawValue: string) => {
      const parsed = parseFloat(rawValue.replace(",", "."))
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateAmount(slot.type, entryId, parsed)
      }
    },
    [onUpdateAmount, slot.type]
  )

  const moveEnabled = Boolean(onMoveEntry) && !isLocked
  const dropEnabled = (Boolean(onDropPayload) || moveEnabled) && !isLocked

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!dropEnabled) return
      event.preventDefault()
      setIsDragOver(false)
      setActiveDropIndex(null)
      const sourceSlot = event.dataTransfer.getData(MEAL_PLAN_DRAG_SOURCE_SLOT) as MealSlotType | ""
      const sourceEntryId = event.dataTransfer.getData(MEAL_PLAN_DRAG_SOURCE_ENTRY)
      if (sourceSlot && sourceEntryId && onMoveEntry) {
        onMoveEntry(sourceSlot, sourceEntryId, slot.type)
        return
      }
      if (!onDropPayload) return
      const entryType = event.dataTransfer.getData(MEAL_PLAN_DRAG_TYPE) as MealEntry["type"]
      const referenceId = event.dataTransfer.getData(MEAL_PLAN_DRAG_ID)
      if (!entryType || !referenceId) return
      onDropPayload(slot.type, { type: entryType, referenceId })
    },
    [dropEnabled, onDropPayload, onMoveEntry, slot.type],
  )

  const handleEntryDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, entry: MealEntry) => {
      if (isLocked || !onMoveEntry) return
      event.dataTransfer.setData(MEAL_PLAN_DRAG_TYPE, entry.type)
      event.dataTransfer.setData(MEAL_PLAN_DRAG_ID, entry.referenceId)
      event.dataTransfer.setData(MEAL_PLAN_DRAG_SOURCE_SLOT, slot.type)
      event.dataTransfer.setData(MEAL_PLAN_DRAG_SOURCE_ENTRY, entry.id)
      event.dataTransfer.effectAllowed = "move"
      setDraggingEntryId(entry.id)
    },
    [isLocked, onMoveEntry, slot.type],
  )

  const handleEntryDragEnd = useCallback(() => {
    setDraggingEntryId(null)
    setActiveDropIndex(null)
  }, [])

  const handleGapDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, insertIndex: number) => {
      if (!moveEnabled) return
      const sourceSlot = event.dataTransfer.getData(MEAL_PLAN_DRAG_SOURCE_SLOT) as MealSlotType | ""
      const sourceEntryId = event.dataTransfer.getData(MEAL_PLAN_DRAG_SOURCE_ENTRY)
      if (!sourceSlot || !sourceEntryId) return
      event.preventDefault()
      event.stopPropagation()
      setActiveDropIndex(null)
      setIsDragOver(false)
      onMoveEntry?.(sourceSlot, sourceEntryId, slot.type, insertIndex)
    },
    [moveEnabled, onMoveEntry, slot.type],
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
              disabled={isLocked}
            >
              Austauschliste
            </Button>
          )}
          <Badge variant="secondary">{formatNumber(Math.round(totalKcal))} kcal</Badge>
          {totalSlotBE > 0 && (
            <Badge
              variant="outline"
              className="border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
              title="Broteinheiten (1 BE = 12 g Kohlenhydrate)"
            >
              {formatNumber(totalSlotBE, 1)} BE
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {slot.entries.length === 0 && !isLocked && (
          <p className="text-muted-foreground text-sm">
            Noch keine Einträge. {moveEnabled ? "Ziehe einen Eintrag aus einem anderen Slot hierher oder " : ""}
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
        {slot.entries.length === 0 && isLocked && (
          <p className="text-muted-foreground text-sm">Keine Einträge.</p>
        )}
        {slot.entries.map((entry, index) => {
          const kcal = getEntryKcal(entry, foodMap, recipeMap, foods)
          const unitLabel = entry.type === "food" ? "g" : entry.amount === 1 ? "Portion" : "Portionen"
          const entryWarnings = allergenWarnings?.get(entry.id)
          const isBeingDragged = draggingEntryId === entry.id
          const showTopIndicator = activeDropIndex === index

          return (
            <div key={entry.id}>
              {moveEnabled && (
                <div
                  className={cn(
                    "h-1 transition-colors",
                    showTopIndicator ? "bg-primary rounded-full" : "bg-transparent",
                  )}
                  onDragOver={(event) => {
                    if (!moveEnabled) return
                    const hasSource = event.dataTransfer.types.includes(MEAL_PLAN_DRAG_SOURCE_ENTRY)
                    if (!hasSource) return
                    event.preventDefault()
                    event.stopPropagation()
                    setActiveDropIndex(index)
                  }}
                  onDragLeave={() => {
                    setActiveDropIndex((current) => (current === index ? null : current))
                  }}
                  onDrop={(event) => handleGapDrop(event, index)}
                />
              )}
              <div
                draggable={moveEnabled}
                onDragStart={(event) => handleEntryDragStart(event, entry)}
                onDragEnd={handleEntryDragEnd}
                className={cn(
                  "flex items-center gap-2",
                  moveEnabled && "cursor-grab active:cursor-grabbing",
                  isBeingDragged && "opacity-40",
                )}
              >
                {moveEnabled && (
                  <GripVertical
                    className="text-muted-foreground/60 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {entryWarnings && entryWarnings.length > 0 && (
                  <span title={entryWarnings.join(", ")}>
                    <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
                  </span>
                )}
                <span className="flex-1 truncate text-sm font-medium">
                  {getEntryName(entry, foodMap, recipeMap)}
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
                    readOnly={isLocked}
                    aria-readonly={isLocked}
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
                  onClick={() => onOpenExchange?.(slot.type, entry.id)}
                  disabled={!onOpenExchange || isLocked}
                >
                  <Replace className="h-3.5 w-3.5" />
                  <span className="sr-only">Austauschen</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRemoveEntry(slot.type, entry.id)}
                  disabled={isLocked}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Entfernen</span>
                </Button>
              </div>
              <Separator className="mt-2" />
              {moveEnabled && index === slot.entries.length - 1 && (
                <div
                  className={cn(
                    "mt-1 h-1 transition-colors",
                    activeDropIndex === slot.entries.length
                      ? "bg-primary rounded-full"
                      : "bg-transparent",
                  )}
                  onDragOver={(event) => {
                    const hasSource = event.dataTransfer.types.includes(MEAL_PLAN_DRAG_SOURCE_ENTRY)
                    if (!hasSource) return
                    event.preventDefault()
                    event.stopPropagation()
                    setActiveDropIndex(slot.entries.length)
                  }}
                  onDragLeave={() => {
                    setActiveDropIndex((current) =>
                      current === slot.entries.length ? null : current,
                    )
                  }}
                  onDrop={(event) => handleGapDrop(event, slot.entries.length)}
                />
              )}
            </div>
          )
        })}
        {!isLocked && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onAddEntry(slot.type)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Hinzufügen
          </Button>
        )}
        {moveEnabled && slot.entries.length > 1 && (
          <p className="text-muted-foreground text-[11px]">
            Tipp: Einträge per Griff verschieben, zwischen Slots ziehen oder neu sortieren.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
