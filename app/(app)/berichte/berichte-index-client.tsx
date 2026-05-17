"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Filter, Plus, Search, UserRound } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { PatientReportCard } from "@/components/patient-report-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/format"
import type { Patient, PatientReportRecord, ReportRetentionStatus } from "@/lib/types"

const REPORTS_HEADER = {
  title: "Berichte",
  description: "Patientengebundene Berichte und Versionshistorie",
  helpText:
    "Übersicht aller patientengebundenen Berichte. Öffnen Sie eine archivierte Version oder erstellen Sie einen neuen Bericht aus dem Patienten-Workspace heraus.",
}

type FormatFilter = "all" | "PDF" | "CSV"
type RetentionFilter = "all" | ReportRetentionStatus
type SortMode = "updated_desc" | "patient_asc"

interface BerichteIndexClientProps {
  reports: PatientReportRecord[]
  patients: Patient[]
}

interface PatientGroup {
  patientRef: string
  patient: Patient | undefined
  displayName: string
  indication?: string
  reports: PatientReportRecord[]
  latestUpdate: string
}

function getReportTimestamp(report: PatientReportRecord): string {
  return report.updatedAt ?? report.createdAt ?? ""
}

function groupReportsByPatient(
  reports: PatientReportRecord[],
  patientLookup: Map<string, Patient>,
): PatientGroup[] {
  const groups = new Map<string, PatientGroup>()

  for (const report of reports) {
    const patient = patientLookup.get(report.patientRef)
    const displayName = patient
      ? `${patient.firstName} ${patient.lastName}`
      : report.patientName || "Unbekannter Patient"

    const indication =
      patient?.indications?.length
        ? patient.indications.join(", ")
        : report.patientIndication

    const existing = groups.get(report.patientRef)
    const timestamp = getReportTimestamp(report)

    if (existing) {
      existing.reports.push(report)
      if (timestamp.localeCompare(existing.latestUpdate) > 0) {
        existing.latestUpdate = timestamp
      }
    } else {
      groups.set(report.patientRef, {
        patientRef: report.patientRef,
        patient,
        displayName,
        indication,
        reports: [report],
        latestUpdate: timestamp,
      })
    }
  }

  for (const group of groups.values()) {
    group.reports.sort((a, b) => getReportTimestamp(b).localeCompare(getReportTimestamp(a)))
  }

  return Array.from(groups.values())
}

function reportMatchesFilters(
  report: PatientReportRecord,
  formatFilter: FormatFilter,
  retentionFilter: RetentionFilter,
  query: string,
): boolean {
  if (formatFilter !== "all") {
    const reportFormats = new Set<string>([report.lastFormat])
    for (const version of report.versions ?? []) {
      reportFormats.add(version.format)
    }
    if (!reportFormats.has(formatFilter)) {
      return false
    }
  }

  if (retentionFilter !== "all") {
    const statuses = new Set<string>()
    if (report.retentionStatus) statuses.add(report.retentionStatus)
    for (const version of report.versions ?? []) {
      if (version.retentionStatus) statuses.add(version.retentionStatus)
    }
    if (!statuses.has(retentionFilter)) {
      return false
    }
  }

  if (query) {
    const haystack = [
      report.title,
      report.patientName,
      report.patientIndication ?? "",
      report.planDateLabel ?? "",
      ...(report.activeSectionLabels ?? []),
    ]
      .join(" ")
      .toLowerCase()
    if (!haystack.includes(query)) {
      return false
    }
  }

  return true
}

