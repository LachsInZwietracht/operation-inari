"use client"

import { useState, useMemo } from "react"
import { format, startOfWeek, addDays, startOfMonth, subMonths, startOfYear } from "date-fns"
import { de } from "date-fns/locale"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePracticeAppointments, usePracticeInvoices } from "@/hooks/use-practice"
import { usePatients } from "@/hooks/use-patients"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import type { PracticeAppointment } from "@/lib/types"

const TYPE_LABELS: Record<PracticeAppointment["type"], string> = {
  beratung: "Beratung",
  kontrolle: "Follow-up",
  team: "Team",
  webinar: "Workshop",
}

function calculateDurationMinutes(appointment: PracticeAppointment) {
  const [startHour, startMinute] = appointment.startTime.split(":").map(Number)
  const [endHour, endMinute] = appointment.endTime.split(":").map(Number)
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  return Math.max(15, end - start)
}

function computeStats(values: number[]) {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0, std: 0 }
  }
  const sum = values.reduce((acc, value) => acc + value, 0)
  const mean = sum / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance = values.length > 1
    ? values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / (values.length - 1)
    : 0
  const std = Math.sqrt(variance)
  return { mean, min, max, std }
}

function getTrend(current: number, previous: number): "up" | "down" | "flat" {
  if (previous === 0) return current > 0 ? "up" : "flat"
  const change = (current - previous) / previous
  if (change > 0.02) return "up"
  if (change < -0.02) return "down"
  return "flat"
}

type TimeRange = "month" | "quarter" | "year" | "all"

const GENDER_LABELS: Record<string, string> = {
  m: "Männlich",
  w: "Weiblich",
  d: "Divers",
}

const GENDER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

