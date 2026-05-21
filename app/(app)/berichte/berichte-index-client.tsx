"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, Plus, Search } from "lucide-react"

import { PageHeader } from "@/components/page-header"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import type {
  Patient,
  PatientReportRecord,
  PatientReportVersion,
  ReportRetentionStatus,
} from "@/lib/types"

const REPORTS_HEADER = {
  title: "Berichte",
  description: "Patientengebundene Nährstoffberichte und Versionshistorie",
  helpText:
    "Pro Patient gibt es einen Standard-Bericht. Jeder Export erzeugt eine neue Version mit eigenem Aufbewahrungsstatus.",
}

const RETENTION_STATUS_LABELS: Record<ReportRetentionStatus, string> = {
  active: "Aktiv",
  legal_hold: "Legal Hold",
  deletion_review: "Löschprüfung",
  expired: "Abgelaufen",
}

const RETENTION_BADGE_VARIANTS: Record<ReportRetentionStatus, "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  legal_hold: "outline",
  deletion_review: "outline",
  expired: "destructive",
}

type RetentionFilter = "all" | ReportRetentionStatus
type SortMode = "exported_desc" | "patient_asc"

interface BerichteIndexClientProps {
  reports: PatientReportRecord[]
  patients: Patient[]
}

interface ReportRow {
  report: PatientReportRecord
  patient: Patient | undefined
  displayName: string
  indication?: string
  latestVersion?: PatientReportVersion
  latestActivity: string
}

function getLatestVersion(report: PatientReportRecord): PatientReportVersion | undefined {
  if (!report.versions || report.versions.length === 0) return undefined
  return [...report.versions].sort((a, b) => {
    const aTime = a.exportedAt ?? a.createdAt ?? ""
    const bTime = b.exportedAt ?? b.createdAt ?? ""
    return bTime.localeCompare(aTime)
  })[0]
}

function buildReportRows(
  reports: PatientReportRecord[],
  patientLookup: Map<string, Patient>,
): ReportRow[] {
  return reports.map((report) => {
    const patient = patientLookup.get(report.patientRef)
    const displayName = patient
      ? `${patient.lastName}, ${patient.firstName}`
      : report.patientName || "Unbekannter Patient"
    const indication = patient?.indications?.length
      ? patient.indications.join(", ")
      : report.patientIndication
    const latestVersion = getLatestVersion(report)
    const latestActivity =
      latestVersion?.exportedAt ?? report.updatedAt ?? report.createdAt ?? ""

    return {
      report,
      patient,
      displayName,
      indication,
      latestVersion,
      latestActivity,
    }
  })
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
          <DialogTitle>Bericht erstellen</DialogTitle>
          <DialogDescription>
            Wählen Sie einen Patienten aus. Der Bericht wird im Patienten-Workspace angelegt oder
            aktualisiert.
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

export function BerichteIndexClient({ reports, patients }: BerichteIndexClientProps) {
  const [search, setSearch] = useState("")
  const [retentionFilter, setRetentionFilter] = useState<RetentionFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("exported_desc")
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

  const rows = useMemo(() => buildReportRows(reports, patientLookup), [reports, patientLookup])

  const filteredRows = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()

    const filtered = rows.filter((row) => {
      if (retentionFilter !== "all") {
        if (row.report.retentionStatus !== retentionFilter) {
          return false
        }
      }

      if (normalizedQuery) {
        const haystack =
          `${row.displayName} ${row.indication ?? ""} ${row.report.planDateLabel ?? ""}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) {
          return false
        }
      }

      return true
    })

    return filtered.sort((a, b) => {
      if (sortMode === "patient_asc") {
        return a.displayName.localeCompare(b.displayName, "de-DE")
      }
      return b.latestActivity.localeCompare(a.latestActivity)
    })
  }, [rows, search, retentionFilter, sortMode])

  const hasAnyReports = rows.length > 0
  const hasResults = filteredRows.length > 0

  return (
    <div className="space-y-6">
      <PageHeader {...REPORTS_HEADER}>
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Bericht erstellen
        </Button>
      </PageHeader>

      {hasAnyReports ? (
        <Card>
          <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_200px_200px]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nach Patient oder Indikation suchen..."
                className="pl-9"
              />
            </div>
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
                <SelectItem value="exported_desc">Zuletzt exportiert</SelectItem>
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
              Berichte werden im Patienten-Workspace angelegt und enthalten Nährwertanalyse,
              Mahlzeitenverteilung und Energiequellen. Jeder Export erzeugt eine neue archivierte
              Version.
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
        <Card>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Patient</TableHead>
                    <TableHead>Indikation</TableHead>
                    <TableHead>Letzte Version</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Exportiert</TableHead>
                    <TableHead>Aufbewahrung</TableHead>
                    <TableHead className="pr-6 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const retentionStatus = row.report.retentionStatus
                    const versionsCount = row.report.versions?.length ?? 0
                    return (
                      <TableRow key={row.report.id}>
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="font-medium">{row.displayName}</span>
                            {!row.patient ? (
                              <Badge variant="outline" className="mt-1 w-fit">
                                Patient nicht gefunden
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {row.indication ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.latestVersion
                            ? `v${row.latestVersion.versionNumber}`
                            : "Nur Datensatz"}
                          {versionsCount > 0 ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({versionsCount})
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.latestVersion?.format ?? row.report.lastFormat}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {row.latestVersion
                            ? formatDate(row.latestVersion.exportedAt)
                            : formatDate(row.report.updatedAt ?? row.report.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {retentionStatus ? (
                            <Badge variant={RETENTION_BADGE_VARIANTS[retentionStatus]}>
                              {RETENTION_STATUS_LABELS[retentionStatus]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex justify-end gap-2">
                            {row.latestVersion ? (
                              <Button asChild size="sm" variant="ghost">
                                <a
                                  href={`/api/patient-report-versions/${row.latestVersion.id}/download`}
                                  aria-label={`Version ${row.latestVersion.versionNumber} herunterladen`}
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : null}
                            {row.patient ? (
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/patienten/${row.patient.id}?tab=patientenberichte`}
                                  prefetch={false}
                                >
                                  Öffnen
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
