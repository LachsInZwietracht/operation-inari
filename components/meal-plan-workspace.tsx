"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Cookie, Copy, Moon, Plus, Sunrise, Utensils, Wand2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  DailyMealPlan,
  MealEntry,
  MealSlotType,
  NutrientValue,
} from "@/lib/types"

const SHEET_NUTRIENTS = [
  { id: "energie", label: "KCAL", decimals: 0 },
  { id: "eiweiss", label: "EIWEISS", decimals: 0 },
  { id: "kohlenhydrate", label: "KH", decimals: 0 },
  { id: "fett", label: "FETT", decimals: 0 },
  { id: "ballaststoffe", label: "BALLAST.", decimals: 0 },
] as const

const SLOT_STYLES: Record<
  MealSlotType,
  { icon: typeof Sunrise; accent: string; border: string }
> = {
  fruehstueck: { icon: Sunrise, accent: "text-emerald-500", border: "border-l-emerald-500" },
  snack_vormittag: { icon: Cookie, accent: "text-violet-500", border: "border-l-violet-500" },
  mittagessen: { icon: Utensils, accent: "text-amber-500", border: "border-l-amber-500" },
  snack_nachmittag: { icon: Cookie, accent: "text-teal-500", border: "border-l-teal-500" },
  abendessen: { icon: Moon, accent: "text-blue-500", border: "border-l-blue-500" },
}

const GRID_COLS =
  "grid grid-cols-[minmax(0,2.4fr)_minmax(60px,0.9fr)_minmax(52px,0.7fr)_minmax(56px,0.8fr)_minmax(46px,0.7fr)_minmax(46px,0.7fr)_minmax(56px,0.8fr)] items-center gap-1"

export interface WorkspaceBalanceRow {
  nutrientId: string
  label: string
  value: number
  target?: number
  unit: string
  status: "ok" | "low" | "high"
}

export interface WorkspaceSuggestion {
  id: string
  title: string
  description: string
  deltaLabel: string
}

interface MealPlanWorkspaceProps {
  days: DailyMealPlan[]
  activeDate: string
  plan: DailyMealPlan
  isLocked: boolean
  referenceLabel?: string
  balance: WorkspaceBalanceRow[]
  suggestions: WorkspaceSuggestion[]
  getEntryName: (entry: MealEntry) => string
  getEntryNutrients: (entry: MealEntry) => NutrientValue[]
  onSelectDay: (date: string) => void
  onDuplicateDay: () => void
  onAddToSlot: (slotType: MealSlotType) => void
  onRemoveEntry: (slotType: MealSlotType, entryId: string) => void
  onUpdateAmount: (slotType: MealSlotType, entryId: string, amount: number) => void
  onApplySuggestion: (id: string) => void
}

