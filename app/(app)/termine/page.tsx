"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { de } from "date-fns/locale"
import {
  Bell,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Repeat2,
  UserRound,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePracticeAppointments } from "@/hooks/use-practice"
import { usePatients } from "@/hooks/use-patients"
import type { PracticeAppointment } from "@/lib/types"
import { cn } from "@/lib/utils"

const TYPE_META: Record<PracticeAppointment["type"], { label: string; badge: "default" | "secondary" | "outline" }> = {
  beratung: { label: "Beratung", badge: "default" },
  kontrolle: { label: "Follow-up", badge: "secondary" },
  team: { label: "Team", badge: "outline" },
  webinar: { label: "Workshop", badge: "outline" },
}

const REMINDER_OPTIONS = ["keine", "15 Minuten", "2 Stunden", "24 Stunden", "48 Stunden"]
const RECURRING_OPTIONS = ["keine", "wöchentlich", "14-tägig", "monatlich"]

type ViewMode = "day" | "week" | "month"

interface AppointmentFormState {
  title: string
  date: string
  startTime: string
  endTime: string
  patientId: string
  location: string
  type: PracticeAppointment["type"]
  recurring: string
  reminder: string
}

function buildInitialState(): AppointmentFormState {
  const now = new Date()
  const hour = Math.min(18, Math.max(8, now.getHours()))
  const pad = (value: number) => value.toString().padStart(2, "0")
  return {
    title: "",
    date: format(now, "yyyy-MM-dd"),
    startTime: `${pad(hour)}:00`,
    endTime: `${pad(hour + 1)}:00`,
    patientId: "",
    location: "Raum 1",
    type: "beratung",
    recurring: "keine",
    reminder: "24 Stunden",
  }
}

function toDateKey(date: Date) {
  return formatISO(date, { representation: "date" })
}

function formatRangeLabel(view: ViewMode, date: Date) {
  if (view === "day") {
    return format(date, "EEEE, dd.MM.yyyy", { locale: de })
  }
  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    const end = endOfWeek(date, { weekStartsOn: 1 })
    return `${format(start, "dd.MM.", { locale: de })} – ${format(end, "dd.MM.yyyy", { locale: de })}`
  }
  return format(date, "LLLL yyyy", { locale: de })
}

function formatTimeRange(appointment: PracticeAppointment) {
  return `${appointment.startTime}–${appointment.endTime}`
}

