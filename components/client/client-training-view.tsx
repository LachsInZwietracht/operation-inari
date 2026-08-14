"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  Flame,
  Pencil,
  Plus,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { toast } from "sonner"

import { ClientExerciseDetailDialog } from "@/components/client/client-exercise-detail-dialog"
import { ClientRestTimer } from "@/components/client/client-rest-timer"
import { ClientWorkoutSessionDialog } from "@/components/client/client-workout-session-dialog"
import { ClientWorkoutSetDialog } from "@/components/client/client-workout-set-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  addWeeks,
  findPersonalRecords,
  formatSet,
  isStrengthSession,
  summarizeExerciseProgress,
  summarizeWeek,
  suggestExercisesForSession,
  weekEnd,
  weekStart,
} from "@/lib/client-training"
import { todayIsoDate } from "@/lib/client-mode"
import { estimateActivityEnergy, findActivity } from "@/lib/energy-expenditure"
import { fetchClientPatientHistory } from "@/lib/data/client-history-client"
import {
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

function sessionEnergy(session: ClientWorkoutSession) {
  return estimateActivityEnergy({
    activityId: session.activityKind,
    intensity: session.intensity,
    minutes: session.durationMinutes,
    weightKg: session.bodyWeightKg,
  })
}

interface SetDialogState {
  sessionId: string
  exerciseName?: string
}

export function ClientTrainingView({
  clientUserId,
  initialSessions,
}: {
  clientUserId: string | null
  initialSessions: ClientWorkoutSession[]
}) {
  const [sessions, setSessions] = useState(initialSessions)
  const [setDialog, setSetDialog] = useState<SetDialogState | null>(null)
  const [sessionDialog, setSessionDialog] = useState<{ sessionId?: string } | null>(null)
  const [detailExercise, setDetailExercise] = useState<string | null>(null)
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null)
  const [historyWeightKg, setHistoryWeightKg] = useState<number | undefined>()

  const refresh = useCallback(async () => {
    if (!clientUserId) return
    try {
      setSessions(await fetchClientWorkoutSessions(clientUserId))
    } catch (error) {
      console.error("Failed to refresh workout sessions:", error)
    }
  }, [clientUserId])

  // Best effort only: an energy estimate is nicer with the counselor's last
  // measurement, but a client without a counselor still gets to type a weight.
  useEffect(() => {
    if (!clientUserId) return
    void fetchClientPatientHistory()
      .then((history) => setHistoryWeightKg(history.measurements.at(-1)?.weight || undefined))
      .catch(() => setHistoryWeightKg(undefined))
  }, [clientUserId])

  const [week, setWeek] = useState(() => weekStart(todayIsoDate()))

  const weekSessions = useMemo(
    () => sessions.filter((session) => session.date >= week && session.date <= weekEnd(week)),
    [sessions, week],
  )

  const weekSummary = useMemo(
    () =>
      summarizeWeek(
        weekSessions.map((session) => ({
          durationMinutes: session.durationMinutes,
          sets: session.sets,
          kcal: sessionEnergy(session)?.netKcal,
        })),
      ),
    [weekSessions],
  )

  const records = useMemo(() => findPersonalRecords(sessions), [sessions])
  const recordSetIds = useMemo(
    () => new Set([...records.values()].map((record) => record.setId)),
    [records],
  )

  // Most recently trained first: the exercise you did today is the one you want
  // to check, not the one that sorts first alphabetically.
  const progress = useMemo(
    () =>
      summarizeExerciseProgress(sessions).sort((a, b) => {
        const lastA = a.points.at(-1)?.weekStart ?? ""
        const lastB = b.points.at(-1)?.weekStart ?? ""
        return lastB.localeCompare(lastA) || a.exerciseName.localeCompare(b.exerciseName, "de")
      }),
    [sessions],
  )

  const knownTitles = useMemo(
    () => [...new Set(sessions.map((session) => session.title.trim()).filter(Boolean))],
    [sessions],
  )

  const suggestedWeightKg = useMemo(() => {
    const lastLogged = [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((session) => session.bodyWeightKg !== undefined)?.bodyWeightKg
    return lastLogged ?? historyWeightKg
  }, [sessions, historyWeightKg])

  const activeSetSession = setDialog
    ? sessions.find((session) => session.id === setDialog.sessionId)
    : undefined
  const activeSessionEdit = sessionDialog?.sessionId
    ? sessions.find((session) => session.id === sessionDialog.sessionId)
    : undefined

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
      {/* By week, not by day. The diary's day chrome would be empty most of
          the time here — and a week is the grain training is planned in. */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Vorherige Woche"
          onClick={() => setWeek((current) => addWeeks(current, -1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="text-center">
          <p className="text-base font-semibold">
            {week === weekStart(todayIsoDate()) ? "Diese Woche" : `KW ${format(parseISO(week), "I", { locale: de })}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(week), "d.", { locale: de })}–
            {format(parseISO(weekEnd(week)), "d. MMMM", { locale: de })}
          </p>
        </div>

        {week >= weekStart(todayIsoDate()) ? (
          <Button variant="ghost" size="icon" disabled aria-label="Nächste Woche">
            <ChevronRightIcon className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Nächste Woche"
            onClick={() => setWeek((current) => addWeeks(current, 1))}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-2 py-4">
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold tabular-nums">{weekSummary.sessions}</p>
              <p className="text-xs text-muted-foreground">
                {weekSummary.sessions === 1 ? "Einheit" : "Einheiten"}
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">{weekSummary.minutes}</p>
              <p className="text-xs text-muted-foreground">Minuten</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">
                {weekSummary.kcal ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setSessionDialog({})}>
            <Plus className="mr-1 h-4 w-4" />
            Einheit
          </Button>
        </CardContent>
      </Card>

      {progress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Steigerung
            </CardTitle>
            <CardDescription>
              Geschätztes Einer-Maximum je Übung. Tipp auf eine Übung für den ganzen Verlauf.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {progress.map((exercise) => {
                const points = exercise.points
                const last = points.at(-1)
                const previous = points.at(-2)
                const delta =
                  last?.bestOneRepMaxKg !== undefined && previous?.bestOneRepMaxKg !== undefined
                    ? Math.round((last.bestOneRepMaxKg - previous.bestOneRepMaxKg) * 10) / 10
                    : undefined

                return (
                  <li key={exercise.exerciseName}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setDetailExercise(exercise.exerciseName)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {exercise.exerciseName}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatSet(last?.bestReps, last?.bestWeightKg)}
                          {last?.volumeKg ? ` · ${Math.round(last.volumeKg)} kg Volumen` : ""}
                        </span>
                      </span>

                      {last?.bestOneRepMaxKg !== undefined && (
                        <span className="text-sm tabular-nums">{last.bestOneRepMaxKg} kg</span>
                      )}
                      {/* Only shown when there is a comparison to make; a first
                          week has no delta, and "±0" would imply a plateau. */}
                      {delta !== undefined && delta !== 0 && (
                        <Badge
                          variant={delta > 0 ? "default" : "secondary"}
                          className="tabular-nums"
                        >
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {weekSessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diese Woche noch nichts</CardTitle>
            <CardDescription>
              Kraft, ein Spaziergang, Radfahren — alles zählt. Trag eine Einheit ein.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        weekSessions.map((session) => {
          const energy = sessionEnergy(session)
          const suggestions = suggestExercisesForSession(sessions, session)

          return (
            <Card key={session.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-medium">{session.title}</CardTitle>
                  <CardDescription>
                    {format(parseISO(session.date), "EEEE, d. MMMM yyyy", { locale: de })}
                  </CardDescription>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {session.durationMinutes !== undefined && (
                      <span className="flex items-center gap-1 tabular-nums">
                        <Timer className="h-3.5 w-3.5" />
                        {session.durationMinutes} min
                      </span>
                    )}
                    {energy ? (
                      <span className="flex items-center gap-1 tabular-nums">
                        <Flame className="h-3.5 w-3.5" />≈ {energy.netKcal} kcal
                        <span className="opacity-70">
                          ({energy.lowKcal}–{energy.highKcal})
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-foreground"
                        onClick={() => setSessionDialog({ sessionId: session.id })}
                      >
                        Dauer nachtragen
                      </button>
                    )}
                    {session.activityKind && (
                      <span>{findActivity(session.activityKind).label}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Einheit bearbeiten"
                    onClick={() => setSessionDialog({ sessionId: session.id })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Einheit löschen"
                    onClick={() => void handleDeleteSession(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* A walk is a complete entry with no sets in it. Only strength
                  work gets the exercise machinery — offering "+ Satz" under a
                  bike ride is the surface insisting on a shape the data never
                  required. */}
              <CardContent className="space-y-3 pt-0">
                {!isStrengthSession(session) ? null : session.sets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Sätze.</p>
                ) : (
                  <ul className="space-y-3">
                    {groupByExercise(session.sets).map((group) => (
                      <li key={group.label}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-sm font-medium hover:underline"
                            onClick={() => setDetailExercise(group.label)}
                          >
                            {group.label}
                          </button>
                          {/* One tap repeats this exercise, prefilled with the
                              set above it — the gym path. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 px-2 text-xs"
                            onClick={() =>
                              setSetDialog({ sessionId: session.id, exerciseName: group.label })
                            }
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Satz
                          </Button>
                        </div>
                        <ul className="mt-1 divide-y">
                          {group.sets.map((set) => (
                            <li key={set.id} className="flex items-center gap-2 py-1.5">
                              <span className="w-8 text-xs text-muted-foreground">
                                {set.setIndex}.
                              </span>
                              <span className="flex-1 text-sm tabular-nums">
                                {formatSet(set.reps, set.weightKg)}
                              </span>
                              {recordSetIds.has(set.id) && (
                                <Trophy
                                  className="h-3.5 w-3.5 text-primary"
                                  aria-label="Persönliche Bestleistung"
                                />
                              )}
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

                {isStrengthSession(session) && suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Beim letzten „{session.title}“ dabei:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((name) => (
                        <Button
                          key={name}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setSetDialog({ sessionId: session.id, exerciseName: name })
                          }
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {isStrengthSession(session) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSetDialog({ sessionId: session.id })}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Andere Übung
                  </Button>
                ) : (
                  // The way back for something logged as a walk that turned
                  // into a workout — without making it the default gesture.
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => setSetDialog({ sessionId: session.id })}
                  >
                    Übung hinzufügen
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {activeSetSession && (
        <ClientWorkoutSetDialog
          session={activeSetSession}
          sessions={sessions}
          initialExerciseName={setDialog?.exerciseName}
          onClose={() => setSetDialog(null)}
          onSaved={() => {
            setRestStartedAt(Date.now())
            void refresh()
          }}
        />
      )}

      {sessionDialog && (
        <ClientWorkoutSessionDialog
          session={activeSessionEdit}
          knownTitles={knownTitles}
          suggestedWeightKg={suggestedWeightKg}
          onClose={() => setSessionDialog(null)}
          onSaved={() => {
            setSessionDialog(null)
            void refresh()
          }}
        />
      )}

      {detailExercise && (
        <ClientExerciseDetailDialog
          exerciseName={detailExercise}
          sessions={sessions}
          onClose={() => setDetailExercise(null)}
        />
      )}

      {restStartedAt !== null && (
        <ClientRestTimer startedAt={restStartedAt} onDismiss={() => setRestStartedAt(null)} />
      )}
    </div>
  )
}
