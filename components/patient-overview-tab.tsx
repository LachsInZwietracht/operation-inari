"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Flame,
  HeartPulse,
  Ruler,
  Scale,
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
import type {
  AnthropometricEntry,
  CounselingSession,
  DailyMealPlan,
  DiagnosisEntry,
  Patient,
  PatientAllergenEntry,
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

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Scale
  label: string
  value: string
  note?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function PatientOverviewTab({
  patient,
  anthropometrics,
  appointments,
  sessions,
  diagnoses,
  patientAllergens,
  mealPlans,
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
  const events = [
    intakeSubmission ? { date: intakeSubmission.submittedAt, label: "Aufnahme eingegangen", detail: "Angaben des Patienten" } : null,
    intakeSubmission?.reviewedAt ? { date: intakeSubmission.reviewedAt, label: "Aufnahme übernommen", detail: "In die Patientenakte übertragen" } : null,
    latestMeasurement ? { date: latestMeasurement.date, label: "Messwerte erfasst", detail: `${formatNumber(latestMeasurement.weight, 1)} kg · BMI ${formatNumber(latestMeasurement.bmi, 1)}` } : null,
    latestSession ? { date: latestSession.date, label: "Letzte Beratung", detail: latestSession.type } : null,
    currentPlan ? { date: currentPlan.date, label: "Ernährungsplan", detail: currentPlan.title ?? "Plan angelegt" } : null,
    nextAppointment ? { date: nextAppointment.date, label: "Nächster Termin", detail: `${nextAppointment.title} · ${nextAppointment.startTime.slice(0, 5)} Uhr` } : null,
  ].filter((event): event is { date: string; label: string; detail: string } => Boolean(event)).sort((a, b) => b.date.localeCompare(a.date))

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
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader className="gap-2 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Aktueller Stand</CardTitle>
              <CardDescription className="mt-1">
                Die wichtigsten Informationen für die nächste Betreuung von {patient.firstName}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {intakeSubmission ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Originale Aufnahme
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                    <DialogHeader>
                      <DialogTitle>Originale Aufnahme</DialogTitle>
                      <DialogDescription>
                        Eingegangen am {formatDate(intakeSubmission.submittedAt)}. Diese Angaben bleiben als Quelle erhalten.
                      </DialogDescription>
                    </DialogHeader>
                    <PatientIntakeReview submission={intakeSubmission} />
                  </DialogContent>
                </Dialog>
              ) : null}
              <Button onClick={onAddMeasurement}>
                <Scale className="mr-2 h-4 w-4" />
                Messwerte erfassen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Letzter Kontakt" value={latestSession ? formatDate(latestSession.date) : undefined} />
          <Detail
            label="Nächster Termin"
            value={nextAppointment ? `${formatDate(nextAppointment.date)} · ${nextAppointment.startTime.slice(0, 5)}` : undefined}
          />
          <Detail label="Aktueller Plan" value={currentPlan?.title ?? (currentPlan ? "Ernährungsplan" : undefined)} />
          <Detail label="Kalorienziel" value={patient.dailyCalorieGoal ? `${formatNumber(patient.dailyCalorieGoal)} kcal` : undefined} />
        </CardContent>
      </Card>

      <section aria-label="Körperwerte" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={HeartPulse}
          label="Alter"
          value={`${ageYears} Jahre`}
          note={`Geboren am ${formatDate(patient.dateOfBirth)}`}
        />
        <MetricCard
          icon={Scale}
          label="Gewicht"
          value={latestMeasurement ? `${formatNumber(latestMeasurement.weight, 1)} kg` : "–"}
          note={latestMeasurement ? `vom ${formatDate(latestMeasurement.date)}` : "Messwert fehlt"}
        />
        <MetricCard
          icon={Ruler}
          label="Größe"
          value={latestMeasurement ? `${formatNumber(latestMeasurement.height)} cm` : "–"}
          note={latestMeasurement ? "aus letzter Messung" : "Messwert fehlt"}
        />
        <MetricCard
          icon={HeartPulse}
          label="BMI"
          value={latestMeasurement ? formatNumber(latestMeasurement.bmi, 1) : "–"}
          note={latestWeightChange === undefined ? "Verlauf nach Messung sichtbar" : `${latestWeightChange > 0 ? "+" : ""}${formatNumber(latestWeightChange, 1)} kg seit erster Messung`}
        />
        <MetricCard
          icon={Target}
          label="Zielgewicht"
          value={patient.goalWeight ? `${formatNumber(patient.goalWeight, 1)} kg` : "–"}
          note={patient.goalWeight ? "in der Patientenakte festgelegt" : "Ziel noch nicht festgelegt"}
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
          <CardDescription>Die letzten und nächsten Schritte in dieser Patientenakte.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length ? (
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <li key={`${event.label}-${event.date}`} className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(event.date)}</p>
                  <p className="mt-1 text-sm font-medium">{event.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
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
