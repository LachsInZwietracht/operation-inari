"use client"

import { useState } from "react"
import { Info, Scale, TrendingDown, TrendingUp } from "lucide-react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { bmiCategory } from "@/lib/bmi"
import { formatDate, formatNumber } from "@/lib/format"
import type { WeightProjection } from "@/lib/nutrition/weight-projection"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000

/** How far ahead the dashed line is drawn. Weeks, because the projection is weekly. */
export const HORIZON_OPTIONS = [
  { value: "1", label: "1 M", weeks: 4, full: "Ein Monat" },
  { value: "3", label: "3 M", weeks: 13, full: "Drei Monate" },
  { value: "6", label: "6 M", weeks: 26, full: "Sechs Monate" },
] as const

export type HorizonValue = (typeof HORIZON_OPTIONS)[number]["value"]

export interface WeightPoint {
  ts: number
  weight: number
  bmi: number
}

interface ChartRow {
  ts: number
  weight?: number
  projected?: number
  /** Only on measured rows — the projection has no measured BMI to quote. */
  bmi?: number
}

interface PatientWeightChartProps {
  points: WeightPoint[]
  projection: WeightProjection | null
  /** Height of the latest measurement, in cm. Turns the right axis into a BMI scale. */
  heightCm?: number
  goalWeightKg?: number
  ageYears: number
  /** Date of birth, shown behind the age chip's info affordance. */
  dateOfBirth: string
  /** Date of the latest measurement, shown behind the weight's info affordance. */
  measuredOn?: string
  horizon: HorizonValue
  onHorizonChange: (value: HorizonValue) => void
  onAddMeasurement: () => void
}

/**
 * One fact stated as bare value plus unit, with everything else on hover.
 *
 * "180 cm" needs no label saying it is a height, and "aus letzter Messung"
 * under it is a sentence nobody reads twice. The provenance still matters
 * occasionally, so it lives one hover away instead of on the page forever.
 */
function FactChip({
  value,
  unit,
  title,
  detail,
  tone,
}: {
  value: string
  unit: string
  title: string
  detail: string
  /** Colours the info dot when the detail is worth noticing, e.g. a birthday. */
  tone?: "accent"
}) {
  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="group flex items-baseline gap-1 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-sm font-semibold tabular-nums">{value}</span>
          <span className="text-xs font-normal text-muted-foreground">{unit}</span>
          <Info
            className={cn(
              "size-3 self-center transition-colors",
              tone === "accent"
                ? "text-primary"
                : "text-muted-foreground/40 group-hover:text-muted-foreground",
            )}
            aria-hidden="true"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto max-w-64 py-2" side="bottom" align="end">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-sm">{detail}</p>
      </HoverCardContent>
    </HoverCard>
  )
}

interface TooltipEntry {
  value?: number
  dataKey?: string | number
  payload?: ChartRow
}

/**
 * Recharts paints its own tooltip white with inline styles, which is unreadable
 * in dark mode. This one is drawn on theme tokens, and answers both scales at
 * once: the kilograms on the left axis and the BMI on the right.
 */
function ChartTooltip({
  active,
  payload,
  label,
  heightCm,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  heightCm?: number
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const measured = payload.find((entry) => entry.dataKey === "weight")?.value
  const projected = payload.find((entry) => entry.dataKey === "projected")?.value
  const weight = measured ?? projected
  if (weight === undefined) return null
  const bmi =
    row?.bmi ?? (heightCm && heightCm > 0 ? weight / (heightCm / 100) ** 2 : undefined)

  return (
    <div className="rounded-lg border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium text-muted-foreground">
        {formatDate(new Date(Number(label)))}
        {measured === undefined ? " · Prognose" : ""}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {formatNumber(weight, 1)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">kg</span>
      </p>
      {bmi !== undefined ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: bmiCategory(bmi).color }}
            aria-hidden="true"
          />
          <span className="tabular-nums">BMI {formatNumber(bmi, 1)}</span>
          <span className="text-muted-foreground">{bmiCategory(bmi).label}</span>
        </p>
      ) : null}
    </div>
  )
}

