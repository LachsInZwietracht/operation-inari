"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  addYears,
  differenceInCalendarDays,
  differenceInYears,
  format,
  isBefore,
  parseISO,
  setYear,
} from "date-fns"
import { Cable, CreditCard, Gift, Inbox, Plus, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { PatientCard } from "@/components/patient-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"

import { usePatients } from "@/hooks/use-patients"
import { useEgkScanner } from "@/hooks/use-egk-scanner"
import { useEgkInbox } from "@/hooks/use-egk-inbox"
import { useMailMergeHistory } from "@/hooks/use-mail-merge"
import { useBirthdayReminders } from "@/hooks/use-birthday-reminders"
import { COUNSELING_SESSIONS, MAIL_MERGE_PLACEHOLDERS, MAIL_MERGE_TEMPLATES } from "@/lib/mock-data"
import { INDICATION_OPTIONS } from "@/lib/constants"
import type { EgkCardData, Patient } from "@/lib/types"

const UNASSIGNED_EGK_VALUE = "__unassigned__"

export default function PatientenPage() {
  const { patients } = usePatients()
  const [search, setSearch] = useState("")
  const [indicationFilter, setIndicationFilter] = useState<string>("alle")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(MAIL_MERGE_TEMPLATES[0]?.id ?? "")
  const [mailSubject, setMailSubject] = useState<string>(MAIL_MERGE_TEMPLATES[0]?.subject ?? "")
  const [mailBody, setMailBody] = useState<string>(MAIL_MERGE_TEMPLATES[0]?.body ?? "")
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [lastBatch, setLastBatch] = useState<{ timestamp: string; count: number; templateName: string } | null>(null)
  const [birthdayWindow, setBirthdayWindow] = useState<string>("30")
  const bodyTextAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const {
    status: egkStatus,
    isSupported: egkSupported,
    connect: connectEgk,
    scanCard: scanEgkCard,
    fetchFromCompanion,
    simulateCard,
    isReading: isEgkReading,
    isConnecting: isEgkConnecting,
    lastCard: lastEgkCard,
    lastError: egkError,
  } = useEgkScanner()
  const {
    pendingEvents: egkEvents,
    addEvent: addEgkEvent,
    linkToPatient: assignEgkEvent,
    archiveEvent: archiveEgkEvent,
  } = useEgkInbox()
  const { batches, logBatch, markExported } = useMailMergeHistory()
  const { reminders, markSent } = useBirthdayReminders(patients)

  const lastSessionMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const session of COUNSELING_SESSIONS) {
      const existing = map.get(session.patientId)
      if (!existing || session.date > existing) {
        map.set(session.patientId, session.date)
      }
    }
    return map
  }, [])

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        !search ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        `${p.lastName} ${p.firstName}`.toLowerCase().includes(search.toLowerCase())
      const matchesIndication =
        indicationFilter === "alle" || p.indication === indicationFilter
      return matchesSearch && matchesIndication
    })
  }, [patients, search, indicationFilter])

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const reminderMap = useMemo(() => new Map(reminders.map((reminder) => [reminder.patientId, reminder])), [reminders])
  const selectedTemplate = useMemo(
    () => MAIL_MERGE_TEMPLATES.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId],
  )

  useEffect(() => {
    if (selectedTemplate) {
      setMailSubject(selectedTemplate.subject)
      setMailBody(selectedTemplate.body)
    }
  }, [selectedTemplate])

  useEffect(() => {
    if (filtered.length > 0 && selectedRecipients.length === 0) {
      setSelectedRecipients(filtered.slice(0, Math.min(filtered.length, 5)).map((p) => p.id))
    }
  }, [filtered, selectedRecipients.length])

  const renderTemplate = (template: string, patientId?: string) => {
    if (!template) return ""
    const patient = patientId ? patientMap.get(patientId) : undefined
    if (!patient) return template

    const replacements: Record<string, string> = {
      "patient.firstName": patient.firstName,
      "patient.lastName": patient.lastName,
      "patient.fullName": `${patient.firstName} ${patient.lastName}`,
      "patient.dateOfBirth": format(parseISO(patient.dateOfBirth), "dd.MM.yyyy"),
      "appointment.date": format(new Date(), "dd.MM.yyyy"),
      "appointment.time": "10:00",
      "protocol.energy": patient.indication?.includes("Diabetes") ? "1850" : "2000",
      "protocol.protein": "85",
      "protocol.priority": patient.indication ?? "Ernährungscoaching",
      "practice.name": "Operation Prodi Ernährungszentrum",
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, token) => {
      const key = token.trim()
      return replacements[key] ?? match
    })
  }

  const downloadMailMergeBundle = useCallback(
    (documents: { patient: Patient; subject: string; body: string }[], fileName: string) => {
      const content = documents
        .map(
          (doc) =>
            `# ${doc.patient.lastName}, ${doc.patient.firstName}\nBetreff: ${doc.subject}\n\n${doc.body}`,
        )
        .join("\n\n---\n\n")
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${fileName}.txt`
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    [],
  )

  const matchPatientByInsurance = useCallback(
    (card: EgkCardData) =>
      patients.find(
        (patient) =>
          patient.insuranceNumber === card.insuranceNumber ||
          `${patient.lastName}${patient.firstName}`.toLowerCase() ===
            `${card.lastName}${card.firstName}`.toLowerCase(),
      ),
    [patients],
  )

  const toggleRecipient = (patientId: string, checked: boolean) => {
    setSelectedRecipients((prev) =>
      checked ? Array.from(new Set([...prev, patientId])) : prev.filter((id) => id !== patientId),
    )
  }

  const handleBirthdayPrepare = (patientId: string) => {
    setSelectedTemplateId("birthday_greeting")
    setSelectedRecipients([patientId])
    toast.success("Geburtstagsgruß vorbereitet")
  }

  const handleBirthdayComplete = (patientId: string, date: string) => {
    markSent(patientId, date)
    toast.success("Erinnerung als versendet markiert")
  }

  const handleEgkIntake = async (mode: "serial" | "companion" | "demo") => {
    try {
      let card: EgkCardData
      if (mode === "serial") {
        card = await scanEgkCard()
      } else if (mode === "companion") {
        card = await fetchFromCompanion()
      } else {
        card = simulateCard()
      }
      const matchedPatient = matchPatientByInsurance(card)
      const status = matchedPatient ? "matched" : "pending"
      const event = addEgkEvent({ card, patientId: matchedPatient?.id, source: mode === "demo" ? "simulation" : mode === "serial" ? "webserial" : "companion", status })
      if (matchedPatient) {
        toast.success(`Karte ${matchedPatient.lastName} zugeordnet`)
      } else {
        toast.message("Neue eGK erfasst", {
          description: "Noch keinem Patienten zugewiesen",
        })
      }
      return event
    } catch (error) {
      toast.error((error as Error)?.message ?? "Karte konnte nicht eingelesen werden")
      return null
    }
  }

  const handleInsertPlaceholder = (token: string) => {
    const textarea = bodyTextAreaRef.current
    const start = textarea?.selectionStart ?? mailBody.length
    const end = textarea?.selectionEnd ?? mailBody.length
    setMailBody((prev) => `${prev.slice(0, start)}${token}${prev.slice(end)}`)
    requestAnimationFrame(() => {
      if (textarea) {
        const cursor = start + token.length
        textarea.focus()
        textarea.selectionStart = cursor
        textarea.selectionEnd = cursor
      }
    })
  }

  const egkStatusLabel: Record<string, string> = {
    disconnected: "Nicht verbunden",
    connecting: "Verbindung...",
    ready: "Bereit",
    reading: "Lese Daten",
    error: "Fehler",
  }

  const handleAssignEgkEvent = (eventId: string, patientId: string) => {
    const patient = patientMap.get(patientId)
    if (!patient) return
    assignEgkEvent(eventId, patient)
    toast.success(`eGK ${patient.lastName} zugeordnet`)
  }

  const handleGenerateMerge = () => {
    if (selectedRecipients.length === 0) {
      toast.error("Bitte wählen Sie mindestens einen Patienten aus")
      return
    }
    const documents = selectedRecipients
      .map((id) => patientMap.get(id))
      .filter(Boolean)
      .map((patient) => ({
        patient: patient as Patient,
        subject: renderTemplate(mailSubject, patient!.id),
        body: renderTemplate(mailBody, patient!.id),
      }))

    if (documents.length === 0) {
      toast.error("Keine gültigen Empfänger gefunden")
      return
    }

    const batch = logBatch({
      templateId: selectedTemplate?.id,
      templateName: selectedTemplate?.name ?? "Benutzerdefiniert",
      documents: documents.map((doc) => ({
        patientId: doc.patient.id,
        subject: doc.subject,
        body: doc.body,
      })),
    })

    downloadMailMergeBundle(documents, batch.downloadName)
    markExported(batch.id)
    setLastBatch({
      timestamp: batch.createdAt,
      count: batch.recipientCount,
      templateName: batch.templateName,
    })
    toast.success(`Serienbrief für ${documents.length} Patient:innen erzeugt`)
  }

  const selectAllRecipients = () => setSelectedRecipients(filtered.map((patient) => patient.id))
  const clearRecipients = () => setSelectedRecipients([])

  const previewPatientId = selectedRecipients[0] ?? filtered[0]?.id
  const previewSubject = previewPatientId ? renderTemplate(mailSubject, previewPatientId) : ""
  const previewBody = previewPatientId ? renderTemplate(mailBody, previewPatientId) : ""

  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    const windowDays = Number(birthdayWindow)
    return patients
      .map((patient) => {
        const birthDate = parseISO(patient.dateOfBirth)
        let nextBirthday = setYear(birthDate, today.getFullYear())
        if (isBefore(nextBirthday, today)) {
          nextBirthday = addYears(nextBirthday, 1)
        }
        const daysUntil = differenceInCalendarDays(nextBirthday, today)
        const isoDate = format(nextBirthday, "yyyy-MM-dd")
        const reminder = reminderMap.get(patient.id)
        const reminderStatus = reminder && reminder.status === "sent" && reminder.dueDate === isoDate ? "sent" : "open"
        return { patient, nextBirthday, daysUntil, reminderStatus, isoDate }
      })
      .filter((entry) => entry.daysUntil >= 0 && entry.daysUntil <= windowDays)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [patients, birthdayWindow, reminderMap])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patienten"
        description="Patientenverwaltung und -übersicht"
        helpText="Ihre zentrale Patientenübersicht. Legen Sie neue Patienten an, verwalten Sie Stammdaten und greifen Sie auf Beratungshistorien und Ernährungsprotokolle zu."
      >
        <Button asChild>
          <Link href="/patienten/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Patient
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Patient suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="sm:w-[220px]">
          <Label htmlFor="indication-filter" className="sr-only">
            Indikationen
          </Label>
          <Select value={indicationFilter} onValueChange={setIndicationFilter}>
            <SelectTrigger id="indication-filter" className="w-full">
              <SelectValue placeholder="Alle Indikationen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Indikationen</SelectItem>
              {INDICATION_OPTIONS.map((ind) => (
                <SelectItem key={ind} value={ind}>
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> eGK-Intake
            </CardTitle>
            <CardDescription>Direktlesung über Web Serial oder Companion-App.</CardDescription>
          </div>
          <Badge variant={egkStatus === "ready" ? "secondary" : "outline"}>{egkStatusLabel[egkStatus]}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={egkStatus === "ready" || isEgkConnecting}
              onClick={() => void connectEgk()}
            >
              {isEgkConnecting ? "Verbinde..." : "Leser verbinden"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={egkStatus !== "ready" || isEgkReading}
              onClick={() => void handleEgkIntake("serial")}
            >
              <Cable className="mr-2 h-4 w-4" />
              {isEgkReading ? "Lese..." : "Karte einlesen"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleEgkIntake("companion")}>
              <Inbox className="mr-2 h-4 w-4" /> Companion Sync
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleEgkIntake("demo")}>
              Demo-Karte
            </Button>
          </div>
          {!egkSupported && (
            <p className="text-sm text-muted-foreground">
              Browser unterstützt kein Web Serial – Companion-App nutzen.
            </p>
          )}
          {egkError && <p className="text-sm text-destructive">{egkError}</p>}
          {lastEgkCard && (
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-medium">
                Zuletzt gelesen: {lastEgkCard.firstName} {lastEgkCard.lastName}
              </p>
              <p className="text-muted-foreground">
                {lastEgkCard.street}, {lastEgkCard.zip} {lastEgkCard.city} · {lastEgkCard.insuranceProvider}
              </p>
            </div>
          )}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Eingehende Karten</p>
            {egkEvents.length > 0 ? (
              <div className="divide-y rounded-md border">
                {egkEvents.slice(0, 4).map((event) => {
                  const matchedPatient = event.patientId ? patientMap.get(event.patientId) : null
                  return (
                    <div key={event.id} className="space-y-2 p-3 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {event.card.lastName}, {event.card.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.card.insuranceProvider} · {event.card.insuranceNumber}
                          </p>
                        </div>
                        <Badge variant={event.status === "matched" ? "secondary" : "outline"}>
                          {event.status === "matched" ? "Zugeordnet" : "Offen"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={matchedPatient?.id ?? UNASSIGNED_EGK_VALUE}
                          onValueChange={(value) => {
                            if (value === UNASSIGNED_EGK_VALUE) return
                            handleAssignEgkEvent(event.id, value)
                          }}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Patient verknüpfen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_EGK_VALUE}>Unzugeordnet</SelectItem>
                            {patients.map((patient) => (
                              <SelectItem key={`egk_select_${patient.id}`} value={patient.id}>
                                {patient.lastName}, {patient.firstName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => archiveEgkEvent(event.id)}
                        >
                          Archivieren
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine eingelesenen Karten.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Serienbriefe & Mailings</CardTitle>
              <CardDescription>
                Personalisierte Schreiben mit Platzhaltern und PDF-Generator vorbereiten.
              </CardDescription>
            </div>
            {lastBatch && (
              <Badge variant="secondary">
                Zuletzt erstellt: {format(parseISO(lastBatch.timestamp), "dd.MM.yyyy HH:mm")}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label>Vorlage</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vorlage auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAIL_MERGE_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Betreff</Label>
                  <Input value={mailSubject} onChange={(event) => setMailSubject(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Textbaustein</Label>
                  <Textarea
                    ref={bodyTextAreaRef}
                    rows={8}
                    value={mailBody}
                    onChange={(event) => setMailBody(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Platzhalter</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MAIL_MERGE_PLACEHOLDERS.map((placeholder) => (
                      <Button
                        key={placeholder.token}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleInsertPlaceholder(placeholder.token)}
                      >
                        {placeholder.token}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Empfängerauswahl</Label>
                    <p className="text-xs text-muted-foreground">
                      {selectedRecipients.length} von {filtered.length} Patienten selektiert
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={selectAllRecipients}>
                      Alle
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={clearRecipients}>
                      Leeren
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="divide-y">
                    {filtered.length > 0 ? (
                      filtered.map((patient) => (
                        <label
                          key={`recipient_${patient.id}`}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={selectedRecipients.includes(patient.id)}
                            onCheckedChange={(checked) =>
                              toggleRecipient(patient.id, checked === true)
                            }
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {patient.lastName}, {patient.firstName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {patient.indication ?? "Ohne Indikation"}
                            </span>
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Kein Patient entspricht dem Filter.
                      </p>
                    )}
                  </div>
                </ScrollArea>
                <Button type="button" onClick={handleGenerateMerge} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" /> Dokumente erzeugen
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vorschau</p>
              {previewSubject ? (
                <div>
                  <p className="font-semibold">{previewSubject}</p>
                  <pre className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {previewBody}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Bitte Empfänger auswählen.</p>
              )}
            </div>

            {batches.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Serienbrief-Historie</p>
                <div className="mt-2 space-y-2 text-sm">
                  {batches.slice(0, 3).map((batch) => (
                    <div key={batch.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{batch.templateName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(batch.createdAt), "dd.MM.yyyy HH:mm")} · {batch.recipientCount} Empfänger
                        </p>
                      </div>
                      <Badge variant={batch.status === "exported" ? "secondary" : "outline"}>
                        {batch.status === "exported" ? "Exportiert" : "Offen"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Geburtstagsliste</CardTitle>
              <CardDescription>
                Automatisch sortierte Geburtstage der nächsten Tage.
              </CardDescription>
            </div>
            <Select value={birthdayWindow} onValueChange={setBirthdayWindow}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14">14 Tage</SelectItem>
                <SelectItem value="30">30 Tage</SelectItem>
                <SelectItem value="60">60 Tage</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {upcomingBirthdays.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Alter</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingBirthdays.slice(0, 6).map(({ patient, nextBirthday, reminderStatus, isoDate }) => (
                    <TableRow key={`birthday_${patient.id}`}>
                      <TableCell className="font-medium">
                        {patient.lastName}, {patient.firstName}
                      </TableCell>
                      <TableCell>{format(nextBirthday, "dd.MM.")}</TableCell>
                      <TableCell className="text-right">
                        {differenceInYears(nextBirthday, parseISO(patient.dateOfBirth))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => handleBirthdayPrepare(patient.id)}
                            aria-label="Geburtstagsgruß vorbereiten"
                          >
                            <Gift className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={reminderStatus === "sent" ? "secondary" : "ghost"}
                            disabled={reminderStatus === "sent"}
                            onClick={() => handleBirthdayComplete(patient.id, isoDate)}
                          >
                            {reminderStatus === "sent" ? "Erledigt" : "Abhaken"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Geburtstage im gewählten Zeitraum.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              lastSessionDate={lastSessionMap.get(patient.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Keine Patienten gefunden.
        </div>
      )}
    </div>
  )
}