function NewReportDialog({
  open,
  onOpenChange,
  patients,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patients: Patient[]
}) {
  const router = useRouter()
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")

  const sortedPatients = useMemo(
    () =>
      [...patients].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "de-DE"),
      ),
    [patients],
  )

  const handleConfirm = () => {
    if (!selectedPatientId) return
    onOpenChange(false)
    router.push(`/patienten/${selectedPatientId}?tab=patientenberichte`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Bericht erstellen</DialogTitle>
          <DialogDescription>
            Wählen Sie einen Patienten aus. Der Bericht wird im Patienten-Workspace mit dem aktuellen
            Ernährungsplan und Protokollkontext angelegt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Patient</Label>
          <Command className="rounded-md border">
            <CommandInput placeholder="Patient suchen..." />
            <CommandList className="max-h-64">
              <CommandEmpty>Kein Patient gefunden.</CommandEmpty>
              <CommandGroup>
                {sortedPatients.map((patient) => {
                  const label = `${patient.lastName}, ${patient.firstName}`
                  const isSelected = patient.id === selectedPatientId
                  return (
                    <CommandItem
                      key={patient.id}
                      value={`${label} ${patient.indications?.join(" ") ?? ""}`}
                      onSelect={() => setSelectedPatientId(patient.id)}
                      className={isSelected ? "bg-accent" : undefined}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span>{label}</span>
                        {patient.indications?.length ? (
                          <span className="text-xs text-muted-foreground">
                            {patient.indications.slice(0, 2).join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedPatientId}>
            Weiter zum Patienten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PatientGroupCard({ group }: { group: PatientGroup }) {
  const isOrphaned = !group.patient

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
              {group.displayName}
              {isOrphaned ? <Badge variant="outline">Patient nicht gefunden</Badge> : null}
            </CardTitle>
            <CardDescription>
              {group.indication ? `${group.indication} · ` : ""}
              {group.reports.length} {group.reports.length === 1 ? "Bericht" : "Berichte"}
              {group.latestUpdate ? ` · zuletzt aktualisiert ${formatDate(group.latestUpdate)}` : ""}
            </CardDescription>
          </div>
          {group.patient ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/patienten/${group.patient.id}`} prefetch={false}>
                Patient öffnen
              </Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.reports.map((report) => (
          <PatientReportCard key={report.id} report={report} />
        ))}
      </CardContent>
    </Card>
  )
}

export function BerichteIndexClient({ reports, patients }: BerichteIndexClientProps) {
  const [search, setSearch] = useState("")
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all")
  const [retentionFilter, setRetentionFilter] = useState<RetentionFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc")
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  const patientLookup = useMemo(() => {
    const map = new Map<string, Patient>()
    for (const patient of patients) {
      map.set(patient.id, patient)
      if (patient.legacyId) {
        map.set(patient.legacyId, patient)
      }
    }
    return map
  }, [patients])

  const groups = useMemo(() => groupReportsByPatient(reports, patientLookup), [reports, patientLookup])

  const filteredGroups = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()
    const filtered: PatientGroup[] = []

    for (const group of groups) {
      const matchingReports = group.reports.filter((report) =>
        reportMatchesFilters(report, formatFilter, retentionFilter, normalizedQuery),
      )

      if (matchingReports.length === 0) {
        if (!normalizedQuery) continue
        const haystack = `${group.displayName} ${group.indication ?? ""}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) continue
      }

      filtered.push({
        ...group,
        reports: matchingReports.length > 0 ? matchingReports : group.reports,
      })
    }

    return filtered.sort((a, b) => {
      if (sortMode === "patient_asc") {
        return a.displayName.localeCompare(b.displayName, "de-DE")
      }
      return b.latestUpdate.localeCompare(a.latestUpdate)
    })
  }, [groups, search, formatFilter, retentionFilter, sortMode])

  const totalReports = reports.length
  const hasAnyReports = totalReports > 0
  const hasResults = filteredGroups.length > 0

  return (
    <div className="space-y-6">
      <PageHeader {...REPORTS_HEADER}>
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuen Bericht erstellen
        </Button>
      </PageHeader>

      {hasAnyReports ? (
        <Card>
          <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_160px_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nach Patient, Titel oder Indikation suchen..."
                className="pl-9"
              />
            </div>
            <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value as FormatFilter)}>
              <SelectTrigger aria-label="Format filtern">
                <Filter className="mr-2 h-4 w-4" aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Formate</SelectItem>
                <SelectItem value="PDF">Nur PDF</SelectItem>
                <SelectItem value="CSV">Nur CSV</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={retentionFilter}
              onValueChange={(value) => setRetentionFilter(value as RetentionFilter)}
            >
              <SelectTrigger aria-label="Aufbewahrung filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aufbewahrungen</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="legal_hold">Legal Hold</SelectItem>
                <SelectItem value="deletion_review">Löschprüfung</SelectItem>
                <SelectItem value="expired">Abgelaufen</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <SelectTrigger aria-label="Sortierung">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Neueste zuerst</SelectItem>
                <SelectItem value="patient_asc">Patient A–Z</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      {!hasAnyReports ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Noch keine patientengebundenen Berichte</CardTitle>
            <CardDescription>
              Sobald Sie einen Ernährungsplan eines Patienten als PDF oder CSV exportieren, erscheint die
              archivierte Version hier mit Aufbewahrungsstatus und Downloadlink.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setNewDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Patient auswählen
            </Button>
          </CardContent>
        </Card>
      ) : hasResults ? (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <PatientGroupCard key={group.patientRef} group={group} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Keine Berichte passen zu den aktuellen Filtern.
          </CardContent>
        </Card>
      )}

      <NewReportDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} patients={patients} />
    </div>
  )
}
