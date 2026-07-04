"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity as ActivityIcon,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Droplets,
  Flame,
  Minus,
  PersonStanding,
  Scale,
  Target,
} from "lucide-react"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatNumber } from "@/lib/format"
import type { ActivityEntry, AnthropometricEntry, CounselingSession, Patient } from "@/lib/types"

interface PatientStatsTabProps {
  patient: Patient
  entries: AnthropometricEntry[]
  activities: ActivityEntry[]
  sessions: CounselingSession[]
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string; unit?: string }>
  label?: string | number
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const title = typeof label === "number" ? formatDate(new Date(label)) : label
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{title}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm text-muted-foreground">
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatNumber(entry.value ?? 0, 1)}
          {entry.unit ? ` ${entry.unit}` : ""}
        </p>
      ))}
    </div>
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

const TIME_RANGES = [
  { value: "all", label: "Gesamtverlauf", days: null },
  { value: "5y", label: "5 Jahre", days: 365 * 5 },
  { value: "1y", label: "1 Jahr", days: 365 },
  { value: "6m", label: "6 Monate", days: 183 },
  { value: "3m", label: "3 Monate", days: 92 },
  { value: "30d", label: "30 Tage", days: 30 },
] as const

type TimeRangeValue = (typeof TIME_RANGES)[number]["value"]

const BODY_COMPOSITION_METRICS = [
  { key: "bodyFatPercentage", label: "Körperfett", unit: "%", decimals: 1, color: "var(--color-chart-3)" },
  { key: "subcutaneousFatPercentage", label: "Unterhautfett", unit: "%", decimals: 1, color: "var(--color-chart-4)" },
  { key: "visceralFatRating", label: "Viszerales Fett", unit: "", decimals: 1, color: "var(--color-chart-5)" },
  { key: "bodyWaterPercentage", label: "Körperwasser", unit: "%", decimals: 1, color: "var(--color-chart-1)" },
  { key: "muscleMassKg", label: "Muskelmasse", unit: "kg", decimals: 1, color: "var(--color-chart-2)" },
  { key: "skeletalMusclePercentage", label: "Skelettmuskeln", unit: "%", decimals: 1, color: "var(--color-chart-3)" },
  { key: "fatFreeMassKg", label: "Fettfreie Masse", unit: "kg", decimals: 1, color: "var(--color-chart-4)" },
  { key: "boneMassKg", label: "Knochenmasse", unit: "kg", decimals: 2, color: "var(--color-chart-5)" },
  { key: "proteinPercentage", label: "Protein", unit: "%", decimals: 1, color: "var(--color-chart-1)" },
  { key: "bmrKcal", label: "BMR", unit: "kcal", decimals: 0, color: "var(--color-chart-2)" },
  { key: "metabolicAgeYears", label: "Metabolisches Alter", unit: "Jahre", decimals: 0, color: "var(--color-chart-3)" },
] as const satisfies ReadonlyArray<{
  key: keyof AnthropometricEntry
  label: string
  unit: string
  decimals: number
  color: string
}>

type BodyCompositionMetricKey = (typeof BODY_COMPOSITION_METRICS)[number]["key"]

function getTimestamp(date: string): number {
  return parseISO(date).getTime()
}

function formatAxisDate(value: number | string): string {
  const timestamp = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(timestamp)) return ""
  return formatDate(new Date(timestamp))
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Untergewicht"
  if (bmi < 25) return "Normalgewicht"
  if (bmi < 30) return "Übergewicht"
  return "Adipositas"
}

function DeltaBadge({ delta, unit }: { delta: number; unit: string }) {
  const rounded = Math.round(delta * 10) / 10
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {rounded > 0 ? "+" : ""}
      {formatNumber(rounded, 1)} {unit}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: typeof Scale
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: "var(--color-chart-1)" }}
      />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
        <div className="mt-1 min-h-[20px]">{children}</div>
      </CardContent>
    </Card>
  )
}

