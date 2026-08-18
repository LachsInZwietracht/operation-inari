"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { ChevronDown, Minus, Plus, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import {
  CHECKIN_METRICS,
  clientMetricPreference,
  formatSleepDuration,
  resolveClientMetricPreferences,
  type ClientMetricKey,
  type ClientMetricPreferences,
} from "@/lib/client-metrics"
import {
  fetchClientCheckin,
  fetchClientMetricPreferences,
  saveClientCheckin,
  type ClientCheckinPatch,
} from "@/lib/data/client-checkin-client"
import type { ClientCheckin } from "@/lib/types"

/**
 * How the day went, asked on the day itself.
 *
 * Placement is the design decision that matters most here, and it is two
 * decisions. It sits in the diary rather than in a tab of its own, because a
 * tab is visited when someone remembers to and a check-in that is not filled
 * daily makes every evaluation built on it worthless. And it sits *above* the
 * day's totals, because someone who first reads their kcal balance rates the
 * balance instead of the day.
 *
 * Only the fields this client tracks are rendered. Everything else lives one
 * link away in the settings, so there is exactly one place where this is
 * configured rather than an inline picker competing with it.
 */

/** Long enough to tap through a scale without writing ten rows. */
const SAVE_DEBOUNCE_MS = 600

/** Sleep is entered in quarter hours; nobody knows their sleep to the minute. */
const SLEEP_STEP_MIN = 15
const SLEEP_MAX_MIN = 14 * 60

/** One drink, in the unit a counselor documents: 10 g ethanol. */
const ALCOHOL_STEP = 0.5
const ALCOHOL_MAX = 20

type CheckinDraft = {
  wellbeing?: number
  energy?: number
  mood?: number
  digestion?: number
  sleepMinutes?: number
  sleepQuality?: number
  alcoholUnits?: number
}

function draftFromCheckin(checkin: ClientCheckin | null): CheckinDraft {
  return {
    wellbeing: checkin?.wellbeing,
    energy: checkin?.energy,
    mood: checkin?.mood,
    digestion: checkin?.digestion,
    sleepMinutes: checkin?.sleepMinutes,
    sleepQuality: checkin?.sleepQuality,
    alcoholUnits: checkin?.alcoholUnits,
  }
}

