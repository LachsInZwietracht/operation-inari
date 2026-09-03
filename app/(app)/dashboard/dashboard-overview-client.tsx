"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { addDays, addWeeks, format, formatDistanceToNowStrict, isWeekend, parseISO, startOfWeek } from "date-fns"
import { de } from "date-fns/locale"
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FilePenLine,
  Plus,
  UserPlus,
  Users,
} from "lucide-react"

import { PracticeTaskBoard } from "@/components/practice-task-board"
import { buildDashboardWorklist, type DashboardWorkItem } from "@/lib/dashboard-worklist"
import type {
  CounselingSession,
  DailyMealPlan,
  Patient,
  PatientIntakeSubmission,
  PracticeAppointment,
  PracticeTask,
} from "@/lib/types"

const TEXT = {
  hi: "var(--card-foreground)",
  body: "var(--foreground)",
  mid: "var(--secondary-foreground)",
  muted: "var(--muted-foreground)",
  faint: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
} as const

const BRAND_GRADIENT = "var(--brand-gradient)"
const ON_BRAND = "var(--on-brand)"
const BRAND_SHADOW = "0 6px 18px var(--brand-shadow)"

const APPOINTMENT_TYPE_LABEL: Record<PracticeAppointment["type"], string> = {
  beratung: "Beratung",
  kontrolle: "Kontrolle",
  team: "Team",
  webinar: "Webinar",
}

const APPOINTMENT_TYPE_COLOR: Record<PracticeAppointment["type"], string> = {
  beratung: "var(--chart-3)",
  kontrolle: "var(--chart-2)",
  team: "var(--chart-4)",
  webinar: "var(--chart-1)",
}

const WORK_META = {
  intake: { icon: ClipboardCheck, color: "var(--chart-4)" },
  plan: { icon: FilePenLine, color: "var(--chart-1)" },
  contact: { icon: Clock3, color: "var(--chart-2)" },
} as const

const soft = (color: string) => `color-mix(in srgb, ${color} 13%, transparent)`

interface DashboardProps {
  firstName: string | null
  plans: DailyMealPlan[]
  patients: Patient[]
  appointments: PracticeAppointment[]
  sessions: CounselingSession[]
  submissions: PatientIntakeSubmission[]
  tasks: PracticeTask[]
}

function patientName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`
}

function patientInitials(patient: Patient): string {
  return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase()
}

function relativeTimestamp(iso?: string): string {
  if (!iso) return ""
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: de, addSuffix: true })
  } catch {
    return ""
  }
}

function planHref(plan: DailyMealPlan): string {
  const params = new URLSearchParams({ date: plan.date })
  if (plan.patientId) params.set("patientId", plan.patientId)
  return `/ernaehrungsplan?${params.toString()}`
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-[18px] border bg-card p-5 sm:p-6 ${className}`}>{children}</section>
}

function CardHeading({
  title,
  helper,
  href,
  linkLabel,
}: {
  title: string
  helper?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold" style={{ color: TEXT.hi }}>{title}</h2>
        {helper ? <p className="mt-0.5 text-xs" style={{ color: TEXT.faint }}>{helper}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 text-[12.5px] font-semibold text-primary hover:underline">
          {linkLabel} ›
        </Link>
      ) : null}
    </div>
  )
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  helper: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ color, backgroundColor: soft(color) }}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xl font-semibold tabular-nums" style={{ color: TEXT.hi }}>{value}</span>
        <span className="block truncate text-xs font-semibold" style={{ color: TEXT.body }}>{label}</span>
        <span className="block truncate text-[11px]" style={{ color: TEXT.faint }}>{helper}</span>
      </span>
    </div>
  )
}

