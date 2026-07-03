"use client"

/**
 * Dashboard A — "Geführter Start" (Übersicht).
 *
 * Faithful build of the Inari clinical dashboard design handoff. This screen is
 * a launch ramp, not a report: it returns the dietitian to her work as fast as
 * possible (Patient → Erstgespräch/Notizen → Plan → Übergabe).
 *
 * Content is the demo dataset specified in the handoff. Wiring these rows to
 * live app entities (recent plans / patients / appointments) is a follow-up;
 * the data shapes below mirror what the screen reads from real entities.
 */

import { useMemo } from "react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import {
  ArrowRight,
  Bell,
  Calendar,
  ChevronRight,
  FileText,
  Plus,
} from "lucide-react"

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
type PlanState = "Entwurf" | "In Arbeit" | "Bereit" | "Freigegeben" | "Archiviert"

const STATE_COLOR: Record<PlanState, string> = {
  Entwurf: "var(--chart-4)",
  "In Arbeit": "var(--chart-2)",
  Bereit: "light-dark(#0d9488, #2dd4bf)",
  Freigegeben: "var(--chart-1)",
  Archiviert: "var(--muted-foreground)",
}

// Domain colour coding: pläne=green, patienten=blue, analyse=violet, berichte=amber.
const DOMAIN = {
  patient: "var(--chart-2)",
  plan: "var(--chart-1)",
  analysis: "var(--chart-3)",
  report: "var(--chart-4)",
} as const

/** Soft fill = accent colour at 12.5% opacity. */
const soft = (color: string) => `color-mix(in srgb, ${color} 12.5%, transparent)`

// --- Demo data (shapes mirror real app entities) -------------------------------

interface RecentPlan {
  name: string
  patient: string
  initials: string
  state: PlanState
  edited: string
  action: "Weiterbearbeiten" | "Übergeben" | "Öffnen"
}

const recentPlans: RecentPlan[] = [
  { name: "Mediterrane Kost", patient: "Anna Bergmann", initials: "AB", state: "Entwurf", edited: "vor 18 Min", action: "Weiterbearbeiten" },
  { name: "Eliminationsdiät", patient: "Julia Schäfer", initials: "JS", state: "In Arbeit", edited: "vor 2 Std", action: "Weiterbearbeiten" },
  { name: "Vollkost-Aufbau", patient: "Lukas Fischer", initials: "LF", state: "Bereit", edited: "vor 4 Std", action: "Übergeben" },
  { name: "Diabetes Typ 2", patient: "Thomas Krüger", initials: "TK", state: "Freigegeben", edited: "gestern", action: "Öffnen" },
  { name: "Low-FODMAP Aufbau", patient: "Sofia Lindqvist", initials: "SL", state: "In Arbeit", edited: "gestern", action: "Weiterbearbeiten" },
]

interface PlanTask {
  action: string
  plan: string
  patient: string
  state: PlanState
}

/** Derived from plan status — there are no manually planned tasks. */
const PLAN_TASK_ACTION: Partial<Record<PlanState, string>> = {
  Entwurf: "Entwurf fertigstellen",
  "In Arbeit": "Weiterbearbeiten",
  Bereit: "Freigeben & übergeben (PDF)",
}

const planTasks: PlanTask[] = recentPlans
  .filter((plan) => plan.state in PLAN_TASK_ACTION)
  .map((plan) => ({
    action: PLAN_TASK_ACTION[plan.state] as string,
    plan: plan.name,
    patient: plan.patient,
    state: plan.state,
  }))

interface RecentPatient {
  name: string
  initials: string
  contextMeta: string
  when: string
}

const recentPatients: RecentPatient[] = [
  { name: "Anna Bergmann", initials: "AB", contextMeta: "Plan: Mediterrane Kost", when: "vor 18 Min" },
  { name: "Julia Schäfer", initials: "JS", contextMeta: "Erstgespräch · Notizen", when: "vor 2 Std" },
  { name: "Lukas Fischer", initials: "LF", contextMeta: "Plan: Vollkost-Aufbau", when: "vor 4 Std" },
  { name: "Thomas Krüger", initials: "TK", contextMeta: "Plan: Diabetes Typ 2", when: "gestern" },
  { name: "Sofia Lindqvist", initials: "SL", contextMeta: "Plan: Low-FODMAP Aufbau", when: "gestern" },
  { name: "Markus Wolf", initials: "MW", contextMeta: "Neuer Patient angelegt", when: "gestern" },
]

interface Appointment {
  time: string
  name: string
  sub: string
  duration: string
  domain: string
}

const appointments: Appointment[] = [
  { time: "09:00", name: "Anna Bergmann", sub: "Erstgespräch · Notizen", duration: "60 Min", domain: DOMAIN.analysis },
  { time: "11:00", name: "Thomas Krüger", sub: "Plan-Besprechung", duration: "30 Min", domain: DOMAIN.plan },
  { time: "14:30", name: "Sofia Lindqvist", sub: "Verlaufskontrolle", duration: "30 Min", domain: DOMAIN.analysis },
]

