"use client"

import { useState, type DragEvent } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Check, Copy, FolderOpen, Lock, MoreHorizontal, Plus, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  readMealPlanDragPayload,
  type MealPlanDragPayload,
} from "@/components/meal-plan-library"
import { formatNumber } from "@/lib/format"
import { todayIsoDate } from "@/lib/client-mode"
import { getEnergyTargetStatus } from "@/lib/meal-plan-calc"
import { cn } from "@/lib/utils"
import type {
  DailyMealPlan,
  MealEntry,
  MealSlotType,
} from "@/lib/types"

type DragPayload = MealPlanDragPayload

type DayPlanningState = "open" | "planned" | "released"

function isReleasedPlan(plan: DailyMealPlan) {
  return plan.status === "approved" || plan.status === "active"
}

function getDayPlanningState(plan: DailyMealPlan): DayPlanningState {
  if (isReleasedPlan(plan)) return "released"
  return plan.slots.some((slot) => slot.entries.length > 0) ? "planned" : "open"
}

const DAY_STATE_META: Record<
  DayPlanningState,
  { label: string; className: string }
> = {
  open: {
    label: "Offen",
    className: "border-border bg-background/70 text-muted-foreground",
  },
  planned: {
    label: "Geplant",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  released: {
    label: "Freigegeben",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
}

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

export interface WeekBoardTarget {
  nutrientId: string
  label: string
  value: number
  target?: number
  unit: string
  status: "ok" | "low" | "high"
}

interface MealPlanWeekBoardProps {
  days: { plan: DailyMealPlan; kcal: number; energyEvaluable: boolean }[]
  activeDate: string
  selectedDates: string[]
  /** Drives the per-day kcal progress bars in the board header. */
  energyTarget?: number
  getEntryLabel: (entry: MealEntry) => string
  onSelectDay: (date: string, extendSelection?: boolean) => void
  onOpenDay: (date: string) => void
  onCopyCurrentToDay: (date: string) => void
  onCopyToNextDay: (date: string) => void
  onClearDay: (date: string) => void
  onDrop: (date: string, slotType: MealSlotType, payload: DragPayload) => void
  onAddEntry: (date: string, slotType: MealSlotType) => void
  onRemoveEntry: (date: string, slotType: MealSlotType, entryId: string) => void
}

export function MealPlanWeekBoard({
  days,
  activeDate,
  selectedDates,
  energyTarget,
  getEntryLabel,
  onSelectDay,
  onOpenDay,
  onCopyCurrentToDay,
  onCopyToNextDay,
  onClearDay,
  onDrop,
  onAddEntry,
  onRemoveEntry,
}: MealPlanWeekBoardProps) {
  const [dropTarget, setDropTarget] = useState<{ date: string; slot: MealSlotType } | null>(null)
  const today = todayIsoDate()

  const handleCellDrop = (event: DragEvent, plan: DailyMealPlan, slotType: MealSlotType) => {
    event.preventDefault()
    setDropTarget(null)
    if (isReleasedPlan(plan)) return
    const payload = readMealPlanDragPayload(event)
    if (!payload) return
    onDrop(plan.date, slotType, payload)
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-[788px] space-y-2">
          <div className="grid grid-cols-[72px_repeat(7,1fr)] gap-2">
            <div />
            {days.map(({ plan, kcal, energyEvaluable }) => {
              const isActive = plan.date === activeDate
              const isSelected = selectedDates.includes(plan.date)
              const isPast = plan.date < today
              const isToday = plan.date === today
              const planningState = getDayPlanningState(plan)
              const stateMeta = DAY_STATE_META[planningState]
              const isPlanned = planningState !== "open"
              const energyStatus = isPlanned && energyEvaluable
                ? getEnergyTargetStatus(kcal, energyTarget)
                : "unplanned"
              const pct = energyTarget
                ? Math.min(100, Math.round((kcal / energyTarget) * 100))
                : 0
              return (
                <div
                  key={plan.date}
                  data-day-date={plan.date}
                  data-day-planning-state={planningState}
                  data-day-temporal-state={isPast ? "past" : isToday ? "today" : "upcoming"}
                  className={cn(
                    "group/day relative rounded-lg border transition-colors",
                    isPast && "border-border/70 bg-muted/70",
                    !isPast && "bg-card hover:bg-accent",
                    isActive && "border-primary/50 bg-primary/10 ring-primary/10 ring-1",
                    isSelected && !isActive && "border-primary/40 bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`${format(parseISO(plan.date), "EEEE, d. MMMM yyyy", { locale: de })} mit Doppelklick in Tagesansicht öffnen`}
                    aria-pressed={isSelected}
                    title="Einmal auswählen, mit Shift weitere Tage auswählen; mit Doppelklick in die Tagesansicht"
                    onClick={(event) => {
                      // A double click dispatches two click events first. Only
                      // the first selects; the dedicated double-click handler
                      // then opens the contextual day view.
                      if (event.detail <= 1) onSelectDay(plan.date, event.shiftKey)
                    }}
                    onDoubleClick={() => onOpenDay(plan.date)}
                    className={cn(
                      "flex w-full select-none flex-col items-center gap-1.5 p-2 text-center transition-opacity",
                      isPast && !isActive && "opacity-70 hover:opacity-100",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold capitalize",
                        isSelected || isActive ? "text-primary" : isPast ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {format(parseISO(plan.date), "EEE dd.", { locale: de })}
                      {planningState === "released" && <Lock className="h-3 w-3" />}
                    </span>
                    <div className="flex min-h-4 items-center justify-center gap-1">
                      {isPast ? (
                        <span className="text-muted-foreground text-[9px] font-medium">Vergangen</span>
                      ) : isToday ? (
                        <span className="text-primary text-[9px] font-medium">Heute</span>
                      ) : null}
                      <Badge
                        variant="outline"
                        className={cn("h-4 rounded-full px-1.5 text-[9px] font-medium", stateMeta.className)}
                      >
                        {planningState === "released" ? <Check className="mr-0.5 h-2.5 w-2.5" /> : null}
                        {stateMeta.label}
                      </Badge>
                    </div>
                    <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          energyStatus === "in-range"
                            ? "bg-emerald-500"
                            : energyStatus === "low" || energyStatus === "high"
                              ? "bg-amber-500"
                              : energyStatus === "no-target"
                                ? "bg-primary/70"
                                : "bg-muted-foreground/25",
                        )}
                        style={{ width: `${isPlanned ? pct : 0}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {!isPlanned
                        ? "Nicht geplant"
                        : !energyEvaluable
                          ? "kcal nicht beurteilbar"
                        : energyTarget
                          ? `${formatNumber(Math.round(kcal))} / ${formatNumber(Math.round(energyTarget))} kcal`
                          : `${formatNumber(Math.round(kcal))} kcal`}
                    </span>
                    {isPlanned && energyEvaluable && energyTarget ? (
                      <span className="text-muted-foreground text-[9px]">
                        {pct} % · ±5 % Zielkorridor
                      </span>
                    ) : null}
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
                        Tagesansicht öffnen
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
            <div key={slotType} className="grid grid-cols-[72px_repeat(7,1fr)] gap-2">
              <div className="flex items-center justify-end pr-1">
                <span className="text-muted-foreground text-right text-[10px] leading-tight font-semibold uppercase">
                  {SLOT_ROW_LABELS[slotType]}
                </span>
              </div>
              {days.map(({ plan }) => {
                const slot = plan.slots.find((item) => item.type === slotType)
                const entries = slot?.entries ?? []
                const isLocked = isReleasedPlan(plan)
                const isPast = plan.date < today
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
                    data-day-date={plan.date}
                    data-day-temporal-state={isPast ? "past" : plan.date === today ? "today" : "upcoming"}
                    className={cn(
                      "flex min-h-[104px] flex-col gap-1 rounded-lg border p-1.5 transition-colors",
                      isDropTarget
                        ? "border-primary bg-primary/10 border-dashed"
                        : isPast
                          ? "border-border/60 bg-muted/55"
                        : entries.length > 0
                          ? "bg-card"
                          : "bg-muted/30",
                      isLocked && "opacity-60",
                    )}
                  >
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          "group bg-accent/60 border-l-primary relative rounded-md border-l-2 px-2 py-1",
                          isPast && "border-l-muted-foreground/40 bg-background/70 text-muted-foreground",
                        )}
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
                    {entries.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center">
                        {isDropTarget ? (
                          <Badge variant="outline" className="border-primary/50 text-primary text-[10px]">
                            Hier ablegen
                          </Badge>
                        ) : isLocked ? (
                          <Plus className="text-muted-foreground/40 h-4 w-4" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddEntry(plan.date, slotType)}
                            className="text-muted-foreground/40 hover:text-foreground hover:bg-accent flex h-full w-full items-center justify-center rounded-md transition-colors"
                            aria-label="Lebensmittel oder Rezept hinzufügen"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      !isLocked && (
                        <button
                          type="button"
                          onClick={() => onAddEntry(plan.date, slotType)}
                          className="text-muted-foreground/40 hover:text-foreground hover:bg-accent flex items-center justify-center rounded-md py-0.5 transition-colors"
                          aria-label="Lebensmittel oder Rezept hinzufügen"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )
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
