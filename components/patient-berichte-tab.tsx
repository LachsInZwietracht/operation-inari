"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Filter, Plus, Search } from "lucide-react"

import { PatientReportCard } from "@/components/patient-report-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  DailyMealPlan,
  NutritionProtocol,
  Patient,
  PatientReportRecord,
} from "@/lib/types"

type FormatFilter = "all" | "PDF" | "CSV"

interface PatientBerichteTabProps {
  patient: Patient
  reports: PatientReportRecord[]
  mealPlans: DailyMealPlan[]
  protocols: NutritionProtocol[]
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

function reportMatchesFilter(
  report: PatientReportRecord,
  formatFilter: FormatFilter,
  query: string,
): boolean {
  if (formatFilter !== "all") {
    const formats = new Set<string>([report.lastFormat])
    for (const version of report.versions ?? []) {
      formats.add(version.format)
    }
    if (!formats.has(formatFilter)) return false
  }

  if (!query) return true

  const haystack = [
    report.title,
    report.planDateLabel ?? "",
    report.patientIndication ?? "",
    ...(report.activeSectionLabels ?? []),
    ...(report.versions?.map((v) => `${v.title} v${v.versionNumber}`) ?? []),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(query)
}

export function PatientBerichteTab({
  patient,
  reports,
  mealPlans,
  protocols,
}: PatientBerichteTabProps) {
  const [search, setSearch] = useState("")
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all")

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

  const reportHref = useMemo(() => {
    const params = new URLSearchParams({ patientId: patient.id })
    if (latestPlan) params.set("planId", latestPlan.id)
    if (latestProtocol) params.set("protocolId", latestProtocol.id)
    return `/berichte?${params.toString()}`
  }, [patient.id, latestPlan, latestProtocol])

  const sortedReports = useMemo(
    () =>
      [...reports].sort((a, b) => {
        const aTime = a.updatedAt ?? a.createdAt ?? ""
        const bTime = b.updatedAt ?? b.createdAt ?? ""
        return bTime.localeCompare(aTime)
      }),
    [reports],
  )

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sortedReports.filter((report) => reportMatchesFilter(report, formatFilter, query))
  }, [sortedReports, search, formatFilter])

  const hasReports = sortedReports.length > 0
  const hasResults = filteredReports.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {hasReports
            ? `${sortedReports.length} ${sortedReports.length === 1 ? "Bericht" : "Berichte"} für ${patient.firstName} ${patient.lastName}`
            : "Noch keine Berichte für diesen Patienten."}
        </div>
        <Button asChild>
          <Link href={reportHref} prefetch={false}>
            <Plus className="mr-2 h-4 w-4" />
            Neuen Bericht erstellen
          </Link>
        </Button>
      </div>

      {hasReports ? (
        <>
          <Card>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_180px]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nach Titel, Plan oder Indikation suchen..."
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
            </CardContent>
          </Card>

          {hasResults ? (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <PatientReportCard key={report.id} report={report} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Keine Berichte passen zu den aktuellen Filtern.
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Noch keine Berichte</p>
              <p className="text-sm text-muted-foreground">
                Beim Export eines Ernährungsplans als PDF oder CSV wird automatisch eine archivierte
                Version mit Versionshistorie hier abgelegt.
              </p>
            </div>
            <Button asChild>
              <Link href={reportHref} prefetch={false}>
                <Plus className="mr-2 h-4 w-4" />
                Neuen Bericht erstellen
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
