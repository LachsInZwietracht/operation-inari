"use client"

import { parseISO } from "date-fns"
import Link from "next/link"
import type React from "react"
import { useMemo, useState, type CSSProperties } from "react"
import {
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Flame,
  Scale,
  Send,
  Stethoscope,
  Target,
  UtensilsCrossed,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { PatientEnergyCard } from "@/components/patient-energy-card"
import { PatientIntakeReview } from "@/components/patient-intake-review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ALLERGEN_MAP, ALLERGEN_TYPE_LABELS } from "@/lib/allergen-constants"
import {
  BMI_CATEGORIES,
  bmiBandWidth,
  bmiCategory,
  bmiScalePosition,
  healthyWeightRange,
} from "@/lib/bmi"
import { DIET_EXCLUSION_LABELS, DIET_STYLE_LABELS, resolveDietStyle } from "@/lib/diet-constants"
import { formatDate, formatNumber } from "@/lib/format"
import {
  PATIENT_ENERGY_FORMULA,
  type EnergySex,
} from "@/lib/nutrition/energy-calculation"
import { projectWeight } from "@/lib/nutrition/weight-projection"
import {
  derivePatientIntakeStage,
  INTAKE_STAGE_META,
  type IntakeStage,
} from "@/lib/patient-journey"
import { cn } from "@/lib/utils"
import type {
  AnthropometricEntry,
  CounselingSession,
  DailyMealPlan,
  DiagnosisEntry,
  Patient,
  PatientAllergenEntry,
  PatientIntakeLink,
  PatientIntakeSubmission,
  PracticeAppointment,
} from "@/lib/types"

interface PatientOverviewTabProps {
  patient: Patient
  anthropometrics: AnthropometricEntry[]
  appointments: PracticeAppointment[]
  sessions: CounselingSession[]
  diagnoses: DiagnosisEntry[]
  patientAllergens: PatientAllergenEntry[]
  mealPlans: DailyMealPlan[]
  intakeLinks: PatientIntakeLink[]
  intakeSubmissions: PatientIntakeSubmission[]
  basalMetabolicRate?: number
  totalEnergyExpenditure?: number
  palValue: number
  onAddMeasurement: () => void
  onSaveCalorieGoal: (kcal: number) => Promise<void>
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "Nicht erfasst"}</p>
    </div>
  )
}

/**
 * One line of the header summary.
 *
 * The header used to spend its height on restating the phase four different
 * ways. These rows carry the facts a practitioner opens the record for instead:
 * label on the left, the answer on the right, one line each.
 */
function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  /** True when there is nothing recorded yet, so the value reads as absent. */
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-medium tabular-nums", muted && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  )
}

/**
 * One cell of the status strip: a label over its answer.
 *
 * The strip replaced a full card that spent a header, a badge and six rows on
 * facts that fit in one line each. Stacking label over value lets all of them
 * share a single row, which is the whole point — the phase now lives next to
 * the patient's name, so this band only has to carry the dates.
 */
function FactCell({
  label,
  value,
  muted,
  className,
  children,
}: {
  label: string
  value?: string
  muted?: boolean
  className?: string
  /** Replaces the plain value when the cell has to be clickable. */
  children?: React.ReactNode
}) {
  return (
    <div className={cn("min-w-0 px-4 py-2.5", className)}>
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children ?? (
        <p className={cn("truncate text-sm font-medium", muted && "text-muted-foreground")}>
          {value}
        </p>
      )}
    </div>
  )
}

/**
 * The clickable half of {@link FactCell}.
 *
 * Spreads the remaining props onto the button so it can serve as a
 * `DialogTrigger asChild` child — Radix passes its handlers down that way, and
 * swallowing them here would leave the trigger inert.
 */
