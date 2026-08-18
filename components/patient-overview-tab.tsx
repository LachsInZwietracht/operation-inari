"use client"

import { parseISO } from "date-fns"
import Link from "next/link"
import type React from "react"
import { useMemo, useState, type CSSProperties } from "react"
import {
  CalendarPlus,
  Check,
  ChevronRight,
  FileText,
  Info,
  Send,
  Stethoscope,
  Target,
  UtensilsCrossed,
} from "lucide-react"

import { PatientEnergyCard } from "@/components/patient-energy-card"
import { PatientStatsTab } from "@/components/patient-stats-tab"
import { PatientIntakeReview } from "@/components/patient-intake-review"
import {
  PatientWeightChart,
  type HorizonValue,
} from "@/components/patient-weight-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
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
  ActivityEntry,
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
  /** Client-recorded activities, drawn in the Verlauf section at the bottom. */
  activities: ActivityEntry[]
  mealPlans: DailyMealPlan[]
  intakeLinks: PatientIntakeLink[]
  intakeSubmissions: PatientIntakeSubmission[]
  /** Resolved rate — the hand-set override when there is one, the formula otherwise. */
  basalMetabolicRate?: number
  /** Mifflin-St Jeor from the current measurements, for the reset affordance. */
  calculatedBasalMetabolicRate?: number
  basalOverride?: number
  totalEnergyExpenditure?: number
  palValue: number
  onPalChange: (pal: number) => void
  onSaveBasalOverride: (kcal: number | undefined) => Promise<void>
  onAddMeasurement: () => void
  onSaveCalorieGoal: (kcal: number) => Promise<void>
}

/**
 * One line of a compact fact list: label left, answer right.
 *
 * Used inside hover cards and the BMI panel, where a fact needs a name but not
 * a heading and a paragraph.
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
    <div className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0">
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
 * Every cell gets an equal share of the row and truncates its own value, which
 * is what the old four-column layout got wrong — the last cell carried two
 * buttons, so "Messung 16.08.2026" was cut off mid-date.
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
      className="group flex w-full min-w-0 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("truncate text-sm font-medium", muted && "text-muted-foreground")}>
        {value}
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
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
    </div>
  )
}

/** Six months ahead: far enough to show a trend, near enough to still mean something. */
const PROJECTION_WEEKS = 26

interface TimelineEvent {
  id: string
  date: string
  label: string
  detail: string
  stage: IntakeStage
  isUpcoming?: boolean
}

/**
 * The milestones on one horizontal rail, oldest on the left.
 *
 * Stacked vertically they cost a screen of height for six short facts, and the
 * order had to be read rather than seen. Laid out along a line, the spacing
 * between them is the information — and the whole history fits in the height of
 * a single card.
 */