interface PulseStat {
  value: string
  label: string
  color: string
}

const pulseStats: PulseStat[] = [
  { value: "12", label: "Aktive Pläne", color: DOMAIN.plan },
  { value: "4", label: "Entwürfe", color: DOMAIN.report },
  { value: "48", label: "Aktive Patienten", color: DOMAIN.patient },
  { value: "6", label: "Erstgespräche · Woche", color: DOMAIN.analysis },
]

// UI preferences (would come from user settings).
const hasTermine = true
const showPulse = true

const resume = recentPlans[0]

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

function StatusBadge({ state }: { state: PlanState }) {
  const color = STATE_COLOR[state]
  return (
    <span
      className="inline-flex items-center rounded-full px-[11px] py-1 text-[11px] font-bold"
      style={{ color, backgroundColor: soft(color) }}
    >
      {state}
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
  link?: { label: string; color: string }
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
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: link.color }}
        >
          {link.label} ›
        </button>
      ) : null}
    </div>
  )
}

// --- Row components ------------------------------------------------------------

function PlanTaskRow({ task }: { task: PlanTask }) {
  const color = STATE_COLOR[task.state]
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-[9px] text-left transition-colors hover:bg-muted"
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>
          {task.action}
        </span>
        <span className="block truncate text-[12px]" style={{ color: TEXT.muted2 }}>
          {task.plan} · {task.patient}
        </span>
      </span>
      <ChevronRight className="size-[15px] shrink-0" style={{ color: TEXT.faint }} />
    </button>
  )
}

function PlanRow({ plan }: { plan: RecentPlan }) {
  const color = STATE_COLOR[plan.state]
  return (
    <div
      className="group flex items-center gap-3 rounded-xl border-l-2 px-3 py-[11px] transition-colors"
      style={{ borderLeftColor: color, backgroundColor: "var(--muted)" }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[12.5px] font-bold"
        style={{ color, backgroundColor: soft(color) }}
      >
        {plan.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold" style={{ color: TEXT.hi }}>
          {plan.name}
        </span>
        <span className="block truncate text-[12.5px]" style={{ color: TEXT.muted2 }}>
          {plan.patient} · {plan.edited}
        </span>
      </span>
      <StatusBadge state={plan.state} />
      <button
        type="button"
        className="shrink-0 rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold transition-opacity hover:opacity-80"
        style={{ color, backgroundColor: soft(color) }}
      >
        {plan.action}
      </button>
    </div>
  )
}

function PatientRow({ patient }: { patient: RecentPatient }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-[9px] text-left transition-colors hover:bg-muted"
    >
      <span
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{ color: DOMAIN.patient, backgroundColor: soft(DOMAIN.patient) }}
      >
        {patient.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>
          {patient.name}
        </span>
        <span className="block truncate text-[11.5px]" style={{ color: TEXT.muted2 }}>
          {patient.contextMeta}
        </span>
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: TEXT.faint }}>
        {patient.when}
      </span>
    </button>
  )
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <div className="flex items-center gap-3 rounded-[9px] px-1.5 py-[9px]">
      <span
        className="w-11 shrink-0 font-mono text-[13px] font-semibold tabular-nums"
        style={{ color: TEXT.muted }}
      >
        {appointment.time}
      </span>
      <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: appointment.domain }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>
          {appointment.name}
        </span>
        <span className="block truncate text-[11.5px]" style={{ color: TEXT.muted2 }}>
          {appointment.sub}
        </span>
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: TEXT.faint }}>
        {appointment.duration}
      </span>
    </div>
  )
}

function PulseStatItem({ stat }: { stat: PulseStat }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: stat.color }} />
      <span className="font-mono text-[20px] font-semibold tabular-nums" style={{ color: TEXT.hi }}>
        {stat.value}
      </span>
      <span className="text-[12.5px]" style={{ color: TEXT.muted }}>
        {stat.label}
      </span>
    </div>
  )
}

// --- Page ----------------------------------------------------------------------

