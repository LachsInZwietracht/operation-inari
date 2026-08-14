"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { format, parseISO, subDays } from "date-fns"
import { de } from "date-fns/locale"
import { Copy, Link2, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { createClientInviteAction, revokeClientLinkAction } from "@/app/(app)/patienten/[id]/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { calculateClientLogNutrients } from "@/lib/client-food-log"
import { formatInviteCode, todayIsoDate } from "@/lib/client-mode"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { fetchClientFoodLogDays } from "@/lib/data/client-food-log-client"
import { hydrateClientFoods } from "@/lib/data/client-custom-foods-client"
import { fetchClientRecipeFacts } from "@/lib/data/client-plan-nutrition-client"
import { fetchClientAdherence } from "@/lib/data/client-plan-client"
import { fetchClientWorkoutSessions } from "@/lib/data/client-training-client"
import { fetchClientLinkForPatient } from "@/lib/data/client-links"
import { estimateActivityEnergy } from "@/lib/energy-expenditure"
import { getNutrientValue } from "@/lib/nutrients"
import { createClient } from "@/lib/supabase/client"
import type {
  ClientAdherenceSummary,
  ClientFoodLogDay,
  ClientLink,
  ClientWorkoutSession,
  Food,
  NutrientValue,
  Patient,
} from "@/lib/types"

const LOG_WINDOW_DAYS = 7

/**
 * The one line under an activity: what it consisted of.
 *
 * A walk carries its meaning in minutes and kcal, a strength session in its
 * sets — so both are shown when present and neither is invented. The kcal
 * figure is the same estimate the client sees, recomputed from the stored
 * inputs rather than read from a column.
 */
function describeSession(session: ClientWorkoutSession): string {
  const parts: string[] = []

  if (session.durationMinutes !== undefined) parts.push(`${session.durationMinutes} min`)

  const energy = estimateActivityEnergy({
    activityId: session.activityKind,
    intensity: session.intensity,
    minutes: session.durationMinutes,
    weightKg: session.bodyWeightKg,
  })
  if (energy) parts.push(`ca. ${energy.netKcal} kcal`)

  if (session.sets.length > 0) {
    const exercises = [...new Set(session.sets.map((set) => set.exerciseName))].slice(0, 3)
    parts.push(
      `${session.sets.length} ${session.sets.length === 1 ? "Satz" : "Sätze"} · ${exercises.join(", ")}`,
    )
  }

  return parts.join(" · ")
}

export function KlientenAppTab({ patient }: { patient: Patient }) {
  const supabase = useMemo(() => createClient(), [])
  const [link, setLink] = useState<ClientLink | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [days, setDays] = useState<ClientFoodLogDay[]>([])
  const [foods, setFoods] = useState<Map<string, Food>>(new Map())
  const [recipeFacts, setRecipeFacts] = useState<
    Map<string, { name: string; perPortion: NutrientValue[] }>
  >(new Map())
  const [adherence, setAdherence] = useState<ClientAdherenceSummary>({ byDay: [], bySlot: [] })
  const [workouts, setWorkouts] = useState<ClientWorkoutSession[]>([])
  const [isPending, startTransition] = useTransition()

  const loadLink = useCallback(async () => {
    try {
      setLink(await fetchClientLinkForPatient(supabase, patient.id))
    } catch (error) {
      console.error("Failed to load client link:", error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, patient.id])

  useEffect(() => {
    void loadLink()
  }, [loadLink])

  const clientUserId = link?.status === "active" ? link.clientUserId : undefined

  const loadDays = useCallback(async () => {
    if (!clientUserId) return

    const today = todayIsoDate()
    const range = {
      from: format(subDays(parseISO(today), LOG_WINDOW_DAYS - 1), "yyyy-MM-dd"),
      to: today,
    }
    try {
      const loaded = await fetchClientFoodLogDays(clientUserId, range, supabase)
      setDays(loaded)

      if (isClientModuleEnabled("plan")) {
        setAdherence(await fetchClientAdherence(patient.id, clientUserId, range, supabase))
      }

      // Training rides on its own consent flag; without it RLS returns nothing
      // and the section stays hidden rather than showing an empty shell.
      if (isClientModuleEnabled("training")) {
        setWorkouts(await fetchClientWorkoutSessions(clientUserId, 5, supabase))
      }

      // Includes the client's own products, which the by-ids endpoint strips —
      // under an active consented link they are readable through RLS, and
      // without them a scanned product would show as a nameless empty line.
      setFoods(
        await hydrateClientFoods(
          loaded.flatMap((day) =>
            day.entries.map((entry) => entry.foodId).filter((id): id is string => Boolean(id)),
          ),
          supabase,
        ),
      )

      setRecipeFacts(
        await fetchClientRecipeFacts(
          loaded.flatMap((day) =>
            day.entries.map((entry) => entry.recipeId).filter((id): id is string => Boolean(id)),
          ),
          supabase,
        ),
      )
    } catch (error) {
      console.error("Failed to load client food log:", error)
    }
  }, [clientUserId, supabase, patient.id])

  useEffect(() => {
    void loadDays()
  }, [loadDays])

  function handleInvite() {
    startTransition(async () => {
      const result = await createClientInviteAction({ patientId: patient.id })
      if (result.status === "error") {
        toast.error(result.message ?? "Die Einladung konnte nicht erstellt werden.")
        if (result.link) setLink(result.link)
        return
      }
      if (result.link) setLink(result.link)
      toast.success("Einladung erstellt.")
    })
  }

  function handleRevoke() {
    if (!link) return
    startTransition(async () => {
      const result = await revokeClientLinkAction({ linkId: link.id, patientId: patient.id })
      if (result.status === "error") {
        toast.error(result.message ?? "Die Verbindung konnte nicht beendet werden.")
        return
      }
      toast.success("Verbindung beendet.")
      setLink(null)
      setDays([])
      setAdherence({ byDay: [], bySlot: [] })
      setWorkouts([])
    })
  }

  async function copyInviteLink() {
    if (!link) return
    const url = `${window.location.origin}/klient/einladung/${link.inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Einladungslink kopiert.")
    } catch {
      toast.error("Kopieren nicht möglich. Bitte den Code manuell weitergeben.")
    }
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verbindung wird geprüft
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Klienten-Zugang
            {link?.status === "active" && <Badge variant="secondary">Verbunden</Badge>}
            {link?.status === "invited" && <Badge variant="outline">Einladung offen</Badge>}
          </CardTitle>
          <CardDescription>
            {patient.firstName} {patient.lastName} kann die App selbst nutzen und das eigene
            Ernährungstagebuch führen. Die Einträge gehören dem Klienten — Sie lesen mit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!link && (
            <Button disabled={isPending} onClick={handleInvite}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Klienten-Zugang einladen
            </Button>
          )}

          {link?.status === "invited" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Einladungscode</p>
                <p className="font-mono text-lg tracking-wider">
                  {formatInviteCode(link.inviteCode)}
                </p>
                {link.inviteExpiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Gültig bis{" "}
                    {format(parseISO(link.inviteExpiresAt), "d. MMMM yyyy", { locale: de })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyInviteLink()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Link kopieren
                </Button>
                <Button variant="ghost" size="sm" disabled={isPending} onClick={handleRevoke}>
                  Einladung zurückziehen
                </Button>
              </div>
            </div>
          )}

          {link?.status === "active" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Verbunden seit{" "}
                {format(parseISO(link.consentedAt ?? link.createdAt), "d. MMMM yyyy", {
                  locale: de,
                })}
              </p>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={handleRevoke}>
                Verbindung beenden
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {link?.status === "active" && isClientModuleEnabled("plan") && adherence.byDay.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan-Treue der letzten {LOG_WINDOW_DAYS} Tage</CardTitle>
            <CardDescription>
              Abgehakte Mahlzeiten gegen den freigegebenen Plan. Ohne Reaktion heißt weder
              gegessen noch ausgelassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* By meal first: "which meal is the problem" is the question a
                counselor can act on. A client at 80 % overall can still be
                skipping every dinner, and the per-day list hides that. */}
            {adherence.bySlot.length > 0 && (
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {adherence.bySlot.map((slot) => {
                  const unanswered = slot.planned - slot.completed - slot.skipped
                  return (
                    <div
                      key={slot.slotType}
                      className="flex items-baseline justify-between gap-2 rounded-lg border px-3 py-2"
                    >
                      <span className="text-sm font-medium">
                        {MEAL_SLOT_LABELS[slot.slotType]}
                      </span>
                      <span className="text-sm tabular-nums">
                        {slot.completed}/{slot.planned}
                        {slot.skipped > 0 && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {slot.skipped} ausgelassen
                          </span>
                        )}
                        {unanswered > 0 && (
                          <span className="text-muted-foreground"> · {unanswered} offen</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <ul className="divide-y">
              {adherence.byDay.map((day) => (
                <li key={day.date} className="flex items-center justify-between gap-2 py-2">
                  <p className="text-sm font-medium">
                    {format(parseISO(day.date), "EEEE, d. MMMM", { locale: de })}
                  </p>
                  <p className="text-sm tabular-nums">
                    {day.completed}/{day.planned}
                    {day.skipped > 0 && (
                      <span className="text-muted-foreground"> · {day.skipped} ausgelassen</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {link?.status === "active" && isClientModuleEnabled("training") && workouts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Letzte Aktivitäten</CardTitle>
            <CardDescription>Vom Klienten selbst erfasst.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {workouts.map((session) => {
                const detail = describeSession(session)
                return (
                  <li key={session.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(session.date), "d. MMMM", { locale: de })}
                      </p>
                    </div>
                    {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {link?.status === "active" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Tagebuch der letzten {LOG_WINDOW_DAYS} Tage</CardTitle>
              <CardDescription>Vom Klienten selbst eingetragen.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" aria-label="Aktualisieren" onClick={() => void loadDays()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                In diesem Zeitraum wurde noch nichts eingetragen.
              </p>
            ) : (
              <ul className="divide-y">
                {days.map((day) => {
                  const totals = calculateClientLogNutrients(
                    day.entries,
                    foods,
                    new Map([...recipeFacts].map(([id, facts]) => [id, facts.perPortion])),
                  )
                  return (
                    <li key={day.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="text-sm font-medium">
                          {format(parseISO(day.date), "EEEE, d. MMMM", { locale: de })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {day.entries.length} {day.entries.length === 1 ? "Eintrag" : "Einträge"}
                        </p>
                      </div>
                      <p className="text-sm tabular-nums">
                        {getNutrientValue(totals, "energie").toFixed(0)} kcal
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
