"use client"

import { useMemo, useState, type DragEvent } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import {
  AlertTriangle,
  Coffee,
  Cookie,
  Copy,
  Moon,
  Plus,
  Replace,
  Sunrise,
  UtensilsCrossed,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MEAL_PLAN_DRAG_SOURCE_ENTRY,
  MEAL_PLAN_DRAG_SOURCE_SLOT,
  MEAL_PLAN_DRAG_TYPE,
  MEAL_PLAN_DRAG_ID,
  readMealPlanDragPayload,
  type MealPlanDragPayload,
} from "@/components/meal-plan-library"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { calculateEntryNutrients } from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  DailyMealPlan,
  Food,
  MealEntry,
  MealSlotType,
  Recipe,
} from "@/lib/types"

const NUTRIENT_COLUMNS: Array<{ id: string; label: string; decimals: number }> = [
  { id: "energie", label: "kcal", decimals: 0 },
  { id: "eiweiss", label: "Eiweiß", decimals: 0 },
  { id: "kohlenhydrate", label: "KH", decimals: 0 },
  { id: "fett", label: "Fett", decimals: 0 },
  { id: "ballaststoffe", label: "Ballast.", decimals: 0 },
]

const SLOT_ACCENTS: Record<MealSlotType, { icon: typeof Sunrise; border: string }> = {
  fruehstueck: { icon: Sunrise, border: "border-l-emerald-500" },
  snack_vormittag: { icon: Coffee, border: "border-l-violet-500" },
  mittagessen: { icon: UtensilsCrossed, border: "border-l-amber-500" },
  snack_nachmittag: { icon: Cookie, border: "border-l-sky-500" },
  abendessen: { icon: Moon, border: "border-l-indigo-500" },
}

interface PlanDayWorkspaceProps {
  plan: DailyMealPlan
  /** The 7 plans of the week containing the active day, Monday-first. */
  weekPlans: DailyMealPlan[]
  activeDate: string
  onSelectDay: (date: string) => void
  onDuplicateDay: () => void
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  onAddEntry: (slotType: MealSlotType) => void
  onRemoveEntry: (slotType: MealSlotType, entryId: string) => void
  onUpdateAmount: (slotType: MealSlotType, entryId: string, amount: number) => void
  onMoveEntry: (
    sourceSlot: MealSlotType,
    sourceEntryId: string,
    targetSlot: MealSlotType,
  ) => void
  onOpenExchange: (slotType: MealSlotType, entryId?: string) => void
  onDropPayload: (slotType: MealSlotType, payload: MealPlanDragPayload) => void
  allergenWarnings?: Map<string, string[]>
  isLocked?: boolean
}

