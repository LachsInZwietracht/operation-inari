"use client"

/**
 * Dashboard A — "Geführter Start" (Übersicht).
 *
 * This screen is a launch ramp, not a report: it returns the dietitian to her
 * work as fast as possible (Patient → Erstgespräch/Notizen → Plan → Übergabe).
 *
 * All content derives from real app entities passed in from the server page:
 * the user's meal plans, patients, and appointments. Every row and button
 * links into the corresponding workflow.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns"
import { de } from "date-fns/locale"
import { ArrowRight, Calendar, ChevronRight, Plus, User } from "lucide-react"

import type {
  DailyMealPlan,
  MealPlanStatus,
  Patient,
  PracticeAppointment,
} from "@/lib/types"

// --- Design tokens ---------------------------------------------------------------
// All colours resolve through the theme variables in globals.css so the screen
// renders correctly in light and dark mode.

const TEXT = {
  hi: "var(--card-foreground)",
  body: "var(--foreground)",
  mid: "var(--secondary-foreground)",
  muted: "var(--muted-foreground)",
  muted2: "var(--muted-foreground)",
  faint: "color-mix(in oklab, var(--muted-foreground) 78%, transparent)",
  label: "color-mix(in oklab, var(--muted-foreground) 68%, transparent)",
} as const

const BRAND_GRADIENT = "var(--brand-gradient)"
const PROGRESS_GRADIENT = "var(--brand-gradient)"
const ON_BRAND = "var(--on-brand)"
const BRAND_SHADOW = "0 6px 18px var(--brand-shadow)"

// Plan status colour coding (badges + left accent edge).
const STATUS_LABEL: Record<MealPlanStatus, string> = {
  draft: "Entwurf",
  active: "In Arbeit",
  approved: "Freigegeben",
  archived: "Archiviert",
}

const STATUS_COLOR: Record<MealPlanStatus, string> = {
  draft: "var(--chart-4)",
  active: "var(--chart-2)",
  approved: "var(--chart-1)",
  archived: "var(--muted-foreground)",
}

// Domain colour coding: pläne=green, patienten=blue, analyse=violett, berichte=amber.
const DOMAIN = {
  patient: "var(--chart-2)",
  plan: "var(--chart-1)",
  analysis: "var(--chart-3)",
  report: "var(--chart-4)",
} as const

const APPOINTMENT_TYPE_LABEL: Record<PracticeAppointment["type"], string> = {
  beratung: "Beratung",
  kontrolle: "Kontrolle",
  team: "Team",
  webinar: "Webinar",
}

const APPOINTMENT_TYPE_COLOR: Record<PracticeAppointment["type"], string> = {
  beratung: DOMAIN.analysis,
  kontrolle: DOMAIN.patient,
  team: DOMAIN.report,
  webinar: DOMAIN.plan,
}

/** Soft fill = accent colour at 12.5% opacity. */
const soft = (color: string) => `color-mix(in srgb, ${color} 12.5%, transparent)`

// --- Derivation helpers ----------------------------------------------------------

const MEAL_SLOT_COUNT = 5

interface DashboardProps {
  firstName: string | null
  plans: DailyMealPlan[]
  patients: Patient[]
  appointments: PracticeAppointment[]
}

function patientInitials(patient: Patient): string {
  return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase()
}

