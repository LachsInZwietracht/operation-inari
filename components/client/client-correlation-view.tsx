"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { addDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  compareClientMetrics,
  MAX_SHIFT_DAYS,
  MIN_PAIRED_DAYS,
  metricsWithData,
  type ClientDayFactRow,
} from "@/lib/client-checkin"
import {
  formatMetricValue,
  getClientMetric,
  isClientMetricKey,
  metricAxisLabel,
  metricChartValue,
  shownClientMetrics,
  type ClientMetric,
  type ClientMetricKey,
  type ClientMetricPreferences,
} from "@/lib/client-metrics"

/**
 * Two of your own series, next to each other.
 *
 * The whole surface is deliberately passive. It compares the pair it was
 * asked to compare, at the offset it was asked for, and says nothing about
 * what that means. It does not scan pairs, does not rank them, does not mark a
 * "best" shift and does not use the word significant — with roughly a hundred
 * possible pairs and seven offsets each, something always looks strong at
 * n=28, and an app that pointed at it would be manufacturing beliefs rather
 * than showing data. The reading happens with a counselor; this is the tool
 * that makes the reading possible.
 *
 * Two things keep the arithmetic honest and both are visible in the UI: a
 * comparison below fourteen paired days states nothing at all, and a bucket
 * with fewer than three days keeps its row but not its number.
 */

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
} as const

/**
 * Lines carry no area and so no obligation to a zero baseline — a mood that
 * moves between 6 and 8 plotted from zero is a flat line. Same helper the
 * strength charts use, for the same reason.
 */
const PADDED_DOMAIN = [
  (min: number) => Math.max(0, Math.floor(min - Math.max(1, Math.abs(min) * 0.08))),
  (max: number) => Math.ceil(max + Math.max(1, Math.abs(max) * 0.08)),
] as const

const STORAGE_KEY = "prodi:client:correlation-pair"

function shortDate(iso: string) {
  return format(parseISO(iso), "d.M.", { locale: de })
}

/** How the chosen offset reads as a sentence, rather than as a number. */
function shiftLabel(x: ClientMetric, y: ClientMetric, shift: number): string {
  const xLabel = x.shortLabel ?? x.label
  const yLabel = y.shortLabel ?? y.label
  if (shift === 0) return `${xLabel} → ${yLabel}, am selben Tag`
  if (shift > 0) {
    return `${xLabel}, ${shift} ${shift === 1 ? "Tag" : "Tage"} vorher → ${yLabel}`
  }
  return `${xLabel}, ${-shift} ${shift === -1 ? "Tag" : "Tage"} später → ${yLabel}`
}