function WorkRow({ item }: { item: DashboardWorkItem }) {
  const meta = WORK_META[item.kind]
  const Icon = meta.icon
  return (
    <Link href={item.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: meta.color, backgroundColor: soft(meta.color) }}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-bold" style={{ color: TEXT.body }}>{item.title}</span>
          {item.priority === "high" ? <span className="size-2 shrink-0 rounded-full bg-destructive" title="Hohe Priorität" /> : null}
        </span>
        <span className="block truncate text-xs" style={{ color: TEXT.faint }}>{item.detail}</span>
      </span>
      <span className="hidden shrink-0 text-xs font-semibold text-primary sm:inline">{item.action}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function AppointmentRow({
  appointment,
  patient,
}: {
  appointment: PracticeAppointment
  patient?: Patient
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5">
      <span className="w-11 shrink-0 font-mono text-sm font-semibold tabular-nums text-muted-foreground">{appointment.startTime}</span>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: APPOINTMENT_TYPE_COLOR[appointment.type] }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{patient ? patientName(patient) : appointment.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {patient ? appointment.title : APPOINTMENT_TYPE_LABEL[appointment.type]}
          {appointment.location ? ` · ${appointment.location}` : ""}
        </span>
      </span>
      {patient ? (
        <Link href={`/patienten/${patient.id}`} className="text-xs font-semibold text-primary hover:underline">Akte</Link>
      ) : null}
    </div>
  )
}

export function DashboardOverviewClient({
  firstName,
  plans,
  patients,
  appointments,
  sessions,
  submissions,
  tasks,
}: DashboardProps) {
  const [nowTs] = useState(() => Date.now())
  const today = useMemo(() => new Date(nowTs), [nowTs])
  const todayIso = format(today, "yyyy-MM-dd")
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }))

  const derived = useMemo(() => {
    const patientsById = new Map(patients.map((patient) => [patient.id, patient]))
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index)
      const iso = format(date, "yyyy-MM-dd")
      return {
        date,
        iso,
        appointments: appointments
          .filter((appointment) => appointment.date === iso)
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }
    })
    const lastSessionByPatient = new Map<string, string>()
    for (const session of sessions) {
      const current = lastSessionByPatient.get(session.patientId)
      if (!current || session.date > current) lastSessionByPatient.set(session.patientId, session.date)
    }
    const recentPatients = [...patients]
      .filter((patient) => patient.status !== "archived")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 6)
    const visiblePlans = [...plans]
      .filter((plan) => plan.status !== "archived")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    const worklist = buildDashboardWorklist({ patients, plans, appointments, sessions, submissions, now: today }).slice(0, 7)
    const weekEnd = format(addDays(weekStart, 6), "yyyy-MM-dd")

    return {
      patientsById,
      week,
      lastSessionByPatient,
      recentPatients,
      visiblePlans,
      worklist,
      stats: {
        intake: submissions.filter((submission) => submission.status === "new" || submission.status === "reviewed").length,
        patients: patients.filter((patient) => (patient.status ?? "active") === "active").length,
        plans: plans.filter((plan) => plan.status === "draft" || plan.status === "active").length,
        appointments: appointments.filter((appointment) => appointment.date >= format(weekStart, "yyyy-MM-dd") && appointment.date <= weekEnd).length,
      },
    }
  }, [appointments, patients, plans, sessions, submissions, today, weekStart])

  const selectedAppointments = derived.week.find((day) => day.iso === selectedDate)?.appointments ?? []
  const selectedDateObject = derived.week.find((day) => day.iso === selectedDate)?.date ?? today
  const hour = today.getHours()
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend"
  const changeWeek = (direction: -1 | 1) => {
    setWeekStart((current) => addWeeks(current, direction))
    setSelectedDate((current) => format(addWeeks(parseISO(current), direction), "yyyy-MM-dd"))
  }
  const showCurrentWeek = () => {
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))
    setSelectedDate(todayIso)
  }

  return (
    <div className="mx-auto flex min-w-0 w-full max-w-[1300px] flex-col gap-5 overflow-x-hidden">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: TEXT.hi }} suppressHydrationWarning>
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[13px]" style={{ color: TEXT.faint }} suppressHydrationWarning>
            {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/patienten/aufnahmen"
            className="flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[13.5px] font-extrabold transition-opacity hover:opacity-90"
            style={{ background: BRAND_GRADIENT, color: ON_BRAND, boxShadow: BRAND_SHADOW }}
          >
            <UserPlus className="size-[18px]" />
            Neue Aufnahme
          </Link>
          <Link href="/patienten/neu" className="flex h-10 items-center justify-center gap-2 rounded-[10px] border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-accent">
            <Plus className="size-4" /> Neuer Patient
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Praxisübersicht">
        <StatCard label="Fragebogen prüfen" value={derived.stats.intake} helper="wartet auf deine Entscheidung" icon={ClipboardCheck} color="var(--chart-4)" />
        <StatCard label="Aktive Patienten" value={derived.stats.patients} helper="aktuell in der Praxis" icon={Users} color="var(--chart-2)" />
        <StatCard label="Offene Pläne" value={derived.stats.plans} helper="Entwürfe und laufende Pläne" icon={FilePenLine} color="var(--chart-1)" />
        <StatCard label="Termine diese Woche" value={derived.stats.appointments} helper="Montag bis Sonntag" icon={CalendarDays} color="var(--chart-3)" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <CardShell>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: TEXT.hi }}>Kalender</h2>
              <p className="mt-0.5 text-xs" style={{ color: TEXT.faint }}>
                {format(weekStart, "d. MMMM", { locale: de })} – {format(addDays(weekStart, 6), "d. MMMM yyyy", { locale: de })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => changeWeek(-1)} aria-label="Vorherige Woche" className="flex size-8 items-center justify-center rounded-lg border hover:bg-muted">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={showCurrentWeek} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">Heute</button>
              <button type="button" onClick={() => changeWeek(1)} aria-label="Nächste Woche" className="flex size-8 items-center justify-center rounded-lg border hover:bg-muted">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="grid min-w-[500px] grid-cols-7 gap-1.5" role="tablist" aria-label="Kalendertage">
              {derived.week.map((day) => {
              const selected = day.iso === selectedDate
              const weekend = isWeekend(day.date)
              return (
                <button
                  key={day.iso}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`${format(day.date, "EEEE, d. MMMM", { locale: de })}${weekend ? " (Wochenende)" : ""}`}
                  onClick={() => setSelectedDate(day.iso)}
                  className={`flex min-w-0 flex-col items-center rounded-xl border px-1 py-2.5 transition-colors hover:bg-muted ${weekend ? "opacity-60" : ""}`}
                  style={selected ? { borderColor: "var(--primary)", backgroundColor: soft("var(--primary)") } : weekend ? { backgroundColor: soft("var(--muted-foreground)") } : undefined}
                >
                  <span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{format(day.date, "EEE", { locale: de })}</span>
                  <span className="mt-1 font-mono text-lg font-semibold tabular-nums">{format(day.date, "d")}</span>
                  <span className="mt-1 flex h-4 items-center justify-center">
                    {day.appointments.length > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{day.appointments.length}</span>
                    ) : <span className="size-1 rounded-full bg-border" />}
                  </span>
                </button>
              )
              })}
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{selectedDate === todayIso ? "Heute" : format(selectedDateObject, "EEEE, d. MMMM", { locale: de })}</p>
              <Link href="/termine" className="text-xs font-semibold text-primary hover:underline">Termin eintragen</Link>
            </div>
            {selectedAppointments.length > 0 ? (
              <div className="space-y-2">
                {selectedAppointments.map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} patient={appointment.patientId ? derived.patientsById.get(appointment.patientId) : undefined} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                <CalendarDays className="size-5" /> Keine Termine an diesem Tag.
              </div>
            )}
          </div>
        </CardShell>

        <CardShell>
          <CardHeading title="Was jetzt wichtig ist" helper="Nach Dringlichkeit aus deinen Daten sortiert" />
          {derived.worklist.length > 0 ? (
            <div className="space-y-0.5">{derived.worklist.map((item) => <WorkRow key={item.id} item={item} />)}</div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed px-4 py-9 text-center">
              <CheckCircle2 className="size-8 text-primary" />
              <p className="mt-2 text-sm font-semibold">Alles im Blick</p>
              <p className="mt-1 text-xs text-muted-foreground">Neue Fragebogen, offene Pläne und fällige Kontakte erscheinen hier.</p>
            </div>
          )}
        </CardShell>
      </section>

      <CardShell>
        <CardHeading title="Aufgaben" helper="Dein Board — was du selbst notiert hast" />
        <PracticeTaskBoard initialTasks={tasks} />
      </CardShell>

      <section className="grid gap-5 lg:grid-cols-2">
        <CardShell>
          <CardHeading title="Meine Patienten" helper="Zuletzt geänderte Akten" href="/patienten" linkLabel="Alle Patienten" />
          {derived.recentPatients.length > 0 ? (
            <div className="space-y-1">
              {derived.recentPatients.map((patient) => {
                const lastSession = derived.lastSessionByPatient.get(patient.id)
                return (
                  <Link key={patient.id} href={`/patienten/${patient.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ color: "var(--chart-2)", backgroundColor: soft("var(--chart-2)") }}>{patientInitials(patient)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{patientName(patient)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{lastSession ? `Letzte Beratung: ${format(parseISO(lastSession), "dd.MM.yyyy")}` : "Noch keine Beratung dokumentiert"}</span>
                    </span>
                    <span className="hidden text-[11px] text-muted-foreground sm:block" suppressHydrationWarning>{relativeTimestamp(patient.updatedAt)}</span>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Noch keine Patienten vorhanden.</div>
          )}
        </CardShell>

        <CardShell>
          <CardHeading title="Ernährungspläne" helper="Zuletzt bearbeitet" href="/ernaehrungsplan" linkLabel="Alle Pläne" />
          {derived.visiblePlans.length > 0 ? (
            <div className="space-y-1">
              {derived.visiblePlans.map((plan) => {
                const patient = plan.patientId ? derived.patientsById.get(plan.patientId) : undefined
                const status = plan.status ?? "draft"
                return (
                  <Link key={plan.id} href={planHref(plan)} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--chart-1)", backgroundColor: soft("var(--chart-1)") }}><FilePenLine className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{plan.title || "Ernährungsplan"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{patient ? patientName(patient) : "Ohne Patient"} · {status === "draft" ? "Entwurf" : status === "active" ? "In Arbeit" : "Freigegeben"}</span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center">
              <AlertCircle className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Noch keine Ernährungspläne vorhanden.</p>
            </div>
          )}
        </CardShell>
      </section>
    </div>
  )
}