/** Small keyed square/line used under the chart instead of the recharts legend. */
function LegendChip({
  label,
  dashed,
  hollow,
  color,
}: {
  label: string
  dashed?: boolean
  hollow?: boolean
  color?: string
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn("h-0.5 w-4 rounded-full", dashed && "opacity-70")}
        style={{
          backgroundColor: hollow ? "transparent" : (color ?? "var(--color-chart-1)"),
          backgroundImage: dashed
            ? `repeating-linear-gradient(90deg, ${color ?? "var(--color-chart-1)"} 0 5px, transparent 5px 9px)`
            : undefined,
          border: hollow ? `1px dashed ${color ?? "var(--color-muted-foreground)"}` : undefined,
        }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

/**
 * The weight curve, drawn on the BMI classification it lands in.
 *
 * Two charts used to answer one question. A weight curve and a BMI curve have
 * the same shape by construction — BMI is weight divided by a constant — so the
 * second chart only ever restated the first at a different scale. Here the BMI
 * is the right-hand axis and the WHO bands are the background, which means the
 * curve shows *where the patient is* rather than only how the number moved.
 *
 * The projection is the dashed continuation, re-anchored to the newest
 * measurement, and the horizon control decides how far ahead it is worth
 * looking. See `lib/nutrition/weight-projection.ts` for why it bends.
 */
export function PatientWeightChart({
  points,
  projection,
  heightCm,
  goalWeightKg,
  ageYears,
  dateOfBirth,
  measuredOn,
  horizon,
  onHorizonChange,
  onAddMeasurement,
}: PatientWeightChartProps) {
  const [todayTs] = useState(() => Date.now())
  const horizonWeeks =
    HORIZON_OPTIONS.find((option) => option.value === horizon)?.weeks ?? 26

  const latest = points.at(-1)
  const first = points[0]
  const totalChange = latest && first && points.length > 1 ? latest.weight - first.weight : undefined

  // Measured rows first, then the projection dashed on from the newest one. The
  // anchor row carries both series so the dashed line starts exactly where the
  // solid one ends instead of floating beside it.
  const rows: ChartRow[] = (() => {
    if (points.length === 0) return []
    const anchorTs = points[points.length - 1].ts
    const measured: ChartRow[] = points.map((point, index) => ({
      ts: point.ts,
      weight: point.weight,
      bmi: point.bmi,
      projected: index === points.length - 1 ? projection?.points[0]?.weightKg : undefined,
    }))
    const ahead: ChartRow[] = (projection?.points ?? [])
      .filter((point) => point.week > 0 && point.week <= horizonWeeks)
      .map((point) => ({
        ts: anchorTs + point.week * 7 * DAY_MS,
        projected: point.weightKg,
      }))
    return [...measured, ...ahead]
  })()

  const values = rows.flatMap((row) =>
    [row.weight, row.projected].filter((value): value is number => value !== undefined),
  )
  if (goalWeightKg !== undefined) values.push(goalWeightKg)

  // Integer bounds with a little air, and never a span so tight that the curve
  // reads as a cliff. Fixed numbers rather than recharts' string domains, so
  // the BMI axis on the right can mirror them exactly.
  const [minKg, maxKg] = (() => {
    if (values.length === 0) return [60, 90] as const
    const low = Math.min(...values)
    const high = Math.max(...values)
    const pad = Math.max(1.2, (high - low) * 0.1)
    const lo = Math.floor(low - pad)
    const hi = Math.ceil(high + pad)
    return hi - lo < 4 ? ([lo - 2, hi + 2] as const) : ([lo, hi] as const)
  })()

  const metres = heightCm && heightCm > 0 ? heightCm / 100 : null
  const bmiDomain: [number, number] | null = metres
    ? [minKg / metres ** 2, maxKg / metres ** 2]
    : null


  const trend =
    totalChange === undefined || Math.abs(totalChange) < 0.05
      ? null
      : totalChange < 0
        ? { Icon: TrendingDown, tone: "text-sky-500" }
        : { Icon: TrendingUp, tone: "text-amber-600" }
  const TrendIcon = trend?.Icon

  const birthdayInDays = daysUntilBirthday(dateOfBirth, todayTs)
  const birthdaySoon = birthdayInDays !== null && birthdayInDays <= 28

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Scale className="size-3.5" />
              Gewichtsverlauf
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-semibold tabular-nums leading-none">
                {latest ? formatNumber(latest.weight, 1) : "–"}
                <span className="ml-1 text-base font-normal text-muted-foreground">kg</span>
              </span>
              {totalChange !== undefined && TrendIcon ? (
                <span className={cn("flex items-center gap-1 text-sm font-medium tabular-nums", trend.tone)}>
                  <TrendIcon className="size-3.5" />
                  {totalChange > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(totalChange), 1)} kg
                </span>
              ) : null}
            </div>
          </div>

          {/* Age and height, as bare numbers. Both carry their provenance on
              hover rather than in a line of grey text under every value. */}
          <div className="flex flex-wrap items-center gap-1">
            <FactChip
              value={`${ageYears}`}
              unit="Jahre"
              title="Alter"
              tone={birthdaySoon ? "accent" : undefined}
              detail={
                birthdaySoon
                  ? `Geboren am ${formatDate(dateOfBirth)}. Geburtstag ${
                      birthdayInDays === 0
                        ? "heute"
                        : birthdayInDays === 1
                          ? "morgen"
                          : `in ${birthdayInDays} Tagen`
                    }.`
                  : `Geboren am ${formatDate(dateOfBirth)}.`
              }
            />
            {heightCm ? (
              <FactChip
                value={formatNumber(heightCm)}
                unit="cm"
                title="Größe"
                detail={
                  measuredOn
                    ? `Aus der Messung vom ${formatDate(measuredOn)}.`
                    : "Aus der letzten Messung."
                }
              />
            ) : null}
            {measuredOn ? (
              <FactChip
                value={formatDate(measuredOn)}
                unit=""
                title="Letzte Messung"
                detail={
                  totalChange !== undefined
                    ? `${totalChange > 0 ? "+" : "−"}${formatNumber(Math.abs(totalChange), 1)} kg seit der ersten Messung.`
                    : "Erste erfasste Messung."
                }
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LegendChip label="Gemessen" />
            {projection ? <LegendChip label="Prognose" dashed /> : null}
            {goalWeightKg !== undefined ? (
              <LegendChip label="Zielgewicht" hollow color="var(--color-muted-foreground)" />
            ) : null}
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={horizon}
            onValueChange={(value) => {
              if (value) onHorizonChange(value as HorizonValue)
            }}
            aria-label="Prognosehorizont"
            className="shrink-0"
          >
            {HORIZON_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.full}
                className="px-2.5 text-xs tabular-nums"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {rows.length ? (
          <div className="h-[248px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.35} />

                {/* A numeric time axis, not one category per row: measured and
                    projected points are weeks apart and must not be spaced evenly. */}
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value: number) => formatDate(new Date(value))}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  minTickGap={28}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  yAxisId="kg"
                  domain={[minKg, maxKg]}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={46}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(value: number) => formatNumber(value)}
                  label={{
                    value: "kg",
                    position: "top",
                    offset: 10,
                    fontSize: 10,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                {/* The same curve read as BMI. No second line: BMI is weight
                    over a constant, so a second series would only redraw this
                    one at another scale. */}
                {bmiDomain ? (
                  <YAxis
                    yAxisId="bmi"
                    orientation="right"
                    domain={bmiDomain}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={38}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(value: number) => formatNumber(value, 1)}
                    label={{
                      value: "BMI",
                      position: "top",
                      offset: 10,
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                ) : null}

                <Tooltip
                  content={<ChartTooltip heightCm={heightCm} />}
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                />

                {goalWeightKg !== undefined ? (
                  <ReferenceLine
                    yAxisId="kg"
                    y={goalWeightKg}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.9}
                    label={{
                      value: `Ziel ${formatNumber(goalWeightKg, 1)} kg`,
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                ) : null}

                {/* Where measurement stops and arithmetic starts. */}
                {projection && latest ? (
                  <ReferenceLine
                    yAxisId="kg"
                    x={latest.ts}
                    stroke="var(--color-border)"
                    strokeDasharray="2 3"
                  />
                ) : null}

                <Area
                  yAxisId="kg"
                  type="monotone"
                  dataKey="weight"
                  stroke="none"
                  fill="url(#weight-area)"
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="kg"
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--color-chart-1)" }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-background)" }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="kg"
                  type="monotone"
                  dataKey="projected"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-background)" }}
                  connectNulls
                  isAnimationActive={false}
                />
                {/* Invisible carrier for the BMI axis. Recharts builds its axis
                    map from the graphical items, so an axis nothing references
                    is silently dropped. */}
                {bmiDomain ? (
                  <Line
                    yAxisId="bmi"
                    dataKey="bmi"
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAddMeasurement}
            className="flex h-[248px] w-full flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors hover:bg-muted/40"
          >
            <Scale className="mb-3 size-7 text-muted-foreground" />
            <span className="text-sm font-medium">Noch keine Verlaufskurve</span>
            <span className="mt-1 max-w-xs text-sm text-muted-foreground">
              Messwert erfassen — danach stehen hier Verlauf, BMI-Band und Prognose.
            </span>
          </button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Days until the next birthday, or `null` when the date cannot be read.
 *
 * Compared on calendar days rather than milliseconds so a birthday later today
 * counts as 0 and not as "in 0,4 Tagen".
 */
function daysUntilBirthday(dateOfBirth: string, nowTs: number): number | null {
  const born = new Date(dateOfBirth)
  if (Number.isNaN(born.getTime())) return null
  const now = new Date(nowTs)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(today.getFullYear(), born.getMonth(), born.getDate())
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, born.getMonth(), born.getDate())
  }
  return Math.round((next.getTime() - today.getTime()) / DAY_MS)
}