export function MealPlanWorkspace({
  days,
  activeDate,
  plan,
  isLocked,
  referenceLabel,
  balance,
  suggestions,
  getEntryName,
  getEntryNutrients,
  onSelectDay,
  onDuplicateDay,
  onAddToSlot,
  onRemoveEntry,
  onUpdateAmount,
  onApplySuggestion,
}: MealPlanWorkspaceProps) {
  const slotRows = useMemo(() => {
    return plan.slots.map((slot) => {
      const entryRows = slot.entries.map((entry) => ({
        entry,
        name: getEntryName(entry),
        nutrients: getEntryNutrients(entry),
      }))
      return {
        slot,
        entryRows,
        totals: sumNutrients(entryRows.map((row) => row.nutrients)),
      }
    })
  }, [getEntryName, getEntryNutrients, plan])

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {days.map((day) => {
            const isActive = day.date === activeDate
            return (
              <Button
                key={day.date}
                size="sm"
                variant={isActive ? "default" : "outline"}
                className="capitalize"
                onClick={() => onSelectDay(day.date)}
              >
                {format(parseISO(day.date), "EEE", { locale: de })}
              </Button>
            )
          })}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={onDuplicateDay} disabled={isLocked}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Tag duplizieren
          </Button>
        </div>

        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className={cn(GRID_COLS, "bg-muted/50 border-b px-4 py-2.5")}>
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider">
                MAHLZEIT / LEBENSMITTEL
              </span>
              <span className="text-muted-foreground text-right text-[10px] font-bold tracking-wider">
                MENGE
              </span>
              {SHEET_NUTRIENTS.map((nutrient) => (
                <span
                  key={nutrient.id}
                  className="text-muted-foreground text-right text-[10px] font-bold tracking-wider"
                >
                  {nutrient.label}
                </span>
              ))}
            </div>

            {slotRows.map(({ slot, entryRows, totals }) => {
              const style = SLOT_STYLES[slot.type]
              const SlotIcon = style.icon
              return (
                <div key={slot.type}>
                  <div
                    className={cn(
                      GRID_COLS,
                      "bg-muted/30 border-t border-l-[3px] px-4 py-2.5",
                      style.border,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <SlotIcon className={cn("h-4 w-4 flex-none", style.accent)} />
                      <span className="truncate text-sm font-bold">
                        {MEAL_SLOT_LABELS[slot.type]}
                      </span>
                      <span className="text-muted-foreground flex-none text-[11px]">
                        {entryRows.length === 0
                          ? "leer"
                          : entryRows.length === 1
                            ? "1 Eintrag"
                            : `${entryRows.length} Einträge`}
                      </span>
                    </div>
                    <span />
                    {SHEET_NUTRIENTS.map((nutrient) => (
                      <span
                        key={nutrient.id}
                        className="text-right font-mono text-xs font-semibold"
                      >
                        {formatNumber(getNutrientValue(totals, nutrient.id), nutrient.decimals)}
                      </span>
                    ))}
                  </div>

                  {entryRows.map(({ entry, name, nutrients }) => (
                    <div
                      key={entry.id}
                      className={cn(GRID_COLS, "group hover:bg-accent/50 border-t px-4 py-1.5 pl-9")}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-medium">{name}</span>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => onRemoveEntry(slot.type, entry.id)}
                            className="text-muted-foreground hover:text-destructive hidden flex-none group-hover:block"
                            aria-label={`${name} entfernen`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={entry.amount}
                          disabled={isLocked}
                          onChange={(event) => {
                            const amount = Number(event.target.value)
                            if (Number.isFinite(amount) && amount >= 0) {
                              onUpdateAmount(slot.type, entry.id, amount)
                            }
                          }}
                          className="h-6 w-16 px-1.5 text-right font-mono text-xs"
                          aria-label={`Menge für ${name}`}
                        />
                        <span className="text-muted-foreground w-7 flex-none text-[10px]">
                          {entry.type === "food" ? "g" : "Port."}
                        </span>
                      </div>
                      {SHEET_NUTRIENTS.map((nutrient) => (
                        <span
                          key={nutrient.id}
                          className="text-muted-foreground text-right font-mono text-xs"
                        >
                          {formatNumber(getNutrientValue(nutrients, nutrient.id), nutrient.decimals)}
                        </span>
                      ))}
                    </div>
                  ))}

                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => onAddToSlot(slot.type)}
                      className="text-muted-foreground hover:bg-accent/50 hover:text-foreground flex w-full items-center gap-2 border-t px-4 py-2 pl-9 text-xs font-medium transition-colors"
                    >
                      <Plus className="text-primary h-3.5 w-3.5" />
                      Lebensmittel oder Rezept hinzufügen …
                    </button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-20">
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Tagesbilanz</span>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                LIVE
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Ist / Soll · {referenceLabel ?? "Zielprofil auswählen"}
            </p>
            <div className="text-muted-foreground grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr] gap-1.5 border-b pt-2 pb-1.5 text-[10px] font-bold tracking-wider">
              <span>NÄHRSTOFF</span>
              <span className="text-right">IST</span>
              <span className="text-right">SOLL</span>
              <span className="text-right">Δ</span>
            </div>
            {balance.length === 0 && (
              <p className="text-muted-foreground py-3 text-xs">
                Wähle ein Zielprofil, um Ist- und Sollwerte zu vergleichen.
              </p>
            )}
            {balance.map((row) => {
              const delta = row.target != null ? row.value - row.target : undefined
              const pct =
                row.target && row.target > 0
                  ? Math.min(100, Math.round((row.value / row.target) * 100))
                  : 0
              return (
                <div key={row.nutrientId} className="border-b py-2 last:border-b-0">
                  <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr] items-center gap-1.5">
                    <span className="truncate text-xs font-semibold">{row.label}</span>
                    <span className="text-right font-mono text-xs">
                      {formatNumber(row.value, 0)}
                    </span>
                    <span className="text-muted-foreground text-right font-mono text-xs">
                      {row.target != null ? formatNumber(row.target, 0) : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-xs font-semibold",
                        row.status === "ok" && "text-primary",
                        row.status === "low" && "text-amber-500",
                        row.status === "high" && "text-destructive",
                      )}
                    >
                      {delta != null
                        ? `${delta >= 0 ? "+" : "−"}${formatNumber(Math.abs(delta), 0)} ${row.unit}`
                        : "—"}
                    </span>
                  </div>
                  <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        row.status === "ok" && "bg-primary",
                        row.status === "low" && "bg-amber-500",
                        row.status === "high" && "bg-destructive",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-bold">Vorschläge zum Auffüllen</span>
            </div>
            <p className="text-muted-foreground text-[11px]">Schließt offene Ziele im Tagesplan</p>
            {suggestions.length === 0 && (
              <p className="text-muted-foreground py-2 text-xs">
                Aktuell keine offenen Ziele — alles im Rahmen.
              </p>
            )}
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="bg-muted/30 space-y-1.5 rounded-lg border border-l-2 border-l-violet-500 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{suggestion.title}</span>
                  <Badge variant="secondary" className="flex-none font-mono text-[10px]">
                    {suggestion.deltaLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground min-w-0 truncate text-[11px]">
                    {suggestion.description}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 flex-none px-2 text-[11px]"
                    disabled={isLocked}
                    onClick={() => onApplySuggestion(suggestion.id)}
                  >
                    Übernehmen
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
