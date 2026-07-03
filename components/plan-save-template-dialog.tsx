"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { DietLinePreset } from "@/lib/types"

export interface SaveTemplateDraft {
  name: string
  description: string
  indication: string
  dietLineId: string
}

interface PlanSaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dietLines: DietLinePreset[]
  /** Prefill values captured from the current plan at open time. */
  defaults: SaveTemplateDraft
  /** Persists the draft; resolves true on success so the dialog can close. */
  onSave: (draft: SaveTemplateDraft) => Promise<boolean>
}

/** Saves the current day plan as a reusable personal template. */
export function PlanSaveTemplateDialog({
  open,
  onOpenChange,
  dietLines,
  defaults,
  onSave,
}: PlanSaveTemplateDialogProps) {
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftIndication, setDraftIndication] = useState("")
  const [draftDietLineId, setDraftDietLineId] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Seeded during render (not in an effect) so the first open paint
  // already shows the prefill values.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraftName(defaults.name)
      setDraftDescription(defaults.description)
      setDraftIndication(defaults.indication)
      setDraftDietLineId(defaults.dietLineId)
    }
  }

  const saveDraft = async () => {
    const name = draftName.trim()
    if (!name) {
      toast.error("Bitte einen Namen für die Vorlage eingeben.")
      return
    }
    setIsSaving(true)
    try {
      const saved = await onSave({
        name,
        description: draftDescription.trim(),
        indication: draftIndication.trim(),
        dietLineId: draftDietLineId,
      })
      if (saved) {
        onOpenChange(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan als Vorlage speichern</DialogTitle>
          <DialogDescription>
            Die Vorlage wird Ihrem Konto zugeordnet und steht für künftige Pläne zur Verfügung.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="z. B. Reduktion 1500 kcal Tag 1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-description">Beschreibung</Label>
            <Textarea
              id="template-description"
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder="Wofür eignet sich die Vorlage?"
              rows={2}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-indication">Indikation</Label>
              <Input
                id="template-indication"
                value={draftIndication}
                onChange={(event) => setDraftIndication(event.target.value)}
                placeholder="z. B. Diabetes mellitus Typ 2"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kostform</Label>
              <Select
                value={draftDietLineId || "none"}
                onValueChange={(value) => setDraftDietLineId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kostform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Zuordnung</SelectItem>
                  {dietLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => void saveDraft()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
