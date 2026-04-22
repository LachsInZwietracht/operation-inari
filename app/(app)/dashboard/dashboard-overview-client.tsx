"use client"

import { useMemo } from "react"
import Link from "next/link"
import { format, subMonths, startOfMonth, addDays, formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Calendar,
  FileText,
  MessageSquare,
  Gift,
  UserPlus,
  CalendarPlus,
  ChefHat,
  Search,
  BarChart3,
  ArrowRight,
  Activity,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePatients } from "@/hooks/use-patients"
import { usePracticeAppointments, usePracticeInvoices } from "@/hooks/use-practice"
import { useCounseling } from "@/hooks/use-counseling"
import { useBirthdayReminders } from "@/hooks/use-birthday-reminders"
import { formatCurrency, formatDate } from "@/lib/format"
import type { PracticeAppointment } from "@/lib/types"

const TYPE_LABELS: Record<PracticeAppointment["type"], string> = {
  beratung: "Beratung",
  kontrolle: "Follow-up",
  team: "Team",
  webinar: "Workshop",
}

function getTrend(current: number, previous: number): "up" | "down" | "flat" {
  if (previous === 0) return current > 0 ? "up" : "flat"
  const change = (current - previous) / previous
  if (change > 0.02) return "up"
  if (change < -0.02) return "down"
  return "flat"
}

interface ActivityEvent {
  id: string
  type: "patient" | "appointment" | "counseling" | "invoice"
  title: string
  timestamp: Date
}