export default function PraxisStatistikenPage() {
  const { appointments } = usePracticeAppointments()
  const { invoices } = usePracticeInvoices()
  const { patients } = usePatients()
  const [timeRange, setTimeRange] = useState<TimeRange>("month")

  const now = useMemo(() => new Date(), [])
  const currentMonthStart = useMemo(() => startOfMonth(now), [now])
  const previousMonthStart = useMemo(() => startOfMonth(subMonths(now, 1)), [now])

  // --- Dynamic KPIs (always current month vs previous month) ---
  const dynamicKpis = useMemo(() => {
    const currentMonthAppointments = appointments.filter(
      (a) => new Date(a.date) >= currentMonthStart,
    )
    const previousMonthAppointments = appointments.filter((a) => {
      const d = new Date(a.date)
      return d >= previousMonthStart && d < currentMonthStart
    })

    const currentMonthInvoices = invoices.filter(
      (inv) => new Date(inv.dueDate) >= currentMonthStart,
    )
    const previousMonthInvoices = invoices.filter((inv) => {
      const d = new Date(inv.dueDate)
      return d >= previousMonthStart && d < currentMonthStart
    })

    const currentNewPatients = patients.filter(
      (p) => p.createdAt && new Date(p.createdAt) >= currentMonthStart,
    ).length
    const previousNewPatients = patients.filter((p) => {
      if (!p.createdAt) return false
      const d = new Date(p.createdAt)
      return d >= previousMonthStart && d < currentMonthStart
    }).length

    const currentMonthDurations = currentMonthAppointments.map(calculateDurationMinutes)
    const avgDuration = currentMonthDurations.length
      ? Math.round(currentMonthDurations.reduce((a, b) => a + b, 0) / currentMonthDurations.length)
      : 0
    const prevMonthDurations = previousMonthAppointments.map(calculateDurationMinutes)
    const prevAvgDuration = prevMonthDurations.length
      ? Math.round(prevMonthDurations.reduce((a, b) => a + b, 0) / prevMonthDurations.length)
      : 0

    const currentRevenue = currentMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const previousRevenue = previousMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    return [
      {
        id: "patients_active",
        label: "Aktive Patienten",
        value: `${patients.length}`,
        trend: getTrend(currentNewPatients, previousNewPatients),
        helper: `${currentNewPatients} Neuzugänge diesen Monat`,
      },
      {
        id: "sessions_month",
        label: "Sitzungen (Monat)",
        value: `${currentMonthAppointments.length}`,
        trend: getTrend(currentMonthAppointments.length, previousMonthAppointments.length),
        helper: `${previousMonthAppointments.length} im Vormonat`,
      },
      {
        id: "avg_duration",
        label: "Ø Sitzungsdauer",
        value: `${avgDuration} min`,
        trend: getTrend(avgDuration, prevAvgDuration),
        helper: `${prevAvgDuration} min im Vormonat`,
      },
      {
        id: "revenue",
        label: "Umsatz (Monat)",
        value: formatCurrency(currentRevenue),
        trend: getTrend(currentRevenue, previousRevenue),
        helper: `${formatCurrency(previousRevenue)} im Vormonat`,
      },
    ]
  }, [appointments, invoices, patients, currentMonthStart, previousMonthStart])

  // --- Time-range filtering ---
  const rangeStart = useMemo(() => {
    switch (timeRange) {
      case "month":
        return currentMonthStart
      case "quarter":
        return startOfMonth(subMonths(now, 2))
      case "year":
        return startOfYear(now)
      case "all":
        return new Date(0)
    }
  }, [timeRange, currentMonthStart, now])

  const filteredAppointments = useMemo(
    () => appointments.filter((a) => new Date(a.date) >= rangeStart),
    [appointments, rangeStart],
  )

  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => new Date(inv.dueDate) >= rangeStart),
    [invoices, rangeStart],
  )

  // --- Existing computations using filtered data ---
  const appointmentDurations = useMemo(
    () => filteredAppointments.map(calculateDurationMinutes),
    [filteredAppointments],
  )
  const durationStats = useMemo(() => computeStats(appointmentDurations), [appointmentDurations])

  const invoiceAmounts = useMemo(() => filteredInvoices.map((invoice) => invoice.amount), [filteredInvoices])
  const invoiceStats = useMemo(() => computeStats(invoiceAmounts), [invoiceAmounts])

  const appointmentTimeline = useMemo(() => {
    const map = new Map<string, { iso: string; label: string; appointments: number; patientSlots: number }>()
    filteredAppointments.forEach((appointment) => {
      if (!map.has(appointment.date)) {
        map.set(appointment.date, {
          iso: appointment.date,
          label: format(new Date(appointment.date), "dd.MM.", { locale: de }),
          appointments: 0,
          patientSlots: 0,
        })
      }
      const bucket = map.get(appointment.date)!
      bucket.appointments += 1
      if (appointment.patientId) {
        bucket.patientSlots += 1
      }
    })
    return Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso))
  }, [filteredAppointments])

  const typeBreakdown = useMemo(() => {
    const counts: Record<PracticeAppointment["type"], { total: number; patientSlots: number }> = {
      beratung: { total: 0, patientSlots: 0 },
      kontrolle: { total: 0, patientSlots: 0 },
      team: { total: 0, patientSlots: 0 },
      webinar: { total: 0, patientSlots: 0 },
    }
    filteredAppointments.forEach((appointment) => {
      counts[appointment.type].total += 1
      if (appointment.patientId) {
        counts[appointment.type].patientSlots += 1
      }
    })
    return Object.entries(counts).map(([type, value]) => ({
      type: TYPE_LABELS[type as PracticeAppointment["type"]],
      termine: value.total,
      patienten: value.patientSlots,
    }))
  }, [filteredAppointments])

  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  const appointmentsThisWeek = appointments.filter((appointment) => {
    const appointmentDate = new Date(appointment.date)
    return appointmentDate >= weekStart && appointmentDate <= weekEnd
  })

  const slotUtilization = Math.min(100, Math.round((appointmentsThisWeek.length / 20) * 100))
  const recurringShare = filteredAppointments.length
    ? Math.round((filteredAppointments.filter((appointment) => appointment.recurring).length / filteredAppointments.length) * 100)
    : 0

  const totalRevenue = invoiceAmounts.reduce((acc, value) => acc + value, 0)
  const outstandingRevenue = filteredInvoices
    .filter((invoice) => invoice.status !== "bezahlt")
    .reduce((acc, invoice) => acc + invoice.amount, 0)
  const paymentRate = totalRevenue ? Math.round(((totalRevenue - outstandingRevenue) / totalRevenue) * 100) : 0
  const averageTicket = filteredInvoices.length ? totalRevenue / filteredInvoices.length : 0

  const performanceIndicators = [
    {
      label: "Slot-Auslastung",
      value: slotUtilization,
      helper: `${appointmentsThisWeek.length} Termine in der aktuellen Woche (Kapazität 20)`,
    },
    {
      label: "Zahlungsquote",
      value: paymentRate,
      helper: `${formatCurrency(totalRevenue - outstandingRevenue)} von ${formatCurrency(totalRevenue)} erhalten`,
    },
    {
      label: "Serientermine",
      value: recurringShare,
      helper: "Anteil wiederkehrender Termine",
    },
  ]

  const uniquePatients = useMemo(() => {
    const set = new Set<string>()
    filteredAppointments.forEach((appointment) => {
      if (appointment.patientId) {
        set.add(appointment.patientId)
      }
    })
    return set.size
  }, [filteredAppointments])

  const overdueInvoices = filteredInvoices.filter((invoice) => {
    const dueDate = new Date(invoice.dueDate)
    return invoice.status !== "bezahlt" && dueDate < now
  })

  const statsTable = [
    {
      metric: "Termindauer (Minuten)",
      mean: `${formatNumber(durationStats.mean, 0)}`,
      min: `${formatNumber(durationStats.min, 0)}`,
      max: `${formatNumber(durationStats.max, 0)}`,
      std: `${formatNumber(durationStats.std, 1)}`,
    },
    {
      metric: "Rechnungsbetrag (€)",
      mean: formatCurrency(invoiceStats.mean),
      min: formatCurrency(invoiceStats.min),
      max: formatCurrency(invoiceStats.max),
      std: `${formatNumber(invoiceStats.std, 1)} €`,
    },
    {
      metric: "Aktive Patienten",
      mean: `${uniquePatients}`,
      min: "Ziel 120",
      max: "Kapazität 180",
      std: `${filteredAppointments.length ? Math.max(1, Math.round(uniquePatients * 0.05)) : 0}`,
    },
  ]

  const invoiceHealth = [
    { label: "Gesamtumsatz", value: formatCurrency(totalRevenue) },
    { label: "Offen", value: formatCurrency(outstandingRevenue) },
    { label: "Ø Ticket", value: formatCurrency(averageTicket) },
    { label: "Überfällig", value: `${overdueInvoices.length} Vorgänge` },
  ]

  // --- Monthly revenue stacked bar chart data ---
  const monthlyRevenueData = useMemo(() => {
    const map = new Map<string, { month: string; sortKey: string; bezahlt: number; offen: number }>()
    filteredInvoices.forEach((inv) => {
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
  }, [filteredInvoices])

  // --- Patient demographics ---
  const genderDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    patients.forEach((p) => {
      const key = p.gender || "d"
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).map(([gender, count]) => ({
      name: GENDER_LABELS[gender] || gender,
      value: count,
    }))
  }, [patients])

  const topIndikationen = useMemo(() => {
    const counts: Record<string, number> = {}
    patients.forEach((p) => {
      if (p.indication) {
        counts[p.indication] = (counts[p.indication] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [patients])

  const newPatientsPerMonth = useMemo(() => {
    const map = new Map<string, { month: string; sortKey: string; count: number }>()
    patients.forEach((p) => {
      if (!p.createdAt) return
      const d = new Date(p.createdAt)
      if (d < rangeStart) return
      const key = format(d, "yyyy-MM")
      const label = format(d, "MMM yy", { locale: de })
      if (!map.has(key)) {
        map.set(key, { month: label, sortKey: key, count: 0 })
      }
      map.get(key)!.count += 1
    })
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [patients, rangeStart])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Praxis-Statistiken"
        description="Alle KPIs zur Auslastung, Patientenzahlen und Abrechnung auf einen Blick"
        helpText="Ihre Praxis-Kennzahlen im Überblick. Analysieren Sie Auslastung, Patientenentwicklung und Umsatz, um Ihre Praxis datenbasiert zu steuern."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dynamicKpis.map((kpi) => {
          const Icon =
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
                <Icon className={`${trendColor} h-4 w-4`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-muted-foreground text-xs">{kpi.helper}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
        <TabsList>
          <TabsTrigger value="month">Dieser Monat</TabsTrigger>
          <TabsTrigger value="quarter">Letzte 3 Monate</TabsTrigger>
          <TabsTrigger value="year">Dieses Jahr</TabsTrigger>
          <TabsTrigger value="all">Gesamt</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Timeline Terminvolumen</CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentTimeline.length === 0 ? (
              <p className="text-muted-foreground text-sm">Noch keine Messwerte.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={appointmentTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="appointments"
                      name="Termine"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="patientSlots"
                      name="Patiententermine"
                      stroke="hsl(var(--primary) / 0.5)"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leistungsauslastung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {performanceIndicators.map((indicator) => (
              <div key={indicator.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{indicator.label}</span>
                  <span>{indicator.value}%</span>
                </div>
                <Progress value={indicator.value} />
                <p className="text-muted-foreground text-xs">{indicator.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mix der Termine</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAppointments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Termine vorhanden.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" interval={0} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="termine" name="Slots" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="patienten" name="Patiententermine" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monatlicher Umsatz</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyRevenueData.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Rechnungsdaten vorhanden.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="bezahlt" name="Bezahlt" stackId="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="offen" name="Offen/Mahnung" stackId="revenue" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Statistische Kennzahlen</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kennzahl</TableHead>
                  <TableHead>Mittelwert</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Std-Abw.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statsTable.map((row) => (
                  <TableRow key={row.metric}>
                    <TableCell className="font-medium">{row.metric}</TableCell>
                    <TableCell>{row.mean}</TableCell>
                    <TableCell>{row.min}</TableCell>
                    <TableCell>{row.max}</TableCell>
                    <TableCell>{row.std}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Umsatz & Risiken</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {invoiceHealth.map((item) => (
              <div key={item.label} className="rounded-lg border p-3">
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Geschlechterverteilung</CardTitle>
          </CardHeader>
          <CardContent>
            {patients.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Patientendaten vorhanden.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {genderDistribution.map((_entry, index) => (
                        <Cell key={index} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Indikationen</CardTitle>
          </CardHeader>
          <CardContent>
            {topIndikationen.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Indikationen erfasst.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topIndikationen} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Patienten" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neuzugänge</CardTitle>
          </CardHeader>
          <CardContent>
            {newPatientsPerMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Neuzugänge im Zeitraum.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newPatientsPerMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Neue Patienten" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Warnungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overdueInvoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine offenen Risiken.</p>
          ) : (
            overdueInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{invoice.service}</span>
                  <Badge variant="destructive">Überfällig</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatDate(invoice.dueDate)} · {formatCurrency(invoice.amount)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