export default function TerminePage() {
  const {
    appointments,
    upcomingAppointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  } = usePracticeAppointments()
  const { patients } = usePatients()

  const [view, setView] = useState<ViewMode>("day")
  const [activeDate, setActiveDate] = useState<Date>(new Date())
  const [patientFilter, setPatientFilter] = useState<string>("alle")
  const [typeFilter, setTypeFilter] = useState<string>("alle")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<PracticeAppointment | null>(null)
  const [formState, setFormState] = useState<AppointmentFormState>(() => buildInitialState())

  const patientLookup = useMemo(() => {
    const map = new Map<string, string>()
    patients.forEach((patient) => {
      map.set(patient.id, `${patient.firstName} ${patient.lastName}`)
    })
    return map
  }, [patients])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const matchesPatient =
        patientFilter === "alle" || appointment.patientId === patientFilter
      const matchesType = typeFilter === "alle" || appointment.type === typeFilter
      return matchesPatient && matchesType
    })
  }, [appointments, patientFilter, typeFilter])

  const selectedDateKey = toDateKey(activeDate)

  const dayAppointments = useMemo(() => {
    return filteredAppointments.filter((appointment) => appointment.date === selectedDateKey)
  }, [filteredAppointments, selectedDateKey])

  const weekStart = useMemo(() => startOfWeek(activeDate, { weekStartsOn: 1 }), [activeDate])
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
    [weekStart],
  )

  const weekMap = useMemo(() => {
    const map = new Map<string, PracticeAppointment[]>()
    weekDays.forEach((day) => {
      map.set(toDateKey(day), [])
    })
    filteredAppointments.forEach((appointment) => {
      if (map.has(appointment.date)) {
        map.get(appointment.date)!.push(appointment)
      }
    })
    return map
  }, [filteredAppointments, weekDays])

  const monthGrid = useMemo(() => {
    const monthStart = startOfMonth(activeDate)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(activeDate), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7))
    }
    return rows
  }, [activeDate])

  const recurringAppointments = filteredAppointments.filter(
    (appointment) => appointment.recurring,
  )
  const reminderAppointments = filteredAppointments.filter(
    (appointment) => appointment.reminder,
  )

  function openCreateDialog() {
    setEditingAppointment(null)
    setFormState(buildInitialState())
    setDialogOpen(true)
  }

  function openEditDialog(appointment: PracticeAppointment) {
    setEditingAppointment(appointment)
    setFormState({
      title: appointment.title,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      patientId: appointment.patientId ?? "",
      location: appointment.location ?? "",
      type: appointment.type,
      recurring: appointment.recurring ?? "keine",
      reminder: appointment.reminder ?? "keine",
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingAppointment(null)
    setFormState(buildInitialState())
  }

  function handlePrev() {
    setActiveDate((prev) => {
      if (view === "day") return addDays(prev, -1)
      if (view === "week") return addWeeks(prev, -1)
      return addMonths(prev, -1)
    })
  }

  function handleNext() {
    setActiveDate((prev) => {
      if (view === "day") return addDays(prev, 1)
      if (view === "week") return addWeeks(prev, 1)
      return addMonths(prev, 1)
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: Omit<PracticeAppointment, "id"> = {
      title: formState.title,
      date: formState.date,
      startTime: formState.startTime,
      endTime: formState.endTime,
      location: formState.location || undefined,
      patientId: formState.patientId || undefined,
      type: formState.type,
      recurring: formState.recurring === "keine" ? undefined : formState.recurring,
      reminder: formState.reminder === "keine" ? undefined : formState.reminder,
    }

    if (editingAppointment) {
      updateAppointment(editingAppointment.id, payload)
      toast.success("Termin aktualisiert")
    } else {
      addAppointment(payload)
      toast.success("Termin angelegt")
    }
    closeDialog()
  }

  function handleDelete() {
    if (!editingAppointment) return
    deleteAppointment(editingAppointment.id)
    toast.success("Termin gelöscht")
    closeDialog()
  }

  function handleReminder(appointment: PracticeAppointment) {
    const name = appointment.patientId
      ? patientLookup.get(appointment.patientId) ?? "Patient"
      : "Team"
    toast.info(`Erinnerung für ${name} verschickt`)
  }

  function createNextOccurrence(appointment: PracticeAppointment) {
    if (!appointment.recurring) return
    const baseDate = new Date(appointment.date)
    let nextDate = addWeeks(baseDate, 1)
    if (appointment.recurring.includes("14")) {
      nextDate = addWeeks(baseDate, 2)
    } else if (appointment.recurring.includes("monat")) {
      nextDate = addMonths(baseDate, 1)
    }
    addAppointment({
      title: appointment.title,
      date: format(nextDate, "yyyy-MM-dd"),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      patientId: appointment.patientId,
      location: appointment.location,
      type: appointment.type,
      recurring: appointment.recurring,
      reminder: appointment.reminder,
    })
    toast.success("Nächster Termin der Serie geplant")
  }

  const rangeLabel = formatRangeLabel(view, activeDate)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Termine"
        description="Kalender mit Patientenbezug, Wiederholungen und Erinnerungen"
      >
        <Button onClick={openCreateDialog}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Neuer Termin
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card className="lg:col-span-1 lg:col-start-1">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Kalender</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Zwischen Tag-, Wochen- und Monatsansicht wechseln
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrev}
                  aria-label="Vorheriger Zeitraum"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveDate(new Date())}
                  aria-label="Heute"
                >
                  <Clock3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  aria-label="Nächster Zeitraum"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{rangeLabel}</span>
              <Select value={patientFilter} onValueChange={setPatientFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Patientenfilter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Patienten</SelectItem>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Art" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Arten</SelectItem>
                  {Object.entries(TYPE_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="day">Tag</TabsTrigger>
                <TabsTrigger value="week">Woche</TabsTrigger>
                <TabsTrigger value="month">Monat</TabsTrigger>
              </TabsList>
              <div className="pt-4">
                <TabsContent value="day" className="space-y-3">
                  {dayAppointments.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      Keine Termine für diesen Tag.
                    </p>
                  )}
                  {dayAppointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{appointment.title}</p>
                          <p className="text-muted-foreground text-xs flex items-center gap-2">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatTimeRange(appointment)}
                            {appointment.location && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {appointment.location}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={TYPE_META[appointment.type].badge}>
                            {TYPE_META[appointment.type].label}
                          </Badge>
                          {appointment.patientId && (
                            <Badge variant="secondary" className="bg-muted text-foreground">
                              <UserRound className="mr-1 h-3 w-3" />
                              {patientLookup.get(appointment.patientId) ?? "Unbekannt"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {appointment.recurring && (
                          <Badge variant="outline" className="text-xs">
                            <Repeat2 className="mr-1 h-3 w-3" /> {appointment.recurring}
                          </Badge>
                        )}
                        {appointment.reminder && (
                          <Badge variant="outline" className="text-xs">
                            <Bell className="mr-1 h-3 w-3" /> {appointment.reminder}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(appointment)}>
                          Bearbeiten
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleReminder(appointment)}>
                          Erinnerung senden
                        </Button>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="week" className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-7">
                    {weekDays.map((day) => {
                      const key = toDateKey(day)
                      const dailyAppointments = weekMap.get(key) ?? []
                      return (
                        <div
                          key={key}
                          className={cn(
                            "rounded-lg border p-2",
                            isSameDay(day, activeDate) && "border-primary",
                          )}
                          onClick={() => setActiveDate(day)}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-semibold">
                              {format(day, "EEE", { locale: de })}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {format(day, "dd.MM.")}
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {dailyAppointments.length === 0 && (
                              <p className="text-muted-foreground text-xs">frei</p>
                            )}
                            {dailyAppointments.map((appointment) => (
                              <div key={appointment.id} className="rounded-md bg-muted/40 p-2 text-xs">
                                <div className="font-medium">
                                  {formatTimeRange(appointment)}
                                </div>
                                <p className="truncate">
                                  {appointment.patientId
                                    ? patientLookup.get(appointment.patientId)
                                    : appointment.title}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="month" className="space-y-2">
                  <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted">
                    {monthGrid.flat().map((day) => {
                      const key = toDateKey(day)
                      const dailyAppointments = filteredAppointments.filter(
                        (appointment) => appointment.date === key,
                      )
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActiveDate(day)
                            setView("day")
                          }}
                          className={cn(
                            "flex min-h-[90px] flex-col border bg-background p-2 text-left",
                            isSameMonth(day, activeDate)
                              ? ""
                              : "text-muted-foreground/60",
                            isSameDay(day, activeDate) && "border-primary",
                          )}
                        >
                          <span className="text-xs font-semibold">
                            {format(day, "d")}
                          </span>
                          <div className="mt-2 space-y-1">
                            {dailyAppointments.slice(0, 3).map((appointment) => (
                              <Badge key={appointment.id} variant="secondary" className="text-[10px]">
                                {formatTimeRange(appointment)}
                              </Badge>
                            ))}
                            {dailyAppointments.length > 3 && (
                              <p className="text-muted-foreground text-[10px]">
                                +{dailyAppointments.length - 3} weitere
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anstehende Termine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAppointments.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Es stehen keine neuen Termine an.
                </p>
              )}
              {upcomingAppointments.slice(0, 5).map((appointment) => (
                <div key={appointment.id} className="flex flex-col gap-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{appointment.title}</span>
                    <span>
                      {format(
                        new Date(`${appointment.date}T${appointment.startTime}`),
                        "dd.MM. HH:mm",
                      )}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs flex items-center gap-2">
                    {appointment.patientId ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {patientLookup.get(appointment.patientId) ?? "Unbekannt"}
                      </span>
                    ) : (
                      <span>Praxisintern</span>
                    )}
                    {appointment.reminder && (
                      <span className="inline-flex items-center gap-1">
                        <Bell className="h-3 w-3" /> {appointment.reminder}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(appointment)}>
                      Details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleReminder(appointment)}>
                      Erinnerung
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {recurringAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Serientermine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recurringAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{appointment.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {appointment.recurring}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatTimeRange(appointment)} · nächster Slot: {format(
                        new Date(`${appointment.date}T${appointment.startTime}`),
                        "dd.MM.",
                      )}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(appointment)}>
                        Bearbeiten
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => createNextOccurrence(appointment)}>
                        Nächsten Termin erstellen
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {reminderAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Aktive Erinnerungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminderAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{appointment.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Reminder: {appointment.reminder}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleReminder(appointment)}>
                      Erinnerung senden
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? "Termin bearbeiten" : "Neuen Termin planen"}
            </DialogTitle>
            <DialogDescription>
              Patientenzuweisung, Wiederholungsintervall und Erinnerung festlegen.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                required
                placeholder="z. B. Erstberatung"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  type="date"
                  value={formState.date}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, date: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select
                  value={formState.patientId || "keiner"}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, patientId: value === "keiner" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Patient auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keiner">Ohne Patient</SelectItem>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Startzeit</Label>
                <Input
                  type="time"
                  value={formState.startTime}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Endzeit</Label>
                <Input
                  type="time"
                  value={formState.endTime}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Art</Label>
                <Select
                  value={formState.type}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, type: value as PracticeAppointment["type"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Ort</Label>
                <Input
                  id="location"
                  value={formState.location}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Raum / Video / Telefon"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Serienintervall</Label>
                <Select
                  value={formState.recurring}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, recurring: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "keine" ? "Keine Serie" : option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Erinnerung</Label>
                <Select
                  value={formState.reminder}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, reminder: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "keine" ? "Keine Erinnerung" : option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
              {editingAppointment && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Termin löschen
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Abbrechen
                </Button>
                <Button type="submit">Speichern</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