function EventRail({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Ereignisse erfasst.</p>
  }
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="relative flex min-w-max gap-6">
        {/* The rail itself, behind the dots. A single event has nothing to
            connect, so the line would only be decoration. */}
        {events.length > 1 ? (
          <span
            className="absolute left-3 right-3 top-[7px] h-px bg-border"
            aria-hidden="true"
          />
        ) : null}
        {events.map((event) => (
          <li key={event.id} className="relative w-[9.5rem] shrink-0">
            <span
              className={cn(
                "flex size-3.5 items-center justify-center rounded-full ring-4 ring-card",
                event.isUpcoming && "bg-card",
              )}
              style={
                event.isUpcoming
                  ? { border: `2px solid ${INTAKE_STAGE_META[event.stage].color}` }
                  : { backgroundColor: INTAKE_STAGE_META[event.stage].color }
              }
              aria-hidden="true"
            >
              {event.isUpcoming ? null : event.label === "Einladung versendet" ? (
                <Send className="size-2 text-white" />
              ) : (
                <Check className="size-2 text-white" />
              )}
            </span>
            <p className="mt-2.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {formatDate(event.date)}
              {event.isUpcoming ? " · geplant" : ""}
            </p>
            <p className="mt-0.5 text-sm font-medium leading-tight">{event.label}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground">
              {event.detail}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PatientOverviewTab({
  patient,
  anthropometrics,
  appointments,
  sessions,
  diagnoses,
  patientAllergens,
  activities,
  mealPlans,
  intakeLinks,
  intakeSubmissions,
  basalMetabolicRate,
  calculatedBasalMetabolicRate,
  basalOverride,
  totalEnergyExpenditure,
  palValue,
  onPalChange,
  onSaveBasalOverride,
  onAddMeasurement,
  onSaveCalorieGoal,
}: PatientOverviewTabProps) {
  const [todayDate] = useState(() => new Date())
  const [horizon, setHorizon] = useState<HorizonValue>("6")
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
        bmi: entry.bmi,
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
  //
  // Always projected to the full horizon. The chart's 1/3/6-month control clips
  // what is drawn; it does not shorten the simulation, so the milestones and
  // the goal date in the energy card stay available at every setting.
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
          basalOverrideKcal: basalOverride,
          goalWeightKg: patient.goalWeight,
          weeks: PROJECTION_WEEKS,
        })
      : null

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
          detail: "Aufnahmelink erstellt und geteilt",
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
  // Oldest first: the rail runs left to right, so the reading order and the
  // chronology have to agree.
  const events = eventCandidates
    .filter((event): event is TimelineEvent => event !== null)
    .sort((left, right) => left.date.localeCompare(right.date))

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

  const goalText = patient.patientGoals?.trim() || patient.intakeReason?.trim()
  const planHref = `/patienten/${patient.id}?tab=ernaehrungsplan`

  return (
    <div className="space-y-4">
      {/* One band, one line per fact. Every cell gets the same share of the row,
          which is what stopped the last one from truncating mid-date. */}
      <Card style={phaseStyle} className="overflow-hidden py-0">
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-3 xl:grid-cols-6 [&>*]:border-border">
          <FactCell label="Ziel">
            <HoverCard openDelay={80} closeDelay={60}>
              <HoverCardTrigger asChild>
                <Link
                  href={planHref}
                  className="group flex min-w-0 items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      !goalText && "text-muted-foreground",
                    )}
                  >
                    {goalText ?? "Nicht festgelegt"}
                  </span>
                  <Info
                    className="size-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </HoverCardTrigger>
              <HoverCardContent className="w-72" side="bottom" align="start">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ziel der Beratung
                </p>
                <p className="mt-1 whitespace-pre-line text-sm">
                  {goalText ?? "Noch nichts hinterlegt. Kommt aus dem Aufnahmebogen oder der Akte."}
                </p>
                <div className="mt-2">
                  <SummaryRow
                    label="Zielgewicht"
                    value={
                      patient.goalWeight
                        ? `${formatNumber(patient.goalWeight, 1)} kg`
                        : "Nicht festgelegt"
                    }
                    muted={!patient.goalWeight}
                  />
                  <SummaryRow
                    label="Kalorienziel"
                    value={
                      patient.dailyCalorieGoal
                        ? `${formatNumber(patient.dailyCalorieGoal)} kcal`
                        : "Nicht festgelegt"
                    }
                    muted={!patient.dailyCalorieGoal}
                  />
                </div>
              </HoverCardContent>
            </HoverCard>
          </FactCell>
          <FactCell
            label="Letzter Kontakt"
            value={latestSession ? formatDate(latestSession.date) : "Nicht erfasst"}
            muted={!latestSession}
          />
          <FactCell label="Nächster Termin">
            {nextAppointment ? (
              <p className="truncate text-sm font-medium">
                {formatDate(nextAppointment.date)} · {nextAppointment.startTime.slice(0, 5)}
              </p>
            ) : (
              <Link
                href={`/kalender?patientId=${patient.id}`}
                className="group flex min-w-0 items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <CalendarPlus className="size-3.5 shrink-0" />
                <span className="truncate">Termin planen</span>
              </Link>
            )}
          </FactCell>
          <FactCell label="Aktueller Plan">
            <Link
              href={planHref}
              className={cn(
                "group flex min-w-0 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline",
                !currentPlan && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {currentPlan ? (currentPlan.title ?? "Ernährungsplan") : "Plan erstellen"}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </FactCell>
          <FactCell label="Aufnahme">
            {intakeSubmission ? (
              <Dialog>
                <DialogTrigger asChild>
                  {/* The visible text is a date, so the button needs a name
                      that says what opening it does. */}
                  <FactButton
                    value={formatDate(intakeSubmission.submittedAt)}
                    aria-label={`Originalaufnahme vom ${formatDate(intakeSubmission.submittedAt)} öffnen`}
                  />
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
            ) : (
              <p className="truncate text-sm font-medium text-muted-foreground">
                Nicht eingegangen
              </p>
            )}
          </FactCell>
          <FactCell label="Letzte Messung">
            <FactButton
              value={latestMeasurement ? formatDate(latestMeasurement.date) : "Messwerte erfassen"}
              muted={!latestMeasurement}
              onClick={onAddMeasurement}
            />
          </FactCell>
        </div>
      </Card>

      {/* The first screen: the curve, and the two panels that explain it. */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PatientWeightChart
            points={measuredPoints}
            projection={projection}
            heightCm={latestMeasurement?.height}
            goalWeightKg={patient.goalWeight}
            ageYears={ageYears}
            dateOfBirth={patient.dateOfBirth}
            measuredOn={latestMeasurement?.date}
            horizon={horizon}
            onHorizonChange={setHorizon}
            onAddMeasurement={onAddMeasurement}
          />
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Target className="size-3.5" />
              BMI und Zielgewicht
            </p>
            {latestMeasurement ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-3xl font-semibold tabular-nums leading-none">
                    {formatNumber(latestMeasurement.bmi, 1)}
                  </span>
                  <Badge
                    variant="outline"
                    style={{ borderColor: currentBmiCategory.color, color: currentBmiCategory.color }}
                  >
                    {currentBmiCategory.label}
                  </Badge>
                  {/* The two paragraphs of caveat this card used to carry sit
                      behind here — they explain, they do not decide. */}
                  <HoverCard openDelay={80} closeDelay={60}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="ml-auto rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Erläuterung zum BMI"
                      >
                        <Info className="size-3.5" />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72 space-y-2 text-sm" side="bottom" align="end">
                      <p>
                        {rangePosition}
                        {goalDistance !== undefined
                          ? ` Noch ${formatNumber(Math.abs(goalDistance), 1)} kg ${goalDistance > 0 ? "abzunehmen" : "zuzunehmen"} bis zum Ziel.`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {healthyWeight?.ageAdjusted
                          ? "Ab 65 Jahren liegt der empfohlene Bereich höher (BMI 22–27), weil dort ein zu niedriges Gewicht das größere Risiko ist."
                          : "Bereich nach WHO-Grenzen. Der BMI ist ein Screeningwert, keine Diagnose."}
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                </div>
                <BmiScale bmi={latestMeasurement.bmi} goalBmi={goalBmi} />
                <div>
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
                  {goalDistance !== undefined ? (
                    <SummaryRow
                      label="Noch"
                      value={`${formatNumber(Math.abs(goalDistance), 1)} kg ${goalDistance > 0 ? "abnehmen" : "zunehmen"}`}
                    />
                  ) : null}
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

      {latestMeasurement &&
      basalMetabolicRate &&
      calculatedBasalMetabolicRate &&
      totalEnergyExpenditure &&
      projection ? (
        <PatientEnergyCard
          weightKg={latestMeasurement.weight}
          pal={palValue}
          onPalChange={onPalChange}
          basalMetabolicRate={basalMetabolicRate}
          calculatedBasalMetabolicRate={calculatedBasalMetabolicRate}
          basalOverride={basalOverride}
          onSaveBasalOverride={onSaveBasalOverride}
          totalEnergyExpenditure={totalEnergyExpenditure}
          dailyCalorieGoal={patient.dailyCalorieGoal}
          goalWeightKg={patient.goalWeight}
          targetKcal={targetKcal}
          onTargetChange={setTargetKcal}
          projection={projection}
          onSaveCalorieGoal={onSaveCalorieGoal}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-sm font-medium">Energie und Kalorienziel</p>
              <p className="text-sm text-muted-foreground">
                Für die Berechnung fehlen aktuelle Größe und Gewicht.
              </p>
            </div>
            <Button variant="outline" onClick={onAddMeasurement}>
              Messwerte erfassen
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="size-4 text-primary" /> Behandlung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Indikationen und Diagnosen</p>
              {careTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {careTags.map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch nicht erfasst.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Ernährung und Einschränkungen</p>
              {foodTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {foodTags.map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch nicht erfasst.</p>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patienten/${patient.id}?tab=diagnosen`}>
                Gesundheitsdaten bearbeiten
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wichtige Ereignisse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EventRail events={events} />
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button variant={nextAppointment ? "outline" : "default"} size="sm" asChild>
                <Link href={`/kalender?patientId=${patient.id}`}>
                  <CalendarPlus className="mr-1.5 size-4" />
                  Termin planen
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/patienten/${patient.id}?tab=beratungen`}>
                  Beratung dokumentieren
                </Link>
              </Button>
              <Button variant={currentPlan ? "outline" : "default"} size="sm" asChild>
                <Link href={planHref}>
                  {currentPlan ? (
                    <FileText className="mr-1.5 size-4" />
                  ) : (
                    <UtensilsCrossed className="mr-1.5 size-4" />
                  )}
                  {currentPlan ? "Plan öffnen" : "Plan erstellen"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Folded in from the former Statistiken tab. What the weight chart above
          already draws — the curve, the BMI, the body composition history — is
          not repeated here; what is left is the trend and the numbers behind it. */}
      <section aria-label="Verlauf und Statistik" className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Verlauf und Statistik</h2>
          <p className="text-sm text-muted-foreground">
            Was sich seit der ersten Messung verändert hat.
          </p>
        </div>
        <PatientStatsTab
          embedded
          patient={patient}
          entries={anthropometrics}
          activities={activities}
          sessions={sessions}
        />
      </section>
    </div>
  )
}
