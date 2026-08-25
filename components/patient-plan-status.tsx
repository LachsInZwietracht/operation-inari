"use client"

import { useMemo, useState } from "react"
import {
  addDays,
  differenceInYears,
  format,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns"
import { de } from "date-fns/locale"
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  CircleAlert,
  Clock3,
  HeartPulse,
  Loader2,
  Moon,
  RefreshCw,
  Scale,
  Target,
  Utensils,
} from "lucide-react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  PlanStatusGuidance,
  type PatientEnergyContext,
} from "@/components/plan-strategy-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCounselorClientPulse } from "@/hooks/use-counselor-client-pulse"
import { calculateClientLogNutrients } from "@/lib/client-food-log"
import {
  formatMetricValue,
  getClientMetric,
  type ClientMetricKey,
} from "@/lib/client-metrics"
import { todayIsoDate } from "@/lib/client-mode"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatDate, formatNumber } from "@/lib/format"
import { parsePatientGoals } from "@/lib/intake/patient-goals"
import { getNutrientValue } from "@/lib/nutrients"
import {
  PATIENT_ENERGY_FORMULA,
  type EnergySex,
} from "@/lib/nutrition/energy-calculation"
import { projectWeight } from "@/lib/nutrition/weight-projection"
import type {
  AnthropometricEntry,
  ClientFoodLogEntry,
  DailyMealPlan,
  Patient,
  PatientAllergenEntry,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000
const COVERAGE_DAYS = 14
const PROJECTION_WEEKS = 8

type CoverageState = "released" | "draft" | "empty"

interface CoverageDay {
  date: string
  state: CoverageState
  hasRevision: boolean
}

interface PatientPlanStatusProps {
  patient: Patient
  plans: DailyMealPlan[]
  anthropometrics: AnthropometricEntry[]
  energyContext?: PatientEnergyContext
  patientAllergens: PatientAllergenEntry[]
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
  onOpenPlanner: (date: string) => void
  onOpenClientApp: () => void
}

function hasEntries(plan: DailyMealPlan) {
  return plan.slots.some((slot) => slot.entries.length > 0)
}

function buildCoverage(plans: DailyMealPlan[], startDate: string): CoverageDay[] {
  return Array.from({ length: COVERAGE_DAYS }, (_, index) => {
    const date = format(addDays(parseISO(startDate), index), "yyyy-MM-dd")
    const rows = plans.filter((plan) => plan.date === date && hasEntries(plan))
    const released = rows.some(
      (plan) =>
        (plan.status === "active" || plan.status === "approved") && !plan.replacedAt,
    )
    const draft = rows.some((plan) => plan.status === "draft")
    return {
      date,
      state: released ? "released" : draft ? "draft" : "empty",
      hasRevision: released && draft,
    }
  })
}

function phaseFor(patient: Patient, maintenance?: number) {
  const target = patient.dailyCalorieGoal
  if (!target || !maintenance) return "Zielphase"
  const difference = target - maintenance
  if (difference < -75) return "Reduktionsphase"
  if (difference > 75) return "Aufbauphase"
  return "Stabilisierungsphase"
}

function shortDay(date: string) {
  return format(parseISO(date), "EE", { locale: de })
}

function shortDate(date: string) {
  return format(parseISO(date), "d. MMM", { locale: de })
}

function clientEntryLabel(
  entry: ClientFoodLogEntry,
  foods: ReturnType<typeof useCounselorClientPulse>["foods"],
  recipeFacts: ReturnType<typeof useCounselorClientPulse>["recipeFacts"],
) {
  if (entry.sourceType === "custom") return entry.customName ?? "Eigenes Lebensmittel"
  if (entry.sourceType === "recipe") {
    return entry.recipeId ? recipeFacts.get(entry.recipeId)?.name ?? "Rezept" : "Rezept"
  }
  return entry.foodId ? foods.get(entry.foodId)?.name ?? "Lebensmittel" : "Lebensmittel"
}

function PulseTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: typeof HeartPulse
  label: string
  value: string
  detail: string
  tone?: "green" | "blue" | "amber" | "neutral"
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full",
            tone === "green" && "bg-emerald-500/10 text-emerald-600",
            tone === "blue" && "bg-sky-500/10 text-sky-600",
            tone === "amber" && "bg-amber-500/10 text-amber-600",
            tone === "neutral" && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed">
        {detail}
      </p>
    </div>
  )
}

