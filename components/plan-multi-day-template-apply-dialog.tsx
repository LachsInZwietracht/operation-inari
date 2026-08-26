"use client"

import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { AlertTriangle, CalendarPlus, Loader2 } from "lucide-react"

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

interface PlanMultiDayTemplateApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName: string
  dates: string[]
  occupiedDates: string[]
  isApplying: boolean
  onConfirm: () => void | Promise<void>
}

/** A multi-day blueprint may replace several drafts, so it always asks once. */
export function PlanMultiDayTemplateApplyDialog({
  open,
  onOpenChange,
  templateName,
  dates,
  occupiedDates,
  isApplying,
  onConfirm,
}: PlanMultiDayTemplateApplyDialogProps) {
  const dateLabel = dates
    .map((date) => format(parseISO(date), "EEE, d. MMM", { locale: de }))
    .join(" · ")

  return (
    <Dialog open={open} onOpenChange={(next) => !isApplying && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vorlagenblock anwenden</DialogTitle>
          <DialogDescription>
            „{templateName}“ wird auf {dates.length} ausgewählte Planungstage ab dem aktiven Tag übertragen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <Badge variant="outline">{dates.length} Tage</Badge>
            <p className="mt-2 font-medium">{dateLabel}</p>
          </div>
          {occupiedDates.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {occupiedDates.length} bestehende {occupiedDates.length === 1 ? "Entwurf wird" : "Entwürfe werden"} ersetzt
              </div>
              <p className="mt-1 text-xs">
                {occupiedDates.map((date) => format(parseISO(date), "EEE, d. MMM", { locale: de })).join(" · ")}
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Freigegebene, aktive oder archivierte Tage werden vor dem Anwenden geprüft und nie überschrieben.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>Abbrechen</Button>
          <Button onClick={() => void onConfirm()} disabled={isApplying}>
            {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
            Block anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
