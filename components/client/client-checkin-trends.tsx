"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CLIENT_CHECKIN_WINDOW_OPTIONS } from "@/lib/client-stats"
import type { ClientDayFactRow } from "@/lib/client-checkin"
import {
  formatMetricValue,
  metricChartValue,
  shownClientMetrics,
  type ClientMetric,
  type ClientMetricPreferences,
} from "@/lib/client-metrics"

/**
 * The check-in, drawn.
 *
 * Two rules do most of the work here, and both are about the empty days. A gap
 * is drawn as a gap — `connectNulls` stays off, so a line never bridges a week
 * nobody answered — and the stretch itself is shaded, so "no data" reads as
 * missing rather than as a low value. Everything else on this page already
 * works that way; a mood series that quietly interpolated would be the one
 * place the app invented a number about how someone felt.
 *
 * The day notes appear as thin vertical marks. An outlier with "Einladung bei
 * Freunden" written against it is explained; the same outlier without the mark
 * is noise, and a chart that hides the explanation invites the wrong reading.
 */

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
} as const

/** Enough width per day that eight weeks stay readable by scrolling. */
const MIN_WIDTH_PER_DAY = 14

function shortDate(iso: string) {
  return format(parseISO(iso), "d.M.", { locale: de })
}

export function ClientCheckinTrends({
  rows,
  notesByDate,
  preferences,
  windowDays,
  onWindowChange,
}: {
  rows: ClientDayFactRow[]
  notesByDate: Map<string, string>
  preferences: ClientMetricPreferences
  windowDays: number
  onWindowChange: (days: number) => void
}) {
  const metrics = useMemo(
    () =>
      shownClientMetrics(preferences).filter(
        (metric) =>
          metric.group === "befinden" &&
          rows.some((row) => row.facts[metric.key] !== undefined),
      ),
    [preferences, rows],
  )

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">Zeitraum</p>
        <div className="flex gap-1">
          {CLIENT_CHECKIN_WINDOW_OPTIONS.map((option) => (
            <Button
              key={option}
              variant={option === windowDays ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onWindowChange(option)}
            >
              {option} Tage
            </Button>
          ))}
        </div>
      </div>

      {metrics.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Sobald du im Tagebuch einträgst, wie ein Tag war, entsteht hier eine Kurve.
          </CardContent>
        </Card>
      ) : (
        metrics.map((metric) => (
          <MetricTrendCard
            key={metric.key}
            metric={metric}
            rows={rows}
            notesByDate={notesByDate}
            windowDays={windowDays}
          />
        ))
      )}
    </>
  )
}

function MetricTrendCard({
  metric,
  rows,
  notesByDate,
  windowDays,
}: {
  metric: ClientMetric
  rows: ClientDayFactRow[]
  notesByDate: Map<string, string>
  windowDays: number
}) {
  const data = rows.map((row) => {
    const raw = row.facts[metric.key]
    return {
      date: row.date,
      label: shortDate(row.date),
      value: raw === undefined ? null : metricChartValue(metric, raw),
      hasNote: notesByDate.has(row.date),
    }
  })

  const answered = data.filter((point) => point.value !== null)
  const average =
    answered.length > 0
      ? answered.reduce((sum, point) => sum + (point.value ?? 0), 0) / answered.length
      : 0

  // Consecutive unanswered days, so the shading is one band per stretch rather
  // than one per day.
  const gaps: { from: string; to: string }[] = []
  let openGap: { from: string; to: string } | null = null
  for (const point of data) {
    if (point.value === null) {
      openGap =
        openGap === null
          ? { from: point.label, to: point.label }
          : { from: openGap.from, to: point.label }
    } else if (openGap) {
      gaps.push(openGap)
      openGap = null
    }
  }
  if (openGap) gaps.push(openGap)

  const domain: [number, number] | undefined =
    metric.scale === "continuous" ? undefined : [metric.scale.min, metric.scale.max]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{metric.label}</CardTitle>
        <CardDescription>
          {answered.length === 0
            ? `Letzte ${windowDays} Tage`
            : `Letzte ${windowDays} Tage · Ø ${
                metric.key === "sleep_minutes"
                  ? `${average.toFixed(1).replace(".", ",")} h`
                  : formatMetricValue(metric, average)
              } an ${answered.length} ${answered.length === 1 ? "Tag" : "Tagen"} mit Angabe`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(280, data.length * MIN_WIDTH_PER_DAY) }}>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
                <YAxis domain={domain} {...AXIS_PROPS} />

                {gaps.map((gap) => (
                  <ReferenceArea
                    key={`${gap.from}-${gap.to}`}
                    x1={gap.from}
                    x2={gap.to}
                    fill="var(--color-muted-foreground)"
                    fillOpacity={0.08}
                  />
                ))}

                {data
                  .filter((point) => point.hasNote)
                  .map((point) => (
                    <ReferenceLine
                      key={point.date}
                      x={point.label}
                      stroke="var(--color-muted-foreground)"
                      strokeOpacity={0.5}
                      strokeDasharray="2 2"
                    />
                  ))}

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as (typeof data)[number]
                    if (point.value === null) return null
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          {metric.key === "sleep_minutes"
                            ? `${String(point.value).replace(".", ",")} h`
                            : formatMetricValue(metric, point.value)}
                        </p>
                        {notesByDate.get(point.date) && (
                          <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                            {notesByDate.get(point.date)}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  name={metric.label}
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  // Never bridged: a line drawn across four unanswered days is
                  // a claim about days nobody described.
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.some((point) => point.hasNote) && (
          <p className={cn("mt-2 text-xs text-muted-foreground")}>
            Gestrichelt: Tage mit einer Notiz im Tagebuch.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
