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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export interface WeekTemplateDraft {
  name: string
  description: string
  indication: string
  dietLineId?: string
  scope: "patient" | "advisor"
}

interface PlanWeekTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dates: string[]
  dietLines: Array<{ id: string; name: string }>
  initialDietLineId?: string
  patient?: { id: string; name: string }
  isSaving: boolean
  onSave: (draft: WeekTemplateDraft) => void
}

/**
 * Keeps the irreversible-looking action explicit: saving a blueprint never
 * changes its source plan. In a patient workspace, the counselor makes
 * the reuse scope explicit instead of silently creating a global template.
 */
export function PlanWeekTemplateDialog({
  open,
  onOpenChange,
  dates,
  dietLines,
  initialDietLineId,
  patient,
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
  const [description, setDescription] = useState("")
  const [indication, setIndication] = useState("")
  const [dietLineId, setDietLineId] = useState(initialDietLineId ?? "__none__")
  const [scope, setScope] = useState<"patient" | "advisor">(patient ? "patient" : "advisor")

  const isMultiDay = sortedDates.length > 1
  const spanDays = sortedDates.length > 1
    ? Math.round((parseISO(sortedDates.at(-1)!).getTime() - parseISO(sortedDates[0]).getTime()) / 86_400_000) + 1
    : 1

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Als Vorlage speichern</DialogTitle>
          <DialogDescription>
            {isMultiDay
              ? "Der ausgewählte Ablauf wird als mehrtägiger Vorlagenblock gespeichert. Die Auswahl unten bestimmt, wo er später erscheint."
              : "Der ausgewählte Tag wird als persönliche Vorlage gespeichert. Die Auswahl unten bestimmt, wo er später erscheint."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <Badge variant="outline">
              {sortedDates.length} {sortedDates.length === 1 ? "Planungstag" : "Planungstage"}
            </Badge>
            {isMultiDay ? <Badge variant="outline" className="ml-1">Zeitraum {spanDays} Tage</Badge> : null}
            <p className="mt-2 text-sm font-medium">
              {sortedDates.map((date) => format(parseISO(date), "EEE, d. MMM", { locale: de })).join(" · ")}
            </p>
            {isMultiDay ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Die Abstände und bewussten Lücken zwischen den Tagen bleiben beim späteren Anwenden erhalten.
              </p>
            ) : null}
          </div>
          {patient ? (
            <div className="space-y-2">
              <Label>Geltungsbereich</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as "patient" | "advisor")} disabled={isSaving}>
                <SelectTrigger aria-label="Geltungsbereich der Vorlage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Nur für {patient.name}</SelectItem>
                  <SelectItem value="advisor">Für alle meine Patienten</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {scope === "patient" ? "Die Vorlage kann nur im Plan dieses Patienten angewendet werden." : "Die Vorlage steht dir in allen eigenen Patientenplänen zur Verfügung."}
              </p>
            </div>
          ) : null}

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
          <div className="space-y-2">
            <Label htmlFor="week-template-indication">Indikation <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="week-template-indication"
              value={indication}
              onChange={(event) => setIndication(event.target.value)}
              placeholder="z. B. Diabetes Typ 2"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label>Kostform <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={dietLineId} onValueChange={setDietLineId} disabled={isSaving}>
              <SelectTrigger aria-label="Kostform"><SelectValue placeholder="Keine Kostform hinterlegen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Keine Kostform hinterlegen</SelectItem>
                {dietLines.map((dietLine) => <SelectItem key={dietLine.id} value={dietLine.id}>{dietLine.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="week-template-description">Beschreibung <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="week-template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Wofür ist diese Vorlage gedacht?"
              disabled={isSaving}
              className="min-h-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">Bestehende Patientenpläne werden dadurch nicht verändert.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button disabled={!name.trim() || sortedDates.length === 0 || isSaving} onClick={() => onSave({ name: name.trim(), description: description.trim(), indication: indication.trim(), dietLineId: dietLineId === "__none__" ? undefined : dietLineId, scope })}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Vorlage speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
