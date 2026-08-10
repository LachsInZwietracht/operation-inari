"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Loader2, Trophy } from "lucide-react"
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
  collectExerciseNames,
  estimateOneRepMax,
  findLastPerformance,
  findPersonalRecords,
  formatSetRun,
} from "@/lib/client-training"
import { addClientWorkoutSet } from "@/lib/data/client-training-client"
import type { ClientWorkoutSession, ClientWorkoutSet } from "@/lib/types"

function parseNumber(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function toInput(value?: number): string {
  return value === undefined ? "" : String(value)
}

/** Sets of one exercise inside one session, in order. */
function setsOf(session: ClientWorkoutSession, exerciseName: string): ClientWorkoutSet[] {
  const key = exerciseName.trim().toLowerCase()
  if (!key) return []
  return session.sets.filter((set) => set.exerciseName.trim().toLowerCase() === key)
}

/** Mounted per open by the caller, so it always starts clean. */
export function ClientWorkoutSetDialog({
  session,
  sessions,
  initialExerciseName,
  onClose,
  onSaved,
}: {
  session: ClientWorkoutSession
  sessions: ClientWorkoutSession[]
  /** Set when opened from an exercise already in the session or a suggestion. */
  initialExerciseName?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [exerciseName, setExerciseName] = useState(initialExerciseName ?? "")
  const [reps, setReps] = useState("")
  const [weight, setWeight] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const knownExercises = useMemo(() => collectExerciseNames(sessions), [sessions])
  const records = useMemo(() => findPersonalRecords(sessions), [sessions])

  // Set numbering must not depend on the refresh landing: the parent reloads
  // after every save, so count from a snapshot taken at mount plus what this
  // dialog has written since. State rather than a ref because the number is
  // rendered — the dialog title says which set is next.
  const [baseCounts] = useState(() =>
    session.sets.reduce((counts, set) => {
      const setKey = set.exerciseName.trim().toLowerCase()
      return counts.set(setKey, (counts.get(setKey) ?? 0) + 1)
    }, new Map<string, number>()),
  )
  const [savedHere, setSavedHere] = useState<Record<string, number>>({})

  const trimmedName = exerciseName.trim()
  const key = trimmedName.toLowerCase()

  // The comparison that makes a training log worth keeping: what this exercise
  // looked like last time, and what has already gone in today.
  const lastPerformance = useMemo(
    () => (trimmedName ? findLastPerformance(sessions, trimmedName, session.id) : null),
    [sessions, trimmedName, session.id],
  )
  const todaySets = useMemo(() => setsOf(session, trimmedName), [session, trimmedName])

  /**
   * Prefill from the obvious starting point — the set before this one, or
   * failing that the last one from the previous session. Overwriting on every
   * exercise change is the predictable rule: pick an exercise, get its numbers,
   * adjust if today is different.
   */
  const prefilledFor = useRef<string | null>(null)
  useEffect(() => {
    if (!key || prefilledFor.current === key) return

    // Nothing to go on — a name being typed one letter at a time must not keep
    // wiping numbers the person has already entered.
    const source = todaySets.at(-1) ?? lastPerformance?.sets.at(-1)
    if (!source) return

    prefilledFor.current = key
    setReps(toInput(source.reps))
    setWeight(toInput(source.weightKg))
  }, [key, todaySets, lastPerformance])

  async function save(): Promise<boolean> {
    if (!trimmedName) {
      toast.error("Bitte gib eine Übung an.")
      return false
    }

    const parsedReps = parseNumber(reps)
    const parsedWeight = parseNumber(weight)
    if (parsedReps === undefined && parsedWeight === undefined) {
      toast.error("Trag mindestens Wiederholungen oder Gewicht ein.")
      return false
    }

    setIsSaving(true)
    try {
      const setIndex = (baseCounts.get(key) ?? 0) + (savedHere[key] ?? 0) + 1

      await addClientWorkoutSet({
        sessionId: session.id,
        exerciseName: trimmedName,
        setIndex,
        reps: parsedReps,
        weightKg: parsedWeight,
      })
      setSavedHere((previous) => ({ ...previous, [key]: (previous[key] ?? 0) + 1 }))

      const oneRepMax = estimateOneRepMax(parsedReps, parsedWeight)
      const previous = records.get(key)
      if (oneRepMax !== undefined && previous && oneRepMax > previous.oneRepMaxKg) {
        toast.success(`Bestleistung bei ${trimmedName}!`, {
          icon: <Trophy className="h-4 w-4" />,
          description: `Geschätztes 1RM ${oneRepMax} kg statt ${previous.oneRepMaxKg} kg.`,
        })
      }

      onSaved()
      return true
    } catch (error) {
      console.error("Failed to add workout set:", error)
      toast.error("Der Satz konnte nicht gespeichert werden.")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const nextNumber = (baseCounts.get(key) ?? 0) + (savedHere[key] ?? 0) + 1

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{trimmedName ? `${trimmedName} · Satz ${nextNumber}` : "Satz hinzufügen"}</DialogTitle>
          <DialogDescription>{session.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workout-exercise">Übung</Label>
            <Input
              id="workout-exercise"
              autoFocus={!initialExerciseName}
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

            {todaySets.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Heute schon: <span className="text-foreground">{formatSetRun(todaySets)}</span>
              </p>
            )}
            {lastPerformance && (
              <p className="text-xs text-muted-foreground">
                {format(parseISO(lastPerformance.date), "d. MMM", { locale: de })}:{" "}
                <span className="text-foreground">{formatSetRun(lastPerformance.sets)}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="workout-reps">Wiederholungen</Label>
              <Input
                id="workout-reps"
                inputMode="numeric"
                autoFocus={Boolean(initialExerciseName)}
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          {/* The gym case: three identical sets should be three taps, not three
              trips through the dialog. */}
          <Button variant="secondary" disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern &amp; weiter
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              void save().then((ok) => {
                if (ok) onClose()
              })
            }}
          >
            Fertig
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