function CoverageRail({
  days,
  onOpenPlanner,
}: {
  days: CoverageDay[]
  onOpenPlanner: (date: string) => void
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Planabdeckung</p>
          <p className="text-muted-foreground text-xs">
            Freigegeben, vorbereitet und noch offen – jeder Tag führt direkt in den Planer.
          </p>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Freigegeben
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" /> Entwurf
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/20 size-2 rounded-full" /> Offen
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
        {days.map((day, index) => (
          <button
            key={day.date}
            type="button"
            onClick={() => onOpenPlanner(day.date)}
            aria-label={`${formatDate(day.date)}: ${
              day.state === "released"
                ? "freigegeben"
                : day.state === "draft"
                  ? "Entwurf"
                  : "offen"
            }`}
            className={cn(
              "group relative flex min-h-16 flex-col items-center justify-center rounded-xl border text-center transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              day.state === "released" &&
                "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
              day.state === "draft" &&
                "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-300",
              day.state === "empty" && "border-dashed bg-muted/30 text-muted-foreground",
              index === 0 && "ring-1 ring-foreground/15",
            )}
          >
            <span className="text-[10px] font-medium uppercase">{shortDay(day.date)}</span>
            <span className="mt-0.5 text-sm font-semibold tabular-nums">
              {format(parseISO(day.date), "d")}
            </span>
            {day.state === "released" ? (
              <Check className="mt-1 size-3" />
            ) : day.state === "draft" ? (
              <span className="mt-1 size-1.5 rounded-full bg-current" />
            ) : (
              <span className="mt-1 text-xs opacity-50">+</span>
            )}
            {day.hasRevision ? (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-sky-500 ring-2 ring-background" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

type TrajectoryRow = {
  ts: number
  label: string
  measured?: number
  projected?: number
}

function TrajectoryTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    dataKey?: string | number
    value?: number
    payload?: TrajectoryRow
  }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const measured = payload.find((item) => item.dataKey === "measured")?.value
  const projected = payload.find((item) => item.dataKey === "projected")?.value
  const value = measured ?? projected
  if (!row || value === undefined) return null

  return (
    <div className="rounded-xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-medium">{row.label}</p>
      <p className="mt-0.5 text-sm tabular-nums">
        {formatNumber(value, 1)} kg
        <span className="text-muted-foreground ml-1 text-xs">
          {measured !== undefined ? "gemessen" : "Schätzung"}
        </span>
      </p>
    </div>
  )
}

function PlanTrajectory({
  patient,
  anthropometrics,
  energyContext,
  coverage,
  onOpenPlanner,
}: Pick<
  PatientPlanStatusProps,
  "patient" | "anthropometrics" | "energyContext" | "onOpenPlanner"
> & { coverage: CoverageDay[] }) {
  const sortedMeasurements = useMemo(
    () => [...anthropometrics].sort((a, b) => a.date.localeCompare(b.date)).slice(-12),
    [anthropometrics],
  )
  const latest = sortedMeasurements.at(-1)
  const today = todayIsoDate()
  const todayTs = parseISO(today).getTime()
  const firstGap = coverage.find((day) => day.state === "empty")
  const coveredDays = firstGap
    ? coverage.slice(0, coverage.indexOf(firstGap))
    : coverage
  const plannedThrough = coveredDays.at(-1)?.date
  const cycleEndTs = plannedThrough ? parseISO(plannedThrough).getTime() : null

  const sex: EnergySex =
    patient.gender === "m" ? "male" : patient.gender === "w" ? "female" : "diverse"
  const projection =
    latest && patient.dailyCalorieGoal && energyContext?.pal
      ? projectWeight({
          targetKcal: patient.dailyCalorieGoal,
          weightKg: latest.weight,
          heightCm: latest.height,
          ageYears: differenceInYears(new Date(), parseISO(patient.dateOfBirth)),
          sex,
          formula: PATIENT_ENERGY_FORMULA,
          pal: energyContext.pal,
          basalOverrideKcal: patient.basalMetabolicRateOverride,
          goalWeightKg: patient.goalWeight,
          weeks: PROJECTION_WEEKS,
        })
      : null

  const rows: TrajectoryRow[] = sortedMeasurements.map((entry, index) => ({
    ts: parseISO(entry.date).getTime(),
    label: formatDate(entry.date),
    measured: entry.weight,
    projected:
      index === sortedMeasurements.length - 1 ? projection?.points[0]?.weightKg : undefined,
  }))

  if (latest && projection) {
    const anchor = parseISO(latest.date).getTime()
    for (const point of projection.points) {
      if (point.week === 0) continue
      rows.push({
        ts: anchor + point.week * 7 * DAY_MS,
        label: formatDate(new Date(anchor + point.week * 7 * DAY_MS).toISOString()),
        projected: point.weightKg,
      })
    }
  }

  const chartValues = rows.flatMap((row) =>
    [row.measured, row.projected].filter((value): value is number => value !== undefined),
  )
  if (patient.goalWeight) chartValues.push(patient.goalWeight)
  const low = chartValues.length > 0 ? Math.min(...chartValues) : 60
  const high = chartValues.length > 0 ? Math.max(...chartValues) : 90
  const padding = Math.max(1.5, (high - low) * 0.12)
  const yDomain: [number, number] = [Math.floor(low - padding), Math.ceil(high + padding)]

  return (
    <Card className="overflow-hidden rounded-[28px] border-black/[0.06] shadow-[0_18px_50px_-34px_rgba(0,0,0,0.35)] dark:border-white/10">
      <CardHeader className="gap-4 border-b bg-muted/20 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
              Verlauf und Planung
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Vergangenheit, heute und die nächsten Schritte
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Messwerte sind durchgezogen. Die gestrichelte Kurve ist eine Modellschätzung bei
              unverändertem Kalorienziel – keine automatische Therapieentscheidung.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full bg-background/70 px-3 py-1">
            {plannedThrough
              ? `Geplant bis ${shortDate(plannedThrough)}`
              : "Heute noch offen"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {rows.length > 0 ? (
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 14, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="plan-status-weight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.55} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value: number) =>
                    format(new Date(value), "d. MMM", { locale: de })
                  }
                  tickLine={false}
                  axisLine={false}
                  minTickGap={36}
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  domain={yDomain}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(value: number) => `${formatNumber(value)} kg`}
                />
                <Tooltip content={<TrajectoryTooltip />} />
                {cycleEndTs && cycleEndTs >= todayTs ? (
                  <ReferenceArea
                    x1={todayTs}
                    x2={cycleEndTs}
                    fill="var(--color-chart-2)"
                    fillOpacity={0.07}
                    strokeOpacity={0}
                  />
                ) : null}
                <ReferenceLine
                  x={todayTs}
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.3}
                  strokeDasharray="3 3"
                  label={{
                    value: "Heute",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                {patient.goalWeight ? (
                  <ReferenceLine
                    y={patient.goalWeight}
                    stroke="var(--color-muted-foreground)"
                    strokeOpacity={0.55}
                    strokeDasharray="4 4"
                    label={{
                      value: `Ziel ${formatNumber(patient.goalWeight, 1)} kg`,
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                ) : null}
                <Area
                  type="monotone"
                  dataKey="measured"
                  stroke="none"
                  fill="url(#plan-status-weight)"
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="measured"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-background)" }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  strokeOpacity={0.55}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center">
            <Scale className="text-muted-foreground size-6" />
            <p className="mt-3 text-sm font-medium">Noch keine Gewichtskurve</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Sobald ein Gewicht erfasst wurde, verbindet Inari den Ist-Verlauf mit der
              gekennzeichneten Prognose.
            </p>
          </div>
        )}

        <CoverageRail days={coverage} onOpenPlanner={onOpenPlanner} />
      </CardContent>
    </Card>
  )
}

function ClientPulse({
  patient,
  onOpenClientApp,
}: Pick<PatientPlanStatusProps, "patient" | "onOpenClientApp">) {
  const pulse = useCounselorClientPulse(patient.id)
  const latestDay = [...pulse.days].sort((a, b) => b.date.localeCompare(a.date))[0]
  const recipeNutrients = useMemo(
    () =>
      new Map(
        [...pulse.recipeFacts].map(([id, facts]) => [id, facts.perPortion]),
      ),
    [pulse.recipeFacts],
  )
  const latestTotals = latestDay
    ? calculateClientLogNutrients(latestDay.entries, pulse.foods, recipeNutrients)
    : []
  const latestKcal = getNutrientValue(latestTotals, "energie")
  const latestFoods = latestDay
    ? [...new Set(latestDay.entries.map((entry) => clientEntryLabel(entry, pulse.foods, pulse.recipeFacts)))]
        .slice(0, 3)
        .join(", ")
    : ""

  const selectedMetrics = (["mood", "energy", "sleep_minutes"] as ClientMetricKey[])
    .flatMap((key) => {
      const series = pulse.wellbeing.get(key)
      if (!series?.length) return []
      const latest = [...series].sort((a, b) => b.date.localeCompare(a.date))[0]
      return [{ metric: getClientMetric(key), latest, count: series.length }]
    })
    .slice(0, 3)

  const adherenceTotals = pulse.adherence.byDay.reduce(
    (totals, day) => ({
      planned: totals.planned + day.planned,
      completed: totals.completed + day.completed,
      skipped: totals.skipped + day.skipped,
    }),
    { planned: 0, completed: 0, skipped: 0 },
  )
  const adherencePercent = adherenceTotals.planned
    ? Math.round((adherenceTotals.completed / adherenceTotals.planned) * 100)
    : null
  const problemSlot = [...pulse.adherence.bySlot]
    .filter((slot) => slot.planned > 0 && slot.skipped > 0)
    .sort((a, b) => b.skipped / b.planned - a.skipped / a.planned)[0]

  const refreshedLabel = pulse.refreshedAt
    ? `vor ${formatDistanceToNowStrict(pulse.refreshedAt, { locale: de })}`
    : "wird geladen"

  return (
    <Card className="overflow-hidden rounded-[28px] border-black/[0.06] bg-gradient-to-br from-emerald-500/[0.07] via-background to-sky-500/[0.05] shadow-[0_18px_50px_-34px_rgba(0,0,0,0.35)] dark:border-white/10">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              {pulse.link?.status === "active" ? (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-35" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex size-2.5 rounded-full",
                  pulse.link?.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/35",
                )}
              />
            </span>
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-[0.18em]",
                pulse.link?.status === "active"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {pulse.link?.status === "active"
                ? "Aktuell aus der Klienten-App"
                : "Klienten-Signal"}
            </p>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
            Wie es {patient.firstName} gerade wirklich geht
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Selbst eingetragene und freigegebene Werte – automatisch jede Minute aktualisiert.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => void pulse.refresh()}
          disabled={pulse.isLoading}
        >
          {pulse.isLoading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 size-3.5" />
          )}
          {refreshedLabel}
        </Button>
      </CardHeader>

      <CardContent className="pb-6">
        {pulse.isLoading && !pulse.refreshedAt ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : pulse.error && !pulse.link ? (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-700 dark:text-amber-400">
            <CircleAlert className="size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Klientendaten gerade nicht erreichbar</p>
              <p className="mt-1 text-sm opacity-80">{pulse.error}</p>
            </div>
          </div>
        ) : pulse.link?.status !== "active" ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed bg-background/60 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">Noch keine aktive Klienten-Verbindung</p>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                Sobald {patient.firstName} verbunden ist und Daten freigibt, erscheinen hier
                Befinden, Schlaf, tatsächliche Mahlzeiten und Planumsetzung.
              </p>
            </div>
            <Button variant="outline" className="rounded-full" onClick={onOpenClientApp}>
              Klienten-App verbinden
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        ) : (
          <>
            {pulse.error ? (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <CircleAlert className="size-4" />
                {pulse.error}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {selectedMetrics.map(({ metric, latest }) => (
                <PulseTile
                  key={metric.key}
                  icon={metric.key === "sleep_minutes" ? Moon : HeartPulse}
                  label={metric.label}
                  value={formatMetricValue(metric, latest.value)}
                  detail={`Zuletzt ${shortDate(latest.date)} · vom Klienten selbst angegeben`}
                  tone={metric.key === "sleep_minutes" ? "blue" : "green"}
                />
              ))}

              <PulseTile
                icon={Utensils}
                label="Tatsächlich gegessen"
                value={latestDay ? `${formatNumber(latestKcal)} kcal` : "Noch offen"}
                detail={
                  latestDay
                    ? `${shortDate(latestDay.date)} · ${latestFoods || `${latestDay.entries.length} Einträge`}`
                    : "In den letzten 14 Tagen wurde noch kein Essen geteilt."
                }
                tone="amber"
              />

              {adherencePercent !== null ? (
                <PulseTile
                  icon={CalendarCheck2}
                  label="Planumsetzung"
                  value={`${adherencePercent} %`}
                  detail={
                    problemSlot
                      ? `${MEAL_SLOT_LABELS[problemSlot.slotType]}: ${problemSlot.skipped} von ${problemSlot.planned} Einträgen ausgelassen.`
                      : `${adherenceTotals.completed} von ${adherenceTotals.planned} geplanten Einträgen bestätigt.`
                  }
                  tone="blue"
                />
              ) : null}

              {selectedMetrics.length === 0 && !latestDay && adherencePercent === null ? (
                <div className="rounded-2xl border border-dashed bg-background/60 p-5 sm:col-span-2 xl:col-span-4">
                  <p className="text-sm font-medium">Noch keine geteilten Angaben</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Die Verbindung steht. Sobald {patient.firstName} heute etwas einträgt,
                    erscheint es hier ohne Wechsel in einen anderen Tab.
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function PatientPlanStatus({
  patient,
  plans,
  anthropometrics,
  energyContext,
  patientAllergens,
  onSavePatient,
  onOpenPlanner,
  onOpenClientApp,
}: PatientPlanStatusProps) {
  const [today] = useState(todayIsoDate)
  const coverage = useMemo(() => buildCoverage(plans, today), [plans, today])
  const firstGap = coverage.find((day) => day.state === "empty")
  const plannedDays = firstGap ? coverage.slice(0, coverage.indexOf(firstGap)) : coverage
  const plannedThrough = plannedDays.at(-1)?.date
  const nextDate =
    firstGap?.date ??
    format(addDays(parseISO(coverage.at(-1)?.date ?? today), 1), "yyyy-MM-dd")
  const draftCount = coverage.filter((day) => day.state === "draft").length
  const releasedCount = coverage.filter((day) => day.state === "released").length
  const goals = parsePatientGoals(patient.patientGoals)
  const goalText = goals.goal ?? patient.intakeReason?.trim()
  const phase = phaseFor(patient, energyContext?.totalEnergyExpenditure)
  const calorieDelta =
    patient.dailyCalorieGoal && energyContext?.totalEnergyExpenditure
      ? patient.dailyCalorieGoal - energyContext.totalEnergyExpenditure
      : null

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[30px] border border-black/[0.06] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_42%),linear-gradient(135deg,var(--background),color-mix(in_srgb,var(--muted)_45%,var(--background)))] p-5 shadow-[0_22px_70px_-42px_rgba(0,0,0,0.45)] sm:p-7 dark:border-white/10">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[1.4fr_1fr] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-foreground px-3 py-1 text-background hover:bg-foreground">
                {phase}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {releasedCount} Tage freigegeben · {draftCount} vorbereitet
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {plannedThrough
                ? `Der aktuelle Plan reicht bis ${shortDate(plannedThrough)}.`
                : "Der nächste Planungstag ist noch offen."}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
              {plannedThrough
                ? `Danach braucht ${patient.firstName} einen geprüften nächsten Stand. Ist-Werte und Klienten-Feedback zeigen, ob das Konzept unverändert weiterlaufen kann.`
                : `Ziele und aktuelle Rückmeldungen sind der Ausgangspunkt. Beginnen Sie mit dem ersten Tages- oder Wochenplan.`}
            </p>
            {goals.timeframe || patient.goalWeight || patient.indications?.length ? (
              <div className="mt-4 flex max-w-3xl flex-wrap gap-2 text-xs">
                {patient.goalWeight ? (
                  <span className="rounded-full border border-black/[0.06] bg-background/70 px-3 py-1.5 backdrop-blur dark:border-white/10">
                    Zielgewicht {formatNumber(patient.goalWeight, 1)} kg
                  </span>
                ) : null}
                {goals.timeframe ? (
                  <span className="rounded-full border border-black/[0.06] bg-background/70 px-3 py-1.5 backdrop-blur dark:border-white/10">
                    Zeithorizont {goals.timeframe}
                  </span>
                ) : null}
                {patient.indications?.map((indication) => (
                  <span
                    key={indication}
                    className="rounded-full border border-black/[0.06] bg-background/70 px-3 py-1.5 backdrop-blur dark:border-white/10"
                  >
                    {indication}
                  </span>
                ))}
              </div>
            ) : null}
            {goals.motivation ? (
              <p className="text-muted-foreground mt-4 max-w-2xl border-l-2 border-emerald-500/40 pl-3 text-sm italic">
                „{goals.motivation}“
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button className="rounded-full px-5" onClick={() => onOpenPlanner(nextDate)}>
                {plannedThrough ? `Ab ${shortDate(nextDate)} weiterplanen` : "Plan beginnen"}
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full bg-background/70 px-5 backdrop-blur"
                onClick={() => onOpenPlanner(today)}
              >
                Aktuellen Plan öffnen
              </Button>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06] sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3 dark:border-white/10 dark:bg-white/10">
            <div className="bg-background/85 p-4 backdrop-blur">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Target className="size-3.5" /> Ziel
              </p>
              <p className="mt-2 line-clamp-2 text-sm font-medium">
                {goalText || "Noch kein Beratungsziel hinterlegt"}
              </p>
            </div>
            <div className="bg-background/85 p-4 backdrop-blur">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Scale className="size-3.5" /> Sollwert
              </p>
              <p className="mt-2 text-sm font-medium tabular-nums">
                {patient.dailyCalorieGoal
                  ? `${formatNumber(patient.dailyCalorieGoal)} kcal/Tag`
                  : "Noch kein Kalorienziel"}
              </p>
              {calorieDelta !== null ? (
                <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                  {calorieDelta > 0 ? "+" : calorieDelta < 0 ? "−" : ""}
                  {formatNumber(Math.abs(calorieDelta))} kcal zum Erhalt
                </p>
              ) : null}
            </div>
            <div className="bg-background/85 p-4 backdrop-blur">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Clock3 className="size-3.5" /> Nächste Entscheidung
              </p>
              <p className="mt-2 text-sm font-medium">
                {firstGap ? shortDate(firstGap.date) : "In mehr als 14 Tagen"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {firstGap ? "Noch nicht abgedeckt" : "Planungsfenster vollständig"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ClientPulse patient={patient} onOpenClientApp={onOpenClientApp} />

      <PlanTrajectory
        patient={patient}
        anthropometrics={anthropometrics}
        energyContext={energyContext}
        coverage={coverage}
        onOpenPlanner={onOpenPlanner}
      />

      <PlanStatusGuidance
        patient={patient}
        patientAllergens={patientAllergens}
        energyContext={energyContext}
        onSavePatient={onSavePatient}
      />
    </div>
  )
}
