import type {
  CounselingSession,
  DailyMealPlan,
  Patient,
  PatientIntakeSubmission,
  PracticeAppointment,
} from "@/lib/types"

export type DashboardWorkKind = "intake" | "plan" | "contact"
export type DashboardWorkPriority = "high" | "medium" | "normal"

export interface DashboardWorkItem {
  id: string
  kind: DashboardWorkKind
  priority: DashboardWorkPriority
  title: string
  detail: string
  href: string
  action: string
  sortAt: string
}

interface BuildDashboardWorklistInput {
  patients: Patient[]
  plans: DailyMealPlan[]
  appointments: PracticeAppointment[]
  sessions: CounselingSession[]
  submissions: PatientIntakeSubmission[]
  now?: Date
  staleAfterDays?: number
}

const MS_PER_DAY = 86_400_000

function patientName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`
}

function daysBetween(earlier: string, now: Date): number {
  const timestamp = new Date(earlier).getTime()
  return Number.isNaN(timestamp)
    ? 0
    : Math.max(0, Math.floor((now.getTime() - timestamp) / MS_PER_DAY))
}

function priorityRank(priority: DashboardWorkPriority): number {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2
}

/**
 * Builds a short, deterministic work queue from existing records. It does not
 * invent reminders or change clinical state; every item links to the record
 * that supplies the next action.
 */
export function buildDashboardWorklist({
  patients,
  plans,
  appointments,
  sessions,
  submissions,
  now = new Date(),
  staleAfterDays = 42,
}: BuildDashboardWorklistInput): DashboardWorkItem[] {
  const items: DashboardWorkItem[] = []
  const today = now.toISOString().slice(0, 10)
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]))

  for (const submission of submissions) {
    if (submission.status !== "new" && submission.status !== "reviewed") continue
    const name = `${submission.payload.person.firstName} ${submission.payload.person.lastName}`
    const params = new URLSearchParams({ stufe: "fragebogen", name })
    items.push({
      id: `intake-${submission.id}`,
      kind: "intake",
      priority: "high",
      title: `${name}: Fragebogen prüfen`,
      detail: `Eingegangen vor ${daysBetween(submission.submittedAt, now)} Tagen`,
      href: `/patienten/aufnahmen?${params.toString()}`,
      action: "Prüfen",
      sortAt: submission.submittedAt,
    })
  }

  const openPlanPatientIds = new Set<string>()
  for (const plan of plans) {
    const status = plan.status ?? "draft"
    if (status !== "draft" && status !== "active") continue
    if (plan.patientId) openPlanPatientIds.add(plan.patientId)
    const patient = plan.patientId ? patientsById.get(plan.patientId) : undefined
    const title = plan.title || "Ernährungsplan"
    items.push({
      id: `plan-${plan.id}`,
      kind: "plan",
      priority: status === "draft" ? "medium" : "normal",
      title: status === "draft" ? `${title} fertigstellen` : `${title} weiterbearbeiten`,
      detail: patient ? patientName(patient) : "Ohne Patientenzuordnung",
      href: `/ernaehrungsplan?date=${encodeURIComponent(plan.date)}${plan.patientId ? `&patientId=${encodeURIComponent(plan.patientId)}` : ""}`,
      action: "Öffnen",
      sortAt: plan.date,
    })
  }

  const latestSessionByPatient = new Map<string, CounselingSession>()
  for (const session of sessions) {
    const current = latestSessionByPatient.get(session.patientId)
    if (!current || session.date > current.date) latestSessionByPatient.set(session.patientId, session)
  }
  const futureAppointmentPatientIds = new Set(
    appointments
      .filter((appointment) => appointment.patientId && appointment.date >= today)
      .map((appointment) => appointment.patientId as string),
  )
  const caredPatientIds = new Set(
    plans
      .filter((plan) => plan.patientId && plan.status !== "archived")
      .map((plan) => plan.patientId as string),
  )

  for (const patient of patients) {
    if ((patient.status ?? "active") !== "active") continue
    if (!caredPatientIds.has(patient.id)) continue
    if (futureAppointmentPatientIds.has(patient.id)) continue
    if (openPlanPatientIds.has(patient.id) && plans.some((plan) => plan.patientId === patient.id && (plan.status ?? "draft") === "draft")) {
      continue
    }

    const latest = latestSessionByPatient.get(patient.id)
    const referenceDate = latest?.date ?? patient.createdAt
    const days = daysBetween(referenceDate, now)
    if (days < staleAfterDays) continue

    items.push({
      id: `contact-${patient.id}`,
      kind: "contact",
      priority: days >= staleAfterDays * 2 ? "high" : "medium",
      title: `${patientName(patient)}: Kontakt prüfen`,
      detail: latest
        ? `Letzte Beratung vor ${days} Tagen; kein Termin geplant`
        : `Seit ${days} Tagen ohne dokumentierte Beratung`,
      href: `/patienten/${patient.id}`,
      action: "Akte öffnen",
      sortAt: referenceDate,
    })
  }

  return items.sort((a, b) => {
    const priority = priorityRank(a.priority) - priorityRank(b.priority)
    if (priority !== 0) return priority
    // A returned questionnaire is work waiting on the practice now. Put it
    // before an equally urgent follow-up reminder.
    if (a.kind === "intake" && b.kind !== "intake") return -1
    if (b.kind === "intake" && a.kind !== "intake") return 1
    return a.sortAt.localeCompare(b.sortAt)
  })
}
