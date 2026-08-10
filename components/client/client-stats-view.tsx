"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Loader2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { todayIsoDate } from "@/lib/client-mode"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { formatSet } from "@/lib/client-training"
import { PatientStatsTab } from "@/components/patient-stats-tab"
import { CLIENT_STATS_WINDOW_DAYS } from "@/lib/client-stats"
import { fetchClientStats, type ClientStats } from "@/lib/data/client-stats-client"
import {
  fetchClientPatientHistory,
  type ClientPatientHistory,
} from "@/lib/data/client-history-client"

/**
 * Colors come from the app's chart tokens, in fixed order, never cycled. The
 * green/blue/red steps were validated for colorblind separation against the
 * card surface; the violet step sits too close to the blue one under deutan
 * vision, so it is deliberately skipped here.
 */
const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-5)"]

/** More lines than this stops being a chart and starts being a hairball. */
const MAX_EXERCISES = 3

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
} as const

/**
 * Strength is a level, not a quantity: an eight-kilo gain plotted from zero is
 * a flat line. Lines carry no area and so no obligation to a zero baseline —
 * pad the observed range instead. Bars keep their zero.
 */
const PADDED_DOMAIN = [
  (min: number) => Math.max(0, Math.floor(min - Math.max(2, Math.abs(min) * 0.08))),
  (max: number) => Math.ceil(max + Math.max(2, Math.abs(max) * 0.08)),
] as const

interface TooltipEntry {
  name?: string
  value?: number
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-sm text-muted-foreground">
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {entry.value ?? 0}
          {unit ? ` ${unit}` : ""}
        </p>
      ))}
    </div>
  )
}

function shortDate(iso: string) {
  return format(parseISO(iso), "d.M.", { locale: de })
}

