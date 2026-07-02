"use client"

import { useMemo, useState, type DragEvent } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Copy, FolderOpen, GripVertical, Lock, MoreHorizontal, Plus, Search, Trash2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MEAL_PLAN_DRAG_TYPE,
  MEAL_PLAN_DRAG_ID,
} from "@/components/meal-slot"
import {
  calculateRecipeNutrients,
  calculatePerServing,
  getNutrientValue,
} from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  DailyMealPlan,
  Food,
  FoodSearchItem,
  MealEntry,
  MealSlotType,
  Recipe,
} from "@/lib/types"

type DragPayload = { type: MealEntry["type"]; referenceId: string }

const SLOT_ROW_LABELS: Record<MealSlotType, string> = {
  fruehstueck: "Frühstück",
  snack_vormittag: "Snack Vorm.",
  mittagessen: "Mittag",
  snack_nachmittag: "Snack Nachm.",
  abendessen: "Abend",
}

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

function setDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(MEAL_PLAN_DRAG_TYPE, payload.type)
  event.dataTransfer.setData(MEAL_PLAN_DRAG_ID, payload.referenceId)
  event.dataTransfer.effectAllowed = "copy"
}

function readDragPayload(event: DragEvent): DragPayload | null {
  const type = event.dataTransfer.getData(MEAL_PLAN_DRAG_TYPE) as MealEntry["type"] | ""
  const referenceId = event.dataTransfer.getData(MEAL_PLAN_DRAG_ID)
  if (!type || !referenceId) return null
  return { type, referenceId }
}

interface MealPlanLibraryProps {
  foods: FoodSearchItem[]
  fullFoods: Food[]
  recipes: Recipe[]
  categoryLabels: Map<string, string>
}

export function MealPlanLibrary({ foods, fullFoods, recipes, categoryLabels }: MealPlanLibraryProps) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"foods" | "recipes">("recipes")

  const normalizedQuery = query.trim().toLowerCase()

  const filteredFoods = useMemo(() => {
    return foods
      .filter((food) => !normalizedQuery || food.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 30)
  }, [foods, normalizedQuery])

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter(
        (recipe) =>
          !normalizedQuery ||
          recipe.name.toLowerCase().includes(normalizedQuery) ||
          recipe.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 30)
  }, [normalizedQuery, recipes])

  const recipeKcal = useMemo(() => {
    const map = new Map<string, number>()
    for (const recipe of filteredRecipes) {
      const kcal =
        recipe.cachedKcalPerPortion ??
        getNutrientValue(
          calculatePerServing(calculateRecipeNutrients(recipe, fullFoods), recipe.servings),
          "energie",
        )
      map.set(recipe.id, kcal)
    }
    return map
  }, [filteredRecipes, fullFoods])

  return (
    <Card className="self-start">
      <CardContent className="space-y-3 p-4">
        <div className="text-sm font-semibold">Bibliothek</div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lebensmittel oder Rezept …"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex gap-4 border-b text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("recipes")}
            className={cn(
              "border-b-2 pb-2 transition-colors",
              tab === "recipes"
                ? "border-primary text-foreground"
                : "text-muted-foreground border-transparent",
            )}
          >
            Rezepte
          </button>
          <button
            type="button"
            onClick={() => setTab("foods")}
            className={cn(
              "border-b-2 pb-2 transition-colors",
              tab === "foods"
                ? "border-primary text-foreground"
                : "text-muted-foreground border-transparent",
            )}
          >
            Lebensmittel
          </button>
        </div>
        <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto">
          {tab === "recipes" &&
            filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                draggable
                onDragStart={(event) => setDragPayload(event, { type: "recipe", referenceId: recipe.id })}
                className="hover:bg-accent flex cursor-grab items-center gap-2 rounded-md border p-2 active:cursor-grabbing"
              >
                <GripVertical className="text-muted-foreground h-4 w-4 flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{recipe.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {recipe.category ?? "Rezept"} · 1 Portion
                  </div>
                </div>
                <span className="text-muted-foreground flex-none font-mono text-[11px]">
                  {formatNumber(Math.round(recipeKcal.get(recipe.id) ?? 0))} kcal
                </span>
              </div>
            ))}
          {tab === "recipes" && filteredRecipes.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-xs">Keine Rezepte gefunden.</p>
          )}
          {tab === "foods" &&
            filteredFoods.map((food) => (
              <div
                key={food.id}
                draggable
                onDragStart={(event) => setDragPayload(event, { type: "food", referenceId: food.id })}
                className="hover:bg-accent flex cursor-grab items-center gap-2 rounded-md border p-2 active:cursor-grabbing"
              >
                <GripVertical className="text-muted-foreground h-4 w-4 flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{food.name}</div>
                  <div className="text-muted-foreground truncate text-[11px]">
                    {categoryLabels.get(food.categoryId) ?? "Lebensmittel"} · 120 g
                  </div>
                </div>
              </div>
            ))}
          {tab === "foods" && filteredFoods.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Keine Lebensmittel gefunden.
            </p>
          )}
        </div>
        <p className="text-muted-foreground text-[11px]">
          Einträge per Drag &amp; Drop auf einen Tag ziehen.
        </p>
      </CardContent>
    </Card>
  )
}

