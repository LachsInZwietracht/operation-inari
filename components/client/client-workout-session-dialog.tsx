"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { todayIsoDate } from "@/lib/client-mode"
import { isStrengthKind } from "@/lib/client-training"
import {
  ACTIVITY_INTENSITIES,
  estimateActivityEnergy,
  matchActivityByName,
  MET_ACTIVITIES,
} from "@/lib/energy-expenditure"
import {
  createClientWorkoutSession,
  updateClientWorkoutSession,
} from "@/lib/data/client-training-client"
import type { ClientWorkoutSession } from "@/lib/types"

function parseNumber(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function toInput(value?: number): string {
  return value === undefined ? "" : String(value)
}

/**
 * Creates a session or edits one. Both, because duration is the field you can
 * only fill in once you are done, and forcing it up front would either produce
 * guesses or an empty column.
 */
export function ClientWorkoutSessionDialog({
  session,
  defaultDate,
  knownTitles,
  suggestedWeightKg,
  onClose,
  onSaved,
}: {
  /** Absent when creating. */
  session?: ClientWorkoutSession
  /** The diary supplies its currently open day; the activity hub defaults to today. */
  defaultDate?: string
  knownTitles: string[]
  /** Last known body weight — from an earlier session or the counselor's record. */
  suggestedWeightKg?: number
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(session)

  const [title, setTitle] = useState(session?.title ?? "")
  const [date, setDate] = useState(session?.date ?? defaultDate ?? todayIsoDate())
  const [activityKind, setActivityKind] = useState(session?.activityKind ?? "kraft")
  const [intensity, setIntensity] = useState(session?.intensity ?? "moderat")
  const [duration, setDuration] = useState(toInput(session?.durationMinutes))
  const [weight, setWeight] = useState(toInput(session?.bodyWeightKg ?? suggestedWeightKg))
  const [isSaving, setIsSaving] = useState(false)

  // A title is usually the sport ("Laufen"), so read the activity out of it
  // rather than making the person answer the same question twice. Only while
  // creating, and only until they touch the field themselves.
  const [kindTouched, setKindTouched] = useState(isEdit)
  useEffect(() => {
    if (kindTouched || !title.trim()) return
    setActivityKind(matchActivityByName(title).id)
  }, [title, kindTouched])

  const parsedDuration = parseNumber(duration)
  const parsedWeight = parseNumber(weight)

  // A walk is nothing but its duration: without one there is no volume, no
  // sets and no energy — the entry would say only that something happened.
  // Strength work still carries its meaning in the sets, so there it stays
  // optional and the estimate is the thing you forgo.
  const needsDuration = !isStrengthKind(activityKind)
  const estimate = useMemo(
    () =>
      estimateActivityEnergy({
        activityId: activityKind,
        intensity,
        minutes: parsedDuration,
        weightKg: parsedWeight,
      }),
    [activityKind, intensity, parsedDuration, parsedWeight],
  )

  async function handleSave() {
    if (needsDuration && parsedDuration === undefined) {
      toast.error("Wie lange war die Einheit? Ohne Dauer lässt sich nichts davon berechnen.")
      return
    }

    const trimmed = title.trim() || "Training"
    setIsSaving(true)
    try {
      const payload = {
        title: trimmed,
        date,
        activityKind,
        intensity,
        durationMinutes: parsedDuration,
        bodyWeightKg: parsedWeight,
      }

      if (session) await updateClientWorkoutSession(session.id, payload)
      else await createClientWorkoutSession(payload)

      onSaved()
    } catch (error) {
      console.error("Failed to save workout session:", error)
      toast.error("Die Einheit konnte nicht gespeichert werden.")
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
          <DialogTitle>{isEdit ? "Einheit bearbeiten" : "Neue Einheit"}</DialogTitle>
          <DialogDescription>
            {needsDuration
              ? "Dauer und Intensität beschreiben deine Aktivität."
              : "Dauer und Intensität kannst du auch später nachtragen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-title">Was hast du gemacht?</Label>
            <Input
              id="session-title"
              autoFocus={!isEdit}
              list="session-title-options"
              placeholder="z. B. Spaziergang, Oberkörper, Laufen"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {/* Repeating a title is what makes the exercise suggestions work. */}
            <datalist id="session-title-options">
              {knownTitles.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-date">Datum</Label>
              <Input
                id="session-date"
                type="date"
                max={todayIsoDate()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-duration">
                Dauer (Minuten)
                {!needsDuration && (
                  <span className="ml-1 font-normal text-muted-foreground">optional</span>
                )}
              </Label>
              <Input
                id="session-duration"
                inputMode="numeric"
                placeholder="60"
                required={needsDuration}
                aria-required={needsDuration}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-kind">Art</Label>
              <Select
                value={activityKind}
                onValueChange={(value) => {
                  setKindTouched(true)
                  setActivityKind(value)
                }}
              >
                <SelectTrigger id="session-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MET_ACTIVITIES.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-intensity">Intensität</Label>
              <Select value={intensity} onValueChange={setIntensity}>
                <SelectTrigger id="session-intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_INTENSITIES.map((value) => (
                    <SelectItem key={value} value={value} className="capitalize">
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-weight">Körpergewicht (kg)</Label>
            <Input
              id="session-weight"
              inputMode="decimal"
              placeholder="Für die Kalorienschätzung"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {estimate
                ? `Geschätzt ${estimate.netKcal} kcal zusätzlich verbrannt (${estimate.lowKcal}–${estimate.highKcal}).`
                : "Mit Dauer und Gewicht schätzen wir die verbrannten Kalorien."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Speichern" : "Anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
