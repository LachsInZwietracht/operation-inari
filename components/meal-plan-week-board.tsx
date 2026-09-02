"use client"

import { useState, type DragEvent } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { BarChart3, CircleCheck, Copy, FolderOpen, ListPlus, MoreHorizontal, Plus, Trash2, X } from "lucide-react"
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
    className: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  released: {
    label: "Freigegeben",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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
  onAnalyzeDay: (date: string) => void
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
  onAnalyzeDay,
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
                    "group/day relative rounded-xl border transition-[border-color,background-color,opacity,filter] duration-200",
                    isPast &&
                      "border-foreground/[0.08] bg-foreground/[0.07] grayscale hover:bg-foreground/[0.09]",
                    !isPast && planningState === "released" &&
                      "border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.07] to-emerald-500/[0.025] hover:border-emerald-500/25",
                    !isPast && planningState !== "released" && "bg-card hover:bg-accent",
                    isActive && !isPast &&
                      "border-primary/50 bg-primary/[0.07] ring-primary/10 ring-1",
                    isSelected && !isActive && !isPast &&
                      "border-primary/40 bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`${format(parseISO(plan.date), "EEEE, d. MMMM yyyy", { locale: de })} mit Doppelklick in Tagesansicht öffnen`}
                    aria-pressed={isSelected}
                    title="Einmal auswählen; weitere Tage mit Shift oder über die Tagesaktionen hinzufügen; mit Doppelklick in die Tagesansicht"
                    onClick={(event) => {
                      // A double click dispatches two click events first. Only
                      // the first selects; the dedicated double-click handler
                      // then opens the contextual day view.
                      if (event.detail <= 1) onSelectDay(plan.date, event.shiftKey)
                    }}
                    onDoubleClick={() => onOpenDay(plan.date)}
                    className={cn(
                      "flex min-h-[116px] w-full select-none flex-col items-center gap-1.5 p-2 text-center",
                      isPast &&
                        "text-muted-foreground/55 transition-colors hover:text-muted-foreground/80",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold capitalize",
                        !isPast && (isSelected || isActive)
                          ? "text-primary"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-foreground",
                      )}
                    >
                      {format(parseISO(plan.date), "EEE dd.", { locale: de })}
                    </span>
                    <div className="grid h-5 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
                      <span
                        className={cn(
                          "truncate text-left text-[8px] font-medium",
                          isToday && "text-primary",
                        )}
                      >
                        {isPast ? "Vergangen" : isToday ? "Heute" : ""}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 rounded-full px-2 text-[9px] font-medium shadow-none",
                          stateMeta.className,
                        )}
                      >
                        {planningState === "released" ? (
                          <CircleCheck className="mr-1 h-3 w-3" />
                        ) : null}
                        {stateMeta.label}
                      </Badge>
                      <span aria-hidden="true" />
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
                    <span className="text-muted-foreground flex min-h-8 items-center justify-center font-mono text-[10px] leading-tight">
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
                        className="text-muted-foreground hover:text-foreground absolute top-1 right-1 block opacity-70 transition-opacity md:opacity-0 md:group-hover/day:opacity-100 data-[state=open]:opacity-100"
                        aria-label="Tagesaktionen"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onSelectDay(plan.date, true)}>
                        {isSelected ? <X className="mr-2 h-3.5 w-3.5" /> : <ListPlus className="mr-2 h-3.5 w-3.5" />}
                        {isSelected ? "Aus Vorlagenauswahl entfernen" : "Zur Vorlagenauswahl hinzufügen"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onOpenDay(plan.date)}>
                        <FolderOpen className="mr-2 h-3.5 w-3.5" />
                        Tagesansicht öffnen
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onAnalyzeDay(plan.date)}>
                        <BarChart3 className="mr-2 h-3.5 w-3.5" />
                        Tag analysieren
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
                      "flex min-h-[104px] flex-col gap-1 rounded-xl border p-1.5 transition-[border-color,background-color,opacity,filter] duration-200",
                      isDropTarget
                        ? "border-primary bg-primary/10 border-dashed"
                        : isPast
                          ? "border-foreground/[0.08] bg-foreground/[0.065] grayscale hover:bg-foreground/[0.085]"
                        : isLocked
                          ? "border-emerald-500/10 bg-emerald-500/[0.025]"
                        : entries.length > 0
                          ? "bg-card"
                          : "bg-muted/30",
                    )}
                  >
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          "group bg-accent/60 border-l-primary relative rounded-md border-l-2 px-2 py-1",
                          isPast &&
                            "border-l-muted-foreground/25 bg-background/35 text-muted-foreground opacity-45 transition-opacity hover:opacity-70",
                          !isPast && isLocked &&
                            "border-l-emerald-500/35 bg-emerald-500/[0.05]",
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
                      <div
                        className={cn(
                          "flex flex-1 items-center justify-center",
                          isPast && "opacity-45 transition-opacity hover:opacity-70",
                        )}
                      >
                        {isDropTarget ? (
                          <Badge variant="outline" className="border-primary/50 text-primary text-[10px]">
                            Hier ablegen
                          </Badge>
                        ) : isLocked ? (
                          <span
                            className={cn(
                              "h-px w-5 rounded-full",
                              isPast ? "bg-muted-foreground/25" : "bg-emerald-500/20",
                            )}
                            aria-hidden="true"
                          />
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
