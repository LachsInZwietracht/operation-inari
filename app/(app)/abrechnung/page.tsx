"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { FilePlus2, Mail, CheckCircle2, AlertTriangle } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Legend } from "recharts"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { usePracticeInvoices, usePracticeAppointments } from "@/hooks/use-practice"
import { usePatients } from "@/hooks/use-patients"
import { formatCurrency, formatDate } from "@/lib/format"
import type { InvoiceEntry } from "@/lib/types"

const STATUS_META: Record<InvoiceEntry["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  offen: { label: "Offen", variant: "secondary" },
  bezahlt: { label: "Bezahlt", variant: "default" },
  mahnung: { label: "Mahnung", variant: "destructive" },
}

const NO_APPOINTMENT_VALUE = "none"

interface InvoiceFormState {
  patientId: string
  appointmentId: string
  service: string
  amount: string
  dueDate: string
  insurance: string
  status: InvoiceEntry["status"]
  notes: string
}

const STATUS_OPTIONS: InvoiceEntry["status"][] = ["offen", "mahnung", "bezahlt"]

function buildInvoiceFormState(): InvoiceFormState {
  return {
    patientId: "",
    appointmentId: "",
    service: "Individuelle Ernährungsberatung",
    amount: "150",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    insurance: "",
    status: "offen",
    notes: "",
  }
}

