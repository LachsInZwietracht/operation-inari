"use client"

import Link from "next/link"
import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  FileText,
  QrCode,
  Stethoscope,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/format"
import type {
  AnthropometricEntry,
  CounselingSession,
  DigitalProtocolLink,
  DigitalProtocolSubmission,
  NutritionProtocol,
  Patient,
  PatientReportRecord,
  PracticeAppointment,
  ScreeningResult,
} from "@/lib/types"

type PatientWorkflowStatus = "not_started" | "in_progress" | "done" | "attention"
type PatientWorkflowStageKey = "intake" | "assessment" | "plan" | "report" | "follow_up"

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
  protocols: NutritionProtocol[]
  digitalLinks: DigitalProtocolLink[]
  digitalSubmissions: DigitalProtocolSubmission[]
  sessions: CounselingSession[]
  anthroEntries: AnthropometricEntry[]
  screenings: ScreeningResult[]
  appointments: PracticeAppointment[]
  patientReports: PatientReportRecord[]
  setQrDialogLink: Dispatch<SetStateAction<DigitalProtocolLink | null>>
  onGenerateLink: () => void
  onMarkSubmissionReviewed: (submissionId: string) => void
  isLoadingSubmissions: boolean
  digitalLinksPending: boolean
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
  protocols,
  digitalLinks,
  digitalSubmissions,
  sessions,
  anthroEntries,
  screenings,
  appointments,
  patientReports,
  setQrDialogLink,
  onGenerateLink,
  onMarkSubmissionReviewed,
  isLoadingSubmissions,
  digitalLinksPending,
  counselingPending,
}: PatientWorkflowTabProps) {
  const latestProtocol = useMemo(
    () => getLatestByDate(protocols, (protocol) => protocol.updatedAt ?? protocol.startDate),
    [protocols],
  )
  const latestSubmission = useMemo(
    () => getLatestByDate(digitalSubmissions, (submission) => submission.submittedAt),
    [digitalSubmissions],
  )
  const latestLink = useMemo(
    () => getLatestByDate(digitalLinks, (link) => link.updatedAt ?? link.createdAt),
    [digitalLinks],
  )
  const latestSession = useMemo(
    () => getLatestByDate(sessions, (session) => session.updatedAt ?? session.date),
    [sessions],
  )
  const latestPatientReport = useMemo(
    () => getLatestByDate(patientReports, (report) => report.updatedAt ?? report.createdAt),
    [patientReports],
  )
  const patientReportVersions = useMemo(
    () =>
      patientReports
        .flatMap((report) => report.versions ?? [])
        .sort((a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime()),
    [patientReports],
  )
  const latestPatientReportVersion = useMemo(
    () => patientReportVersions[0] ?? null,
    [patientReportVersions],
  )
  const [reportSearch, setReportSearch] = useState("")
  const [reportFormatFilter, setReportFormatFilter] = useState<"all" | "PDF" | "CSV">("all")
  const filteredPatientReportVersions = useMemo(() => {
    const query = reportSearch.trim().toLowerCase()
    return patientReportVersions.filter((version) => {
      const matchesFormat = reportFormatFilter === "all" || version.format === reportFormatFilter
      const haystack = [
        version.title,
        version.snapshot.planDateLabel,
        version.snapshot.reportLength === "short" ? "Kurzbericht" : "Vollversion",
        version.format,
      ].join(" ").toLowerCase()
      return matchesFormat && (!query || haystack.includes(query))
    })
  }, [patientReportVersions, reportFormatFilter, reportSearch])
  const latestFollowUpAppointment = useMemo(
    () =>
      getLatestByDate(
        appointments.filter((appointment) => appointment.type === "kontrolle"),
        (appointment) => `${appointment.date}T${appointment.startTime}`,
      ),
    [appointments],
  )
  const reportHref = `/berichte?patientId=${patient.id}${latestProtocol ? `&protocolId=${latestProtocol.id}` : ""}`

  const hasClinicalInputs = anthroEntries.length > 0 || screenings.length > 0

  const intakeStage: PatientWorkflowStage = useMemo(() => {
    if (latestSubmission?.status === "converted" && latestSubmission.convertedProtocolId) {
      return {
        key: "intake",
        label: "Intake",
        status: "done",
        summary: "Digitale Einreichung wurde in ein internes Protokoll übernommen.",
        dateLabel: formatDate(latestSubmission.submittedAt),
        primaryAction: buildAction("Protokoll öffnen", `/patienten/${patient.id}/protokolle/${latestSubmission.convertedProtocolId}`),
        secondaryAction: latestLink
          ? {
              label: "QR-Code anzeigen",
              onClick: () => setQrDialogLink(latestLink),
              variant: "outline",
              icon: QrCode,
            }
          : undefined,
      }
    }

    if (latestSubmission) {
      return {
        key: "intake",
        label: "Intake",
        status: latestSubmission.status === "new" ? "attention" : "in_progress",
        summary:
          latestSubmission.status === "new"
            ? "Neue digitale Einreichung wartet auf Sichtung."
            : "Digitale Einreichung ist geprüft und bereit zur Übernahme.",
        dateLabel: formatDate(latestSubmission.submittedAt),
        primaryAction: buildAction(
          "In Entwurf übernehmen",
          `/patienten/${patient.id}/protokolle/neu?digitalSubmission=${latestSubmission.id}`,
        ),
        secondaryAction:
          latestSubmission.status === "new"
            ? {
                label: "Als geprüft markieren",
                onClick: () => onMarkSubmissionReviewed(latestSubmission.id),
                variant: "outline",
                icon: ClipboardCheck,
              }
            : undefined,
      }
    }

    if (latestLink) {
      return {
        key: "intake",
        label: "Intake",
        status: "in_progress",
        summary: `Digitaler Erfassungslink (${latestLink.method}) wurde bereitgestellt, aber noch nicht eingereicht.`,
        dateLabel: formatDate(latestLink.updatedAt ?? latestLink.createdAt),
        primaryAction: {
          label: "QR-Code anzeigen",
          onClick: () => setQrDialogLink(latestLink),
          variant: "default",
          icon: QrCode,
        },
        secondaryAction: {
          label: "Link kopieren",
          onClick: () => {
            void navigator.clipboard.writeText(latestLink.url)
            toast.success("Link kopiert")
          },
          variant: "outline",
          icon: Copy,
        },
      }
    }

    return {
      key: "intake",
      label: "Intake",
      status: "not_started",
      summary: "Es gibt noch keinen aktiven Self-Service-Link oder eine eingereichte Ernährungserfassung.",
      primaryAction: {
        label: "Link erstellen",
        onClick: onGenerateLink,
        variant: "default",
        icon: QrCode,
      },
      secondaryAction: buildAction("Patientendaten prüfen", `/patienten/${patient.id}`, undefined, "outline"),
    }
  }, [latestLink, latestSubmission, onGenerateLink, onMarkSubmissionReviewed, patient.id, setQrDialogLink])

  const assessmentStage: PatientWorkflowStage = useMemo(() => {
    if (latestProtocol) {
      return {
        key: "assessment",
        label: "Assessment",
        status: "done",
        summary: "Ein internes Ernährungsprotokoll liegt vor und kann klinisch weiterverarbeitet werden.",
        dateLabel: formatDate(latestProtocol.startDate),
        primaryAction: buildAction("Protokoll öffnen", `/patienten/${patient.id}/protokolle/${latestProtocol.id}`),
        secondaryAction: buildAction("Neues Protokoll", `/patienten/${patient.id}/protokolle/neu`, undefined, "outline"),
      }
    }

    if (hasClinicalInputs) {
      return {
        key: "assessment",
        label: "Assessment",
        status: "in_progress",
        summary: "Klinische Basisdaten sind dokumentiert, aber noch kein finales Ernährungsprotokoll.",
        primaryAction: buildAction("Protokoll erstellen", `/patienten/${patient.id}/protokolle/neu`),
        secondaryAction: buildAction("Messwerte prüfen", `/patienten/${patient.id}`, undefined, "outline"),
      }
    }

    if (latestSubmission || latestLink) {
      return {
        key: "assessment",
        label: "Assessment",
        status: "attention",
        summary: "Die digitale Erfassung ist vorhanden, jetzt sollte das interne Assessment dokumentiert werden.",
        primaryAction: buildAction("Protokoll erstellen", `/patienten/${patient.id}/protokolle/neu`),
      }
    }

    return {
      key: "assessment",
      label: "Assessment",
      status: "not_started",
      summary: "Noch keine Assessment-Dokumentation vorhanden.",
      primaryAction: buildAction("Protokoll erstellen", `/patienten/${patient.id}/protokolle/neu`),
    }
  }, [hasClinicalInputs, latestLink, latestProtocol, latestSubmission, patient.id])

  const planStage: PatientWorkflowStage = useMemo(() => {
    if (latestSession) {
      return {
        key: "plan",
        label: "Plan",
        status: "done",
        summary: "Eine Beratungssitzung mit Maßnahmen und Empfehlungen wurde dokumentiert.",
        dateLabel: formatDate(latestSession.date),
        primaryAction: buildAction("Beratung öffnen", `/patienten/${patient.id}/beratungen/${latestSession.id}`),
        secondaryAction: buildAction("Neue Beratung", `/patienten/${patient.id}/beratungen/neu`, undefined, "outline"),
      }
    }

    if (latestProtocol) {
      return {
        key: "plan",
        label: "Plan",
        status: "attention",
        summary: "Assessment liegt vor. Als nächster Schritt sollte die Beratung mit Maßnahmen dokumentiert werden.",
        dateLabel: formatDate(latestProtocol.startDate),
        primaryAction: buildAction("Beratung anlegen", `/patienten/${patient.id}/beratungen/neu`),
      }
    }

    return {
      key: "plan",
      label: "Plan",
      status: "not_started",
      summary: "Noch keine Beratungs- oder Maßnahmenplanung vorhanden.",
      primaryAction: buildAction("Beratung anlegen", `/patienten/${patient.id}/beratungen/neu`),
    }
  }, [latestProtocol, latestSession, patient.id])

  const reportStage: PatientWorkflowStage = useMemo(() => {
    if (latestPatientReportVersion) {
      return {
        key: "report",
        label: "Report",
        status: "done",
        summary: "Eine archivierte Berichtsversion liegt vor und kann unverändert erneut geöffnet oder heruntergeladen werden.",
        dateLabel: formatDate(latestPatientReportVersion.exportedAt),
        primaryAction: buildAction("Historie öffnen", `/berichte?reportVersionId=${latestPatientReportVersion.id}`),
        secondaryAction: buildAction("Neuen Bericht erstellen", reportHref, undefined, "outline"),
      }
    }

    if (latestPatientReport) {
      return {
        key: "report",
        label: "Report",
        status: "in_progress",
        summary: "Ein älterer Berichtseintrag liegt vor, aber noch keine archivierte Exportversion.",
        dateLabel: formatDate(latestPatientReport.updatedAt ?? latestPatientReport.createdAt),
        primaryAction: buildAction("Bericht öffnen", `/berichte?reportId=${latestPatientReport.id}`),
        secondaryAction: buildAction("Neuen Bericht erstellen", reportHref, undefined, "outline"),
      }
    }

    if (latestSession || latestProtocol) {
      return {
        key: "report",
        label: "Report",
        status: "in_progress",
        summary: "Die Patientendaten sind weit genug fortgeschritten, um einen Analysebericht zu erstellen.",
        dateLabel: formatDate((latestSession?.date ?? latestProtocol?.startDate) ?? new Date().toISOString()),
        primaryAction: buildAction("Bericht erstellen", reportHref),
        secondaryAction: latestProtocol
          ? buildAction("Protokoll öffnen", `/patienten/${patient.id}/protokolle/${latestProtocol.id}`, undefined, "outline")
          : undefined,
      }
    }

    return {
      key: "report",
      label: "Report",
      status: "not_started",
      summary: "Ein Bericht wird sinnvoll, sobald Assessment und Beratung dokumentiert sind.",
      primaryAction: buildAction("Berichte öffnen", reportHref),
    }
  }, [latestPatientReport, latestPatientReportVersion, latestProtocol, latestSession, patient.id, reportHref])

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

  const stages = [intakeStage, assessmentStage, planStage, reportStage, followUpStage]
  const nextStage = stages.find((stage) => stage.status !== "done") ?? stages[stages.length - 1]

  const timelineEvents = useMemo(() => {
    const events: PatientWorkflowEvent[] = []

    digitalSubmissions.forEach((submission) => {
      events.push({
        id: `submission_${submission.id}`,
        date: submission.submittedAt,
        title: "Digitale Einreichung",
        description:
          submission.status === "converted"
            ? "In internes Protokoll übernommen"
            : submission.status === "reviewed"
              ? "Geprüft und bereit zur Übernahme"
              : "Neu eingereicht",
        href:
          submission.convertedProtocolId
            ? `/patienten/${patient.id}/protokolle/${submission.convertedProtocolId}`
            : `/patienten/${patient.id}/protokolle/neu?digitalSubmission=${submission.id}`,
        tone: submission.status === "converted" ? "success" : "warning",
      })
    })

    protocols.forEach((protocol) => {
      events.push({
        id: `protocol_${protocol.id}`,
        date: protocol.updatedAt ?? protocol.startDate,
        title: protocol.title,
        description: "Internes Ernährungsprotokoll dokumentiert",
        href: `/patienten/${patient.id}/protokolle/${protocol.id}`,
        tone: "success",
      })
    })

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

    patientReportVersions.forEach((version) => {
      events.push({
        id: `patient_report_version_${version.id}`,
        date: version.exportedAt,
        title: version.title,
        description: `Archivierter Bericht ${version.format} · Version ${version.versionNumber}`,
        href: `/berichte?reportVersionId=${version.id}`,
        tone: "success",
      })
    })

    return events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  }, [appointments, digitalSubmissions, patient.id, patientReportVersions, protocols, sessions])

  const latestActivity = timelineEvents[0] ?? null
  const completedCount = stages.filter((stage) => stage.status === "done").length
  const readinessSummary = `${completedCount}/5 Schritte abgeschlossen`

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Nächster empfohlener Schritt</CardDescription>
            <CardTitle className="text-xl">{nextStage.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline" className={STATUS_META[nextStage.status].className}>
              {STATUS_META[nextStage.status].label}
            </Badge>
            <p className="text-sm text-muted-foreground">{nextStage.summary}</p>
            {nextStage.primaryAction ? <WorkflowActionButton action={nextStage.primaryAction} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Letzte Patientenaktivität</CardDescription>
            <CardTitle className="text-xl">{latestActivity?.title ?? "Noch keine Aktivität"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{latestActivity?.description ?? "Workflow startet mit digitaler Erfassung oder internem Assessment."}</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              <span>{latestActivity ? formatDate(latestActivity.date) : "–"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Readiness</CardDescription>
            <CardTitle className="text-xl">{readinessSummary}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {intakeStage.status === "done" ? "Intake übernommen" : "Intake offen"},{" "}
              {assessmentStage.status === "done" ? "Assessment dokumentiert" : "Assessment offen"},{" "}
              {planStage.status === "done" ? "Beratung dokumentiert" : "Beratung offen"}.
            </p>
            <p className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              {patient.firstName} {patient.lastName}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {stages.map((stage) => (
          <Card key={stage.key} className="flex h-full flex-col">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{stage.label}</CardTitle>
                <Badge variant="outline" className={STATUS_META[stage.status].className}>
                  {STATUS_META[stage.status].label}
                </Badge>
              </div>
              <CardDescription>{stage.summary}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <div className="text-xs text-muted-foreground">
                {stage.dateLabel ? `Zuletzt aktualisiert: ${stage.dateLabel}` : "Noch keine Aktivität"}
              </div>
              <div className="flex flex-wrap gap-2">
                {stage.primaryAction ? <WorkflowActionButton action={stage.primaryAction} /> : null}
                {stage.secondaryAction ? <WorkflowActionButton action={stage.secondaryAction} /> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Patient Journey</CardTitle>
            <CardDescription>Die wichtigsten Schritte aus Intake, Assessment, Beratung und Follow-up.</CardDescription>
          </CardHeader>
          <CardContent>
            {timelineEvents.length > 0 ? (
              <div className="space-y-4">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="mt-1">
                      {event.tone === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : event.tone === "warning" ? (
                        <Clock3 className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(event.date)}</span>
                        {event.href ? (
                          <Link href={event.href} className="font-medium text-foreground hover:underline">
                            Öffnen
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isLoadingSubmissions || digitalLinksPending || counselingPending ? (
              <p className="text-sm text-muted-foreground">Workflow-Daten werden synchronisiert.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Workflow-Aktivität vorhanden.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Direkte Einstiege in die wichtigsten Patienten-Workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href={`/patienten/${patient.id}/protokolle/neu`}>
                <span className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Neues Protokoll
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href={`/patienten/${patient.id}/beratungen/neu`}>
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Neue Beratung
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href={reportHref}>
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Berichte öffnen
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href={`/termine?patientId=${patient.id}`}>
                <span className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Kontrolltermin planen
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Berichtshistorie</CardTitle>
          <CardDescription>Patientengebundene Berichte werden beim Export angelegt und können von hier erneut geöffnet werden.</CardDescription>
        </CardHeader>
        <CardContent>
          {patientReports.length > 0 ? (
            <div className="space-y-3">
              {patientReportVersions.length > 0 ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                    <Input
                      value={reportSearch}
                      onChange={(event) => setReportSearch(event.target.value)}
                      placeholder="Archiv nach Titel, Datum oder Umfang filtern..."
                    />
                    <Select value={reportFormatFilter} onValueChange={(value) => setReportFormatFilter(value as "all" | "PDF" | "CSV")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Formate</SelectItem>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filteredPatientReportVersions.length > 0 ? filteredPatientReportVersions.map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{version.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Version {version.versionNumber} · {version.snapshot.planDateLabel} · {version.format} · exportiert {formatDate(version.exportedAt)}
                        </p>
                        {version.retentionUntil ? (
                          <p className="text-xs text-muted-foreground">
                            Aufbewahrung bis {formatDate(version.retentionUntil)}
                            {version.retentionStatus ? ` · ${version.retentionStatus}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{version.snapshot.reportLength === "short" ? "Kurzbericht" : "Vollversion"}</Badge>
                        <Button asChild size="sm">
                          <Link href={`/berichte?reportVersionId=${version.id}`}>Historie öffnen</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/api/patient-report-versions/${version.id}/download`}>
                            {version.format} herunterladen
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                      Keine archivierte Berichtsversion passt zum aktuellen Filter.
                    </p>
                  )}
                </>
              ) : patientReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Legacy-Eintrag · {report.planDateLabel} · {report.lastFormat} · aktualisiert {formatDate(report.updatedAt ?? report.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{report.reportLength === "short" ? "Kurzbericht" : "Vollversion"}</Badge>
                    <Button asChild size="sm">
                      <Link href={`/berichte?reportId=${report.id}`}>Bericht öffnen</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine patientengebundenen Berichte vorhanden.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