function FactButton({
  value,
  muted,
  ...props
}: React.ComponentProps<"button"> & { value: string; muted?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className="group flex w-full items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("truncate text-sm font-medium", muted && "text-muted-foreground")}>
        {value}
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/** One of the three plain body facts, on the line above the weight chart. */
function BodyFact({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: string
  unit?: string
  note: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 font-normal text-muted-foreground">{unit}</span> : null}
      </span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  )
}

/**
 * The weight chart's tooltip.
 *
 * Recharts' built-in tooltip paints itself white with hard-coded inline
 * styles, which is unreadable in dark mode. Every other chart in the app draws
 * its own on theme tokens; this one now does too.
 */
function WeightTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; color?: string; dataKey?: string | number }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{formatDate(new Date(Number(label)))}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-sm text-muted-foreground">
          <span
            className="mr-2 inline-block size-2.5 rounded-sm align-middle"
            style={{ backgroundColor: entry.color }}
          />
          {entry.dataKey === "projected" ? "Prognose" : "Gemessen"}:{" "}
          {formatNumber(Number(entry.value ?? 0), 1)} kg
        </p>
      ))}
    </div>
  )
}

/**
 * Keeps an item from being cut off at the ends of the scale.
 *
 * A marker sitting at 0% or 100% would hang half outside its track. Shifting it
 * by half its width at the edges, and by nothing in the middle, keeps it whole
 * without visibly moving it where there is room.
 */
function pinLeft(percent: number, widthPx: number): string {
  const shift = widthPx / 2 - (percent / 100) * widthPx
  return `calc(${percent}% + ${shift}px)`
}

const BMI_TICKS = [18.5, 25, 30, 35]

/**
 * The WHO bands as a coloured track, with the patient's BMI on it.
 *
 * A bare progress bar answered "how far along some scale" — a question nobody
 * asks about BMI. What a practitioner needs to see is which band the value
 * falls into and how far it is from the next one, so the bands are drawn to
 * scale and the value sits on them.
 */