function getEntryName(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string {
  if (entry.type === "food") return foodMap.get(entry.referenceId)?.name ?? "Lebensmittel"
  return recipeMap.get(entry.referenceId)?.name ?? "Rezept"
}

/** Day tab: dense data workspace — nutrient table per meal plus live Tagesziele. */
export function PlanDayWorkspace({
  plan,
  weekPlans,
  activeDate,
  onSelectDay,
  onDuplicateDay,
  foods,
  foodMap,
  recipeMap,
  onAddEntry,
  onRemoveEntry,
  onUpdateAmount,
  onMoveEntry,
  onOpenExchange,
  onDropPayload,
  allergenWarnings,
  isLocked,
}: PlanDayWorkspaceProps) {
  const [dropSlot, setDropSlot] = useState<MealSlotType | null>(null)

  const entryNutrients = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateEntryNutrients>>()
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        map.set(entry.id, calculateEntryNutrients(entry, foodMap, foods, recipeMap))
      }
    }
    return map
  }, [plan, foodMap, foods, recipeMap])

  const slotTotals = useMemo(() => {
    const map = new Map<MealSlotType, Record<string, number>>()
    for (const slot of plan.slots) {
      const totals = sumNutrients(
        slot.entries.map((entry) => entryNutrients.get(entry.id) ?? []),
      )
      map.set(
        slot.type,
        Object.fromEntries(
          NUTRIENT_COLUMNS.map((column) => [column.id, getNutrientValue(totals, column.id)]),
        ),
      )
    }
    return map
  }, [plan, entryNutrients])

  const weekDayKcal = useMemo(() => {
    const map = new Map<string, number>()
    for (const dayPlan of weekPlans) {
      const totals = sumNutrients(
        dayPlan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      )
      map.set(dayPlan.date, getNutrientValue(totals, "energie"))
    }
    return map
  }, [weekPlans, foodMap, foods, recipeMap])

  const handleSlotDrop = (event: DragEvent, slotType: MealSlotType) => {
    event.preventDefault()
    setDropSlot(null)
    if (isLocked) return

    const sourceSlot = event.dataTransfer.getData(MEAL_PLAN_DRAG_SOURCE_SLOT) as MealSlotType | ""
    const sourceEntryId = event.dataTransfer.getData(MEAL_PLAN_DRAG_SOURCE_ENTRY)
    if (sourceSlot && sourceEntryId) {
      if (sourceSlot !== slotType) onMoveEntry(sourceSlot, sourceEntryId, slotType)
      return
    }

    const payload = readMealPlanDragPayload(event)
    if (payload) onDropPayload(slotType, payload)
  }

  return (
    <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {weekPlans.map((dayPlan) => {
              const isActive = dayPlan.date === activeDate
              const kcal = weekDayKcal.get(dayPlan.date) ?? 0
              return (
                <button
                  key={dayPlan.date}
                  type="button"
                  onClick={() => onSelectDay(dayPlan.date)}
                  className={cn(
                    "flex min-w-[52px] flex-col items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors",
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "bg-card hover:bg-accent",
                  )}
                >
                  {format(parseISO(dayPlan.date), "EEEEEE", { locale: de })}
                  <span
                    className={cn(
                      "mt-0.5 font-mono text-[10px] font-normal",
                      kcal > 0 ? "text-muted-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {kcal > 0 ? formatNumber(Math.round(kcal)) : "–"}
                  </span>
                </button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={isLocked}
            onClick={onDuplicateDay}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Tag duplizieren
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-[11px] tracking-wide uppercase">
                <th className="px-3 py-2 text-left font-semibold">Mahlzeit / Lebensmittel</th>
                <th className="px-3 py-2 text-right font-semibold">Menge</th>
                {NUTRIENT_COLUMNS.map((column) => (
                  <th key={column.id} className="px-3 py-2 text-right font-semibold">
                    {column.label}
                  </th>
                ))}
                <th className="w-16 px-2 py-2" />
              </tr>
            </thead>
            {plan.slots.map((slot) => {
              const accent = SLOT_ACCENTS[slot.type]
              const Icon = accent.icon
              const totals = slotTotals.get(slot.type)
              const isDropTarget = dropSlot === slot.type
              return (
                <tbody
                  key={slot.type}
                  onDragOver={(event) => {
                    if (isLocked) return
                    event.preventDefault()
                    setDropSlot(slot.type)
                  }}
                  onDragLeave={() =>
                    setDropSlot((prev) => (prev === slot.type ? null : prev))
                  }
                  onDrop={(event) => handleSlotDrop(event, slot.type)}
                  className={cn(
                    "border-b last:border-b-0",
                    isDropTarget && "bg-primary/5 outline-primary/50 outline-2 -outline-offset-2 outline-dashed",
                  )}
                >
                  <tr className={cn("bg-muted/40 border-l-2", accent.border)}>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <Icon className="text-muted-foreground h-3.5 w-3.5" />
                        {MEAL_SLOT_LABELS[slot.type]}
                      </span>
                    </td>
                    <td />
                    {NUTRIENT_COLUMNS.map((column) => (
                      <td
                        key={column.id}
                        className="px-3 py-3 text-right font-mono text-xs font-semibold"
                      >
                        {formatNumber(totals?.[column.id] ?? 0, column.decimals)}
                      </td>
                    ))}
                    <td />
                  </tr>
                  {slot.entries.map((entry) => {
                    const nutrients = entryNutrients.get(entry.id) ?? []
                    const warnings = allergenWarnings?.get(entry.id)
                    return (
                      <tr
                        key={entry.id}
                        draggable={!isLocked}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(MEAL_PLAN_DRAG_TYPE, entry.type)
                          event.dataTransfer.setData(MEAL_PLAN_DRAG_ID, entry.referenceId)
                          event.dataTransfer.setData(MEAL_PLAN_DRAG_SOURCE_SLOT, slot.type)
                          event.dataTransfer.setData(MEAL_PLAN_DRAG_SOURCE_ENTRY, entry.id)
                          event.dataTransfer.effectAllowed = "move"
                        }}
                        className="group hover:bg-accent/40 border-t border-dashed"
                      >
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate">
                              {getEntryName(entry, foodMap, recipeMap)}
                            </span>
                            {warnings && warnings.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3.5 w-3.5 flex-none text-amber-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Allergene: {warnings.join(", ")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Input
                              key={`${entry.id}-${entry.amount}`}
                              type="number"
                              min={0}
                              defaultValue={entry.amount}
                              disabled={isLocked}
                              onBlur={(event) => {
                                const next = Number(event.currentTarget.value)
                                if (Number.isFinite(next) && next > 0 && next !== entry.amount) {
                                  onUpdateAmount(slot.type, entry.id, next)
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur()
                              }}
                              className="h-7 w-16 px-1.5 text-right font-mono text-xs"
                            />
                            <span className="text-muted-foreground w-8 text-left text-xs">
                              {entry.type === "food" ? "g" : "Port."}
                            </span>
                          </span>
                        </td>
                        {NUTRIENT_COLUMNS.map((column) => (
                          <td
                            key={column.id}
                            className="text-muted-foreground px-3 py-2.5 text-right font-mono text-xs"
                          >
                            {formatNumber(getNutrientValue(nutrients, column.id), column.decimals)}
                          </td>
                        ))}
                        <td className="px-2 py-2.5">
                          {!isLocked && (
                            <span className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => onOpenExchange(slot.type, entry.id)}
                                className="text-muted-foreground hover:text-foreground rounded p-0.5"
                                aria-label="Eintrag austauschen"
                              >
                                <Replace className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveEntry(slot.type, entry.id)}
                                className="text-muted-foreground hover:text-destructive rounded p-0.5"
                                aria-label="Eintrag entfernen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-dashed">
                    <td colSpan={NUTRIENT_COLUMNS.length + 3} className="px-3 py-2">
                      {isDropTarget ? (
                        <Badge
                          variant="outline"
                          className="border-primary/50 text-primary my-1 text-[10px]"
                        >
                          Hier ablegen
                        </Badge>
                      ) : (
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => onAddEntry(slot.type)}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1 text-xs transition-colors disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Lebensmittel oder Rezept hinzufügen …
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              )
            })}
          </table>
        </div>
    </div>
  )
}