export function ClientCorrelationView({
  rows,
  preferences,
  windowDays,
}: {
  rows: ClientDayFactRow[]
  preferences: ClientMetricPreferences
  windowDays: number
}) {
  const available = useMemo(() => {
    const withData = metricsWithData(rows)
    return shownClientMetrics(preferences).filter((metric) => withData.has(metric.key))
  }, [preferences, rows])

  const [xKey, setXKey] = useState<ClientMetricKey | null>(null)
  const [yKey, setYKey] = useState<ClientMetricKey | null>(null)
  const [shift, setShift] = useState(0)

  // The last pair, remembered where a preference like this belongs: nowhere
  // near the database.
  useEffect(() => {
    if (available.length < 2) return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const [storedX, storedY] = stored?.split("|") ?? []
    const isUsable = (key?: string) =>
      key && isClientMetricKey(key) && available.some((metric) => metric.key === key)

    setXKey((current) =>
      current ?? (isUsable(storedX) ? (storedX as ClientMetricKey) : available[0].key),
    )
    setYKey((current) =>
      current ?? (isUsable(storedY) ? (storedY as ClientMetricKey) : available[1].key),
    )
  }, [available])

  useEffect(() => {
    if (xKey && yKey) window.localStorage.setItem(STORAGE_KEY, `${xKey}|${yKey}`)
  }, [xKey, yKey])

  if (available.length < 2) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Sobald zwei Dinge über mehrere Tage zusammenkommen — zum Beispiel deine Energie und
          dein Schlaf — kannst du sie hier nebeneinanderlegen.
        </CardContent>
      </Card>
    )
  }

  if (!xKey || !yKey) return null

  const xMetric = getClientMetric(xKey)
  const yMetric = getClientMetric(yKey)
  const comparison = compareClientMetrics({ rows, xKey, yKey, shiftDays: shift })

  // Drawn at the date it is compared against, which is what makes an offset
  // visible instead of merely applied.
  const byDate = new Map(rows.map((row) => [row.date, row.facts]))
  const chartData = rows.map((row) => {
    const shiftedDate = format(addDays(parseISO(row.date), -shift), "yyyy-MM-dd")
    const xValue = byDate.get(shiftedDate)?.[xKey]
    const yValue = row.facts[yKey]
    return {
      label: shortDate(row.date),
      x: xValue === undefined ? null : metricChartValue(xMetric, xValue),
      y: yValue === undefined ? null : metricChartValue(yMetric, yValue),
    }
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Zusammenhänge</CardTitle>
        <CardDescription>{shiftLabel(xMetric, yMetric, shift)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="correlation-x" className="text-xs text-muted-foreground">
              Vergleiche
            </Label>
            <Select value={xKey} onValueChange={(value) => setXKey(value as ClientMetricKey)}>
              <SelectTrigger id="correlation-x">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((metric) => (
                  <SelectItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="correlation-y" className="text-xs text-muted-foreground">
              mit
            </Label>
            <Select value={yKey} onValueChange={(value) => setYKey(value as ClientMetricKey)}>
              <SelectTrigger id="correlation-y">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((metric) => (
                  <SelectItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!comparison.hasEnoughData ? (
          <p className="text-sm text-muted-foreground">
            Für diesen Vergleich brauchst du {MIN_PAIRED_DAYS} Tage, an denen beides eingetragen
            ist. Du hast {comparison.pairedDays}
            {comparison.pairedDays === 1 ? " Tag" : " Tage"} — noch{" "}
            {MIN_PAIRED_DAYS - comparison.pairedDays} zu gehen.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(280, chartData.length * 14) }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-border)"
                      strokeOpacity={0.6}
                    />
                    <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
                    {/* Two axes, both labelled with their unit and their own
                        range: any two series can be made to look aligned by
                        scaling, so the scales are stated rather than implied. */}
                    <YAxis
                      yAxisId="x"
                      domain={PADDED_DOMAIN}
                      width={38}
                      {...AXIS_PROPS}
                      label={{
                        value: metricAxisLabel(xMetric),
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10, fill: "var(--color-muted-foreground)" },
                      }}
                    />
                    <YAxis
                      yAxisId="y"
                      orientation="right"
                      domain={PADDED_DOMAIN}
                      width={38}
                      {...AXIS_PROPS}
                      label={{
                        value: metricAxisLabel(yMetric),
                        angle: 90,
                        position: "insideRight",
                        style: { fontSize: 10, fill: "var(--color-muted-foreground)" },
                      }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
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
                                {entry.name}: {String(entry.value).replace(".", ",")}
                              </p>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Line
                      yAxisId="x"
                      type="monotone"
                      dataKey="x"
                      name={xMetric.label}
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="y"
                      type="monotone"
                      dataKey="y"
                      name={yMetric.label}
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="correlation-shift" className="text-xs text-muted-foreground">
                  Versatz
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {shift === 0
                    ? "kein Versatz"
                    : `${shift > 0 ? "−" : "+"}${Math.abs(shift)} ${
                        Math.abs(shift) === 1 ? "Tag" : "Tage"
                      }`}
                </span>
              </div>
              <Slider
                id="correlation-shift"
                aria-label="Versatz in Tagen"
                min={-MAX_SHIFT_DAYS}
                max={MAX_SHIFT_DAYS}
                step={1}
                value={[shift]}
                onValueChange={([value]) => setShift(value)}
              />
            </div>

            <BucketTable comparison={comparison} yMetric={yMetric} windowDays={windowDays} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BucketTable({
  comparison,
  yMetric,
  windowDays,
}: {
  comparison: ReturnType<typeof compareClientMetrics>
  yMetric: ClientMetric
  windowDays: number
}) {
  const values = comparison.buckets
    .map((bucket) => bucket.average)
    .filter((average): average is number => average !== null)
  const max = Math.max(...values, 1)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {windowDays} Tage · {comparison.pairedDays} mit beiden Werten
      </p>

      {comparison.buckets.map((bucket) => (
        // The label is the row's identity here and in the tests: bucket edges
        // are what a reader checks a claim against.
        <div key={bucket.label} data-bucket={bucket.label} className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{bucket.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            {bucket.average !== null && (
              // One colour for every bucket: a green bar and a red bar would
              // be a judgement, and this surface does not make judgements.
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round((bucket.average / max) * 100)}%` }}
              />
            )}
          </div>
          <span className="w-20 shrink-0 text-right text-xs tabular-nums">
            {bucket.average === null ? (
              <span className="text-muted-foreground">zu wenige</span>
            ) : (
              formatMetricValue(yMetric, bucket.average)
            )}
          </span>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            n={bucket.count}
          </span>
        </div>
      ))}

      {/* Said under every comparison, not once at the top of the page. */}
      <p className="pt-1 text-xs text-muted-foreground">Zusammenhang, keine Ursache.</p>
    </div>
  )
}