function BmiScale({ bmi, goalBmi }: { bmi: number; goalBmi?: number }) {
  return (
    <div>
      <div className="relative h-2.5">
        <div className="flex h-full overflow-hidden rounded-full">
          {/* The hairline is what separates the two Adipositas bands, whose
              reds sit close together on purpose. */}
          {BMI_CATEGORIES.map((category) => (
            <div
              key={category.id}
              className="border-r-2 border-card last:border-r-0"
              style={{ width: `${bmiBandWidth(category)}%`, backgroundColor: category.color }}
            />
          ))}
        </div>
        {/* A hollow dot, so it cannot be mistaken for the solid needle even
            when the two land close together. */}
        {goalBmi !== undefined ? (
          <span
            className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-foreground bg-background"
            style={{ left: pinLeft(bmiScalePosition(goalBmi), 12) }}
            aria-hidden="true"
          />
        ) : null}
        <span
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
          style={{ left: pinLeft(bmiScalePosition(bmi), 4) }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-2 h-4" aria-hidden="true">
        {BMI_TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
            style={{ left: `${bmiScalePosition(tick)}%` }}
          >
            {formatNumber(tick, 1)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 rounded-full bg-foreground" aria-hidden="true" />
          Jetzt {formatNumber(bmi, 1)}
        </span>
        {goalBmi !== undefined ? (
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border-2 border-foreground"
              aria-hidden="true"
            />
            Ziel {formatNumber(goalBmi, 1)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Six months ahead: far enough to show a trend, near enough to still mean something. */
const PROJECTION_WEEKS = 26
const DAY_MS = 24 * 60 * 60 * 1000

interface TimelineEvent {
  id: string
  date: string
  label: string
  detail: string
  stage: IntakeStage
  isUpcoming?: boolean
}

export function PatientOverviewTab({
  patient,
  anthropometrics,
  appointments,
  sessions,
  diagnoses,
  patientAllergens,
  mealPlans,
  intakeLinks,
  intakeSubmissions,
  basalMetabolicRate,
  totalEnergyExpenditure,
  palValue,
  onAddMeasurement,
  onSaveCalorieGoal,
}: PatientOverviewTabProps) {
  const [todayDate] = useState(() => new Date())
  const sortedMeasurements = useMemo(
    () => [...anthropometrics].sort((a, b) => a.date.localeCompare(b.date)),
    [anthropometrics],
  )
  const latestMeasurement = sortedMeasurements.at(-1)
  const measuredPoints = useMemo(
    () =>
      sortedMeasurements.slice(-12).map((entry) => ({
        ts: parseISO(entry.date).getTime(),
        weight: entry.weight,
      })),
    [sortedMeasurements],
  )
  const today = todayDate.toISOString().slice(0, 10)
  const nextAppointment = useMemo(
    () =>
      [...appointments]
        .filter((appointment) => appointment.date >= today)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0],
    [appointments, today],
  )
  const latestSession = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0],
    [sessions],
  )
  const currentPlan = useMemo(
    () =>
      [...mealPlans]
        .filter((plan) => plan.status !== "archived")
        .sort((a, b) => b.date.localeCompare(a.date))[0],
    [mealPlans],
  )
  const intakeSubmission = intakeSubmissions[0]
  const dietStyle = resolveDietStyle(patient.dietStyle, patient.nutritionPreferences)
  const dietExclusions = patient.nutritionPreferences ?? []
  const latestWeightChange =
    sortedMeasurements.length > 1 && latestMeasurement
      ? latestMeasurement.weight - sortedMeasurements[0].weight
      : undefined
  const ageYears = Math.max(
    0,
    Math.floor((todayDate.getTime() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
  )
  const energySex: EnergySex =
    patient.gender === "m" ? "male" : patient.gender === "w" ? "female" : "diverse"
  const currentBmiCategory = bmiCategory(latestMeasurement?.bmi ?? 0)
  const healthyWeight = latestMeasurement
    ? healthyWeightRange(latestMeasurement.height, ageYears)
    : null
  // Drawn on the scale next to the current value, so the gap is visible rather
  // than only stated in kilograms.
  const goalBmi =
    patient.goalWeight && latestMeasurement?.height
      ? patient.goalWeight / (latestMeasurement.height / 100) ** 2
      : undefined
  const goalDistance =
    patient.goalWeight && latestMeasurement
      ? latestMeasurement.weight - patient.goalWeight
      : undefined
  // The WHO badge and the sensible range can disagree — a 74-year-old at BMI
  // 21,6 reads "Normalgewicht" while sitting below the range recommended at
  // that age. Saying where the weight actually falls settles it.
  const rangePosition = (() => {
    if (!latestMeasurement || !healthyWeight) return "Ohne Größe lässt sich kein Bereich berechnen."
    const weight = latestMeasurement.weight
    const current = `${formatNumber(weight, 1)} kg`
    if (weight < healthyWeight.min) {
      return `${current} liegt ${formatNumber(healthyWeight.min - weight, 1)} kg unter dem sinnvollen Bereich.`
    }
    if (weight > healthyWeight.max) {
      return `${current} liegt ${formatNumber(weight - healthyWeight.max, 1)} kg darüber.`
    }
    return `${current} liegt im sinnvollen Bereich.`
  })()
  // The calorie scenario lives here, not in the Energie card, because the
  // weight chart draws the same one. Two owners would let the dashed line and
  // the numbers under the slider disagree.
  const maintenanceKcal = totalEnergyExpenditure ?? 0
  const [targetKcal, setTargetKcal] = useState(patient.dailyCalorieGoal ?? maintenanceKcal)
  const [lastEnergyInputs, setLastEnergyInputs] = useState(
    `${patient.dailyCalorieGoal}:${maintenanceKcal}`,
  )
  const energyInputs = `${patient.dailyCalorieGoal}:${maintenanceKcal}`
  if (energyInputs !== lastEnergyInputs) {
    setLastEnergyInputs(energyInputs)
    setTargetKcal(patient.dailyCalorieGoal ?? maintenanceKcal)
  }

  // Depends on the two numbers rather than the measurement object: the compiler
  // cannot prove the object is never mutated, and bails out of memoising the
  // whole component when it is named as a dependency.
  const measuredWeight = latestMeasurement?.weight
  const measuredHeight = latestMeasurement?.height
  // Not wrapped in useMemo: React Compiler memoises this component, and a
  // manual memo here referenced values it could not prove immutable, which made
  // it bail out of optimising the whole file.
  const projection =
    measuredWeight && measuredHeight && totalEnergyExpenditure
      ? projectWeight({
          targetKcal,
          weightKg: measuredWeight,
          heightCm: measuredHeight,
          ageYears,
          sex: energySex,
          formula: PATIENT_ENERGY_FORMULA,
          pal: palValue,
          goalWeightKg: patient.goalWeight,
          weeks: PROJECTION_WEEKS,
        })
      : null

  /**
   * Measured weights, then the projection dashed on from the newest one.
   *
   * The projection never covers a stretch we already have readings for: it is
   * re-anchored to the last measurement every time one arrives, so a plan made
   * in May is not left drawn over what actually happened in June. The anchor
   * point carries both series so the dashed line starts exactly where the solid
   * one ends instead of floating next to it.
   */
  const weightChartData = (() => {
    if (measuredPoints.length === 0) return []
    const lastIndex = measuredPoints.length - 1
    const anchorTs = measuredPoints[lastIndex].ts
    const measured = measuredPoints.map((point, index) => ({
      ts: point.ts,
      weight: point.weight as number | undefined,
      projected: index === lastIndex ? projection?.points[0].weightKg : undefined,
    }))
    const projected = (projection?.points ?? []).slice(1).map((point) => ({
      ts: anchorTs + point.week * 7 * DAY_MS,
      weight: undefined,
      projected: point.weightKg,
    }))
    return [...measured, ...projected]
  })()

  // A narrow range needs a decimal or two ticks round to the same label; a wide
  // one does not, and "97,0 kg" only adds noise.
  const weightValues = weightChartData.flatMap((row) =>
    [row.weight, row.projected].filter((value): value is number => value !== undefined),
  )
  const weightTickDecimals =
    weightValues.length && Math.max(...weightValues) - Math.min(...weightValues) < 6 ? 1 : 0

  const currentStage = derivePatientIntakeStage({
    patient,
    links: intakeLinks,
    submissions: intakeSubmissions,
    sessions,
    appointments,
    now: todayDate,
  })
  const stageMeta = INTAKE_STAGE_META[currentStage]
  const phaseStyle = { borderColor: stageMeta.color } as CSSProperties
  const latestIntakeLink = useMemo(
    () => [...intakeLinks].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0],
    [intakeLinks],
  )
  const eventCandidates: Array<TimelineEvent | null> = [
    latestIntakeLink
      ? {
          id: `invite-${latestIntakeLink.id}`,
          date: latestIntakeLink.createdAt,
          label: "Einladung versendet",
          detail: "Aufnahmelink wurde erstellt und geteilt",
          stage: "eingeladen" as const,
        }
      : null,
    intakeSubmission
      ? {
          id: `submission-${intakeSubmission.id}`,
          date: intakeSubmission.submittedAt,
          label: "Aufnahme eingegangen",
          detail: "Angaben des Patienten liegen vor",
          stage: "fragebogen" as const,
        }
      : null,
    intakeSubmission?.reviewedAt
      ? {
          id: `applied-${intakeSubmission.id}`,
          date: intakeSubmission.reviewedAt,
          label: "Aufnahme übernommen",
          detail: "In die Patientenakte übertragen",
          stage: "plan" as const,
        }
      : null,
    latestMeasurement
      ? {
          id: `measurement-${latestMeasurement.id}`,
          date: latestMeasurement.date,
          label: "Messwerte erfasst",
          detail: `${formatNumber(latestMeasurement.weight, 1)} kg · BMI ${formatNumber(latestMeasurement.bmi, 1)}`,
          stage: "beratung" as const,
        }
      : null,
    latestSession
      ? {
          id: `session-${latestSession.id}`,
          date: latestSession.date,
          label: "Letzte Beratung",
          detail: latestSession.type,
          stage: "beratung" as const,
        }
      : null,
    currentPlan
      ? {
          id: `plan-${currentPlan.id}`,
          date: currentPlan.date,
          label: "Ernährungsplan",
          detail: currentPlan.title ?? "Plan angelegt",
          stage: "plan" as const,
        }
      : null,
    nextAppointment
      ? {
          id: `appointment-${nextAppointment.id}`,
          date: nextAppointment.date,
          label: "Nächster Termin",
          detail: `${nextAppointment.title} · ${nextAppointment.startTime.slice(0, 5)} Uhr`,
          stage: "beratung" as const,
          isUpcoming: true,
        }
      : null,
  ]
  const events = eventCandidates
    .filter((event): event is TimelineEvent => event !== null)
    .sort((left, right) => right.date.localeCompare(left.date))

  const careTags = [
    ...(patient.indications ?? []),
    ...diagnoses.map((entry) => entry.diagnosis),
  ]
  const foodTags = [
    ...(dietStyle ? [DIET_STYLE_LABELS[dietStyle]] : []),
    ...dietExclusions.map((entry) => DIET_EXCLUSION_LABELS[entry]),
    ...patientAllergens.map((entry) => {
      const label = ALLERGEN_MAP.get(entry.allergenId)?.label ?? entry.allergenId
      return `${label} · ${ALLERGEN_TYPE_LABELS[entry.type]}`
    }),
  ]

  return (
    <div className="space-y-4">
      {/* One band, one line per fact. The phase badge and its progress moved up
          next to the patient's name, so nothing here restates the phase. */}
      <Card style={phaseStyle} className="overflow-hidden py-0">
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-4 [&>*]:border-border">
          <FactCell
            label="Letzter Kontakt"
            value={latestSession ? formatDate(latestSession.date) : "Nicht erfasst"}
            muted={!latestSession}
          />
          <FactCell
            label="Nächster Termin"
            value={
              nextAppointment
                ? `${formatDate(nextAppointment.date)} · ${nextAppointment.startTime.slice(0, 5)}`
                : "Nicht geplant"
            }
            muted={!nextAppointment}
          />
          <FactCell label="Aktueller Plan">
            {currentPlan ? (
              <Link
                href={`/patienten/${patient.id}?tab=ernaehrungsplan`}
                className="group flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                <span className="truncate">{currentPlan.title ?? "Ernährungsplan"}</span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href={`/patienten/${patient.id}?tab=ernaehrungsplan`}
                className="group flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                <span className="truncate">Plan erstellen</span>
                <ChevronRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </FactCell>
          <FactCell label={intakeSubmission ? "Aufnahme & Messwerte" : "Messwerte"}>
            <div className="flex items-center gap-3">
              {intakeSubmission ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <FactButton value={`Aufnahme ${formatDate(intakeSubmission.submittedAt)}`} />
                  </DialogTrigger>
                  <DialogContent
                    className="max-h-[85vh] max-w-3xl overflow-y-auto"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DialogHeader>
                      <DialogTitle>Originalaufnahme</DialogTitle>
                      <DialogDescription>
                        Eingegangen am {formatDate(intakeSubmission.submittedAt)}. Diese Angaben
                        bleiben als Quelle erhalten.
                      </DialogDescription>
                    </DialogHeader>
                    <PatientIntakeReview submission={intakeSubmission} />
                  </DialogContent>
                </Dialog>
              ) : null}
              <FactButton
                value={
                  latestMeasurement
                    ? `Messung ${formatDate(latestMeasurement.date)}`
                    : "Messwerte erfassen"
                }
                muted={!latestMeasurement}
                onClick={onAddMeasurement}
              />
            </div>
          </FactCell>
        </div>
      </Card>

      {/* The curve is the thing a practitioner points at during a session, so
          it gets the full width and the room to be read from across a desk. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            Gewichtsverlauf
          </CardTitle>
          <CardDescription>
            {weightChartData.length
              ? projection
                ? "Gemessen durchgezogen, die Prognose zum Tagesziel gestrichelt."
                : "Die letzten Messungen."
              : "Nach der ersten Messung erscheint hier der Verlauf."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Age, weight and height used to hold a card of their own for three
              numbers. They are context for the curve below, so they read as one
              line above it. */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b pb-3">
            <BodyFact
              label="Alter"
              value={`${ageYears}`}
              unit="Jahre"
              note={`geb. ${formatDate(patient.dateOfBirth)}`}
            />
            <BodyFact
              label="Gewicht"
              value={latestMeasurement ? formatNumber(latestMeasurement.weight, 1) : "–"}
              unit={latestMeasurement ? "kg" : undefined}
              note={
                latestWeightChange !== undefined
                  ? `${latestWeightChange > 0 ? "+" : ""}${formatNumber(latestWeightChange, 1)} kg seit Beginn`
                  : latestMeasurement
                    ? `gemessen am ${formatDate(latestMeasurement.date)}`
                    : "noch nicht gemessen"
              }
            />
            <BodyFact
              label="Größe"
              value={latestMeasurement ? formatNumber(latestMeasurement.height) : "–"}
              unit={latestMeasurement ? "cm" : undefined}
              note={latestMeasurement ? "aus letzter Messung" : "noch nicht gemessen"}
            />
          </div>
          {weightChartData.length ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                {/* No negative left margin: it clawed back space by cutting
                    the leading digit off every tick, so 97,4 kg read 7,4 kg. */}
                <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  {/* A numeric time axis, not one category per row: measured
                      and projected points are weeks apart and must not be
                      spaced evenly. */}
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value: number) => formatDate(new Date(value))}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  {/* Integer bounds and rounded ticks. String domains like "dataMin - 1"
                      let recharts pick ticks such as 77,75843, which the axis then
                      renders as an unreadable run of digits. */}
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={56}
                    unit=" kg"
                    domain={[
                      (min: number) => (weightTickDecimals ? min - 1 : Math.floor(min - 1)),
                      (max: number) => (weightTickDecimals ? max + 1 : Math.ceil(max + 1)),
                    ]}
                    tickFormatter={(value: number) => formatNumber(value, weightTickDecimals)}
                  />
                  <Tooltip
                    content={<WeightTooltip />}
                    cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                  />
                  {patient.goalWeight ? (
                    <ReferenceLine
                      y={patient.goalWeight}
                      stroke="var(--color-muted-foreground)"
                      strokeDasharray="2 4"
                      label={{ value: "Ziel", position: "insideTopLeft", fontSize: 11 }}
                    />
                  ) : null}
                  <Line type="monotone" dataKey="weight" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeOpacity={0.75}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Scale className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Noch keine Verlaufskurve</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Erfasse einen Messwert, dann erscheinen hier Verlauf und Prognose.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Below it, the two levers: what to eat on the left, where that lands on
          the right. */}
      <div className="grid gap-4 lg:grid-cols-5">
        {latestMeasurement && basalMetabolicRate && totalEnergyExpenditure ? (
          <div className="lg:col-span-3">
            <PatientEnergyCard
              weightKg={latestMeasurement.weight}
              pal={palValue}
              basalMetabolicRate={basalMetabolicRate}
              totalEnergyExpenditure={totalEnergyExpenditure}
              dailyCalorieGoal={patient.dailyCalorieGoal}
              goalWeightKg={patient.goalWeight}
              targetKcal={targetKcal}
              onTargetChange={setTargetKcal}
              projection={projection!}
              onSaveCalorieGoal={onSaveCalorieGoal}
            />
          </div>
        ) : (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-primary" />
                Energie und Kalorienziel
              </CardTitle>
              <CardDescription>
                Berechnung aus den aktuellen Messwerten und dem Aktivitätswert.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Für die Berechnung fehlen aktuelle Größe und Gewicht.
              </p>
              <Button variant="outline" className="w-full" onClick={onAddMeasurement}>
                Messwerte erfassen
              </Button>
            </CardContent>
          </Card>
        )}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              BMI und Zielgewicht
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestMeasurement ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-3xl font-semibold tabular-nums">
                    {formatNumber(latestMeasurement.bmi, 1)}
                  </span>
                  <Badge
                    variant="outline"
                    style={{ borderColor: currentBmiCategory.color, color: currentBmiCategory.color }}
                  >
                    {currentBmiCategory.label}
                  </Badge>
                </div>
                <BmiScale bmi={latestMeasurement.bmi} goalBmi={goalBmi} />
                <div className="[&>*:last-child]:border-b-0">
                  <SummaryRow
                    label="Sinnvoller Bereich"
                    value={
                      healthyWeight
                        ? `${formatNumber(healthyWeight.min, 1)}–${formatNumber(healthyWeight.max, 1)} kg`
                        : "Größe fehlt"
                    }
                    muted={!healthyWeight}
                  />
                  <SummaryRow
                    label="Zielgewicht"
                    value={
                      patient.goalWeight
                        ? `${formatNumber(patient.goalWeight, 1)} kg`
                        : "Nicht festgelegt"
                    }
                    muted={!patient.goalWeight}
                  />
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    {rangePosition}
                    {goalDistance !== undefined
                      ? ` Noch ${formatNumber(Math.abs(goalDistance), 1)} kg ${goalDistance > 0 ? "abzunehmen" : "zuzunehmen"} bis zum Ziel.`
                      : ""}
                  </p>
                  <p>
                    {healthyWeight?.ageAdjusted
                      ? "Ab 65 Jahren liegt der empfohlene Bereich höher (BMI 22–27), weil dort ein zu niedriges Gewicht das größere Risiko ist."
                      : "Bereich nach WHO-Grenzen. Der BMI ist ein Screeningwert, keine Diagnose."}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Für den BMI fehlen Gewicht und Größe.
                </p>
                <Button variant="outline" className="w-full" onClick={onAddMeasurement}>
                  Messwerte erfassen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Stethoscope className="h-4 w-4 text-primary" /> Behandlung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Indikationen und Diagnosen</p>
              {careTags.length ? <div className="flex flex-wrap gap-1.5">{careTags.map((tag, index) => <Badge key={`${tag}-${index}`} variant="secondary">{tag}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Noch nicht erfasst.</p>}
            </div>
            {patient.patientGoals ? <Detail label="Ziel des Patienten" value={patient.patientGoals} /> : null}
            <div>
              <p className="mb-2 text-sm font-medium">Ernährung und Einschränkungen</p>
              {foodTags.length ? <div className="flex flex-wrap gap-1.5">{foodTags.map((tag, index) => <Badge key={`${tag}-${index}`} variant="outline">{tag}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Noch nicht erfasst.</p>}
            </div>
            <Button variant="outline" asChild><Link href={`/patienten/${patient.id}?tab=diagnosen`}>Gesundheitsdaten bearbeiten</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Nächste Schritte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">{nextAppointment ? nextAppointment.title : "Kein Termin geplant"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{nextAppointment ? `${formatDate(nextAppointment.date)} · ${nextAppointment.startTime.slice(0, 5)} Uhr` : "Noch kein Termin vereinbart."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link href={`/kalender?patientId=${patient.id}`}>Termin planen</Link></Button>
              <Button variant="outline" asChild><Link href={`/patienten/${patient.id}?tab=beratungen`}>Beratung dokumentieren</Link></Button>
              <Button asChild><Link href={`/patienten/${patient.id}?tab=ernaehrungsplan`}>{currentPlan ? <FileText className="mr-2 h-4 w-4" /> : <UtensilsCrossed className="mr-2 h-4 w-4" />}{currentPlan ? "Plan öffnen" : "Plan erstellen"}</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wichtige Ereignisse</CardTitle>
          <CardDescription>Meilensteine von der Einladung bis zur laufenden Betreuung.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length ? (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative rounded-lg border bg-card p-3">
                  <span
                    className="absolute -left-[1.81rem] top-4 flex h-5 w-5 items-center justify-center rounded-full border-4 border-card"
                    style={{ backgroundColor: INTAKE_STAGE_META[event.stage].color }}
                    aria-hidden="true"
                  >
                    {event.label === "Einladung versendet" ? <Send className="h-2.5 w-2.5 text-white" /> : <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.isUpcoming ? <Badge variant="outline">Geplant</Badge> : null}
                      <p className="text-xs font-medium text-muted-foreground">{formatDate(event.date)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Ereignisse erfasst.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
