"use client"

import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Loader2, Save } from "lucide-react"
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

interface PlanWeekTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dates: string[]
  isSaving: boolean
  onSave: (name: string) => void
}

/**
 * Keeps the irreversible-looking action explicit: a saved blueprint is
 * personal and patient-independent, while the source plan stays untouched.
 */
export function PlanWeekTemplateDialog({
  open,
  onOpenChange,
  dates,
  isSaving,
  onSave,
}: PlanWeekTemplateDialogProps) {
  const sortedDates = useMemo(() => [...dates].sort(), [dates])
  // The dialog only mounts when opened, so this avoids an avoidable
  // state-sync effect while still proposing a helpful, editable name.
  const [name, setName] = useState(() => {
    const first = [...dates].sort()[0]
    return first ? `Vorlage ab ${format(parseISO(first), "d. MMM", { locale: de })}` : ""
  })

  const isMultiDay = sortedDates.length > 1

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Als Vorlage speichern</DialogTitle>
          <DialogDescription>
            {isMultiDay
              ? "Der ausgewählte Ablauf wird als persönlicher, mehrtägiger Vorlagenblock gespeichert. Er ist nicht an diesen Patienten gebunden."
              : "Der ausgewählte Tag wird als persönliche Tagesvorlage gespeichert. Er ist nicht an diesen Patienten gebunden."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <Badge variant="outline">
              {sortedDates.length} {sortedDates.length === 1 ? "Tag" : "Tage"}
            </Badge>
            <p className="mt-2 text-sm font-medium">
              {sortedDates.map((date) => format(parseISO(date), "EEE, d. MMM", { locale: de })).join(" · ")}
            </p>
            {isMultiDay ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Die Abstände zwischen den Tagen bleiben beim späteren Anwenden erhalten.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="week-template-name">Name der Vorlage</Label>
            <Input
              id="week-template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Aufbauwoche vegetarisch"
              disabled={isSaving}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button disabled={!name.trim() || sortedDates.length === 0 || isSaving} onClick={() => onSave(name.trim())}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Vorlage speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
