"use client"

import { useState, type DragEvent } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Copy, FolderOpen, Lock, MoreHorizontal, Plus, Trash2, X } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type {
  DailyMealPlan,
  MealEntry,
  MealSlotType,
} from "@/lib/types"

type DragPayload = MealPlanDragPayload

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
  days: { plan: DailyMealPlan; kcal: number }[]
  activeDate: string
  /** Drives the per-day kcal progress bars in the board header. */
  energyTarget?: number
  getEntryLabel: (entry: MealEntry) => string
  onSelectDay: (date: string) => void
  onOpenDay: (date: string) => void
  onCopyCurrentToDay: (date: string) => void
  onCopyToNextDay: (date: string) => void
  onClearDay: (date: string) => void
  onDrop: (date: string, slotType: MealSlotType, payload: DragPayload) => void
  onRemoveEntry: (date: string, slotType: MealSlotType, entryId: string) => void
}

export function MealPlanWeekBoard({
  days,
  activeDate,
  energyTarget,
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
            <div key={slotType} className="grid grid-cols-[72px_repeat(7,1fr)] gap-2">
              <div className="flex items-center justify-end pr-1">
                <span className="text-muted-foreground text-right text-[10px] leading-tight font-semibold uppercase">
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