export default function AbrechnungPage() {
  const { invoices, addInvoice, markInvoiceStatus } = usePracticeInvoices()
  const { appointments } = usePracticeAppointments()
  const { patients } = usePatients()

  const [formState, setFormState] = useState<InvoiceFormState>(() => buildInvoiceFormState())
  const generatorRef = useRef<HTMLDivElement>(null)

  const patientLookup = useMemo(() => {
    const map = new Map<string, { name: string; insurance?: string }>()
    patients.forEach((patient) => {
      map.set(patient.id, {
        name: `${patient.firstName} ${patient.lastName}`,
        insurance: patient.insuranceProvider,
      })
    })
    return map
  }, [patients])

  const totals = useMemo(() => {
    const now = new Date()
    let openValue = 0
    let openCount = 0
    let overdueValue = 0
    let overdueCount = 0
    let paidValue = 0
    let paidCount = 0

    invoices.forEach((invoice) => {
      if (invoice.status === "bezahlt") {
        paidValue += invoice.amount
        paidCount += 1
        return
      }
      openValue += invoice.amount
      openCount += 1
      if (new Date(invoice.dueDate) < now || invoice.status === "mahnung") {
        overdueValue += invoice.amount
        overdueCount += 1
      }
    })

    return {
      openValue,
      openCount,
      overdueValue,
      overdueCount,
      paidValue,
      paidCount,
    }
  }, [invoices])

  const revenueTrend = useMemo(() => {
    const map = new Map<string, { revenue: number; outstanding: number }>()
    invoices.forEach((invoice) => {
      const label = format(new Date(invoice.dueDate), "MMM", { locale: de })
      if (!map.has(label)) {
        map.set(label, { revenue: 0, outstanding: 0 })
      }
      const bucket = map.get(label)!
      if (invoice.status === "bezahlt") {
        bucket.revenue += invoice.amount
      } else {
        bucket.outstanding += invoice.amount
      }
    })
    return Array.from(map.entries()).map(([month, values]) => ({ month, ...values }))
  }, [invoices])

  const insuranceStats = useMemo(() => {
    const stats = new Map<string, { total: number; outstanding: number; cases: number }>()
    invoices.forEach((invoice) => {
      const key = invoice.insurance || "Privat"
      if (!stats.has(key)) {
        stats.set(key, { total: 0, outstanding: 0, cases: 0 })
      }
      const bucket = stats.get(key)!
      bucket.total += invoice.amount
      if (invoice.status !== "bezahlt") {
        bucket.outstanding += invoice.amount
      }
      bucket.cases += 1
    })
    return Array.from(stats.entries()).map(([insurance, values]) => ({ insurance, ...values }))
  }, [invoices])

  const paymentAging = useMemo(() => {
    const now = Date.now()
    return invoices
      .filter((invoice) => invoice.status !== "bezahlt")
      .map((invoice) => {
        const due = new Date(invoice.dueDate).getTime()
        const deltaDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
        return {
          ...invoice,
          deltaDays,
        }
      })
      .sort((a, b) => a.deltaDays - b.deltaDays)
  }, [invoices])

  function handleReminder(invoice: InvoiceEntry) {
    const patientName = patientLookup.get(invoice.patientId)?.name ?? "Patient"
    toast.info(`Zahlungserinnerung an ${patientName} gesendet`)
  }

  function handleGenerateInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(formState.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Bitte gültigen Betrag angeben")
      return
    }

    addInvoice({
      patientId: formState.patientId || "patient_custom",
      service: formState.service,
      amount,
      dueDate: formState.dueDate,
      insurance: formState.insurance || undefined,
      status: formState.status,
    })

    toast.success("Rechnung erstellt")
    setFormState(buildInvoiceFormState())
  }

  function handleAppointmentSelect(appointmentId: string) {
    if (appointmentId === NO_APPOINTMENT_VALUE) {
      setFormState((prev) => ({ ...prev, appointmentId: "" }))
      return
    }
    const appointment = appointments.find((entry) => entry.id === appointmentId)
    if (!appointment) return
    const insurance = appointment.patientId
      ? patientLookup.get(appointment.patientId)?.insurance
      : undefined
    setFormState((prev) => ({
      ...prev,
      appointmentId,
      patientId: appointment.patientId ?? prev.patientId,
      service: appointment.title,
      dueDate: appointment.date,
      insurance: insurance ?? prev.insurance,
    }))
  }

  function scrollToGenerator() {
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abrechnung"
        description="Rechnungen, Versicherungen und Zahlungseingänge verwalten"
        helpText="Erstellen und verwalten Sie Rechnungen für Ihre Beratungsleistungen. Behalten Sie den Überblick über offene Posten, Versicherungsabrechnungen und Zahlungseingänge."
      >
        <Button onClick={scrollToGenerator}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Neue Rechnung erfassen
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Offene Beträge</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.openValue)}</p>
            <p className="text-muted-foreground text-xs">
              {totals.openCount} offene Rechnungen
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Überfällig / Mahnung</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(totals.overdueValue)}
            </p>
            <p className="text-muted-foreground text-xs">
              {totals.overdueCount} Fälle
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bezahlt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.paidValue)}
            </p>
            <p className="text-muted-foreground text-xs">
              {totals.paidCount} Zahlungen diesen Zyklus
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Versicherer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{insuranceStats.length}</p>
            <p className="text-muted-foreground text-xs">aktive Kostenträger</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rechnungsjournal</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnung</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Leistung</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Versicherung</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const patient = patientLookup.get(invoice.patientId)
                    const dueDate = new Date(invoice.dueDate)
                    const isOverdue = invoice.status !== "bezahlt" && dueDate < new Date()
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.id}</TableCell>
                        <TableCell>
                          {patient?.name ?? "Unbekannt"}
                        </TableCell>
                        <TableCell>{invoice.service}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{formatDate(invoice.dueDate)}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="mt-1 w-fit text-[10px]">
                                Überfällig
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_META[invoice.status].variant}>
                            {STATUS_META[invoice.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>{invoice.insurance ?? "Privat"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {invoice.status !== "bezahlt" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  markInvoiceStatus(invoice.id, "bezahlt")
                                  toast.success("Rechnung als bezahlt markiert")
                                }}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Bezahlt
                              </Button>
                            )}
                            {invoice.status === "offen" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  markInvoiceStatus(invoice.id, "mahnung")
                                  toast.warning("Mahnung ausgelöst")
                                }}
                              >
                                <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Mahnung
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleReminder(invoice)}>
                              <Mail className="mr-1 h-3.5 w-3.5" /> Erinnerung
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Finanzreport</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueTrend.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Noch keine Daten verfügbar.
                </p>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend}>
                      <XAxis dataKey="month" interval={0} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Bezahlt" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outstanding" name="Offen" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card ref={generatorRef} id="invoice-generator">
            <CardHeader>
              <CardTitle>Rechnungsgenerator</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleGenerateInvoice}>
                <div className="space-y-2">
                  <Label>Patient</Label>
                  <Select
                    value={formState.patientId || "keiner"}
                    onValueChange={(value) => {
                      setFormState((prev) => ({
                        ...prev,
                        patientId: value === "keiner" ? "" : value,
                        insurance:
                          value && value !== "keiner"
                            ? patientLookup.get(value)?.insurance ?? prev.insurance
                            : prev.insurance,
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Patient wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keiner">Privatzahler / extern</SelectItem>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Zugehöriger Termin</Label>
                  <Select
                    value={formState.appointmentId || NO_APPOINTMENT_VALUE}
                    onValueChange={(value) => handleAppointmentSelect(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_APPOINTMENT_VALUE}>
                        Ohne Terminreferenz
                      </SelectItem>
                      {appointments
                        .filter((appointment) => appointment.patientId)
                        .map((appointment) => (
                          <SelectItem key={appointment.id} value={appointment.id}>
                            {appointment.title} · {formatDate(appointment.date)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Leistung</Label>
                  <Input
                    value={formState.service}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, service: event.target.value }))
                    }
                    placeholder="z. B. Erstberatung"
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Betrag (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={formState.amount}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, amount: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fällig am</Label>
                    <Input
                      type="date"
                      value={formState.dueDate}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, dueDate: event.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Versicherung</Label>
                  <Input
                    value={formState.insurance}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, insurance: event.target.value }))
                    }
                    placeholder="z. B. TK"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formState.status}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, status: value as InvoiceEntry["status"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_META[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notiz / Hinweis</Label>
                  <Textarea
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="z. B. Abrechnung nach §43 SGB"
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Rechnung speichern
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zahlungserinnerungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentAging.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Keine offenen Erinnerungen.
                </p>
              )}
              {paymentAging.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{entry.service}</p>
                      <p className="text-muted-foreground text-xs">
                        {patientLookup.get(entry.patientId)?.name ?? "Unbekannt"}
                      </p>
                    </div>
                    <Badge variant={entry.deltaDays < 0 ? "destructive" : "secondary"}>
                      {entry.deltaDays < 0
                        ? `${Math.abs(entry.deltaDays)} Tage überfällig`
                        : `noch ${entry.deltaDays} Tage`}
                    </Badge>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleReminder(entry)}>
                      <Mail className="mr-1 h-3.5 w-3.5" /> Erinnerung
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        markInvoiceStatus(entry.id, "bezahlt")
                        toast.success("Zahlung verbucht")
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Verbuchen
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versicherungsreport</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insuranceStats.map((entry) => (
                <div key={entry.insurance} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.insurance}</span>
                    <span>{formatCurrency(entry.total)}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {entry.cases} Fälle · {formatCurrency(entry.outstanding)} offen
                  </p>
                </div>
              ))}
              {insuranceStats.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Noch keine Versicherungsdaten.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