function patientFullName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`
}

function planTitle(plan: DailyMealPlan): string {
  return plan.title || `Tagesplan ${format(parseISO(plan.date), "d. MMMM", { locale: de })}`
}

function planHref(plan: DailyMealPlan): string {
  const params = new URLSearchParams({ date: plan.date })
  if (plan.patientId) params.set("patientId", plan.patientId)
  return `/ernaehrungsplan?${params.toString()}`
}

function planDateLabel(plan: DailyMealPlan): string {
  const diff = differenceInCalendarDays(new Date(), parseISO(plan.date))
  if (diff === 0) return "heute"
  if (diff === 1) return "gestern"
  if (diff === -1) return "morgen"
  return format(parseISO(plan.date), "dd.MM.yyyy")
}

function filledSlotCount(plan: DailyMealPlan): number {
  return plan.slots.filter((slot) => slot.entries.length > 0).length
}

function relativeTimestamp(iso: string | undefined): string {
  if (!iso) return ""
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: de, addSuffix: true })
  } catch {
    return ""
  }
}

function appointmentDuration(appointment: PracticeAppointment): string {
  const [startHours, startMinutes] = appointment.startTime.split(":").map(Number)
  const [endHours, endMinutes] = appointment.endTime.split(":").map(Number)
  const minutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes)
  return minutes > 0 ? `${minutes} Min` : ""
}

const PLAN_TASK_ACTION: Partial<Record<MealPlanStatus, string>> = {
  draft: "Entwurf fertigstellen",
  active: "Weiterbearbeiten",
}

// --- Small primitives ----------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color: TEXT.label }}
    >
      {children}
    </span>
  )
}

function StatusBadge({ status }: { status: MealPlanStatus }) {
  const color = STATUS_COLOR[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-[11px] py-1 text-[11px] font-bold"
      style={{ color, backgroundColor: soft(color) }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function CardShell({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col rounded-[18px] border bg-card p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  )
}

function CardTitle({
  children,
  count,
  helper,
  link,
}: {
  children: React.ReactNode
  count?: string
  helper?: string
  link?: { label: string; color: string; href: string }
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold" style={{ color: TEXT.hi }}>
          {children}
        </h2>
        {count ? (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
            style={{ color: TEXT.muted, backgroundColor: "var(--accent)" }}
          >
            {count}
          </span>
        ) : null}
        {helper ? (
          <span className="text-[12px]" style={{ color: TEXT.faint }}>
            {helper}
          </span>
        ) : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: link.color }}
        >
          {link.label} ›
        </Link>
      ) : null}
    </div>
  )
}

function EmptyHint({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  text: string
  action?: { label: string; href: string }
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center"
      style={{ borderColor: "var(--input)" }}
    >
      <Icon className="size-7" style={{ color: TEXT.muted, opacity: 0.5 }} />
      <p className="text-[13.5px] font-bold" style={{ color: TEXT.muted }}>
        {title}
      </p>
      <p className="max-w-xs text-[12.5px]" style={{ color: TEXT.faint }}>
        {text}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-1 flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[12.5px] font-semibold transition-colors hover:bg-accent"
          style={{ backgroundColor: "var(--secondary)", borderColor: "var(--input)", color: TEXT.mid }}
        >
          <Plus className="size-4" />
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

// --- Row components ------------------------------------------------------------

function PlanTaskRow({
  plan,
  patientName,
}: {
  plan: DailyMealPlan
  patientName: string | null
}) {
  const status = plan.status ?? "draft"
  const color = STATUS_COLOR[status]
  return (
    <Link
      href={planHref(plan)}
      className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-[9px] text-left transition-colors hover:bg-muted"
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>
          {PLAN_TASK_ACTION[status]}
        </span>
        <span className="block truncate text-[12px]" style={{ color: TEXT.muted2 }}>
          {planTitle(plan)}
          {patientName ? ` · ${patientName}` : ""}
        </span>
      </span>
      <ChevronRight className="size-[15px] shrink-0" style={{ color: TEXT.faint }} />
    </Link>
  )
}

function PlanRow({
  plan,
  patientName,
  initials,
}: {
  plan: DailyMealPlan
  patientName: string | null
  initials: string
}) {
  const status = plan.status ?? "draft"
  const color = STATUS_COLOR[status]
  const action = status === "approved" || status === "archived" ? "Öffnen" : "Weiterbearbeiten"
  return (
    <div
      className="group flex items-center gap-3 rounded-xl border-l-2 px-3 py-[11px] transition-colors"
      style={{ borderLeftColor: color, backgroundColor: "var(--muted)" }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[12.5px] font-bold"
        style={{ color, backgroundColor: soft(color) }}
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold" style={{ color: TEXT.hi }}>
          {planTitle(plan)}
        </span>
        <span className="block truncate text-[12.5px]" style={{ color: TEXT.muted2 }} suppressHydrationWarning>
          {patientName ? `${patientName} · ` : ""}
          {planDateLabel(plan)}
        </span>
      </span>
      <span className="hidden sm:inline-flex">
        <StatusBadge status={status} />
      </span>
      <Link
        href={planHref(plan)}
        className="shrink-0 rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold transition-opacity hover:opacity-80"
        style={{ color, backgroundColor: soft(color) }}
      >
        {action}
      </Link>
    </div>
  )
}

function PatientRow({ patient, contextMeta }: { patient: Patient; contextMeta: string }) {
  return (
    <Link
      href={`/patienten/${patient.id}`}
      className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-[9px] text-left transition-colors hover:bg-muted"
    >
      <span
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{ color: DOMAIN.patient, backgroundColor: soft(DOMAIN.patient) }}
      >
        {patientInitials(patient)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>
          {patientFullName(patient)}
        </span>
        <span className="block truncate text-[11.5px]" style={{ color: TEXT.muted2 }}>
          {contextMeta}
        </span>
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: TEXT.faint }} suppressHydrationWarning>
        {relativeTimestamp(patient.updatedAt)}
      </span>
    </Link>
  )
}

function AppointmentRow({
  appointment,
  patientName,
}: {
  appointment: PracticeAppointment
  patientName: string | null
}) {
  return (
    <div className="flex items-center gap-3 rounded-[9px] px-1.5 py-[9px]">
      <span
        className="w-11 shrink-0 font-mono text-[13px] font-semibold tabular-nums"
        style={{ color: TEXT.muted }}
      >
        {appointment.startTime}
      </span>
      <span
        className="size-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: APPOINTMENT_TYPE_COLOR[appointment.type] }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>
          {patientName ?? appointment.title}
        </span>
        <span className="block truncate text-[11.5px]" style={{ color: TEXT.muted2 }}>
          {patientName ? appointment.title : APPOINTMENT_TYPE_LABEL[appointment.type]}
        </span>
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: TEXT.faint }}>
        {appointmentDuration(appointment)}
      </span>
    </div>
  )
}

function PulseStatItem({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-mono text-[20px] font-semibold tabular-nums" style={{ color: TEXT.hi }}>
        {value}
      </span>
      <span className="text-[12.5px]" style={{ color: TEXT.muted }}>
        {label}
      </span>
    </div>
  )
}

// --- Page ----------------------------------------------------------------------

export function DashboardOverviewClient({
  firstName,
  plans,
  patients,
  appointments,
}: DashboardProps) {
  // Mount-stable timestamp: impure Date.now()/new Date() inside useMemo gives
  // unstable results across re-renders.
  const [nowTs] = useState(() => Date.now())
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date(nowTs)
    const hour = now.getHours()
    const greetingLabel = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend"
    return {
      greeting: greetingLabel,
      dateLabel: format(now, "EEEE, d. MMMM yyyy", { locale: de }),
    }
  }, [nowTs])

  const {
    patientNameById,
    visiblePlans,
    resume,
    planTasks,
    recentPatients,
    patientContextById,
    todaysAppointments,
    pulseStats,
  } = useMemo(() => {
    const nameById = new Map<string, string>()
    const initialsById = new Map<string, string>()
    for (const patient of patients) {
      nameById.set(patient.id, patientFullName(patient))
      initialsById.set(patient.id, patientInitials(patient))
    }

    const visible = plans.filter((plan) => plan.status !== "archived")
    const resumePlan =
      visible.find((plan) => plan.status === "draft" || plan.status === "active") ?? null
    const tasks = visible
      .filter((plan) => (plan.status ?? "draft") in PLAN_TASK_ACTION)
      .slice(0, 4)

    const sortedPatients = [...patients]
      .filter((patient) => patient.status !== "archived")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 6)

    // Latest plan per patient gives the "where you left off" context line.
    const contextById = new Map<string, string>()
    for (const plan of plans) {
      if (plan.patientId && !contextById.has(plan.patientId)) {
        contextById.set(plan.patientId, `Plan: ${planTitle(plan)}`)
      }
    }

    const todayIso = format(new Date(nowTs), "yyyy-MM-dd")
    const today = appointments.filter((appointment) => appointment.date === todayIso)

    const in7DaysIso = format(
      new Date(nowTs + 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    )
    const upcomingCount = appointments.filter(
      (appointment) => appointment.date >= todayIso && appointment.date <= in7DaysIso,
    ).length

    const stats = [
      {
        value: plans.filter((plan) => plan.status === "active").length,
        label: "Aktive Pläne",
        color: DOMAIN.plan,
      },
      {
        value: plans.filter((plan) => plan.status === "draft").length,
        label: "Entwürfe",
        color: DOMAIN.report,
      },
      {
        value: patients.filter((patient) => (patient.status ?? "active") === "active").length,
        label: "Aktive Patienten",
        color: DOMAIN.patient,
      },
      {
        value: upcomingCount,
        label: "Termine · 7 Tage",
        color: DOMAIN.analysis,
      },
    ]

    return {
      patientNameById: nameById,
      visiblePlans: visible.slice(0, 5),
      resume: resumePlan,
      planTasks: tasks,
      recentPatients: sortedPatients,
      patientContextById: contextById,
      todaysAppointments: today,
      pulseStats: stats,
    }
  }, [plans, patients, appointments, nowTs])

  const resumeFilled = resume ? filledSlotCount(resume) : 0
  const resumeProgress = Math.round((resumeFilled / MEAL_SLOT_COUNT) * 100)
  const resumePatientName = resume?.patientId
    ? (patientNameById.get(resume.patientId) ?? null)
    : null

  return (
    <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-[22px]">
      {/* Greeting + quick actions */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[21px] font-extrabold tracking-tight"
            style={{ color: TEXT.hi }}
            suppressHydrationWarning
          >
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[13px]" style={{ color: TEXT.faint }} suppressHydrationWarning>
            {dateLabel}
          </p>
        </div>
        <Link
          href="/patienten/neu"
          className="flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-extrabold transition-opacity hover:opacity-90"
          style={{
            background: BRAND_GRADIENT,
            color: ON_BRAND,
            boxShadow: BRAND_SHADOW,
          }}
        >
          <Plus className="size-[18px]" />
          Neuer Patient
        </Link>
      </header>

      {/* Row 1 — Hero "Weiter machen" + Pläne, die auf dich warten */}
      <section className="flex flex-col gap-5 lg:flex-row">
        <div
          className="flex flex-[1.55] flex-col rounded-[18px] border p-6"
          style={{
            background: "var(--hero-panel-bg)",
            borderColor: "var(--hero-panel-border)",
          }}
        >
          {resume ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full animate-pulse-dot"
                    style={{ backgroundColor: "var(--primary)" }}
                  />
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                    style={{ color: "var(--primary)" }}
                  >
                    Weiter machen
                  </span>
                </div>
                <StatusBadge status={resume.status ?? "draft"} />
              </div>

              <h2 className="text-[24px] font-extrabold tracking-tight" style={{ color: TEXT.hi }}>
                {planTitle(resume)}
              </h2>
              <p className="mt-1 text-[13.5px]" style={{ color: TEXT.muted }} suppressHydrationWarning>
                {resumePatientName ? `${resumePatientName} · ` : ""}
                Plan für {planDateLabel(resume)}
              </p>

              <div className="mt-auto pt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: TEXT.mid }}>
                    {resumeFilled} von {MEAL_SLOT_COUNT} Mahlzeiten geplant
                  </span>
                  <span className="font-mono text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
                    {resumeProgress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-[6px]" style={{ backgroundColor: "var(--secondary)" }}>
                  <div
                    className="h-full rounded-[6px]"
                    style={{ width: `${resumeProgress}%`, background: PROGRESS_GRADIENT }}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={planHref(resume)}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-extrabold transition-opacity hover:opacity-90"
                    style={{
                      background: BRAND_GRADIENT,
                      color: ON_BRAND,
                      boxShadow: BRAND_SHADOW,
                    }}
                  >
                    Plan weiterbearbeiten
                    <ArrowRight className="size-[18px]" />
                  </Link>
                  {resume.patientId ? (
                    <Link
                      href={`/patienten/${resume.patientId}`}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-[13.5px] font-semibold transition-colors hover:bg-accent"
                      style={{ backgroundColor: "var(--secondary)", borderColor: "var(--input)", color: TEXT.mid }}
                    >
                      <User className="size-[17px]" />
                      Zum Patienten
                    </Link>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "var(--primary)" }}
                >
                  Loslegen
                </span>
              </div>
              <h2 className="text-[24px] font-extrabold tracking-tight" style={{ color: TEXT.hi }}>
                Kein offener Plan
              </h2>
              <p className="mt-1 text-[13.5px]" style={{ color: TEXT.muted }}>
                Starte einen neuen Ernährungsplan oder beginne mit einer Vorlage.
              </p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <Link
                  href="/ernaehrungsplan"
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-extrabold transition-opacity hover:opacity-90"
                  style={{
                    background: BRAND_GRADIENT,
                    color: ON_BRAND,
                    boxShadow: BRAND_SHADOW,
                  }}
                >
                  Neuen Plan erstellen
                  <ArrowRight className="size-[18px]" />
                </Link>
                <Link
                  href="/ernaehrungsplan/bibliothek"
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-[13.5px] font-semibold transition-colors hover:bg-accent"
                  style={{ backgroundColor: "var(--secondary)", borderColor: "var(--input)", color: TEXT.mid }}
                >
                  Vorlagen ansehen
                </Link>
              </div>
            </>
          )}
        </div>

        <CardShell className="flex-1">
          <CardTitle
            count={planTasks.length > 0 ? String(planTasks.length) : undefined}
            helper="Abgeleitet aus dem Status deiner Pläne"
          >
            Pläne, die auf dich warten
          </CardTitle>
          {planTasks.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {planTasks.map((plan) => (
                <PlanTaskRow
                  key={plan.id}
                  plan={plan}
                  patientName={plan.patientId ? (patientNameById.get(plan.patientId) ?? null) : null}
                />
              ))}
            </div>
          ) : (
            <EmptyHint
              icon={Calendar}
              title="Alles erledigt"
              text="Keine Entwürfe oder offenen Pläne. Neue Pläne erscheinen hier automatisch."
            />
          )}
        </CardShell>
      </section>

      {/* Row 2 — Recents (the star) */}
      <section className="flex flex-col gap-5 lg:flex-row">
        <CardShell className="flex-[1.5]">
          <CardTitle link={{ label: "Alle Pläne", color: "var(--primary)", href: "/ernaehrungsplan" }}>
            Zuletzt bearbeitete Pläne
          </CardTitle>
          {visiblePlans.length > 0 ? (
            <div className="flex flex-col gap-2">
              {visiblePlans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  patientName={plan.patientId ? (patientNameById.get(plan.patientId) ?? null) : null}
                  initials={
                    (plan.patientId ? patientInitialsFromMap(patientNameById.get(plan.patientId)) : null) ?? "PL"
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyHint
              icon={Calendar}
              title="Noch keine Pläne"
              text="Erstelle deinen ersten Ernährungsplan — er erscheint danach hier."
              action={{ label: "Plan erstellen", href: "/ernaehrungsplan" }}
            />
          )}
        </CardShell>

        <CardShell className="flex-1">
          <CardTitle link={{ label: "Alle", color: DOMAIN.patient, href: "/patienten" }}>
            Zuletzt geöffnete Patienten
          </CardTitle>
          {recentPatients.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {recentPatients.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  contextMeta={patientContextById.get(patient.id) ?? "Patientenakte"}
                />
              ))}
            </div>
          ) : (
            <EmptyHint
              icon={User}
              title="Noch keine Patienten"
              text="Lege deinen ersten Patienten an, um Pläne und Beratungen zu starten."
              action={{ label: "Patient anlegen", href: "/patienten/neu" }}
            />
          )}
        </CardShell>
      </section>

      {/* Row 3 — Heute (Termine) + Praxis-Puls */}
      <section className="flex flex-col gap-5 lg:flex-row">
        <CardShell className="flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold" style={{ color: TEXT.hi }}>
              Heute
            </h2>
            <Link
              href="/termine"
              className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: DOMAIN.analysis }}
            >
              Alle Termine ›
            </Link>
          </div>
          {todaysAppointments.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {todaysAppointments.map((appointment) => (
                <AppointmentRow
                  key={appointment.id}
                  appointment={appointment}
                  patientName={
                    appointment.patientId
                      ? (patientNameById.get(appointment.patientId) ?? null)
                      : null
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyHint
              icon={Calendar}
              title="Keine Termine heute"
              text="Inari verwaltet Termine optional. Trag einen ein oder verbinde deinen Kalender."
              action={{ label: "Termin eintragen", href: "/termine" }}
            />
          )}
        </CardShell>

        <CardShell className="flex-1">
          <div className="mb-4">
            <SectionLabel>Praxis-Puls</SectionLabel>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-2.5">
            {pulseStats.map((stat) => (
              <PulseStatItem key={stat.label} value={stat.value} label={stat.label} color={stat.color} />
            ))}
          </div>
        </CardShell>
      </section>
    </div>
  )
}

/** "Anna Bergmann" → "AB"; falls back to null when the name is unknown. */
function patientInitialsFromMap(fullName: string | undefined): string | null {
  if (!fullName) return null
  const parts = fullName.split(" ").filter(Boolean)
  if (parts.length === 0) return null
  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ""
  return `${first}${last}`.toUpperCase()
}
