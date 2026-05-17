"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Download, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import type { PatientReportRecord, PatientReportVersion, ReportRetentionStatus } from "@/lib/types"

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

function getLatestVersion(report: PatientReportRecord): PatientReportVersion | undefined {
  if (!report.versions || report.versions.length === 0) return undefined
  return [...report.versions].sort((a, b) => {
    const aTime = a.exportedAt ?? a.createdAt ?? ""
    const bTime = b.exportedAt ?? b.createdAt ?? ""
    return bTime.localeCompare(aTime)
  })[0]
}

function VersionRow({ version }: { version: PatientReportVersion }) {
  const retention = version.retentionStatus

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium">v{version.versionNumber}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{version.title}</span>
          <span className="text-xs text-muted-foreground">{version.snapshot.planDateLabel}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{version.format}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(version.exportedAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {version.retentionUntil ? (
          <span>
            bis {formatDate(version.retentionUntil)}
            {retention ? ` · ${RETENTION_STATUS_LABELS[retention]}` : ""}
          </span>
        ) : retention ? (
          RETENTION_STATUS_LABELS[retention]
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/berichte?reportVersionId=${version.id}`} prefetch={false}>
              Historie öffnen
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a
              href={`/api/patient-report-versions/${version.id}/download`}
              aria-label={`${version.format} herunterladen`}
            >
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function PatientReportCard({ report }: { report: PatientReportRecord }) {
  const latestVersion = getLatestVersion(report)
  const versions = (report.versions ?? []).slice().sort((a, b) => b.versionNumber - a.versionNumber)
  const hasVersions = versions.length > 0
  const [open, setOpen] = useState(false)
  const retentionStatus = report.retentionStatus

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="font-medium">{report.title}</p>
            <Badge variant="outline">
              {report.reportLength === "short" ? "Kurzbericht" : "Vollversion"}
            </Badge>
            <Badge variant="outline">{report.lastFormat}</Badge>
            {retentionStatus ? (
              <Badge variant={RETENTION_BADGE_VARIANTS[retentionStatus]}>
                {RETENTION_STATUS_LABELS[retentionStatus]}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {report.planDateLabel}
            {latestVersion
              ? ` · Letzte Version v${latestVersion.versionNumber} vom ${formatDate(latestVersion.exportedAt)}`
              : ` · Aktualisiert ${formatDate(report.updatedAt ?? report.createdAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm">
            <Link href={`/berichte?reportId=${report.id}`} prefetch={false}>
              Bericht öffnen
            </Link>
          </Button>
        </div>
      </div>

      {hasVersions ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 px-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
              {versions.length} {versions.length === 1 ? "Version" : "Versionen"} anzeigen
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Version</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Exportiert</TableHead>
                    <TableHead>Aufbewahrung</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => (
                    <VersionRow key={version.id} version={version} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className="text-xs text-muted-foreground">
          Legacy-Eintrag ohne archivierte Versionen. Beim nächsten Export wird automatisch eine Versionshistorie angelegt.
        </p>
      )}
    </div>
  )
}
