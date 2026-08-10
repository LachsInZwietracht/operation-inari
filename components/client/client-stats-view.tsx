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
import { CLIENT_STATS_WINDOW_DAYS } from "@/lib/client-stats"
import { fetchClientStats, type ClientStats } from "@/lib/data/client-stats-client"

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
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientUserId) {
      setIsLoading(false)
      return
    }
    try {
      setStats(await fetchClientStats(clientUserId, todayIsoDate()))
    } catch (error) {
      console.error("Failed to load client stats:", error)
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

  const kcalData = (stats?.kcalByDay ?? []).map((day) => ({
    label: shortDate(day.date),
    kcal: day.kcal,
  }))
  const hasKcal = kcalData.some((day) => day.kcal > 0)

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
  const weeks = [
    ...new Set(exercises.flatMap((exercise) => exercise.points.map((p) => p.weekStart))),
  ].sort()
  const trainingData = weeks.map((weekStart) => {
    const row: Record<string, string | number> = {
      label: `KW ${format(parseISO(weekStart), "I", { locale: de })}`,
    }
    for (const exercise of exercises) {
      const point = exercise.points.find((p) => p.weekStart === weekStart)
      // Weight is the axis; bodyweight exercises have none and stay absent
      // rather than being drawn as zero.
      if (point?.bestWeightKg !== undefined) row[exercise.exerciseName] = point.bestWeightKg
    }
    return row
  })
  const hasTraining = trainingData.length > 1

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Verlauf</h1>

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
          {!hasKcal ? (
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
                <Bar
                  dataKey="kcal"
                  name="Kalorien"
                  fill={SERIES_COLORS[0]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
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
              Bestes Gewicht je Übung und Kalenderwoche
              {exercises.length === MAX_EXERCISES ? " · deine drei häufigsten Übungen" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasTraining ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trainingData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                  <XAxis dataKey="label" {...AXIS_PROPS} />
                  <YAxis unit=" kg" width={52} {...AXIS_PROPS} />
                  <Tooltip content={<ChartTooltip unit="kg" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {exercises.map((exercise, index) => (
                    <Line
                      key={exercise.exerciseName}
                      type="monotone"
                      dataKey={exercise.exerciseName}
                      stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
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