export function ClientCheckinCard({ date }: { date: string }) {
  const [draft, setDraft] = useState<CheckinDraft>({})
  const [preferences, setPreferences] = useState<ClientMetricPreferences | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // Merged rather than queued: tapping 6 and then 7 must write 7 once, not
  // both in order.
  const pendingRef = useRef<ClientCheckinPatch>({})
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [checkin, preferenceRows] = await Promise.allSettled([
        fetchClientCheckin(date),
        fetchClientMetricPreferences(),
      ])
      if (cancelled) return

      if (checkin.status === "fulfilled") setDraft(draftFromCheckin(checkin.value))
      setPreferences(
        resolveClientMetricPreferences(
          preferenceRows.status === "fulfilled" ? preferenceRows.value : [],
        ),
      )
      // Opened when it already has content, so a filled sub-score is never
      // hidden behind a fold the client has to remember to open.
      if (checkin.status === "fulfilled" && checkin.value) {
        const value = checkin.value
        if (value.energy || value.mood || value.digestion) setShowDetail(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [date])

  const flush = useCallback(async () => {
    const patch = pendingRef.current
    pendingRef.current = {}
    if (Object.keys(patch).length === 0) return

    try {
      await saveClientCheckin(date, patch)
    } catch (error) {
      // Deliberately quiet: a failed autosave of a mood score is not worth a
      // toast interrupting the diary. The next tap writes the same value again.
      console.error("Failed to save check-in:", error)
    }
  }, [date])

  // A pending write must not be lost when the day is switched or the page is
  // left, which with a debounce is otherwise exactly what happens.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      void flush()
    }
  }, [flush])

  const queue = useCallback(
    (patch: ClientCheckinPatch) => {
      pendingRef.current = { ...pendingRef.current, ...patch }
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        void flush()
      }, SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  const setScore = useCallback(
    (key: keyof CheckinDraft, column: keyof ClientCheckinPatch, value: number | undefined) => {
      setDraft((previous) => ({ ...previous, [key]: value }))
      queue({ [column]: value ?? null } as ClientCheckinPatch)
    },
    [queue],
  )

  const tracked = useMemo(() => {
    if (!preferences) return new Set<ClientMetricKey>()
    return new Set(
      CHECKIN_METRICS.filter((metric) => clientMetricPreference(preferences, metric.key).tracked).map(
        (metric) => metric.key,
      ),
    )
  }, [preferences])

  // Nothing is rendered before the preferences are known: fields appearing one
  // after another under a thumb is worse than a beat of nothing.
  if (!preferences) return null

  const showsSleep = tracked.has("sleep_minutes") || tracked.has("sleep_quality")
  const showsDetail =
    tracked.has("energy") || tracked.has("mood") || tracked.has("digestion")
  const nightLabel = format(parseISO(date), "EEEE, d.M.", { locale: de })

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        {showsSleep && (
          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Nacht auf {nightLabel}</p>

            {tracked.has("sleep_minutes") && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">Schlaf</span>
                  <span className="text-sm font-medium tabular-nums">
                    {draft.sleepMinutes === undefined
                      ? "–"
                      : formatSleepDuration(draft.sleepMinutes)}
                  </span>
                </div>
                <Slider
                  aria-label="Schlafdauer"
                  min={0}
                  max={SLEEP_MAX_MIN}
                  step={SLEEP_STEP_MIN}
                  value={[draft.sleepMinutes ?? 7 * 60]}
                  onValueChange={([value]) =>
                    setDraft((previous) => ({ ...previous, sleepMinutes: value }))
                  }
                  onValueCommit={([value]) => setScore("sleepMinutes", "sleepMinutes", value)}
                />
              </div>
            )}

            {tracked.has("sleep_quality") && (
              <ScoreRow
                label="Schlafqualität"
                max={5}
                value={draft.sleepQuality}
                onChange={(value) => setScore("sleepQuality", "sleepQuality", value)}
              />
            )}
          </section>
        )}

        <section className="space-y-3">
          <ScoreRow
            label="Wie ging es dir heute?"
            max={10}
            value={draft.wellbeing}
            onChange={(value) => setScore("wellbeing", "wellbeing", value)}
            emphasized
          />

          {showsDetail && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground"
                aria-expanded={showDetail}
                onClick={() => setShowDetail((open) => !open)}
              >
                Genauer
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", showDetail && "rotate-180")}
                  aria-hidden
                />
              </button>

              {showDetail && (
                <div className="mt-2 space-y-2">
                  {tracked.has("energy") && (
                    <ScoreRow
                      label="Energie"
                      max={5}
                      value={draft.energy}
                      onChange={(value) => setScore("energy", "energy", value)}
                    />
                  )}
                  {tracked.has("mood") && (
                    <ScoreRow
                      label="Stimmung"
                      max={5}
                      value={draft.mood}
                      onChange={(value) => setScore("mood", "mood", value)}
                    />
                  )}
                  {tracked.has("digestion") && (
                    <ScoreRow
                      label="Verdauung"
                      max={5}
                      value={draft.digestion}
                      onChange={(value) => setScore("digestion", "digestion", value)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {tracked.has("alcohol_units") && (
            <AlcoholRow
              value={draft.alcoholUnits}
              onChange={(value) => setScore("alcoholUnits", "alcoholUnits", value)}
            />
          )}
        </section>

        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
          <Link href="/klient/einstellungen">
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Weitere Felder
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * A scale as buttons rather than a slider: one tap, one value, and the value
 * you picked stays readable afterwards. Tapping the active step again clears
 * it — an answer given by accident has to be revocable, and "unanswered" is a
 * state the data model takes seriously.
 */
function ScoreRow({
  label,
  max,
  value,
  onChange,
  emphasized,
}: {
  label: string
  max: number
  value?: number
  onChange: (value: number | undefined) => void
  emphasized?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <p className={cn("text-sm", emphasized ? "font-medium" : "text-muted-foreground")}>{label}</p>
      <div className="flex gap-1" role="group" aria-label={label}>
        {Array.from({ length: max }, (_, index) => index + 1).map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${label}: ${step} von ${max}`}
            aria-pressed={value === step}
            onClick={() => onChange(value === step ? undefined : step)}
            className={cn(
              "h-9 flex-1 rounded-md border text-sm tabular-nums transition-colors",
              value === step
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Standardgläser, in half steps. A quantity — never converted to calories. */
function AlcoholRow({
  value,
  onChange,
}: {
  value?: number
  onChange: (value: number | undefined) => void
}) {
  const current = value ?? 0

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm">Alkohol</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {value === undefined
            ? "nicht angegeben"
            : `${current.toFixed(1).replace(".", ",")} ${current === 1 ? "Glas" : "Gläser"}`}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label="Weniger Alkohol"
        disabled={value === undefined || current <= 0}
        onClick={() => onChange(Math.max(0, current - ALCOHOL_STEP))}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Mehr Alkohol"
        onClick={() => onChange(Math.min(ALCOHOL_MAX, current + ALCOHOL_STEP))}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
