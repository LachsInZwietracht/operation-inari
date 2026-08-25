"use client"

import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns"
import { de } from "date-fns/locale"
import { Copy, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { WeekCopyCollisionStrategy } from "@/hooks/use-meal-plan"

interface PlanWeekCopyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceWeekStart: string
  sourceWeekLabel: string
  isCopying: boolean
  onCopy: (targetWeekStart: string, repetitions: number, strategy: WeekCopyCollisionStrategy) => void
}

function mondayIso(date: string): string | null {
  if (!date) return null
  const parsed = parseISO(date)
  if (Number.isNaN(parsed.getTime())) return null
  return format(startOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd")
}

function rangeLabel(monday: string | null): string | null {
  if (!monday) return null
  const start = parseISO(monday)
  return `${format(start, "d. MMM", { locale: de })} – ${format(addDays(start, 6), "d. MMM yyyy", { locale: de })}`
}

/**
 * A deliberate range-copy review. Whole weeks are copied through this dialog
 * rather than a tiny drop target, so the counselor can see dates and collision
 * handling before any patient draft changes.
 */
export function PlanWeekCopyDialog({
  open,
  onOpenChange,
  sourceWeekStart,
  sourceWeekLabel,
  isCopying,
  onCopy,
}: PlanWeekCopyDialogProps) {
  const [targetDate, setTargetDate] = useState(() => format(addWeeks(parseISO(sourceWeekStart), 1), "yyyy-MM-dd"))
  const [repetitions, setRepetitions] = useState(1)
  const [strategy, setStrategy] = useState<WeekCopyCollisionStrategy>("fill-empty")

  const targetMonday = mondayIso(targetDate)
  const sourceMonday = mondayIso(sourceWeekStart)
  const targetRange = rangeLabel(targetMonday)
  const finalRange = useMemo(() => {
    if (!targetMonday) return null
    return rangeLabel(format(addWeeks(parseISO(targetMonday), repetitions - 1), "yyyy-MM-dd"))
  }, [repetitions, targetMonday])
  const isTargetInFuture = Boolean(targetMonday && sourceMonday && targetMonday > sourceMonday)

  const handleTargetDateChange = (nextDate: string) => {
    setTargetDate(nextDate)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isCopying && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Woche fortschreiben</DialogTitle>
          <DialogDescription>
            Die Woche {sourceWeekLabel} wird als unabhängiger Entwurf in spätere Wochen kopiert. Freigegebene Planstände bleiben immer unverändert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <div className="space-y-2">
              <Label htmlFor="week-copy-target">Zielwoche</Label>
              <Input
                id="week-copy-target"
                type="date"
                value={targetDate}
                onChange={(event) => handleTargetDateChange(event.target.value)}
                disabled={isCopying}
              />
              <p className="text-xs text-muted-foreground">
                {targetRange ? `Verwendet Montag ${targetRange}.` : "Bitte ein gültiges Datum wählen."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-copy-repetitions">Wochen</Label>
              <Input
                id="week-copy-repetitions"
                type="number"
                min={1}
                max={12}
                value={repetitions}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setRepetitions(Number.isFinite(next) ? Math.min(Math.max(Math.trunc(next), 1), 12) : 1)
                }}
                disabled={isCopying}
              />
              <p className="text-xs text-muted-foreground">Maximal 12 Wochen</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Bestehende Entwürfe</Label>
            <RadioGroup value={strategy} onValueChange={(value) => setStrategy(value as WeekCopyCollisionStrategy)}>
              <Label htmlFor="week-copy-fill" className="items-start rounded-md border p-3 hover:bg-muted/40">
                <RadioGroupItem id="week-copy-fill" value="fill-empty" className="mt-0.5" disabled={isCopying} />
                <span>
                  <span className="block font-medium">Nur leere Tage füllen</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Belegte Entwürfe bleiben erhalten. Empfohlen für die laufende Planung.</span>
                </span>
              </Label>
              <Label htmlFor="week-copy-replace" className="items-start rounded-md border p-3 hover:bg-muted/40">
                <RadioGroupItem id="week-copy-replace" value="replace-drafts" className="mt-0.5" disabled={isCopying} />
                <span>
                  <span className="block font-medium">Bestehende Entwürfe ersetzen</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Nur bearbeitbare Entwürfe werden ersetzt; freigegebene oder gesperrte Tage werden übersprungen.</span>
                </span>
              </Label>
            </RadioGroup>
          </div>

          <section className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{repetitions} {repetitions === 1 ? "Woche" : "Wochen"}</Badge>
              <span className="font-medium">Bis zu {repetitions * 7} Tagesentwürfe</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {targetRange && finalRange
                ? `Von ${targetRange}${repetitions > 1 ? ` bis ${finalRange}` : ""}. Jeder kopierte Tag erhält eigene IDs und bleibt unabhängig bearbeitbar.`
                : "Wählen Sie eine Zielwoche, um die Kopie zu prüfen."}
            </p>
            {!isTargetInFuture && targetMonday ? <p className="mt-2 text-destructive">Die Zielwoche muss nach der sichtbaren Quellwoche liegen.</p> : null}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCopying}>Abbrechen</Button>
          <Button disabled={!targetMonday || !isTargetInFuture || isCopying} onClick={() => targetMonday && onCopy(targetMonday, repetitions, strategy)}>
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Woche fortschreiben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
