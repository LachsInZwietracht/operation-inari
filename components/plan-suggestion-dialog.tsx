"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { DailyMealPlan } from "@/lib/types"

interface PlanSuggestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId?: string
  onApply: (slots: DailyMealPlan["slots"], notes: string[]) => void
}

export function PlanSuggestionDialog({ open, onOpenChange, patientId, onApply }: PlanSuggestionDialogProps) {
  const [slots, setSlots] = useState<DailyMealPlan["slots"]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [blockedReasons, setBlockedReasons] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const createSuggestion = async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const response = await fetch("/api/meal-plan-suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? "Vorschlag konnte nicht erstellt werden")
      setSlots(result.slots ?? [])
      setNotes(result.notes ?? [])
      setBlockedReasons(result.blockedReasons ?? [])
    } catch (error) {
      setBlockedReasons([error instanceof Error ? error.message : "Vorschlag konnte nicht erstellt werden"])
      setSlots([])
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planvorschlag vorbereiten</DialogTitle>
          <DialogDescription>Der Vorschlag wird erst nach deiner Prüfung als Entwurf in den Plan eingesetzt.</DialogDescription>
        </DialogHeader>
        {!patientId ? <p className="text-sm text-muted-foreground">Wähle zuerst einen Patienten.</p> : null}
        {blockedReasons.length ? <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{blockedReasons.map((reason) => <p key={reason}>{reason}</p>)}</div> : null}
        {slots.length ? <div className="space-y-2">{slots.map((slot) => <div key={slot.type} className="rounded-lg border p-3 text-sm"><p className="font-medium">{MEAL_SLOT_LABELS[slot.type]}</p><p className="text-muted-foreground">{slot.entries.length} vorbereitete Auswahl</p></div>)}</div> : null}
        {notes.length ? <p className="text-xs text-muted-foreground">{notes.join(" ")}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          {!slots.length ? <Button disabled={!patientId || loading} onClick={() => void createSuggestion()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Vorschlag erstellen</Button> : <Button onClick={() => { onApply(slots, notes); onOpenChange(false) }}>Als Entwurf einsetzen</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