export function PatientStatsTab({ patient, entries, activities, sessions }: PatientStatsTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeValue>("all")
  // Mount-stable timestamp: Date.now() inside useMemo is impure.
  const [nowTs] = useState(() => Date.now())
  const [bodyMetricKey, setBodyMetricKey] = useState<BodyCompositionMetricKey>("bodyFatPercentage")

  const sorted = useMemo(
    () => [...entries].sort((a, b) => getTimestamp(a.date) - getTimestamp(b.date)),
    [entries],
  )

  const allLatest = sorted[sorted.length - 1] ?? null
  const selectedRange = TIME_RANGES.find((range) => range.value === timeRange) ?? TIME_RANGES[0]

  const filtered = useMemo(() => {
    if (!allLatest || selectedRange.days == null) return sorted
    const cutoff = getTimestamp(allLatest.date) - selectedRange.days * DAY_MS
    return sorted.filter((entry) => getTimestamp(entry.date) >= cutoff)
  }, [allLatest, selectedRange.days, sorted])

  const first = filtered[0] ?? null
  const latest = filtered[filtered.length - 1] ?? null

  const weightData = useMemo(
    () =>
      filtered.map((e) => ({
        timestamp: getTimestamp(e.date),
        date: formatDate(e.date),
        weight: e.weight,
        bmi: e.bmi,
      })),
    [filtered],
  )

  const availableBodyMetrics = useMemo(
    () =>
      BODY_COMPOSITION_METRICS.filter((metric) =>
        filtered.some((entry) => typeof entry[metric.key] === "number"),
      ),
    [filtered],
  )

  const selectedBodyMetric =
    availableBodyMetrics.find((metric) => metric.key === bodyMetricKey) ??
    availableBodyMetrics[0] ??
    BODY_COMPOSITION_METRICS[0]

  const bodyCompositionData = useMemo(
    () =>
      filtered
        .filter((entry) => typeof entry[selectedBodyMetric.key] === "number")
        .map((entry) => ({
          timestamp: getTimestamp(entry.date),
          date: formatDate(entry.date),
          value: entry[selectedBodyMetric.key] as number,
        })),
    [filtered, selectedBodyMetric],
  )

  const timeDomain = useMemo<[number, number]>(() => {
    if (weightData.length === 0) {
      return [nowTs - DAY_MS, nowTs + DAY_MS]
    }
    const min = weightData[0].timestamp
    const max = weightData[weightData.length - 1].timestamp
    if (min === max) return [min - DAY_MS, max + DAY_MS]
    return [min, max]
  }, [weightData, nowTs])

  const activityData = useMemo(
    () =>
      [...activities]
        .filter((activity) => {
          if (!allLatest || selectedRange.days == null) return true
          const cutoff = getTimestamp(allLatest.date) - selectedRange.days * DAY_MS
          return getTimestamp(activity.date) >= cutoff
        })
        .sort((a, b) => getTimestamp(a.date) - getTimestamp(b.date))
        .slice(-8)
        .map((a) => ({
          date: formatDate(a.date),
          energie: Math.round(a.energyKcal ?? a.durationMinutes * 4.5),
        })),
    [activities, allLatest, selectedRange.days],
  )

  const weightDelta = first && latest ? latest.weight - first.weight : 0
  const bmiDelta = first && latest ? latest.bmi - first.bmi : 0
  const spanDays = first && latest ? Math.abs(differenceInCalendarDays(parseISO(latest.date), parseISO(first.date))) : 0
  const spanWeeks = spanDays > 0 ? spanDays / 7 : 0
  const perWeek = spanWeeks > 0 ? weightDelta / spanWeeks : 0
  const sessionsInRange = useMemo(() => {
    if (!allLatest || selectedRange.days == null) return sessions
    const cutoff = getTimestamp(allLatest.date) - selectedRange.days * DAY_MS
    return sessions.filter((session) => getTimestamp(session.date) >= cutoff)
  }, [allLatest, selectedRange.days, sessions])

  const bodyCompositionLatest = useMemo(() => {
    if (!latest) return []

    return [
      {
        icon: Target,
        label: "Körperfett",
        value:
          latest.bodyFatPercentage != null
            ? `${formatNumber(latest.bodyFatPercentage, 1)} %`
            : null,
      },
      {
        icon: PersonStanding,
        label: "Muskelmasse",
        value: latest.muscleMassKg != null ? `${formatNumber(latest.muscleMassKg, 1)} kg` : null,
      },
      {
        icon: Droplets,
        label: "Körperwasser",
        value:
          latest.bodyWaterPercentage != null
            ? `${formatNumber(latest.bodyWaterPercentage, 1)} %`
            : null,
      },
      {
        icon: Flame,
        label: "BMR",
        value: latest.bmrKcal != null ? `${formatNumber(latest.bmrKcal, 0)} kcal` : null,
      },
    ].filter((item): item is { icon: typeof Scale; label: string; value: string } => item.value != null)
  }, [latest])

  if (!allLatest) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Scale className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium">Noch keine Statistiken verfügbar</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sobald Messwerte für {patient.firstName} erfasst sind, erscheinen hier Gewichts- und Verlaufsanalysen.
          </p>
        </CardContent>
      </Card>
    )
  }

  const goalWeight = patient.goalWeight
  const goalRemaining = goalWeight != null && latest ? latest.weight - goalWeight : null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Zeitraum</p>
          <p className="text-sm text-muted-foreground">
            Punkte werden nach echtem Messdatum auf der Zeitachse positioniert.
          </p>
        </div>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRangeValue)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!latest ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarRange className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium">Keine Messungen im gewählten Zeitraum</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Wählen Sie einen längeren Zeitraum, um den Verlauf von {patient.firstName} zu sehen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Scale} label="Aktuelles Gewicht" value={`${formatNumber(latest.weight, 1)} kg`}>
              {filtered.length > 1 ? (
                <DeltaBadge delta={weightDelta} unit="kg" />
              ) : (
                <span className="text-xs text-muted-foreground">Stand {formatDate(latest.date)}</span>
              )}
            </StatCard>
            <StatCard icon={Target} label="BMI" value={formatNumber(latest.bmi, 1)}>
              <span className="text-xs text-muted-foreground">
                {bmiCategory(latest.bmi)}
                {filtered.length > 1 ? (
                  <>
                    {" · "}
                    {bmiDelta > 0 ? "+" : ""}
                    {formatNumber(bmiDelta, 1)}
                  </>
                ) : null}
              </span>
            </StatCard>
            <StatCard
              icon={ActivityIcon}
              label="Ø Trend / Woche"
              value={`${perWeek > 0 ? "+" : ""}${formatNumber(perWeek, 1)} kg`}
            >
              <span className="text-xs text-muted-foreground">
                {goalRemaining != null
                  ? `Noch ${formatNumber(Math.abs(goalRemaining), 1)} kg bis Ziel`
                  : spanWeeks >= 1
                    ? `über ${formatNumber(spanWeeks, 0)} Wochen`
                    : "über < 1 Woche"}
              </span>
            </StatCard>
            <StatCard icon={CalendarRange} label="Zeitraum" value={`${filtered.length} Messungen`}>
              <span className="text-xs text-muted-foreground">
                {sessionsInRange.length} Beratungen · {spanDays > 0 ? `${spanDays} Tage` : "1 Tag"}
              </span>
            </StatCard>
          </div>

          {bodyCompositionLatest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {bodyCompositionLatest.map((metric) => (
                <StatCard key={metric.label} icon={metric.icon} label={metric.label} value={metric.value}>
                  <span className="text-xs text-muted-foreground">Stand {formatDate(latest.date)}</span>
                </StatCard>
              ))}
            </div>
          )}

      <Card>
        <CardHeader>
          <CardTitle>Gewichtsverlauf</CardTitle>
          <CardDescription>
            {filtered.length > 1
              ? `${formatDate(first!.date)} – ${formatDate(latest.date)}`
              : "Sobald weitere Messungen vorliegen, entsteht ein Trend."}
            {goalWeight != null && (
              <Badge variant="outline" className="ml-2 align-middle">
                Ziel {formatNumber(goalWeight, 1)} kg
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={weightData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="statsWeightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={timeDomain}
                tick={{ fontSize: 12 }}
                tickFormatter={formatAxisDate}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={["dataMin - 2", "dataMax + 2"]}
                unit=" kg"
              />
              <Tooltip content={<ChartTooltip />} />
              {goalWeight != null && (
                <ReferenceLine
                  y={goalWeight}
                  stroke="var(--color-chart-4)"
                  strokeDasharray="4 4"
                  label={{ value: "Ziel", position: "right", fontSize: 11, fill: "var(--color-chart-4)" }}
                />
              )}
              <Area
                type="monotone"
                connectNulls
                dataKey="weight"
                name="Gewicht"
                unit="kg"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                fill="url(#statsWeightFill)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>BMI-Verlauf</CardTitle>
            <CardDescription>Body-Mass-Index über die erfassten Messungen.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={weightData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="statsBmiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={timeDomain}
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatAxisDate}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  domain={["dataMin - 1", "dataMax + 1"]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  connectNulls
                  dataKey="bmi"
                  name="BMI"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2.5}
                  fill="url(#statsBmiFill)"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {availableBodyMetrics.length > 0 && (
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Körperzusammensetzung</CardTitle>
                <CardDescription>BIA-/Smart-Scale-Messwerte über den gewählten Zeitraum.</CardDescription>
              </div>
              <Select
                value={selectedBodyMetric.key}
                onValueChange={(value) => setBodyMetricKey(value as BodyCompositionMetricKey)}
              >
                <SelectTrigger className="w-full sm:w-[210px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableBodyMetrics.map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={bodyCompositionData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statsBodyCompositionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={selectedBodyMetric.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={selectedBodyMetric.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={timeDomain}
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatAxisDate}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    unit={selectedBodyMetric.unit ? ` ${selectedBodyMetric.unit}` : undefined}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    connectNulls
                    dataKey="value"
                    name={selectedBodyMetric.label}
                    unit={selectedBodyMetric.unit}
                    stroke={selectedBodyMetric.color}
                    strokeWidth={2.5}
                    fill="url(#statsBodyCompositionFill)"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Aktivitätsenergie</CardTitle>
            <CardDescription>Geschätzter Energieverbrauch der letzten Einheiten.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={activityData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} unit=" kcal" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="energie" name="Energie" unit="kcal" radius={[6, 6, 0, 0]}>
                    {activityData.map((entry) => (
                      <Cell key={entry.date} fill="var(--color-chart-5)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Flame className="h-5 w-5" />
                </span>
                <p className="text-sm text-muted-foreground">Noch keine Aktivitäten erfasst.</p>
              </div>
            )}
          </CardContent>
          </Card>
        </div>
        </>
      )}
    </div>
  )
}
