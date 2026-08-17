"use client"

import Link from "next/link"
import type React from "react"
import { useMemo, useState, type CSSProperties } from "react"
import {
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Flame,
  HeartPulse,
  Ruler,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { PatientIntakeReview } from "@/components/patient-intake-review"
import { IntakeStageProgress } from "@/components/intake-stage-progress"
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
import { DIET_EXCLUSION_LABELS, DIET_STYLE_LABELS, resolveDietStyle } from "@/lib/diet-constants"
import { formatDate, formatNumber } from "@/lib/format"
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
 * A summary row that opens something. Same shape as {@link SummaryRow}.
 *
 * Spreads the remaining props onto the button so it can serve as a
 * `DialogTrigger asChild` child — Radix passes its handlers down that way, and
 * swallowing them here would leave the trigger inert.
 */
function SummaryActionRow({
  label,
  value,
  muted,
  ...props
}: React.ComponentProps<"button"> & {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      className="group flex w-full items-baseline justify-between gap-3 border-b py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className={cn("text-sm font-medium tabular-nums", muted && "text-muted-foreground")}>
          {value}
        </span>
        <ChevronRight className="size-3.5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  progress,
  progressLabel,
  accentColor = "var(--primary)",
}: {
  icon: typeof Scale
  label: string
  value: string
  note?: string
  progress?: number
  progressLabel?: string
  accentColor?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
          </div>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`, color: accentColor }}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        {progress !== undefined ? (
          <div className="mt-4 space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(progress, 100))}%`, backgroundColor: accentColor }}
              />
            </div>
            {progressLabel ? <p className="text-[11px] text-muted-foreground">{progressLabel}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function bmiProgress(bmi?: number): number | undefined {
  if (bmi === undefined) return undefined
  return Math.max(0, Math.min(((bmi - 12) / 28) * 100, 100))
}

function bmiLabel(bmi?: number): string | undefined {
  if (bmi === undefined) return undefined
  if (bmi < 18.5) return "BMI-Skala: unter 18,5"
  if (bmi < 25) return "BMI-Skala: 18,5–24,9"
  if (bmi < 30) return "BMI-Skala: 25,0–29,9"
  return "BMI-Skala: ab 30,0"
}

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
}: PatientOverviewTabProps) {
  const [todayDate] = useState(() => new Date())
  const sortedMeasurements = useMemo(
    () => [...anthropometrics].sort((a, b) => a.date.localeCompare(b.date)),
    [anthropometrics],
  )
  const latestMeasurement = sortedMeasurements.at(-1)
  const chartData = useMemo(
    () =>
      sortedMeasurements.slice(-12).map((entry) => ({
        date: formatDate(entry.date),
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
      <Card style={phaseStyle}>
        {/* `flex` is needed as well as `flex-row`: CardHeader is a grid by
            default, and flex-direction alone does not override display. */}
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-base">Aktueller Stand</CardTitle>
            <Badge style={{ backgroundColor: stageMeta.color, color: "white" }}>
              {stageMeta.label}
            </Badge>
          </div>
          <IntakeStageProgress stage={currentStage} />
        </CardHeader>
        <CardContent className="border-t pt-2">
          {/* The closing row of the grid carries no divider — one column on
              small screens, two from `sm` up, so the count differs per layout. */}
          <div className="grid gap-x-8 [&>*:last-child]:border-b-0 sm:grid-cols-2 sm:[&>*:nth-last-child(-n+2)]:border-b-0">
            <SummaryRow
              label="Letzter Kontakt"
              value={latestSession ? formatDate(latestSession.date) : "Nicht erfasst"}
              muted={!latestSession}
            />
            <SummaryRow
              label="Nächster Termin"
              value={
                nextAppointment
                  ? `${formatDate(nextAppointment.date)} · ${nextAppointment.startTime.slice(0, 5)}`
                  : "Nicht geplant"
              }
              muted={!nextAppointment}
            />
            <SummaryRow
              label="Aktueller Plan"
              value={currentPlan ? (currentPlan.title ?? "Ernährungsplan") : "Kein Plan"}
              muted={!currentPlan}
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
            {intakeSubmission ? (
              <Dialog>
                <DialogTrigger asChild>
                  <SummaryActionRow
                    label="Originalaufnahme"
                    value={formatDate(intakeSubmission.submittedAt)}
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
              <SummaryRow label="Originalaufnahme" value="Nicht vorhanden" muted />
            )}
            <SummaryActionRow
              label="Messwerte erfassen"
              value={
                latestMeasurement
                  ? `Zuletzt ${formatDate(latestMeasurement.date)}`
                  : "Keine Messung"
              }
              muted={!latestMeasurement}
              onClick={onAddMeasurement}
            />
          </div>
        </CardContent>
      </Card>

      <section aria-label="Körperwerte" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={HeartPulse}
          label="Alter"
          value={`${ageYears} Jahre`}
          note={`Geboren am ${formatDate(patient.dateOfBirth)}`}
          progress={ageYears}
          progressLabel="Altersskala von 0 bis 100 Jahren"
          accentColor={stageMeta.color}
        />
        <MetricCard
          icon={Scale}
          label="Gewicht"
          value={latestMeasurement ? `${formatNumber(latestMeasurement.weight, 1)} kg` : "–"}
          note={latestMeasurement ? `vom ${formatDate(latestMeasurement.date)}` : "Messwert fehlt"}
          accentColor={stageMeta.color}
        />
        <MetricCard
          icon={Ruler}
          label="Größe"
          value={latestMeasurement ? `${formatNumber(latestMeasurement.height)} cm` : "–"}
          note={latestMeasurement ? "aus letzter Messung" : "Messwert fehlt"}
          progress={latestMeasurement ? ((latestMeasurement.height - 120) / 100) * 100 : undefined}
          progressLabel={latestMeasurement ? "Größenskala von 120 bis 220 cm" : undefined}
          accentColor={stageMeta.color}
        />
        <MetricCard
          icon={HeartPulse}
          label="BMI"
          value={latestMeasurement ? formatNumber(latestMeasurement.bmi, 1) : "–"}
          note={latestWeightChange === undefined ? "Verlauf nach Messung sichtbar" : `${latestWeightChange > 0 ? "+" : ""}${formatNumber(latestWeightChange, 1)} kg seit erster Messung`}
          progress={bmiProgress(latestMeasurement?.bmi)}
          progressLabel={bmiLabel(latestMeasurement?.bmi)}
          accentColor={stageMeta.color}
        />
        <MetricCard
          icon={Target}
          label="Zielgewicht"
          value={patient.goalWeight ? `${formatNumber(patient.goalWeight, 1)} kg` : "–"}
          note={patient.goalWeight && latestMeasurement ? `${formatNumber(Math.abs(latestMeasurement.weight - patient.goalWeight), 1)} kg bis zum Ziel` : patient.goalWeight ? "in der Patientenakte festgelegt" : "Ziel noch nicht festgelegt"}
          accentColor={stageMeta.color}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" />
              Gewichtsverlauf
            </CardTitle>
            <CardDescription>
              {chartData.length > 1 ? "Die letzten Messungen im Überblick." : "Nach der zweiten Messung erscheint hier der Verlauf."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} unit=" kg" domain={["dataMin - 1", "dataMax + 1"]} />
                    <Tooltip formatter={(value) => [`${formatNumber(Number(value), 1)} kg`, "Gewicht"]} />
                    <Line type="monotone" dataKey="weight" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <Scale className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Noch keine Verlaufskurve</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Erfasse mindestens zwei Messwerte, damit sich die Veränderung zeigt.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-primary" />
              Energie
            </CardTitle>
            <CardDescription>Berechnung aus den aktuellen Messwerten und dem Aktivitätswert.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestMeasurement && basalMetabolicRate && totalEnergyExpenditure ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Detail label="Grundumsatz" value={`${formatNumber(basalMetabolicRate)} kcal`} />
                  <Detail label="Gesamtumsatz" value={`${formatNumber(totalEnergyExpenditure)} kcal`} />
                  <Detail label="Aktivitätswert" value={formatNumber(palValue, 1)} />
                  <Detail label="Kalorienziel" value={patient.dailyCalorieGoal ? `${formatNumber(patient.dailyCalorieGoal)} kcal` : undefined} />
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/patienten/${patient.id}?tab=aktivitaet`}>Energie und Ziel bearbeiten</Link>
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Für die Berechnung fehlen aktuelle Größe und Gewicht.</p>
                <Button variant="outline" className="w-full" onClick={onAddMeasurement}>Messwerte erfassen</Button>
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
              <p className="mt-1 text-sm text-muted-foreground">{nextAppointment ? `${formatDate(nextAppointment.date)} · ${nextAppointment.startTime.slice(0, 5)} Uhr` : "Plane die nächste Beratung direkt im Kalender."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link href={`/kalender?patientId=${patient.id}`}>Termin planen</Link></Button>
              <Button variant="outline" asChild><Link href={`/patienten/${patient.id}?tab=beratungen`}>Beratung dokumentieren</Link></Button>
              <Button asChild><Link href={currentPlan ? `/ernaehrungsplan?patientId=${patient.id}` : `/ernaehrungsplan?patientId=${patient.id}`}>{currentPlan ? <FileText className="mr-2 h-4 w-4" /> : <UtensilsCrossed className="mr-2 h-4 w-4" />}{currentPlan ? "Plan öffnen" : "Plan erstellen"}</Link></Button>
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