export interface WeekBoardTarget {
  nutrientId: string
  label: string
  value: number
  target?: number
  unit: string
  status: "ok" | "low" | "high"
}

interface MealPlanWeekBoardProps {
  days: { plan: DailyMealPlan; kcal: number }[]
  activeDate: string
  activeDayLabel: string
  energyValue: number
  energyTarget?: number
  barTargets: WeekBoardTarget[]
  getEntryLabel: (entry: MealEntry) => string
  onSelectDay: (date: string) => void
  onOpenDay: (date: string) => void
  onCopyCurrentToDay: (date: string) => void
  onCopyToNextDay: (date: string) => void
  onClearDay: (date: string) => void
  onDrop: (date: string, slotType: MealSlotType, payload: DragPayload) => void
  onRemoveEntry: (date: string, slotType: MealSlotType, entryId: string) => void
}

function KcalRing({ value, target }: { value: number; target?: number }) {
  const size = 92
  const stroke = 10
  const radius = size / 2 - stroke - 2
  const circumference = 2 * Math.PI * radius
  const pct = target && target > 0 ? Math.min(1, value / target) : 0

  return (
    <div className="relative h-[92px] w-[92px] flex-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct * circumference).toFixed(1)} ${circumference.toFixed(1)}`}
          className="stroke-primary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg leading-none font-semibold">
          {formatNumber(Math.round(value))}
        </span>
        <span className="text-muted-foreground mt-0.5 text-[10px]">
          {target ? `von ${formatNumber(Math.round(target))} kcal` : "kcal"}
        </span>
      </div>
    </div>
  )
}

