"use client"

import { useMemo } from "react"
import { format, startOfWeek, addDays } from "date-fns"
import { de } from "date-fns/locale"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PRACTICE_KPIS } from "@/lib/mock-data"
import { usePracticeAppointments, usePracticeInvoices } from "@/hooks/use-practice"
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

export default function PraxisStatistikenPage() {
  const { appointments } = usePracticeAppointments()
  const { invoices } = usePracticeInvoices()

  const appointmentDurations = useMemo(
    () => appointments.map(calculateDurationMinutes),
    [appointments],
  )
  const durationStats = useMemo(() => computeStats(appointmentDurations), [appointmentDurations])

  const invoiceAmounts = useMemo(() => invoices.map((invoice) => invoice.amount), [invoices])
  const invoiceStats = useMemo(() => computeStats(invoiceAmounts), [invoiceAmounts])

  const appointmentTimeline = useMemo(() => {
    const map = new Map<string, { iso: string; label: string; appointments: number; patientSlots: number }>()
    appointments.forEach((appointment) => {
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
  }, [appointments])

  const typeBreakdown = useMemo(() => {
    const counts: Record<PracticeAppointment["type"], { total: number; patientSlots: number }> = {
      beratung: { total: 0, patientSlots: 0 },
      kontrolle: { total: 0, patientSlots: 0 },
      team: { total: 0, patientSlots: 0 },
      webinar: { total: 0, patientSlots: 0 },
    }
    appointments.forEach((appointment) => {
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
  }, [appointments])

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  const appointmentsThisWeek = appointments.filter((appointment) => {
    const appointmentDate = new Date(appointment.date)
    return appointmentDate >= weekStart && appointmentDate <= weekEnd
  })

  const slotUtilization = Math.min(100, Math.round((appointmentsThisWeek.length / 20) * 100))
  const recurringShare = appointments.length
    ? Math.round((appointments.filter((appointment) => appointment.recurring).length / appointments.length) * 100)
    : 0

  const totalRevenue = invoiceAmounts.reduce((acc, value) => acc + value, 0)
  const outstandingRevenue = invoices
    .filter((invoice) => invoice.status !== "bezahlt")
    .reduce((acc, invoice) => acc + invoice.amount, 0)
  const paymentRate = totalRevenue ? Math.round(((totalRevenue - outstandingRevenue) / totalRevenue) * 100) : 0
  const averageTicket = invoices.length ? totalRevenue / invoices.length : 0

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
    appointments.forEach((appointment) => {
      if (appointment.patientId) {
        set.add(appointment.patientId)
      }
    })
    return set.size
  }, [appointments])

  const overdueInvoices = invoices.filter((invoice) => {
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
      std: `${appointments.length ? Math.max(1, Math.round(uniquePatients * 0.05)) : 0}`,
    },
  ]

  const invoiceHealth = [
    { label: "Gesamtumsatz", value: formatCurrency(totalRevenue) },
    { label: "Offen", value: formatCurrency(outstandingRevenue) },
    { label: "Ø Ticket", value: formatCurrency(averageTicket) },
    { label: "Überfällig", value: `${overdueInvoices.length} Vorgänge` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Praxis-Statistiken"
        description="Alle KPIs zur Auslastung, Patientenzahlen und Abrechnung auf einen Blick"
        helpText="Ihre Praxis-Kennzahlen im Überblick. Analysieren Sie Auslastung, Patientenentwicklung und Umsatz, um Ihre Praxis datenbasiert zu steuern."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PRACTICE_KPIS.map((kpi) => {
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
                <p className="text-muted-foreground text-xs">{kpi.helper ?? "Live-Daten"}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

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
            {appointments.length === 0 ? (
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
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
    </div>
  )
}
