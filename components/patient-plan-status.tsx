"use client"

import { useMemo, useState } from "react"
import { addDays, format, formatDistanceToNowStrict, parseISO } from "date-fns"
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
  TrendingDown,
  TrendingUp,
  Utensils,
} from "lucide-react"
import {
  PlanStatusGuidance,
  type PatientEnergyContext,
} from "@/components/plan-strategy-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCounselorClientPulse,
  type CounselorClientPulse,
} from "@/hooks/use-counselor-client-pulse"
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
import type {
  AnthropometricEntry,
  ClientFoodLogEntry,
  DailyMealPlan,
  Patient,
  PatientAllergenEntry,
  PracticeAppointment,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const COVERAGE_DAYS = 14

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
  appointments: PracticeAppointment[]
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

type SignalDirection = "up" | "down" | "stable" | "unknown"

interface SignalTrend {
  direction: SignalDirection
  value: string
  detail: string
  delta?: number
  samples: number
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function summarizeMoodTrend(series: { date: string; value: number }[]): SignalTrend {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.at(-1)
  if (!latest) {
    return {
      direction: "unknown",
      value: "Keine Daten",
      detail: "Noch keine Stimmung geteilt",
      samples: 0,
    }
  }
  if (sorted.length === 1) {
    return {
      direction: "unknown",
      value: `${formatNumber(latest.value, 1)} von 5`,
      detail: `Ein Wert vom ${shortDate(latest.date)}`,
      samples: 1,
    }
  }

  const recentCount = Math.min(3, Math.ceil(sorted.length / 2))
  const recent = sorted.slice(-recentCount)
  const previous = sorted.slice(0, -recentCount).slice(-3)
  const recentAverage = average(recent.map((entry) => entry.value))
  const previousAverage = average(previous.map((entry) => entry.value))
  const delta = recentAverage - previousAverage
  const direction = delta > 0.35 ? "up" : delta < -0.35 ? "down" : "stable"

  return {
    direction,
    value:
      direction === "up"
        ? "Tendenz steigt"
        : direction === "down"
          ? "Tendenz sinkt"
          : "Weitgehend stabil",
    detail: `Ø ${formatNumber(recentAverage, 1)} von 5 · ${sorted.length} Angaben`,
    delta,
    samples: sorted.length,
  }
}

function summarizeWeightTrend(entries: AnthropometricEntry[]): SignalTrend {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.at(-1)
  if (!latest) {
    return {
      direction: "unknown",
      value: "Keine Messung",
      detail: "Noch kein Gewicht erfasst",
      samples: 0,
    }
  }
  const previous = sorted.at(-2)
  if (!previous) {
    return {
      direction: "unknown",
      value: `${formatNumber(latest.weight, 1)} kg`,
      detail: `Ein Messwert vom ${shortDate(latest.date)}`,
      samples: 1,
    }
  }

  const delta = latest.weight - previous.weight
  const direction = delta > 0.1 ? "up" : delta < -0.1 ? "down" : "stable"
  const signedDelta = `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatNumber(Math.abs(delta), 1)} kg`

  return {
    direction,
    value:
      direction === "up"
        ? "Gewicht steigt"
        : direction === "down"
          ? "Gewicht sinkt"
          : "Gewicht stabil",
    detail: `${signedDelta} seit ${shortDate(previous.date)} · zuletzt ${formatNumber(latest.weight, 1)} kg`,
    delta,
    samples: sorted.length,
  }
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

function PlanCoverage({
  coverage,
  onOpenPlanner,
}: Pick<PatientPlanStatusProps, "onOpenPlanner"> & { coverage: CoverageDay[] }) {
  const firstGap = coverage.find((day) => day.state === "empty")
  const coveredDays = firstGap ? coverage.slice(0, coverage.indexOf(firstGap)) : coverage
  const plannedThrough = coveredDays.at(-1)?.date

  return (
    <Card className="overflow-hidden rounded-[28px] border-black/[0.06] shadow-[0_18px_50px_-34px_rgba(0,0,0,0.35)] dark:border-white/10">
      <CardHeader className="gap-4 border-b bg-muted/20 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
              Planungshorizont
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Wie weit der aktuelle Plan trägt
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Die nächsten 14 Tage zeigen, was freigegeben, vorbereitet oder noch zu planen ist.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full bg-background/70 px-3 py-1">
            {plannedThrough
              ? `Geplant bis ${shortDate(plannedThrough)}`
              : "Heute noch offen"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <CoverageRail days={coverage} onOpenPlanner={onOpenPlanner} />
      </CardContent>
    </Card>
  )
}

function ClientPulse({
  patient,
  pulse,
  weightTrend,
  onOpenClientApp,
}: Pick<PatientPlanStatusProps, "patient" | "onOpenClientApp"> & {
  pulse: CounselorClientPulse
  weightTrend: SignalTrend
}) {
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
  const moodTrend = summarizeMoodTrend(pulse.wellbeing.get("mood") ?? [])
  const planningHint = (() => {
    if (moodTrend.direction === "down" && moodTrend.samples >= 2) {
      return {
        title: "Belastung vor dem Fortschreiben klären",
        detail:
          "Die geteilte Stimmung ist zuletzt gesunken. Prüfen Sie kurz, ob Umfang und Alltagstauglichkeit des Plans noch passen.",
        tone: "amber" as const,
      }
    }
    if (
      problemSlot &&
      problemSlot.planned >= 2 &&
      problemSlot.skipped / problemSlot.planned >= 0.4
    ) {
      return {
        title: `${MEAL_SLOT_LABELS[problemSlot.slotType]} gezielt prüfen`,
        detail: `${problemSlot.skipped} von ${problemSlot.planned} geplanten Einträgen wurden ausgelassen. Zeitpunkt, Aufwand oder eine einfachere Alternative besprechen.`,
        tone: "amber" as const,
      }
    }
    if (
      adherencePercent !== null &&
      adherenceTotals.planned >= 3 &&
      adherencePercent < 60
    ) {
      return {
        title: "Umsetzungshürden vor der nächsten Woche klären",
        detail: `Aktuell wurden ${adherencePercent} % der geplanten Einträge bestätigt. Den Plan erst nach kurzer Rückmeldung unverändert fortschreiben.`,
        tone: "amber" as const,
      }
    }
    if (
      moodTrend.samples === 0 &&
      !latestDay &&
      adherenceTotals.planned === 0 &&
      weightTrend.samples < 2
    ) {
      return {
        title: "Vor der nächsten Freigabe Rückmeldung einholen",
        detail:
          "Noch reichen die geteilten Signale nicht für eine belastbare Tendenz. Eine kurze Rückfrage ist aussagekräftiger als eine automatische Annahme.",
        tone: "neutral" as const,
      }
    }
    return {
      title: "Aktuelle Signale beim nächsten Kontakt bestätigen",
      detail:
        "Es zeigt sich gerade kein eindeutiges Warnsignal. Prüfen Sie trotzdem kurz, ob Aufwand, Portionsgrößen und Tagesstruktur weiter passen.",
      tone: "green" as const,
    }
  })()

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
            <div
              className={cn(
                "mb-3 flex items-start gap-3 rounded-2xl border p-4",
                planningHint.tone === "amber" &&
                  "border-amber-500/20 bg-amber-500/10",
                planningHint.tone === "green" &&
                  "border-emerald-500/20 bg-emerald-500/10",
                planningHint.tone === "neutral" && "bg-background/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                  planningHint.tone === "amber" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                  planningHint.tone === "green" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                  planningHint.tone === "neutral" && "bg-muted text-muted-foreground",
                )}
              >
                <ArrowRight className="size-4" />
              </span>
              <div>
                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.14em]">
                  Hinweis für die nächste Planung
                </p>
                <p className="mt-1 text-sm font-medium">{planningHint.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {planningHint.detail}
                </p>
              </div>
            </div>
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
  appointments,
  energyContext,
  patientAllergens,
  onSavePatient,
  onOpenPlanner,
  onOpenClientApp,
}: PatientPlanStatusProps) {
  const [today] = useState(todayIsoDate)
  const pulse = useCounselorClientPulse(patient.id)
  const coverage = useMemo(() => buildCoverage(plans, today), [plans, today])
  const moodTrend = useMemo(
    () => summarizeMoodTrend(pulse.wellbeing.get("mood") ?? []),
    [pulse.wellbeing],
  )
  const weightTrend = useMemo(
    () => summarizeWeightTrend(anthropometrics),
    [anthropometrics],
  )
  const nextAppointment = useMemo(
    () =>
      [...appointments]
        .filter((appointment) => appointment.date >= today)
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        )[0],
    [appointments, today],
  )
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
  const MoodTrendIcon =
    moodTrend.direction === "up"
      ? TrendingUp
      : moodTrend.direction === "down"
        ? TrendingDown
        : HeartPulse
  const WeightTrendIcon =
    weightTrend.direction === "up"
      ? TrendingUp
      : weightTrend.direction === "down"
        ? TrendingDown
        : Scale

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
            {goalText || goals.timeframe || patient.goalWeight || patient.indications?.length ? (
              <div className="mt-4 flex max-w-3xl flex-wrap gap-2 text-xs">
                {goalText ? (
                  <span className="rounded-full border border-black/[0.06] bg-background/70 px-3 py-1.5 backdrop-blur dark:border-white/10">
                    Ziel {goalText}
                  </span>
                ) : null}
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
                Zu heute springen
              </Button>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06] sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3 dark:border-white/10 dark:bg-white/10">
            <div className="bg-background/85 p-4 backdrop-blur">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MoodTrendIcon className="size-3.5" /> Stimmungstrend
              </p>
              <p className="mt-2 text-sm font-medium">{moodTrend.value}</p>
              <p className="text-muted-foreground mt-1 text-xs">{moodTrend.detail}</p>
            </div>
            <div className="bg-background/85 p-4 backdrop-blur">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <WeightTrendIcon className="size-3.5" /> Gewichtstrend
              </p>
              <p className="mt-2 text-sm font-medium">{weightTrend.value}</p>
              <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                {weightTrend.detail}
              </p>
            </div>
            <div className="bg-background/85 p-4 backdrop-blur">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Clock3 className="size-3.5" /> Nächster Termin
              </p>
              <p className="mt-2 text-sm font-medium tabular-nums">
                {nextAppointment ? shortDate(nextAppointment.date) : "Nicht geplant"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {nextAppointment
                  ? `${nextAppointment.startTime.slice(0, 5)} Uhr · ${nextAppointment.title}`
                  : "Noch kein zukünftiger Termin"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <PlanCoverage coverage={coverage} onOpenPlanner={onOpenPlanner} />

      <ClientPulse
        patient={patient}
        pulse={pulse}
        weightTrend={weightTrend}
        onOpenClientApp={onOpenClientApp}
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
