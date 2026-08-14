"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { fetchClientLinkForPatient } from "@/lib/data/client-links"
import { createClient } from "@/lib/supabase/client"
import type {
  AnthropometricEntry,
  ClientLink,
  CounselingSession,
  Patient,
  PracticeAppointment,
  ScreeningResult,
  DailyMealPlan,
} from "@/lib/types"
import { usePatientMealPlans } from "@/hooks/use-patient-meal-plans"

type PatientWorkflowStatus = "not_started" | "in_progress" | "done" | "attention"
type PatientWorkflowStageKey = "intake" | "assessment" | "plan" | "follow_up"

type PatientWorkflowEventTone = "default" | "success" | "warning"

interface PatientWorkflowEvent {
  id: string
  date: string
  title: string
  description: string
  href?: string
  tone: PatientWorkflowEventTone
}

interface StageAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: "default" | "outline" | "secondary"
  icon?: typeof ArrowRight
}

interface PatientWorkflowStage {
  key: PatientWorkflowStageKey
  label: string
  status: PatientWorkflowStatus
  summary: string
  dateLabel?: string
  primaryAction?: StageAction
  secondaryAction?: StageAction
}

interface PatientWorkflowTabProps {
  patient: Patient
  sessions: CounselingSession[]
  anthroEntries: AnthropometricEntry[]
  screenings: ScreeningResult[]
  appointments: PracticeAppointment[]
  mealPlans?: DailyMealPlan[]
  counselingPending: boolean
}

const STATUS_META: Record<PatientWorkflowStatus, { label: string; className: string }> = {
  not_started: {
    label: "Nicht gestartet",
    className: "border-slate-200 text-slate-700",
  },
  in_progress: {
    label: "In Arbeit",
    className: "border-blue-200 text-blue-700",
  },
  done: {
    label: "Erledigt",
    className: "border-emerald-200 text-emerald-700",
  },
  attention: {
    label: "Aktion offen",
    className: "border-amber-200 text-amber-700",
  },
}

const MEAL_PLAN_STATUS_META: Record<NonNullable<DailyMealPlan["status"]>, { label: string; className: string }> = {
  draft: {
    label: "Entwurf",
    className: "border-slate-200 text-slate-700",
  },
  active: {
    label: "Aktiv",
    className: "border-blue-200 text-blue-700",
  },
  approved: {
    label: "Freigegeben",
    className: "border-emerald-200 text-emerald-700",
  },
  archived: {
    label: "Archiviert",
    className: "border-slate-200 text-slate-500",
  },
}

function mealPlanHref(patientId: string, plan?: DailyMealPlan | null) {
  const params = new URLSearchParams({ patientId })
  if (plan?.date) params.set("date", plan.date)
  return `/ernaehrungsplan?${params.toString()}`
}

function countPlanEntries(plan: DailyMealPlan) {
  return plan.slots.reduce((count, slot) => count + slot.entries.length, 0)
}

function getLatestByDate<T>(items: T[], getDate: (item: T) => string | undefined): T | null {
  const sorted = [...items].sort((a, b) => {
    const aDate = getDate(a) ?? ""
    const bDate = getDate(b) ?? ""
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })
  return sorted[0] ?? null
}

function buildAction(label: string, href?: string, onClick?: () => void, variant: StageAction["variant"] = "default"): StageAction {
  return { label, href, onClick, variant, icon: ArrowRight }
}

function WorkflowActionButton({ action }: { action: StageAction }) {
  const Icon = action.icon ?? ArrowRight

  if (action.href) {
    return (
      <Button asChild variant={action.variant ?? "default"} size="sm">
        <Link href={action.href}>
          {action.label}
          <Icon className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    )
  }

  return (
    <Button variant={action.variant ?? "default"} size="sm" onClick={action.onClick}>
      {action.label}
      <Icon className="ml-2 h-4 w-4" />
    </Button>
  )
}

