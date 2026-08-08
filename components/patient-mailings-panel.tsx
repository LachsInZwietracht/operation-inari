"use client"

import { useMemo, useRef, useState } from "react"
import {
  addYears,
  differenceInCalendarDays,
  differenceInYears,
  format,
  isBefore,
  parseISO,
  setYear,
} from "date-fns"
import { ChevronDown, FileText, Gift, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useBirthdayReminders } from "@/hooks/use-birthday-reminders"
import { useMailMergeHistory } from "@/hooks/use-mail-merge"
import { usePatients } from "@/hooks/use-patients"
import { MAIL_MERGE_PLACEHOLDERS, MAIL_MERGE_TEMPLATES } from "@/lib/patient-mailings"
import type { Patient, PatientMailMergeExportRequest } from "@/lib/types"
import { downloadResponseFile } from "@/lib/utils"

/**
 * Serienbriefe, Mailings und Geburtstagsliste.
 *
 * This used to be the "Workflows" tab on /patienten, which was neither a
 * workflow nor a patient view — it is batch document generation, so it belongs
 * next to the other exports. The birthday list ships with it because "Gruß
 * vorbereiten" seeds this panel's recipient selection.
 */
export function PatientMailingsPanel() {
  const { patients } = usePatients()
  const { batches, logBatch, markExported } = useMailMergeHistory()
  const { reminders, markSent } = useBirthdayReminders(patients)

  const [search, setSearch] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    MAIL_MERGE_TEMPLATES[0]?.id ?? "",
  )
  const [mailSubject, setMailSubject] = useState<string>(MAIL_MERGE_TEMPLATES[0]?.subject ?? "")
  const [mailBody, setMailBody] = useState<string>(MAIL_MERGE_TEMPLATES[0]?.body ?? "")
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [lastBatch, setLastBatch] = useState<{
    timestamp: string
    count: number
    templateName: string
  } | null>(null)
  const [birthdayWindow, setBirthdayWindow] = useState<string>("30")
  const bodyTextAreaRef = useRef<HTMLTextAreaElement | null>(null)

  const filtered = useMemo(() => {
    if (!search) return patients
    const needle = search.toLowerCase()
    return patients.filter(
      (patient) =>
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(needle) ||
        `${patient.lastName} ${patient.firstName}`.toLowerCase().includes(needle),
    )
  }, [patients, search])

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const reminderMap = useMemo(
    () => new Map(reminders.map((reminder) => [reminder.patientId, reminder])),
    [reminders],
  )
  const selectedTemplate = useMemo(
    () => MAIL_MERGE_TEMPLATES.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId],
  )

  // Event-driven template switch instead of a setState-in-effect cascade:
  // changing the template resets subject/body in the same handler.
  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = MAIL_MERGE_TEMPLATES.find((item) => item.id === templateId)
    if (template) {
      setMailSubject(template.subject)
      setMailBody(template.body)
    }
  }

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
      "protocol.energy": patient.indications?.some((ind) => ind.includes("Diabetes"))
        ? "1850"
        : "2000",
      "protocol.protein": "85",
      "protocol.priority": patient.indications?.join(", ") || "Ernährungscoaching",
      "practice.name": "Inari Ernährungszentrum",
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, token) => {
      const key = token.trim()
      return replacements[key] ?? match
    })
  }

  const toggleRecipient = (patientId: string, checked: boolean) => {
    setSelectedRecipients((prev) =>
      checked ? Array.from(new Set([...prev, patientId])) : prev.filter((id) => id !== patientId),
    )
  }

  const handleBirthdayPrepare = (patientId: string) => {
    applyTemplate("birthday_greeting")
    setSelectedRecipients([patientId])
    toast.success("Geburtstagsgruß vorbereitet")
  }

  const handleBirthdayComplete = (patientId: string, date: string) => {
    markSent(patientId, date)
    toast.success("Erinnerung als versendet markiert")
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

  const handleGenerateMerge = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Bitte wählen Sie mindestens einen Patienten aus")
      return
    }
    const documents = selectedRecipients
      .map((id) => patientMap.get(id))
      .filter((patient): patient is Patient => Boolean(patient))
      .map((patient) => ({
        patient,
        subject: renderTemplate(mailSubject, patient.id),
        body: renderTemplate(mailBody, patient.id),
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

    const exportRequest: PatientMailMergeExportRequest = {
      format: "PDF",
      title: selectedTemplate?.name ?? "Serienbrief",
      fileBaseName: batch.downloadName,
      documents: documents.map((doc) => ({
        patientId: doc.patient.id,
        patientName: `${doc.patient.firstName} ${doc.patient.lastName}`,
        subject: doc.subject,
        body: doc.body,
      })),
    }

    try {
      const response = await fetch("/api/exports/mail-merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exportRequest),
      })
      await downloadResponseFile(response, `${batch.downloadName}.pdf`)
      markExported(batch.id)
      setLastBatch({
        timestamp: batch.createdAt,
        count: batch.recipientCount,
        templateName: batch.templateName,
      })
      toast.success(`Serienbrief für ${documents.length} Patienten erzeugt`)
    } catch (error) {
      toast.error((error as Error).message || "Serienbrief konnte nicht erstellt werden")
    }
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
        const reminderStatus =
          reminder && reminder.status === "sent" && reminder.dueDate === isoDate ? "sent" : "open"
        return { patient, nextBirthday, daysUntil, reminderStatus, isoDate }
      })
      .filter((entry) => entry.daysUntil >= 0 && entry.daysUntil <= windowDays)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [patients, birthdayWindow, reminderMap])

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <Collapsible defaultOpen>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5" /> Serienbriefe & Mailings
                </CardTitle>
                <CardDescription>
                  Personalisierte Schreiben mit Platzhaltern und PDF-Generator vorbereiten.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {lastBatch && (
                  <Badge variant="secondary">
                    Zuletzt erstellt: {format(parseISO(lastBatch.timestamp), "dd.MM.yyyy HH:mm")}
                  </Badge>
                )}
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    Öffnen
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Vorlage</Label>
                    <Select value={selectedTemplateId} onValueChange={applyTemplate}>
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
                    <Input
                      value={mailSubject}
                      onChange={(event) => setMailSubject(event.target.value)}
                    />
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
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Empfänger suchen..."
                  />
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
                                {patient.indications?.length
                                  ? patient.indications.join(" · ")
                                  : "Ohne Indikation"}
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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Serienbrief-Historie
                  </p>
                  <div className="mt-2 space-y-2 text-sm">
                    {batches.slice(0, 3).map((batch) => (
                      <div
                        key={batch.id}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{batch.templateName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(batch.createdAt), "dd.MM.yyyy HH:mm")} ·{" "}
                            {batch.recipientCount} Empfänger
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
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card className="lg:max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Geburtstagsliste</CardTitle>
            <CardDescription>Automatisch sortierte Geburtstage der nächsten Tage.</CardDescription>
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
                {upcomingBirthdays
                  .slice(0, 6)
                  .map(({ patient, nextBirthday, reminderStatus, isoDate }) => (
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
            <p className="text-sm text-muted-foreground">
              Keine Geburtstage im gewählten Zeitraum.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
