"use client"

import { useCallback, useMemo, useState } from "react"
import { Pencil, Plus, Timer, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ClientWorkoutSessionDialog } from "@/components/client/client-workout-session-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  deleteClientWorkoutSession,
  fetchClientWorkoutSessionsForDate,
} from "@/lib/data/client-training-client"
import { findActivity } from "@/lib/energy-expenditure"
import type { ClientWorkoutSession } from "@/lib/types"

/**
 * The day's activity log inside the diary.
 *
 * These are the same session rows as the activity module uses. The diary is
 * where something is recorded on the day; the activity tab can stay the place
 * for weekly summaries, exercise sets and progress without the two drifting.
 */
export function ClientDiaryActivity({
  date,
  clientUserId,
  initialSessions,
  suggestedWeightKg,
}: {
  date: string
  clientUserId: string
  initialSessions: ClientWorkoutSession[]
  suggestedWeightKg?: number
}) {
  const [sessions, setSessions] = useState(initialSessions)
  const [dialogSessionId, setDialogSessionId] = useState<string | null | undefined>()

  const knownTitles = useMemo(
    () => [...new Set(sessions.map((session) => session.title.trim()).filter(Boolean))],
    [sessions],
  )
  const activeSession =
    dialogSessionId === null || dialogSessionId === undefined
      ? undefined
      : sessions.find((session) => session.id === dialogSessionId)

  const refresh = useCallback(async () => {
    try {
      setSessions(await fetchClientWorkoutSessionsForDate(clientUserId, date))
    } catch (error) {
      console.error("Failed to refresh diary activities:", error)
      toast.error("Die Aktivitäten konnten nicht neu geladen werden.")
    }
  }, [clientUserId, date])

  async function handleDelete(sessionId: string) {
    try {
      await deleteClientWorkoutSession(sessionId)
      setSessions((current) => current.filter((session) => session.id !== sessionId))
    } catch (error) {
      console.error("Failed to delete diary activity:", error)
      toast.error("Die Aktivität konnte nicht gelöscht werden.")
    }
  }

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {sessions.length === 0
                  ? "Noch keine Aktivität eingetragen"
                  : sessions.length === 1
                    ? "1 Aktivität eingetragen"
                    : `${sessions.length} Aktivitäten eingetragen`}
              </p>
              {sessions.length === 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Training, Spaziergang oder andere Bewegung.
                </p>
              )}
            </div>
            <Button size="sm" onClick={() => setDialogSessionId(null)}>
              <Plus className="mr-1 h-4 w-4" />
              Eintragen
            </Button>
          </div>

          {sessions.length > 0 && (
            <ul className="mt-3 divide-y border-t">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center gap-3 py-3 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{session.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {session.activityKind ? findActivity(session.activityKind).label : "Training"}
                      </span>
                      {session.durationMinutes !== undefined && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Timer className="h-3.5 w-3.5" aria-hidden />
                          {session.durationMinutes} min
                        </span>
                      )}
                      {session.intensity && <span className="capitalize">{session.intensity}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${session.title} bearbeiten`}
                      onClick={() => setDialogSessionId(session.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${session.title} löschen`}
                      onClick={() => void handleDelete(session.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {dialogSessionId !== undefined && (
        <ClientWorkoutSessionDialog
          session={activeSession}
          defaultDate={date}
          knownTitles={knownTitles}
          suggestedWeightKg={suggestedWeightKg}
          onClose={() => setDialogSessionId(undefined)}
          onSaved={() => {
            setDialogSessionId(undefined)
            void refresh()
          }}
        />
      )}
    </>
  )
}