export function PatientWorkflowTab({
  patient,
  sessions,
  anthroEntries,
  screenings,
  appointments,
  mealPlans: initialMealPlans,
}: PatientWorkflowTabProps) {
  const {
    plans: patientMealPlans,
    latestPlan,
  } = usePatientMealPlans(patient, initialMealPlans)

  // Intake is now "does this person keep their own record in the app", so the
  // stage reads the client link rather than a self-service protocol link.
  const supabase = useMemo(() => createClient(), [])
  const [clientLink, setClientLink] = useState<ClientLink | null>(null)
  useEffect(() => {
    let active = true
    fetchClientLinkForPatient(supabase, patient.id)
      .then((link) => {
        if (active) setClientLink(link)
      })
      .catch((error) => console.error("Failed to load client link:", error))
    return () => {
      active = false
    }
  }, [supabase, patient.id])
  const latestSession = useMemo(
    () => getLatestByDate(sessions, (session) => session.updatedAt ?? session.date),
    [sessions],
  )
  const latestFollowUpAppointment = useMemo(
    () =>
      getLatestByDate(
        appointments.filter((appointment) => appointment.type === "kontrolle"),
        (appointment) => `${appointment.date}T${appointment.startTime}`,
      ),
    [appointments],
  )
  const hasClinicalInputs = anthroEntries.length > 0 || screenings.length > 0

  const intakeStage: PatientWorkflowStage = useMemo(() => {
    if (clientLink?.status === "active") {
      return {
        key: "intake",
        label: "Intake",
        status: "done",
        summary: "Der Klient nutzt die App und führt sein Tagebuch selbst.",
        dateLabel: formatDate(clientLink.updatedAt ?? clientLink.createdAt),
        primaryAction: buildAction("Klienten-App öffnen", `/patienten/${patient.id}`),
      }
    }

    if (clientLink) {
      return {
        key: "intake",
        label: "Intake",
        status: "in_progress",
        summary: "Die Einladung zum Klienten-Zugang ist verschickt, aber noch nicht angenommen.",
        dateLabel: formatDate(clientLink.updatedAt ?? clientLink.createdAt),
        primaryAction: buildAction("Einladung ansehen", `/patienten/${patient.id}`),
      }
    }

    return {
      key: "intake",
      label: "Intake",
      status: "not_started",
      summary: "Es gibt noch keinen Klienten-Zugang; der Patient kann nichts selbst erfassen.",
      primaryAction: buildAction("Klienten-Zugang einladen", `/patienten/${patient.id}`),
      secondaryAction: buildAction("Patientendaten prüfen", `/patienten/${patient.id}`, undefined, "outline"),
    }
  }, [clientLink, patient.id])

  const assessmentStage: PatientWorkflowStage = useMemo(() => {
    if (hasClinicalInputs) {
      return {
        key: "assessment",
        label: "Assessment",
        status: "done",
        summary: "Messwerte und Screenings sind dokumentiert.",
        primaryAction: buildAction("Messwerte prüfen", `/patienten/${patient.id}`),
      }
    }

    return {
      key: "assessment",
      label: "Assessment",
      status: "not_started",
      summary: "Noch keine Messwerte oder Screenings erfasst.",
      primaryAction: buildAction("Messwerte erfassen", `/patienten/${patient.id}`),
    }
  }, [hasClinicalInputs, patient.id])

  const planStage: PatientWorkflowStage = useMemo(() => {
    if (latestPlan) {
      const status = latestPlan.status ?? "draft"
      return {
        key: "plan",
        label: "Plan",
        status: status === "approved" || status === "active" ? "done" : "in_progress",
        summary:
          status === "approved"
            ? "Ein freigegebener patientengebundener Ernährungsplan liegt vor."
            : status === "active"
              ? "Ein aktiver patientengebundener Ernährungsplan liegt vor."
              : "Ein patientengebundener Ernährungsplan ist als Entwurf vorhanden.",
        dateLabel: formatDate(latestPlan.date),
        primaryAction: buildAction("Ernährungsplan öffnen", mealPlanHref(patient.id, latestPlan)),
        secondaryAction: buildAction("Neue Beratung", `/patienten/${patient.id}/beratungen/neu`, undefined, "outline"),
      }
    }

    if (latestSession) {
      return {
        key: "plan",
        label: "Plan",
        status: "attention",
        summary: "Eine Beratungssitzung liegt vor. Der patientengebundene Ernährungsplan sollte als nächster Schritt angelegt werden.",
        dateLabel: formatDate(latestSession.date),
        primaryAction: buildAction("Plan anlegen", mealPlanHref(patient.id)),
        secondaryAction: buildAction("Beratung öffnen", `/patienten/${patient.id}/beratungen/${latestSession.id}`, undefined, "outline"),
      }
    }

    if (hasClinicalInputs) {
      return {
        key: "plan",
        label: "Plan",
        status: "attention",
        summary: "Assessment liegt vor. Als nächster Schritt sollte ein patientengebundener Ernährungsplan erstellt werden.",
        primaryAction: buildAction("Plan anlegen", mealPlanHref(patient.id)),
        secondaryAction: buildAction("Beratung anlegen", `/patienten/${patient.id}/beratungen/neu`, undefined, "outline"),
      }
    }

    return {
      key: "plan",
      label: "Plan",
      status: "not_started",
      summary: "Noch kein patientengebundener Ernährungsplan vorhanden.",
      primaryAction: buildAction("Plan anlegen", mealPlanHref(patient.id)),
    }
  }, [hasClinicalInputs, latestPlan, latestSession, patient.id])

  const followUpStage: PatientWorkflowStage = useMemo(() => {
    const completedTimelineEntry = latestSession?.timeline?.find((entry) => entry.status === "done")

    if (latestFollowUpAppointment) {
      return {
        key: "follow_up",
        label: "Follow-up",
        status: "done",
        summary: "Ein patientenbezogener Kontrolltermin ist bereits im Kalender hinterlegt.",
        dateLabel: formatDate(latestFollowUpAppointment.date),
        primaryAction: buildAction("Termine öffnen", `/termine?patientId=${patient.id}`),
        secondaryAction: latestSession
          ? buildAction("Beratung öffnen", `/patienten/${patient.id}/beratungen/${latestSession.id}`, undefined, "outline")
          : undefined,
      }
    }

    if (completedTimelineEntry || latestSession?.nextAppointment) {
      return {
        key: "follow_up",
        label: "Follow-up",
        status: "in_progress",
        summary: "Der nächste Verlaufsschritt ist festgehalten, aber noch kein Kontrolltermin angelegt.",
        dateLabel: formatDate(latestSession?.nextAppointment ?? completedTimelineEntry?.date ?? latestSession?.date ?? ""),
        primaryAction: buildAction("Kontrolltermin planen", `/termine?patientId=${patient.id}`),
        secondaryAction: latestSession
          ? buildAction("Beratung öffnen", `/patienten/${patient.id}/beratungen/${latestSession.id}`, undefined, "outline")
          : undefined,
      }
    }

    if (latestSession) {
      return {
        key: "follow_up",
        label: "Follow-up",
        status: "attention",
        summary: "Die Beratung ist dokumentiert, der nächste Kontrollschritt fehlt noch.",
        dateLabel: formatDate(latestSession.date),
        primaryAction: buildAction("Kontrolltermin planen", `/termine?patientId=${patient.id}`),
      }
    }

    return {
      key: "follow_up",
      label: "Follow-up",
      status: "not_started",
      summary: "Follow-up wird relevant, sobald ein Plan oder eine Beratung vorliegt.",
      primaryAction: buildAction("Termine öffnen", `/termine?patientId=${patient.id}`),
    }
  }, [latestFollowUpAppointment, latestSession, patient.id])

  const stages = [intakeStage, assessmentStage, planStage, followUpStage]
  const nextStage = stages.find((stage) => stage.status !== "done") ?? stages[stages.length - 1]

  const timelineEvents = useMemo(() => {
    const events: PatientWorkflowEvent[] = []

    sessions.forEach((session) => {
      events.push({
        id: `session_${session.id}`,
        date: session.updatedAt ?? session.date,
        title: session.type,
        description: "Beratungssitzung dokumentiert",
        href: `/patienten/${patient.id}/beratungen/${session.id}`,
        tone: "success",
      })

      session.timeline?.forEach((entry) => {
        events.push({
          id: `session_timeline_${entry.id}`,
          date: entry.date,
          title: entry.title,
          description: entry.description ?? "Beratungsschritt aktualisiert",
          href: `/patienten/${patient.id}/beratungen/${session.id}`,
          tone: entry.status === "done" ? "success" : entry.status === "active" ? "warning" : "default",
        })
      })
    })

    patientMealPlans.forEach((plan) => {
      const status = plan.status ?? "draft"
      events.push({
        id: `meal_plan_${plan.id}`,
        date: plan.date,
        title: plan.title ?? "Ernährungsplan",
        description: `${MEAL_PLAN_STATUS_META[status].label} · ${countPlanEntries(plan)} Einträge`,
        href: mealPlanHref(patient.id, plan),
        tone: status === "approved" || status === "active" ? "success" : "default",
      })
    })

    appointments
      .filter((appointment) => appointment.patientId === patient.id)
      .forEach((appointment) => {
        events.push({
          id: `appointment_${appointment.id}`,
          date: `${appointment.date}T${appointment.startTime}`,
          title: appointment.title,
          description: `${appointment.type === "kontrolle" ? "Follow-up" : "Termin"} in ${appointment.location ?? "Praxis"}`,
          href: `/termine?patientId=${patient.id}`,
          tone: appointment.type === "kontrolle" ? "warning" : "default",
        })
      })

    return events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  }, [appointments, patient.id, patientMealPlans, sessions])

  const latestActivity = timelineEvents[0] ?? null
  const completedCount = stages.filter((stage) => stage.status === "done").length
  const readinessSummary = `${completedCount}/${stages.length} Schritte abgeschlossen`
  const openItems = stages.filter((stage) => stage.status !== "done").map((stage) => stage.label)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <CardDescription>Nächster empfohlener Schritt</CardDescription>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl">{nextStage.label}</CardTitle>
                <Badge variant="outline" className={STATUS_META[nextStage.status].className}>
                  {STATUS_META[nextStage.status].label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{nextStage.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {nextStage.primaryAction ? <WorkflowActionButton action={nextStage.primaryAction} /> : null}
              {nextStage.secondaryAction ? <WorkflowActionButton action={nextStage.secondaryAction} /> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Readiness</p>
              <p className="text-sm font-semibold">{readinessSummary}</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Letzte Aktivität</p>
              <p className="truncate text-sm font-semibold">
                {latestActivity ? `${latestActivity.title} · ${formatDate(latestActivity.date)}` : "Noch keine Aktivität"}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Offen</p>
              <p className="truncate text-sm font-semibold">
                {openItems.length > 0 ? openItems.join(", ") : "Keine offenen Schritte"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behandlungspfad</CardTitle>
          <CardDescription>Der aktuelle Stand von Intake bis Follow-up, kompakt für die tägliche Arbeit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-5">
            {stages.map((stage, index) => {
              const showStageAction =
                stage.key === "plan" && stage.primaryAction && stage.status !== "done"

              return (
                <div key={stage.key} className="relative rounded-md border bg-card p-3">
                  {index < stages.length - 1 && (
                    <div className="absolute left-[calc(100%-0.25rem)] top-6 hidden h-px w-4 bg-border lg:block" />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{stage.label}</p>
                      {stage.dateLabel ? (
                        <p className="mt-1 text-xs text-muted-foreground">{stage.dateLabel}</p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className={STATUS_META[stage.status].className}>
                      {STATUS_META[stage.status].label}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{stage.summary}</p>
                  {showStageAction && stage.primaryAction ? (
                    <div className="mt-3">
                      <WorkflowActionButton action={stage.primaryAction} />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