export function DashboardOverviewClient() {
  const { patients } = usePatients()
  const { appointments, upcomingAppointments } = usePracticeAppointments()
  const { invoices } = usePracticeInvoices()
  const { sessions } = useCounseling()
  const { reminders } = useBirthdayReminders(patients)

  const now = useMemo(() => new Date(), [])
  const currentMonthStart = useMemo(() => startOfMonth(now), [now])
  const previousMonthStart = useMemo(() => startOfMonth(subMonths(now, 1)), [now])

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  )

  // --- KPIs ---
  const kpis = useMemo(() => {
    const currentNewPatients = patients.filter(
      (p) => p.createdAt && new Date(p.createdAt) >= currentMonthStart,
    ).length
    const previousNewPatients = patients.filter((p) => {
      if (!p.createdAt) return false
      const d = new Date(p.createdAt)
      return d >= previousMonthStart && d < currentMonthStart
    }).length

    const sevenDaysFromNow = addDays(now, 7)
    const next7DaysAppointments = upcomingAppointments.filter((a) => {
      const d = new Date(`${a.date}T${a.startTime}`)
      return d <= sevenDaysFromNow
    }).length

    const openInvoices = invoices.filter((inv) => inv.status !== "bezahlt")
    const openAmount = openInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    const currentMonthSessions = sessions.filter(
      (s) => new Date(s.date) >= currentMonthStart,
    ).length
    const previousMonthSessions = sessions.filter((s) => {
      const d = new Date(s.date)
      return d >= previousMonthStart && d < currentMonthStart
    }).length

    return [
      {
        id: "patients",
        label: "Aktive Patienten",
        value: `${patients.length}`,
        trend: getTrend(currentNewPatients, previousNewPatients),
        helper: `${currentNewPatients} Neuzugänge diesen Monat`,
        icon: Users,
      },
      {
        id: "appointments_7d",
        label: "Termine (7 Tage)",
        value: `${next7DaysAppointments}`,
        trend: "flat" as const,
        helper: `${upcomingAppointments.length} insgesamt geplant`,
        icon: Calendar,
      },
      {
        id: "open_invoices",
        label: "Offene Rechnungen",
        value: formatCurrency(openAmount),
        trend: openInvoices.length > 5 ? ("down" as const) : ("flat" as const),
        helper: `${openInvoices.length} offene Vorgänge`,
        icon: FileText,
      },
      {
        id: "counseling_month",
        label: "Beratungen (Monat)",
        value: `${currentMonthSessions}`,
        trend: getTrend(currentMonthSessions, previousMonthSessions),
        helper: `${previousMonthSessions} im Vormonat`,
        icon: MessageSquare,
      },
    ]
  }, [patients, upcomingAppointments, invoices, sessions, now, currentMonthStart, previousMonthStart])

  // --- Activity Feed ---
  const activityFeed = useMemo(() => {
    const events: ActivityEvent[] = []

    patients.forEach((p) => {
      if (p.createdAt) {
        events.push({
          id: `patient_${p.id}`,
          type: "patient",
          title: `${p.firstName} ${p.lastName} angelegt`,
          timestamp: new Date(p.createdAt),
        })
      }
    })

    appointments.forEach((a) => {
      const ts = a.createdAt ? new Date(a.createdAt) : new Date(`${a.date}T${a.startTime}`)
      const patient = a.patientId ? patientMap.get(a.patientId) : null
      const name = patient ? `${patient.firstName} ${patient.lastName}` : a.title
      events.push({
        id: `appt_${a.id}`,
        type: "appointment",
        title: `Termin: ${name}`,
        timestamp: ts,
      })
    })

    sessions.forEach((s) => {
      const ts = s.createdAt ? new Date(s.createdAt) : new Date(s.date)
      const patient = patientMap.get(s.patientId)
      const name = patient ? `${patient.firstName} ${patient.lastName}` : "Patient"
      events.push({
        id: `session_${s.id}`,
        type: "counseling",
        title: `Beratung: ${name}`,
        timestamp: ts,
      })
    })

    invoices.forEach((inv) => {
      const ts = inv.createdAt ? new Date(inv.createdAt) : new Date(inv.dueDate)
      events.push({
        id: `inv_${inv.id}`,
        type: "invoice",
        title: `Rechnung: ${inv.service}`,
        timestamp: ts,
      })
    })

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8)
  }, [patients, appointments, sessions, invoices, patientMap])

  // --- Revenue Chart (last 4 months) ---
  const revenueData = useMemo(() => {
    const fourMonthsAgo = startOfMonth(subMonths(now, 3))
    const filtered = invoices.filter((inv) => new Date(inv.dueDate) >= fourMonthsAgo)

    const map = new Map<string, { month: string; sortKey: string; bezahlt: number; offen: number }>()
    filtered.forEach((inv) => {
      const d = new Date(inv.dueDate)
      const key = format(d, "yyyy-MM")
      const label = format(d, "MMM yy", { locale: de })
      if (!map.has(key)) {
        map.set(key, { month: label, sortKey: key, bezahlt: 0, offen: 0 })
      }
      const bucket = map.get(key)!
      if (inv.status === "bezahlt") {
        bucket.bezahlt += inv.amount
      } else {
        bucket.offen += inv.amount
      }
    })
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [invoices, now])

  // --- Upcoming Appointments (next 5) ---
  const nextAppointments = useMemo(
    () => upcomingAppointments.slice(0, 5),
    [upcomingAppointments],
  )

  // --- Birthdays (next 14 days, open only) ---
  const upcomingBirthdays = useMemo(() => {
    const limit = addDays(now, 14)
    return reminders
      .filter((r) => r.status === "open" && new Date(r.dueDate) <= limit)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [reminders, now])

  const activityIcon = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "patient": return <UserPlus className="h-4 w-4 text-emerald-600" />
      case "appointment": return <Calendar className="h-4 w-4 text-blue-600" />
      case "counseling": return <MessageSquare className="h-4 w-4 text-violet-600" />
      case "invoice": return <FileText className="h-4 w-4 text-amber-600" />
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ihre Praxis auf einen Blick"
        helpText="Ihr persönliches Dashboard zeigt die wichtigsten Kennzahlen zu Patienten, Terminen, Beratungen und Abrechnungen auf einen Blick."
      />

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const TrendIcon =
            kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus
          const trendColor =
            kpi.trend === "up"
              ? "text-emerald-600"
              : kpi.trend === "down"
              ? "text-destructive"
              : "text-muted-foreground"
          return (
            <Card key={kpi.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                <TrendIcon className={`${trendColor} h-4 w-4`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-muted-foreground text-xs">{kpi.helper}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Activity Feed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Aktivitäten
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityFeed.length === 0 ? (
                <p className="text-muted-foreground text-sm">Noch keine Aktivitäten</p>
              ) : (
                <div className="space-y-3">
                  {activityFeed.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="mt-0.5">{activityIcon(event.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatDistanceToNow(event.timestamp, {
                            locale: de,
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Umsatz-Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueData.length === 0 ? (
                <p className="text-muted-foreground text-sm">Keine Rechnungsdaten vorhanden.</p>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar
                        dataKey="bezahlt"
                        name="Bezahlt"
                        stackId="revenue"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="offen"
                        name="Offen"
                        stackId="revenue"
                        fill="hsl(var(--chart-4))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Nächste Termine</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/termine">
                  Alle <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {nextAppointments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Keine anstehenden Termine</p>
              ) : (
                <div className="space-y-3">
                  {nextAppointments.map((appt) => {
                    const patient = appt.patientId ? patientMap.get(appt.patientId) : null
                    const name = patient
                      ? `${patient.firstName} ${patient.lastName}`
                      : appt.title
                    return (
                      <div key={appt.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatDate(appt.date)} · {appt.startTime}–{appt.endTime}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {TYPE_LABELS[appt.type]}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Birthdays */}
          {upcomingBirthdays.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Geburtstage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingBirthdays.map((reminder) => {
                    const patient = patientMap.get(reminder.patientId)
                    if (!patient) return null
                    return (
                      <div key={reminder.id} className="flex items-center gap-3">
                        <Gift className="h-4 w-4 text-pink-500" />
                        <div>
                          <p className="text-sm font-medium">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatDate(reminder.dueDate)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/patienten">
            <UserPlus className="mr-2 h-4 w-4" />
            Neuer Patient
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/termine">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Neuer Termin
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rezepte/neu">
            <ChefHat className="mr-2 h-4 w-4" />
            Neues Rezept
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/lebensmittel">
            <Search className="mr-2 h-4 w-4" />
            Lebensmittel suchen
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/praxis-statistiken">
            <BarChart3 className="mr-2 h-4 w-4" />
            Statistiken
          </Link>
        </Button>
      </div>
    </div>
  )
}
