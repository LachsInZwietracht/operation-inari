"use client"

import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldAlert } from "lucide-react"

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

export interface WeekReleaseReview {
  blockers: string[]
  warnings: string[]
  plannedDays: number
  clientVisibility: "linked" | "not-linked" | "unknown"
}

interface PlanWeekReleaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientName: string
  weekRangeLabel: string
  review: WeekReleaseReview
  isReleasing: boolean
  onRelease: () => void
}

/**
 * A clinical handoff review, not a hidden disabled button. Warnings leave the
 * final decision with the counselor; blockers describe the exact condition
 * that makes an atomic seven-day release impossible.
 */
export function PlanWeekReleaseDialog({
  open,
  onOpenChange,
  patientName,
  weekRangeLabel,
  review,
  isReleasing,
  onRelease,
}: PlanWeekReleaseDialogProps) {
  const releasable = review.blockers.length === 0
  const visibilityText =
    review.clientVisibility === "linked"
      ? "Nach der Freigabe ist der genaue Wochenstand im Klienten-Account sichtbar."
      : review.clientVisibility === "not-linked"
        ? "Es ist kein aktiver Klienten-Account verknüpft. Der Plan wird freigegeben, aber nicht in einer Klienten-App angezeigt."
        : "Die Verknüpfung zum Klienten-Account konnte nicht geprüft werden. Die Freigabe bleibt dennoch ein verbindlicher Wochenstand."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan prüfen &amp; freigeben</DialogTitle>
          <DialogDescription>
            {patientName} · {weekRangeLabel}. Die Freigabe macht exakt diese sieben Tagespläne unveränderlich. Spätere Änderungen beginnen als neue Revision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <Badge variant="outline" className={releasable ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}>
              {review.plannedDays}/7 Tage vorbereitet
            </Badge>
            <span className="text-muted-foreground">Nur sieben gespeicherte, nicht leere Entwürfe können gemeinsam übergeben werden.</span>
          </div>

          {review.blockers.length > 0 ? (
            <section className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                Vor der Freigabe beheben
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {review.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </section>
          ) : (
            <section className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Alle sieben Tage liegen als gespeicherte, befüllte Entwürfe vor.
            </section>
          )}

          {review.warnings.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Fachlich prüfen
              </div>
              <p className="mt-1 text-xs text-amber-900/80">Diese Hinweise blockieren die professionelle Entscheidung nicht automatisch.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {review.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </section>
          ) : null}

          <p className="text-sm text-muted-foreground">{visibilityText}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReleasing}>Abbrechen</Button>
          <Button disabled={!releasable || isReleasing} onClick={onRelease}>
            {isReleasing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Verbindlich freigeben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