export function MealPlanWeekBoard({
  days,
  activeDate,
  activeDayLabel,
  energyValue,
  energyTarget,
  barTargets,
  getEntryLabel,
  onSelectDay,
  onOpenDay,
  onCopyCurrentToDay,
  onCopyToNextDay,
  onClearDay,
  onDrop,
  onRemoveEntry,
}: MealPlanWeekBoardProps) {
  const [dropTarget, setDropTarget] = useState<{ date: string; slot: MealSlotType } | null>(null)

  const handleCellDrop = (event: DragEvent, plan: DailyMealPlan, slotType: MealSlotType) => {
    event.preventDefault()
    setDropTarget(null)
    if (plan.status === "approved") return
    const payload = readDragPayload(event)
    if (!payload) return
    onDrop(plan.date, slotType, payload)
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <KcalRing value={energyValue} target={energyTarget} />
          <div className="min-w-[220px] flex-1 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold capitalize">{activeDayLabel}</span>
              <span className="text-muted-foreground text-xs">· Tagesziel</span>
            </div>
            {barTargets.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Zielprofil auswählen, um Live-Zieltracking zu aktivieren.
              </p>
            ) : (
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                {barTargets.map((target) => {
                  const pct =
                    target.target && target.target > 0
                      ? Math.min(100, Math.round((target.value / target.target) * 100))
                      : 0
                  return (
                    <div key={target.nutrientId} className="min-w-0">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground truncate font-medium">
                          {target.label}
                        </span>
                        <span className="font-mono">
                          {formatNumber(target.value, 0)}
                          {target.target != null && `/${formatNumber(target.target, 0)}`} {target.unit}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            target.status === "ok" && "bg-primary",
                            target.status === "low" && "bg-amber-500",
                            target.status === "high" && "bg-destructive",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <div className="min-w-[980px] space-y-2">
          <div className="grid grid-cols-[86px_repeat(7,1fr)] gap-2">
            <div />
            {days.map(({ plan, kcal }) => {
              const isActive = plan.date === activeDate
              const pct = energyTarget
                ? Math.min(100, Math.round((kcal / energyTarget) * 100))
                : 0
              return (
                <div
                  key={plan.date}
                  className={cn(
                    "group/day relative rounded-lg border transition-colors",
                    isActive ? "border-primary/50 bg-primary/10" : "bg-card hover:bg-accent",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectDay(plan.date)}
                    className="flex w-full flex-col items-center gap-1.5 p-2 text-center"
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold capitalize",
                        isActive ? "text-primary" : "text-foreground",
                      )}
                    >
                      {format(parseISO(plan.date), "EEE dd.", { locale: de })}
                      {plan.status === "approved" && <Lock className="h-3 w-3" />}
                    </span>
                    <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {kcal > 0 ? formatNumber(Math.round(kcal)) : "—"}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground absolute top-1 right-1 hidden group-hover/day:block data-[state=open]:block"
                        aria-label="Tagesaktionen"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onOpenDay(plan.date)}>
                        <FolderOpen className="mr-2 h-3.5 w-3.5" />
                        Tag öffnen
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onCopyCurrentToDay(plan.date)}>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Aktiven Tag hierher kopieren
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onCopyToNextDay(plan.date)}>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Auf Folgetag kopieren
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onClearDay(plan.date)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Tag leeren
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>

          {SLOT_ORDER.map((slotType) => (
            <div key={slotType} className="grid grid-cols-[86px_repeat(7,1fr)] gap-2">
              <div className="flex items-center justify-end pr-1">
                <span className="text-muted-foreground text-right text-[10px] leading-tight font-semibold tracking-wide uppercase">
                  {SLOT_ROW_LABELS[slotType]}
                </span>
              </div>
              {days.map(({ plan }) => {
                const slot = plan.slots.find((item) => item.type === slotType)
                const entries = slot?.entries ?? []
                const isLocked = plan.status === "approved"
                const isDropTarget =
                  dropTarget?.date === plan.date && dropTarget.slot === slotType
                return (
                  <div
                    key={plan.date}
                    onDragOver={(event) => {
                      if (isLocked) return
                      event.preventDefault()
                      setDropTarget({ date: plan.date, slot: slotType })
                    }}
                    onDragLeave={() =>
                      setDropTarget((prev) =>
                        prev?.date === plan.date && prev.slot === slotType ? null : prev,
                      )
                    }
                    onDrop={(event) => handleCellDrop(event, plan, slotType)}
                    className={cn(
                      "flex min-h-[64px] flex-col gap-1 rounded-lg border p-1.5 transition-colors",
                      isDropTarget
                        ? "border-primary bg-primary/10 border-dashed"
                        : entries.length > 0
                          ? "bg-card"
                          : "bg-muted/30",
                      isLocked && "opacity-60",
                    )}
                  >
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="group bg-accent/60 border-l-primary relative rounded-md border-l-2 px-2 py-1"
                      >
                        <div className="pr-4 text-[11px] leading-tight font-medium">
                          {getEntryLabel(entry).split("(")[0]?.trim()}
                        </div>
                        <div className="text-muted-foreground font-mono text-[10px]">
                          {entry.type === "food"
                            ? `${formatNumber(entry.amount)} g`
                            : `${formatNumber(entry.amount)} Port.`}
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => onRemoveEntry(plan.date, slotType, entry.id)}
                            className="text-muted-foreground hover:text-destructive absolute top-1 right-1 hidden group-hover:block"
                            aria-label="Eintrag entfernen"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {entries.length === 0 && (
                      <div className="flex flex-1 items-center justify-center">
                        {isDropTarget ? (
                          <Badge variant="outline" className="border-primary/50 text-primary text-[10px]">
                            Hier ablegen
                          </Badge>
                        ) : (
                          <Plus className="text-muted-foreground/40 h-4 w-4" />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
