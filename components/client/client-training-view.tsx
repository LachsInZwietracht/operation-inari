"use client"

import { useCallback, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Loader2, Plus, Trash2, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import { ClientWorkoutSetDialog } from "@/components/client/client-workout-set-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { todayIsoDate } from "@/lib/client-mode"
import { formatSet, summarizeExerciseProgress } from "@/lib/client-training"
import {
  createClientWorkoutSession,
  deleteClientWorkoutSession,
  deleteClientWorkoutSet,
  fetchClientWorkoutSessions,
} from "@/lib/data/client-training-client"
import type { ClientWorkoutSession, ClientWorkoutSet } from "@/lib/types"

/** Sets of one session, grouped by exercise in the order they first appear. */
function groupByExercise(sets: ClientWorkoutSet[]) {
  const groups = new Map<string, { label: string; sets: ClientWorkoutSet[] }>()
  for (const set of sets) {
    const key = set.exerciseName.trim().toLowerCase()
    const group = groups.get(key) ?? { label: set.exerciseName.trim(), sets: [] }
    group.sets.push(set)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function ClientTrainingView({
  clientUserId,
  initialSessions,
}: {
  clientUserId: string | null
  initialSessions: ClientWorkoutSession[]
}) {
  const [sessions, setSessions] = useState(initialSessions)
  const [setDialogSession, setSetDialogSession] = useState<ClientWorkoutSession | null>(null)
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState("")
  const [newSessionDate, setNewSessionDate] = useState(todayIsoDate())
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!clientUserId) return
    try {
      setSessions(await fetchClientWorkoutSessions(clientUserId))
    } catch (error) {
      console.error("Failed to refresh workout sessions:", error)
    }
  }, [clientUserId])

  const progress = useMemo(() => summarizeExerciseProgress(sessions), [sessions])

  async function handleCreateSession() {
    const title = newSessionTitle.trim() || "Training"
    setIsSaving(true)
    try {
      await createClientWorkoutSession({ date: newSessionDate, title })
      setIsNewSessionOpen(false)
      setNewSessionTitle("")
      setNewSessionDate(todayIsoDate())
      await refresh()
    } catch (error) {
      console.error("Failed to create workout session:", error)
      toast.error("Die Einheit konnte nicht angelegt werden.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteSet(setId: string) {
    try {
      await deleteClientWorkoutSet(setId)
      await refresh()
    } catch (error) {
      console.error("Failed to delete workout set:", error)
      toast.error("Der Satz konnte nicht gelöscht werden.")
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await deleteClientWorkoutSession(sessionId)
      await refresh()
    } catch (error) {
      console.error("Failed to delete workout session:", error)
      toast.error("Die Einheit konnte nicht gelöscht werden.")
    }
  }

  if (!clientUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anmeldung erforderlich</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Melde dich an, um dein Training zu erfassen.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Training</h1>
        <Button size="sm" onClick={() => setIsNewSessionOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Einheit
        </Button>
      </div>

      {progress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Steigerung
            </CardTitle>
            <CardDescription>Bester Satz pro Übung und Woche.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {progress.map((exercise) => {
                const recent = exercise.points.slice(-4)
                return (
                  <li key={exercise.exerciseName}>
                    <p className="text-sm font-medium">{exercise.exerciseName}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {recent.map((point) => (
                        <span key={point.weekStart} className="text-xs text-muted-foreground">
                          KW {format(parseISO(point.weekStart), "I", { locale: de })}:{" "}
                          <span className="text-foreground tabular-nums">
                            {formatSet(point.bestReps, point.bestWeightKg)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Noch kein Training erfasst</CardTitle>
            <CardDescription>
              Leg eine Einheit an und trag deine Sätze ein. Ab der zweiten siehst du, ob du dich
              gesteigert hast.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        sessions.map((session) => (
          <Card key={session.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">{session.title}</CardTitle>
                <CardDescription>
                  {format(parseISO(session.date), "EEEE, d. MMMM yyyy", { locale: de })}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Einheit löschen"
                onClick={() => void handleDeleteSession(session.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {session.sets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Sätze.</p>
              ) : (
                <ul className="space-y-3">
                  {groupByExercise(session.sets).map((group) => (
                    <li key={group.label}>
                      <p className="text-sm font-medium">{group.label}</p>
                      <ul className="mt-1 divide-y">
                        {group.sets.map((set) => (
                          <li key={set.id} className="flex items-center gap-2 py-1.5">
                            <span className="w-8 text-xs text-muted-foreground">
                              {set.setIndex}.
                            </span>
                            <span className="flex-1 text-sm tabular-nums">
                              {formatSet(set.reps, set.weightKg)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Satz löschen"
                              onClick={() => void handleDeleteSet(set.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}

              <Button variant="outline" size="sm" onClick={() => setSetDialogSession(session)}>
                <Plus className="mr-1 h-4 w-4" />
                Satz hinzufügen
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      {setDialogSession && (
        <ClientWorkoutSetDialog
          session={setDialogSession}
          sessions={sessions}
          onClose={() => setSetDialogSession(null)}
          onSaved={() => {
            setSetDialogSession(null)
            void refresh()
          }}
        />
      )}

      <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Einheit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-title">Was hast du gemacht?</Label>
              <Input
                id="session-title"
                autoFocus
                placeholder="z. B. Oberkörper, Laufen"
                value={newSessionTitle}
                onChange={(event) => setNewSessionTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-date">Datum</Label>
              <Input
                id="session-date"
                type="date"
                max={todayIsoDate()}
                value={newSessionDate}
                onChange={(event) => setNewSessionDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewSessionOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={isSaving} onClick={() => void handleCreateSession()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