export function ClientStatsView({ clientUserId }: { clientUserId: string | null }) {
  const [stats, setStats] = useState<ClientStats | null>(null)
  const [history, setHistory] = useState<ClientPatientHistory | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientUserId) {
      setIsLoading(false)
      return
    }
    try {
      // Both sides of the picture, but independently: the measurement history
      // only exists when a counselor keeps one, and its absence must not stop
      // the client's own numbers from rendering.
      const [ownStats, patientHistory] = await Promise.allSettled([
        fetchClientStats(clientUserId, todayIsoDate()),
        fetchClientPatientHistory(),
      ])

      if (ownStats.status === "fulfilled") setStats(ownStats.value)
      else console.error("Failed to load client stats:", ownStats.reason)

      if (patientHistory.status === "fulfilled") setHistory(patientHistory.value)
      else console.error("Failed to load patient history:", patientHistory.reason)
    } finally {
      setIsLoading(false)
    }
  }, [clientUserId])

  useEffect(() => {
    void load()
  }, [load])

  if (!clientUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anmeldung erforderlich</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Melde dich an, um deinen Verlauf zu sehen.
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verlauf wird geladen
      </p>
    )
  }

  const burnedByDate = new Map((stats?.burnedByDay ?? []).map((day) => [day.date, day.kcal]))
  const kcalData = (stats?.kcalByDay ?? []).map((day) => ({
    label: shortDate(day.date),
    kcal: day.kcal,
    verbrannt: burnedByDate.get(day.date) ?? 0,
  }))
  const hasKcal = kcalData.some((day) => day.kcal > 0)
  // Only drawn once there is something to draw: an all-zero series next to the
  // food would read as "you burned nothing", when it means "no duration logged".
  const hasBurned = kcalData.some((day) => day.verbrannt > 0)

  const adherenceData = (stats?.adherence ?? []).map((day) => ({
    label: shortDate(day.date),
    gegessen: day.completed,
    ausgelassen: day.skipped,
    offen: Math.max(0, day.planned - day.completed - day.skipped),
  }))
  const hasAdherence = adherenceData.some(
    (day) => day.gegessen + day.ausgelassen + day.offen > 0,
  )

  const exercises = (stats?.progress ?? []).slice(0, MAX_EXERCISES)
  // Bodyweight exercises have no 1RM to plot. Leaving them in would put a name
  // and a colour in the legend with no line under it — they keep their place in
  // the text list below, which can say "8 Wdh." where the chart cannot.
  const plottedExercises = exercises.filter((exercise) =>
    exercise.points.some((point) => point.bestOneRepMaxKg !== undefined),
  )
  const weeks = [
    ...new Set(plottedExercises.flatMap((exercise) => exercise.points.map((p) => p.weekStart))),
  ].sort()
  const trainingData = weeks.map((weekStart) => {
    const row: Record<string, string | number> = {
      label: `KW ${format(parseISO(weekStart), "I", { locale: de })}`,
    }
    for (const exercise of plottedExercises) {
      const point = exercise.points.find((p) => p.weekStart === weekStart)
      // Estimated 1RM rather than the heaviest set, so more reps at the same
      // weight reads as progress instead of a flat line. Bodyweight exercises
      // have no weight to estimate from and stay absent rather than zero.
      if (point?.bestOneRepMaxKg !== undefined)
        row[exercise.exerciseName] = point.bestOneRepMaxKg
    }
    return row
  })
  const hasTraining = trainingData.length > 1

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Verlauf</h1>

      {/* The measurement history your counselor keeps — the same charts they
          see, over the whole record rather than a fixed window. */}
      {history?.patient && history.measurements.length > 0 && (
        <PatientStatsTab
          patient={history.patient}
          entries={history.measurements}
          activities={history.activities}
          sessions={[]}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Kalorien je Tag</CardTitle>
          <CardDescription>
            {hasKcal
              ? `Letzte ${CLIENT_STATS_WINDOW_DAYS} Tage · Ø ${stats?.averageKcal} kcal an Tagen mit Einträgen`
              : `Letzte ${CLIENT_STATS_WINDOW_DAYS} Tage`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Training alone is enough to draw the chart: someone who logs
              workouts but no food should not be told there is nothing here. */}
          {!hasKcal && !hasBurned ? (
            <p className="text-sm text-muted-foreground">
              Sobald du etwas ins Tagebuch einträgst, siehst du hier deinen Verlauf.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              {/* Right margin leaves room for the average line's label. */}
              <BarChart data={kcalData} margin={{ top: 8, right: 24, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                  content={<ChartTooltip unit="kcal" />}
                />
                {(stats?.averageKcal ?? 0) > 0 && (
                  <ReferenceLine
                    y={stats?.averageKcal}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: "Ø",
                      position: "right",
                      fontSize: 11,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                )}
                {hasBurned && <Legend wrapperStyle={{ fontSize: 12 }} />}
                <Bar
                  dataKey="kcal"
                  name="Gegessen"
                  fill={SERIES_COLORS[0]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={hasBurned ? 14 : 22}
                />
                {/* Side by side, never stacked and never subtracted: these are
                    two different measurements of two different things, and only
                    one of them was actually counted rather than estimated. */}
                {hasBurned && (
                  <Bar
                    dataKey="verbrannt"
                    name="Training (geschätzt)"
                    fill={SERIES_COLORS[1]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}

          {hasBurned && (
            <p className="mt-2 text-xs text-muted-foreground">
              Der Trainingswert ist eine Schätzung aus Art, Dauer und Körpergewicht — er zeigt, was
              zusätzlich zum Grundumsatz verbraucht wurde, und wird nicht von deinen Kalorien
              abgezogen.
            </p>
          )}
        </CardContent>
      </Card>

      {isClientModuleEnabled("plan") && hasAdherence && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan-Treue</CardTitle>
            <CardDescription>
              Abgehakte Mahlzeiten je Tag. „Offen“ heißt weder gegessen noch ausgelassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={adherenceData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
                <YAxis allowDecimals={false} {...AXIS_PROPS} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                  content={<ChartTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {/* 2px surface gap between stacked segments keeps them readable. */}
                <Bar
                  dataKey="gegessen"
                  stackId="plan"
                  fill={SERIES_COLORS[0]}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="ausgelassen"
                  stackId="plan"
                  fill={SERIES_COLORS[2]}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="offen"
                  stackId="plan"
                  fill="var(--color-muted-foreground)"
                  fillOpacity={0.35}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isClientModuleEnabled("training") && exercises.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Training</CardTitle>
            <CardDescription>
              Geschätztes Einer-Maximum je Übung und Kalenderwoche
              {exercises.length === MAX_EXERCISES ? " · deine drei häufigsten Übungen" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasTraining ? (
              <ResponsiveContainer width="100%" height={200}>
                {/* No negative left margin here: the axis carries a unit, and
                    pulling it out of the frame clipped the leading digit. */}
                <LineChart data={trainingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                  <XAxis dataKey="label" {...AXIS_PROPS} />
                  <YAxis unit=" kg" width={60} domain={[...PADDED_DOMAIN]} {...AXIS_PROPS} />
                  <Tooltip content={<ChartTooltip unit="kg" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {plottedExercises.map((exercise, index) => (
                    <Line
                      key={exercise.exerciseName}
                      type="monotone"
                      dataKey={exercise.exerciseName}
                      stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                      strokeWidth={2}
                      // The fill has to be named: recharts defaults a Line's
                      // dots to white, which on a light card makes a series
                      // with a single week invisible.
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "var(--color-card)",
                        fill: SERIES_COLORS[index % SERIES_COLORS.length],
                      }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ab der zweiten Trainingswoche zeichnet sich hier eine Kurve ab.
              </p>
            )}

            {/* The same numbers in text: a chart is not the only way to read them. */}
            <ul className="space-y-1">
              {exercises.map((exercise) => {
                const last = exercise.points[exercise.points.length - 1]
                return (
                  <li key={exercise.exerciseName} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{exercise.exerciseName}</span>
                    {last ? ` · zuletzt ${formatSet(last.bestReps, last.bestWeightKg)}` : ""}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
