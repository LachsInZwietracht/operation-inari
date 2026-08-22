"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  addWeeks,
  findPersonalRecords,
  formatSet,
  isStrengthSession,
  summarizeActivityRhythm,
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
import { cn } from "@/lib/utils"

const ACTIVITY_HUB_SESSION_LIMIT = 80
const INITIAL_VISIBLE_SESSIONS = 3
const INITIAL_VISIBLE_EXERCISES = 3

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
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showAllExercises, setShowAllExercises] = useState(false)

  const refresh = useCallback(async () => {
    if (!clientUserId) return
    try {
      setSessions(await fetchClientWorkoutSessions(clientUserId, ACTIVITY_HUB_SESSION_LIMIT))
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
  const currentWeek = weekStart(todayIsoDate())

  const weekSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.date >= week && session.date <= weekEnd(week))
        .sort((a, b) => b.date.localeCompare(a.date)),
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

  const activeDates = useMemo(
    () => new Set(weekSessions.map((session) => session.date)),
    [weekSessions],
  )

  const weekDays = useMemo(() => {
    const start = parseISO(week)
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start)
      date.setDate(date.getDate() + offset)
      const iso = format(date, "yyyy-MM-dd")
      return {
        iso,
        short: format(date, "EEEEE", { locale: de }),
        label: format(date, "EEEE, d. MMMM", { locale: de }),
      }
    })
  }, [week])

  const rhythm = useMemo(
    () => summarizeActivityRhythm(sessions, week),
    [sessions, week],
  )
  const activeRhythmWeeks = rhythm.filter((entry) => entry.sessions > 0)
  const rhythmMaxDays = Math.max(1, ...rhythm.map((entry) => entry.activeDays))
  const averageActiveDays =
    activeRhythmWeeks.length > 0
      ? activeRhythmWeeks.reduce((sum, entry) => sum + entry.activeDays, 0) /
        activeRhythmWeeks.length
      : 0
  const averageActiveDaysLabel = `${averageActiveDays.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} ${averageActiveDays === 1 ? "aktiver Tag" : "aktive Tage"}`
  const rhythmMessage =
    activeRhythmWeeks.length === 0
      ? "Dein persönlicher Wochenrhythmus entsteht mit der ersten Aktivität."
      : activeRhythmWeeks.length === 1
        ? "Ein guter Anfang. Mit jeder eingetragenen Woche wird dein Rhythmus klarer."
        : `Du warst in ${activeRhythmWeeks.length} der letzten ${rhythm.length} Wochen aktiv · im Schnitt ${averageActiveDaysLabel} pro aktiver Woche.`
  const visibleProgress = showAllExercises
    ? progress
    : progress.slice(0, INITIAL_VISIBLE_EXERCISES)
  const visibleSessions = showAllSessions
    ? weekSessions
    : weekSessions.slice(0, INITIAL_VISIBLE_SESSIONS)

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
      setExpandedSessionId((current) => (current === sessionId ? null : current))
      await refresh()
    } catch (error) {
      console.error("Failed to delete workout session:", error)
      toast.error("Die Einheit konnte nicht gelöscht werden.")
    }
  }

  function changeWeek(delta: number) {
    setWeek((current) => addWeeks(current, delta))
    setExpandedSessionId(null)
    setShowAllSessions(false)
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
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aktivität</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dein persönlicher Überblick über Bewegung und Training.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSessionDialog({})}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Aktivität</span>
          <span className="sr-only sm:hidden">Aktivität hinzufügen</span>
        </Button>
      </header>

      {/* The week is the page's orientation and its calmest, largest signal.
          Energy stays in the activity detail because it is an estimate, not
          the habit the person came here to understand. */}
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardContent className="space-y-6 py-5">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Vorherige Woche"
              onClick={() => changeWeek(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="text-center">
              <p className="text-sm font-medium">
                {week === currentWeek
                  ? "Diese Woche"
                  : `KW ${format(parseISO(week), "I", { locale: de })}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(week), "d.", { locale: de })}–
                {format(parseISO(weekEnd(week)), "d. MMMM", { locale: de })}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              disabled={week >= currentWeek}
              aria-label="Nächste Woche"
              onClick={() => changeWeek(1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {activeDates.size}
            </p>
            <p className="mt-1 text-base font-medium">
              {activeDates.size === 1 ? "aktiver Tag" : "aktive Tage"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weekSummary.sessions} {weekSummary.sessions === 1 ? "Aktivität" : "Aktivitäten"}
              {weekSummary.minutes > 0 ? ` · ${weekSummary.minutes} Minuten` : ""}
            </p>
          </div>

          <div className="grid grid-cols-7 gap-2" aria-label="Aktive Tage der Woche">
            {weekDays.map((day) => {
              const isActive = activeDates.has(day.iso)
              const isFuture = week === currentWeek && day.iso > todayIsoDate()
              return (
                <div
                  key={day.iso}
                  className="flex flex-col items-center gap-2"
                  aria-label={`${day.label}: ${isActive ? "aktiv" : isFuture ? "steht noch bevor" : "keine Aktivität"}`}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border",
                      isActive
                        ? "border-primary bg-primary"
                        : isFuture
                          ? "border-muted-foreground/15 bg-transparent"
                          : "border-muted-foreground/30 bg-background",
                    )}
                  />
                  <span className="text-xs font-medium text-muted-foreground">{day.short}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="activity-rhythm-heading">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <h2 id="activity-rhythm-heading" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Dein Rhythmus
              </h2>
            </CardTitle>
            <CardDescription>{rhythmMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="grid h-24 grid-cols-6 items-end gap-3"
              aria-hidden="true"
            >
              {rhythm.map((entry) => (
                <div key={entry.weekStart} className="flex h-full flex-col justify-end gap-1.5 text-center">
                  <span className="text-xs font-medium tabular-nums">{entry.activeDays}</span>
                  <span
                    className={cn(
                      "mx-auto w-full max-w-8 rounded-md transition-[height]",
                      entry.weekStart === week ? "bg-primary" : "bg-primary/25",
                    )}
                    style={{
                      height: `${entry.activeDays === 0 ? 4 : Math.max(14, (entry.activeDays / rhythmMaxDays) * 48)}px`,
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    KW {format(parseISO(entry.weekStart), "I", { locale: de })}
                  </span>
                </div>
              ))}
            </div>
            <p className="sr-only">
              {rhythm
                .map(
                  (entry) =>
                    `Kalenderwoche ${format(parseISO(entry.weekStart), "I", { locale: de })}: ${entry.activeDays} aktive Tage`,
                )
                .join(". ")}
            </p>
          </CardContent>
        </Card>
      </section>

      {progress.length > 0 && (
        <section aria-labelledby="training-progress-heading">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <h2 id="training-progress-heading" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trainingsfortschritt
                </h2>
              </CardTitle>
              <CardDescription>
                Deine zuletzt trainierten Übungen. Details zeigen den vollständigen Verlauf.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <ul className="divide-y">
                {visibleProgress.map((exercise) => {
                  const points = exercise.points
                  const last = points.at(-1)
                  const previous = points.at(-2)
                  const deltaPercent =
                    last?.bestOneRepMaxKg !== undefined &&
                    previous?.bestOneRepMaxKg !== undefined &&
                    previous.bestOneRepMaxKg > 0
                      ? Math.round(
                          ((last.bestOneRepMaxKg - previous.bestOneRepMaxKg) /
                            previous.bestOneRepMaxKg) *
                            100,
                        )
                      : undefined

                  return (
                    <li key={exercise.exerciseName}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        onClick={() => setDetailExercise(exercise.exerciseName)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Dumbbell className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {exercise.exerciseName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground tabular-nums">
                            {formatSet(last?.bestReps, last?.bestWeightKg)}
                            {last?.bestOneRepMaxKg !== undefined
                              ? ` · Krafttrend ${last.bestOneRepMaxKg} kg`
                              : ""}
                          </span>
                        </span>
                        {deltaPercent !== undefined && deltaPercent > 0 && (
                          <Badge className="tabular-nums">+{deltaPercent} %</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {progress.length > INITIAL_VISIBLE_EXERCISES && (
                <div className="border-t px-4 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAllExercises((current) => !current)}
                  >
                    {showAllExercises ? "Weniger Übungen" : "Alle Übungen anzeigen"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-labelledby="activity-history-heading">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <h2 id="activity-history-heading">
                {week === currentWeek
                  ? "Zuletzt"
                  : `Aktivitäten in KW ${format(parseISO(week), "I", { locale: de })}`}
              </h2>
            </CardTitle>
            <CardDescription>
              Öffne eine Aktivität, um Details oder Trainingssätze zu sehen.
            </CardDescription>
          </CardHeader>

          {weekSessions.length === 0 ? (
            <CardContent className="space-y-4 pb-6">
              <div className="rounded-xl bg-muted/50 px-4 py-5 text-center">
                <Footprints className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">In dieser Woche ist noch nichts eingetragen.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kraft, Spaziergang oder Radfahren – jede Bewegung zählt.
                </p>
              </div>
              <Button className="w-full" onClick={() => setSessionDialog({})}>
                <Plus className="h-4 w-4" />
                Erste Aktivität eintragen
              </Button>
            </CardContent>
          ) : (
            <CardContent className="px-0 pb-2">
              <ul className="divide-y border-y">
                {visibleSessions.map((session) => {
                  const energy = sessionEnergy(session)
                  const suggestions = suggestExercisesForSession(sessions, session)
                  const strength = isStrengthSession(session)
                  const isOpen = expandedSessionId === session.id
                  const activityLabel = session.activityKind
                    ? findActivity(session.activityKind).label
                    : "Training"

                  return (
                    <li key={session.id}>
                      <Collapsible
                        open={isOpen}
                        onOpenChange={(open) => setExpandedSessionId(open ? session.id : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            aria-label={`${session.title} Details`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              {strength ? (
                                <Dumbbell className="h-4 w-4" />
                              ) : (
                                <Footprints className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {session.title}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {format(parseISO(session.date), "EEEE, d. MMMM", { locale: de })}
                                {session.durationMinutes !== undefined
                                  ? ` · ${session.durationMinutes} Min`
                                  : ""}
                                {` · ${activityLabel}`}
                              </span>
                            </span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="space-y-4 border-t bg-muted/20 px-5 py-4">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                              {session.durationMinutes !== undefined && (
                                <span className="flex items-center gap-1 tabular-nums">
                                  <Timer className="h-3.5 w-3.5" />
                                  {session.durationMinutes} Minuten
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
                            </div>

                            {session.notes && (
                              <p className="text-sm text-muted-foreground">{session.notes}</p>
                            )}

                            {strength &&
                              (session.sets.length === 0 ? (
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
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="ml-auto h-7 px-2 text-xs"
                                          onClick={() =>
                                            setSetDialog({
                                              sessionId: session.id,
                                              exerciseName: group.label,
                                            })
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
                              ))}

                            {strength && suggestions.length > 0 && (
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
                                        setSetDialog({
                                          sessionId: session.id,
                                          exerciseName: name,
                                        })
                                      }
                                    >
                                      <Plus className="mr-1 h-3.5 w-3.5" />
                                      {name}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSessionDialog({ sessionId: session.id })}
                              >
                                <Pencil className="h-4 w-4" />
                                Bearbeiten
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSetDialog({ sessionId: session.id })}
                              >
                                <Plus className="h-4 w-4" />
                                {strength ? "Übung hinzufügen" : "Übung ergänzen"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto text-destructive hover:text-destructive"
                                onClick={() => void handleDeleteSession(session.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Löschen
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  )
                })}
              </ul>

              {weekSessions.length > INITIAL_VISIBLE_SESSIONS && (
                <div className="px-4 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => {
                      setShowAllSessions((current) => !current)
                      if (showAllSessions) setExpandedSessionId(null)
                    }}
                  >
                    {showAllSessions ? "Weniger Aktivitäten" : "Alle Aktivitäten anzeigen"}
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </section>

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
