"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
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
import { collectExerciseNames, formatSet } from "@/lib/client-training"
import { addClientWorkoutSet } from "@/lib/data/client-training-client"
import type { ClientWorkoutSession } from "@/lib/types"

function parseNumber(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** Mounted per open by the caller, so it always starts clean. */
export function ClientWorkoutSetDialog({
  session,
  sessions,
  onClose,
  onSaved,
}: {
  session: ClientWorkoutSession
  sessions: ClientWorkoutSession[]
  onClose: () => void
  onSaved: () => void
}) {
  const [exerciseName, setExerciseName] = useState("")
  const [reps, setReps] = useState("")
  const [weight, setWeight] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const knownExercises = useMemo(() => collectExerciseNames(sessions), [sessions])

  // The point of a training log is the comparison, so surface the last set of
  // this exercise while the person is typing the new one.
  const lastPerformance = useMemo(() => {
    const key = exerciseName.trim().toLowerCase()
    if (!key) return null

    for (const past of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
      const match = [...past.sets]
        .reverse()
        .find((set) => set.exerciseName.trim().toLowerCase() === key)
      if (match) return { date: past.date, label: formatSet(match.reps, match.weightKg) }
    }
    return null
  }, [exerciseName, sessions])

  async function handleSave() {
    const name = exerciseName.trim()
    if (!name) {
      toast.error("Bitte gib eine Übung an.")
      return
    }

    const parsedReps = parseNumber(reps)
    const parsedWeight = parseNumber(weight)
    if (parsedReps === undefined && parsedWeight === undefined) {
      toast.error("Trag mindestens Wiederholungen oder Gewicht ein.")
      return
    }

    setIsSaving(true)
    try {
      const nextIndex =
        session.sets.filter((set) => set.exerciseName.trim().toLowerCase() === name.toLowerCase())
          .length + 1

      await addClientWorkoutSet({
        sessionId: session.id,
        exerciseName: name,
        setIndex: nextIndex,
        reps: parsedReps,
        weightKg: parsedWeight,
      })
      onSaved()
    } catch (error) {
      console.error("Failed to add workout set:", error)
      toast.error("Der Satz konnte nicht gespeichert werden.")
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Satz hinzufügen</DialogTitle>
          <DialogDescription>{session.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workout-exercise">Übung</Label>
            <Input
              id="workout-exercise"
              autoFocus
              list="workout-exercise-options"
              placeholder="z. B. Kniebeuge"
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
            />
            <datalist id="workout-exercise-options">
              {knownExercises.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {lastPerformance && (
              <p className="text-xs text-muted-foreground">
                Letztes Mal: {lastPerformance.label}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="workout-reps">Wiederholungen</Label>
              <Input
                id="workout-reps"
                inputMode="numeric"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-weight">Gewicht (kg)</Label>
              <Input
                id="workout-weight"
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
