"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ChevronRight, Download, FileText, Plus, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  DailyMealPlan,
  NutritionProtocol,
  Patient,
  PatientReportRecord,
  PatientReportVersion,
  ReportRetentionStatus,
} from "@/lib/types"

interface PatientBerichteTabProps {
  patient: Patient
  reports: PatientReportRecord[]
  mealPlans: DailyMealPlan[]
  protocols: NutritionProtocol[]
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

function isPatientPlan(plan: DailyMealPlan, patient: Patient): boolean {
  if (!plan.patientId) return false
  return plan.patientId === patient.id || plan.patientId === patient.legacyId
}

function getLatestByDate<T>(items: T[], getDate: (item: T) => string | undefined): T | null {
  if (items.length === 0) return null
  return [...items].sort((a, b) => {
    const aDate = getDate(a) ?? ""
    const bDate = getDate(b) ?? ""
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })[0] ?? null
}

function getLatestVersion(report: PatientReportRecord): PatientReportVersion | undefined {
  if (!report.versions || report.versions.length === 0) return undefined
  return [...report.versions].sort((a, b) => {
    const aTime = a.exportedAt ?? a.createdAt ?? ""
    const bTime = b.exportedAt ?? b.createdAt ?? ""
    return bTime.localeCompare(aTime)
  })[0]
}

export function PatientBerichteTab({
  patient,
  reports,
  mealPlans,
  protocols,
}: PatientBerichteTabProps) {
  const patientMealPlans = useMemo(
    () => mealPlans.filter((plan) => isPatientPlan(plan, patient)),
    [mealPlans, patient],
  )
  const latestPlan = useMemo(
    () => getLatestByDate(patientMealPlans, (plan) => plan.date),
    [patientMealPlans],
  )
  const latestProtocol = useMemo(
    () => getLatestByDate(protocols, (protocol) => protocol.updatedAt ?? protocol.startDate),
    [protocols],
  )

  const analyzerHref = useMemo(() => {
    const params = new URLSearchParams({ patientId: patient.id })
    if (latestPlan) params.set("planId", latestPlan.id)
    if (latestProtocol) params.set("protocolId", latestProtocol.id)
    return `/berichte?${params.toString()}`
  }, [patient.id, latestPlan, latestProtocol])

  const report = reports[0]
  const latestVersion = report ? getLatestVersion(report) : undefined
  const versions = useMemo(
    () =>
      (report?.versions ?? [])
        .slice()
        .sort((a, b) => b.versionNumber - a.versionNumber),
    [report],
  )

  const planOutOfDate = Boolean(
    report && latestPlan && report.planId && latestPlan.id !== report.planId,
  )

  const retentionStatus = report?.retentionStatus

  if (!report) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Noch kein Bericht erstellt</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Der Bericht enthält Makro- und Mikronährstoffanalyse, Mahlzeitenverteilung und
              Energiequellen. Beim Export wird automatisch eine archivierte Version mit
              Versionshistorie hier abgelegt.
            </p>
          </div>
          <Button asChild>
            <Link href={analyzerHref} prefetch={false}>
              <Plus className="mr-2 h-4 w-4" />
              Bericht erstellen
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                Bericht
                {retentionStatus ? (
                  <Badge variant={RETENTION_BADGE_VARIANTS[retentionStatus]}>
                    {RETENTION_STATUS_LABELS[retentionStatus]}
                  </Badge>
                ) : null}
                {planOutOfDate ? (
                  <Badge variant="outline">Aktualisierung empfohlen</Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Standard-Nährwertauswertung für {patient.firstName} {patient.lastName}
                {latestVersion ? (
                  <>
                    {" · "}
                    Letzte Version v{latestVersion.versionNumber} ({latestVersion.format}) vom{" "}
                    {formatDate(latestVersion.exportedAt)}
                  </>
                ) : (
                  " · Noch kein Export archiviert"
                )}
              </CardDescription>
              {planOutOfDate ? (
                <p className="text-xs text-muted-foreground">
                  Seit dem letzten Export ({report.planDateLabel}) wurde ein neuerer Ernährungsplan
                  hinterlegt. Erneuter Export wird empfohlen.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {latestVersion ? (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`/api/patient-report-versions/${latestVersion.id}/download`}
                    aria-label="Letzte Version herunterladen"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Letzte Version
                  </a>
                </Button>
              ) : null}
              <Button asChild size="sm">
                <Link href={analyzerHref} prefetch={false}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {latestVersion ? "Bericht aktualisieren" : "Bericht exportieren"}
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versionshistorie</CardTitle>
          <CardDescription>
            {versions.length > 0
              ? `${versions.length} ${versions.length === 1 ? "Version" : "Versionen"} archiviert`
              : "Beim ersten Export wird automatisch eine archivierte Version angelegt."}
          </CardDescription>
        </CardHeader>
        {versions.length > 0 ? (
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 pl-6">Version</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Exportiert</TableHead>
                    <TableHead>Aufbewahrung</TableHead>
                    <TableHead className="pr-6 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell className="whitespace-nowrap pl-6 font-medium">
                        v{version.versionNumber}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{version.format}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(version.exportedAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {version.retentionUntil ? (
                          <>
                            bis {formatDate(version.retentionUntil)}
                            {version.retentionStatus
                              ? ` · ${RETENTION_STATUS_LABELS[version.retentionStatus]}`
                              : ""}
                          </>
                        ) : version.retentionStatus ? (
                          RETENTION_STATUS_LABELS[version.retentionStatus]
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`/api/patient-report-versions/${version.id}/download`}
                              aria-label={`Version ${version.versionNumber} (${version.format}) herunterladen`}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/berichte?reportVersionId=${version.id}`}
                              prefetch={false}
                            >
                              Historie
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        ) : (
          <CardContent className="text-sm text-muted-foreground">
            Noch keine archivierten Versionen. Der erste Export erzeugt v1.
          </CardContent>
        )}
      </Card>
    </div>
  )
}
