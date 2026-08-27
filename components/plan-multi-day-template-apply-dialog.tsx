"use client"

import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { AlertTriangle, CalendarPlus, Lock, Loader2 } from "lucide-react"

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
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { MealPlanTemplate, MealPlanTemplateDayBlock } from "@/lib/types"
import type { MealEntry } from "@/lib/types"

export interface TemplateApplyTarget {
  date: string
  state: "free" | "draft" | "protected"
}

interface PlanMultiDayTemplateApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: MealPlanTemplate
  startDate: string
  onStartDateChange: (date: string) => void
  targets: TemplateApplyTarget[]
  getEntryLabel: (entry: MealEntry) => string
  isApplying: boolean
  onConfirm: () => void | Promise<void>
}

function blocksFor(template: MealPlanTemplate): MealPlanTemplateDayBlock[] {
  return template.dayBlocks?.length
    ? template.dayBlocks
    : [{ offsetDays: 0, slots: template.slots }]
}

/**
 * The template inspector deliberately comes before any mutation. It works for
 * one and multi-day templates alike, so a single draft never gets replaced by
 * an accidental one-click action.
 */
export function PlanMultiDayTemplateApplyDialog({
  open,
  onOpenChange,
  template,
  startDate,
  onStartDateChange,
  targets,
  getEntryLabel,
  isApplying,
  onConfirm,
}: PlanMultiDayTemplateApplyDialogProps) {
  const blocks = blocksFor(template)
  const hasGaps = blocks.length > 1 && blocks.some((block, index) =>
    index > 0 && block.offsetDays !== blocks[index - 1].offsetDays + 1,
  )
  const spanDays = Math.max(...blocks.map((block) => block.offsetDays)) + 1
  const occupiedTargets = targets.filter((target) => target.state === "draft")
  const protectedTargets = targets.filter((target) => target.state === "protected")
  const canApply = protectedTargets.length === 0 && !isApplying

  return (
    <Dialog open={open} onOpenChange={(next) => !isApplying && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vorlage prüfen und platzieren</DialogTitle>
          <DialogDescription>
            Prüfen Sie Ablauf und Zieltermine, bevor „{template.name}“ in den Wochenplan übernommen wird.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{template.name}</p>
              <Badge variant="outline">{template.patientId ? "Dieser Patient" : "Meine Vorlage"}</Badge>
              <Badge variant="outline">{blocks.length === 1 ? "1 Tag" : `${blocks.length} Planungstage`}</Badge>
              {blocks.length > 1 ? <Badge variant="outline">Zeitraum {spanDays} Tage</Badge> : null}
            </div>
            {template.description ? <p className="mt-2 text-sm text-muted-foreground">{template.description}</p> : null}
            <div className="mt-3 space-y-2 text-xs">
              {blocks.map((block) => {
                const entryCount = block.slots.reduce((sum, slot) => sum + slot.entries.length, 0)
                const meals = block.slots
                  .filter((slot) => slot.entries.length > 0)
                  .map((slot) => MEAL_SLOT_LABELS[slot.type])
                return (
                  <details key={block.offsetDays} className="rounded-lg border bg-background px-3 py-2" open={blocks.length === 1}>
                    <summary className="cursor-pointer font-medium">
                      Tag {block.offsetDays + 1} · {entryCount} {entryCount === 1 ? "Eintrag" : "Einträge"}
                      {meals.length ? ` · ${meals.join(", ")}` : ""}
                    </summary>
                    <div className="mt-2 space-y-2 text-muted-foreground">
                      {block.slots.filter((slot) => slot.entries.length > 0).map((slot) => (
                        <div key={slot.type}>
                          <p className="font-medium text-foreground">{MEAL_SLOT_LABELS[slot.type]}</p>
                          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                            {slot.entries.map((entry) => <li key={entry.id}>{getEntryLabel(entry)}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
            {hasGaps ? <p className="mt-2 text-xs text-muted-foreground">Die Vorlage enthält bewusste Lücken; sie bleiben beim Anwenden erhalten.</p> : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,190px)_1fr] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="template-start-date">Starttag</Label>
              <Input
                id="template-start-date"
                type="date"
                value={startDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                disabled={isApplying}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Der Starttag bestimmt die festen Abstände der Vorlage. Ausgewählte Wochentage werden nicht umsortiert.
            </p>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Zieltermine</Label>
              <span className="text-xs text-muted-foreground">{targets.length} {targets.length === 1 ? "Planungstag" : "Planungstage"}</span>
            </div>
            <div className="divide-y rounded-lg border">
              {targets.map((target) => (
                <div key={target.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{format(parseISO(target.date), "EEEE, d. MMMM", { locale: de })}</span>
                  {target.state === "free" ? (
                    <Badge variant="outline" className="text-muted-foreground">Frei</Badge>
                  ) : target.state === "draft" ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">Entwurf wird ersetzt</Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800"><Lock className="mr-1 h-3 w-3" />Geschützt</Badge>
                  )}
                </div>
              ))}
            </div>
          </section>

          {occupiedTargets.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />{occupiedTargets.length} bestehende {occupiedTargets.length === 1 ? "Entwurf wird" : "Entwürfe werden"} ersetzt</div>
              <p className="mt-1 text-xs">Die Ersetzung wird erst mit „Anwenden“ ausgelöst.</p>
            </div>
          ) : null}
          {protectedTargets.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4" />Vorlage kann nicht angewendet werden</div>
              <p className="mt-1 text-xs">Freigegebene, aktive oder archivierte Ziele werden nie überschrieben. Der Block bleibt vollständig unverändert.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>Abbrechen</Button>
          <Button onClick={() => void onConfirm()} disabled={!canApply}>
            {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
            {blocks.length === 1 ? "Vorlage anwenden" : `Auf ${blocks.length} Tage anwenden`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