export function DashboardOverviewClient() {
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date()
    const hour = now.getHours()
    const greetingLabel = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend"
    return {
      greeting: greetingLabel,
      dateLabel: format(now, "EEEE, d. MMMM yyyy", { locale: de }),
    }
  }, [])

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
            {greeting}, Julia
          </h1>
          <p className="text-[13px]" style={{ color: TEXT.faint }} suppressHydrationWarning>
            {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Benachrichtigungen"
            className="relative flex size-10 items-center justify-center rounded-[10px] border bg-card transition-colors hover:bg-accent"
          >
            <Bell className="size-[18px]" style={{ color: TEXT.muted }} />
            <span
              className="absolute right-2.5 top-2.5 size-1.5 rounded-full"
              style={{ backgroundColor: "var(--destructive)" }}
            />
          </button>
          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-extrabold transition-opacity hover:opacity-90"
            style={{
              background: BRAND_GRADIENT,
              color: ON_BRAND,
              boxShadow: BRAND_SHADOW,
            }}
          >
            <Plus className="size-[18px]" />
            Neuer Patient
          </button>
        </div>
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
            <StatusBadge state={resume.state} />
          </div>

          <h2 className="text-[24px] font-extrabold tracking-tight" style={{ color: TEXT.hi }}>
            {resume.name}
          </h2>
          <p className="mt-1 text-[13.5px]" style={{ color: TEXT.muted }}>
            {resume.patient} · zuletzt {resume.edited} bearbeitet
          </p>

          <div className="mt-auto pt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px]" style={{ color: TEXT.mid }}>
                3 von 5 Bausteinen fertig
              </span>
              <span className="font-mono text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
                70%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-[6px]" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="h-full rounded-[6px]" style={{ width: "70%", background: PROGRESS_GRADIENT }} />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-extrabold transition-opacity hover:opacity-90"
                style={{
                  background: BRAND_GRADIENT,
                  color: ON_BRAND,
                  boxShadow: BRAND_SHADOW,
                }}
              >
                Plan weiterbearbeiten
                <ArrowRight className="size-[18px]" />
              </button>
              <button
                type="button"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-[13.5px] font-semibold transition-colors hover:bg-accent"
                style={{ backgroundColor: "var(--secondary)", borderColor: "var(--input)", color: TEXT.mid }}
              >
                <FileText className="size-[17px]" />
                Vorschau (PDF)
              </button>
            </div>
          </div>
        </div>

        <CardShell className="flex-1">
          <CardTitle count="4" helper="Abgeleitet aus dem Status deiner Pläne">
            Pläne, die auf dich warten
          </CardTitle>
          <div className="flex flex-col gap-0.5">
            {planTasks.map((task) => (
              <PlanTaskRow key={`${task.action}-${task.plan}`} task={task} />
            ))}
          </div>
        </CardShell>
      </section>

      {/* Row 2 — Recents (the star) */}
      <section className="flex flex-col gap-5 lg:flex-row">
        <CardShell className="flex-[1.5]">
          <CardTitle link={{ label: "Alle Pläne", color: "var(--primary)" }}>
            Zuletzt bearbeitete Pläne
          </CardTitle>
          <div className="flex flex-col gap-2">
            {recentPlans.map((plan) => (
              <PlanRow key={plan.name} plan={plan} />
            ))}
          </div>
        </CardShell>

        <CardShell className="flex-1">
          <CardTitle link={{ label: "Alle", color: DOMAIN.patient }}>
            Zuletzt geöffnete Patienten
          </CardTitle>
          <div className="flex flex-col gap-0.5">
            {recentPatients.map((patient) => (
              <PatientRow key={patient.name} patient={patient} />
            ))}
          </div>
        </CardShell>
      </section>

      {/* Row 3 — Heute (optional) + Praxis-Puls */}
      <section className="flex flex-col gap-5 lg:flex-row">
        <CardShell className="flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold" style={{ color: TEXT.hi }}>
              Heute
            </h2>
            <SectionLabel>Optional · Termine</SectionLabel>
          </div>
          {hasTermine ? (
            <div className="flex flex-col gap-0.5">
              {appointments.map((appointment) => (
                <AppointmentRow key={appointment.time} appointment={appointment} />
              ))}
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center"
              style={{ borderColor: "var(--input)" }}
            >
              <Calendar className="size-7" style={{ color: TEXT.muted, opacity: 0.5 }} />
              <p className="text-[13.5px] font-bold" style={{ color: TEXT.muted }}>
                Keine Termine heute
              </p>
              <p className="max-w-xs text-[12.5px]" style={{ color: TEXT.faint }}>
                Inari verwaltet Termine optional. Trag einen ein oder verbinde deinen Kalender.
              </p>
              <button
                type="button"
                className="mt-1 flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[12.5px] font-semibold transition-colors hover:bg-accent"
                style={{ backgroundColor: "var(--secondary)", borderColor: "var(--input)", color: TEXT.mid }}
              >
                <Plus className="size-4" />
                Termin eintragen
              </button>
            </div>
          )}
        </CardShell>

        {showPulse ? (
          <CardShell className="flex-1">
            <div className="mb-4">
              <SectionLabel>Praxis-Puls</SectionLabel>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-2.5">
              {pulseStats.map((stat) => (
                <PulseStatItem key={stat.label} stat={stat} />
              ))}
            </div>
          </CardShell>
        ) : null}
      </section>
    </div>
  )
}
