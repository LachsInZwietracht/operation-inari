"use client"

import { useState } from "react"
import { Scale } from "lucide-react"
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
  MissingHeightError,
  recordClientWeight,
  type ClientWeighIn,
} from "@/lib/data/client-anthropometrics-client"

/**
 * The scale, on the day it was stood on.
 *
 * Weight is the one measurement the client takes more often than their
 * counselor does, and until now it could only travel by telling them. It sits
 * next to water and the day note rather than in a screen of its own, because
 * that is where the other "how was today" facts already are.
 *
 * Height is asked for only when nothing is on record — the first weigh-in of a
 * client whose counselor never measured them. After that it carries forward.
 */
export function ClientWeightField({
  date,
  weightKg,
  measuredOn,
  onRecorded,
}: {
  date: string
  /** The most recent known weight, whoever recorded it. */
  weightKg?: number
  measuredOn?: string
  onRecorded: (entry: ClientWeighIn) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3">
        <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          {weightKg !== undefined ? (
            <p className="text-sm font-medium tabular-nums">
              {weightKg.toFixed(1).replace(".", ",")} kg
              {measuredOn === date && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">heute</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Noch kein Gewicht hinterlegt</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setIsOpen(true)}>
          {weightKg === undefined ? "Eintragen" : "Wiegen"}
        </Button>
      </div>

      {isOpen && (
        <WeightDialog
          date={date}
          initial={weightKg}
          onClose={() => setIsOpen(false)}
          onRecorded={(entry) => {
            setIsOpen(false)
            onRecorded(entry)
          }}
        />
      )}
    </>
  )
}

function WeightDialog({
  date,
  initial,
  onClose,
  onRecorded,
}: {
  date: string
  initial?: number
  onClose: () => void
  onRecorded: (entry: ClientWeighIn) => void
}) {
  const [weight, setWeight] = useState(initial ? String(initial).replace(".", ",") : "")
  const [height, setHeight] = useState("")
  // Only revealed once the server says it has no height to carry forward —
  // asking everyone for their height every time would be a question with a
  // known answer.
  const [needsHeight, setNeedsHeight] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function save() {
    const parsedWeight = Number(weight.replace(",", "."))
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast.error("Bitte gib dein Gewicht in Kilogramm ein.")
      return
    }

    const parsedHeight = height ? Number(height.replace(",", ".")) : undefined
    if (needsHeight && (!parsedHeight || !Number.isFinite(parsedHeight))) {
      toast.error("Bitte gib deine Größe in Zentimetern ein.")
      return
    }

    setIsSaving(true)
    try {
      onRecorded(
        await recordClientWeight({
          weightKg: parsedWeight,
          date,
          heightCm: parsedHeight,
        }),
      )
      toast.success("Gewicht gespeichert.")
    } catch (error) {
      if (error instanceof MissingHeightError) {
        // Not a failure — a question the form did not know to ask yet.
        setNeedsHeight(true)
        toast.info("Für den BMI brauchen wir einmal deine Größe.")
        return
      }
      console.error("Failed to record weight:", error)
      toast.error("Das Gewicht konnte nicht gespeichert werden.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Gewicht eintragen</DialogTitle>
          <DialogDescription>
            Landet in deinem Verlauf und bei deiner Beratung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="client-weight">Gewicht in kg</Label>
            <Input
              id="client-weight"
              autoFocus
              inputMode="decimal"
              placeholder="72,4"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
          </div>

          {needsHeight && (
            <div className="space-y-2">
              <Label htmlFor="client-height">Größe in cm</Label>
              <Input
                id="client-height"
                inputMode="decimal"
                placeholder="170"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
