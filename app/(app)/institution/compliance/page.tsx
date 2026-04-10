"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp } from "lucide-react"
import { COMPLIANCE_DATA, DIET_FORMS } from "@/lib/mock-data"
import { PageHeader } from "@/components/page-header"
import { formatNumber, formatDate, formatNutrient, formatPercent } from "@/lib/format"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

function getScoreColor(score: number) {
  if (score >= 85) return "bg-green-500/15 text-green-700 dark:text-green-400"
  if (score >= 70) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
  return "bg-red-500/15 text-red-700 dark:text-red-400"
}

function getScoreProgressColor(score: number) {
  if (score >= 85) return "[&>div]:bg-green-500"
  if (score >= 70) return "[&>div]:bg-yellow-500"
  return "[&>div]:bg-red-500"
}

function StatusIcon({ status }: { status: "ok" | "warning" | "critical" }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
    case "critical":
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
  }
}

function getDietFormName(dietFormId: string): string {
  const form = DIET_FORMS.find((f) => f.id === dietFormId)
  return form?.name ?? dietFormId
}

export default function CompliancePage() {
  const [selectedDietForm, setSelectedDietForm] = useState("alle")

  const filteredData = useMemo(() => {
    if (selectedDietForm === "alle") return COMPLIANCE_DATA
    return COMPLIANCE_DATA.filter((d) => d.dietFormId === selectedDietForm)
  }, [selectedDietForm])

  const uniqueDates = useMemo(
    () => [...new Set(filteredData.map((d) => d.date))].sort(),
    [filteredData],
  )

  const uniqueDietForms = useMemo(
    () => [...new Set(COMPLIANCE_DATA.map((d) => d.dietFormId))],
    [],
  )

  const averageScore = useMemo(() => {
    if (filteredData.length === 0) return 0
    return filteredData.reduce((sum, d) => sum + d.overallScore, 0) / filteredData.length
  }, [filteredData])

  const uniqueDietFormCount = useMemo(
    () => new Set(filteredData.map((d) => d.dietFormId)).size,
    [filteredData],
  )

  // Group data by date for daily cards
  const dataByDate = useMemo(() => {
    const map = new Map<string, typeof filteredData>()
    for (const entry of filteredData) {
      const existing = map.get(entry.date) ?? []
      existing.push(entry)
      map.set(entry.date, existing)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filteredData])

  // Trend data grouped by diet form
  const trendData = useMemo(() => {
    const allDates = [...new Set(COMPLIANCE_DATA.map((d) => d.date))].sort()
    const forms = selectedDietForm === "alle" ? uniqueDietForms : [selectedDietForm]

    return forms.map((formId) => ({
      formId,
      formName: getDietFormName(formId),
      entries: allDates.map((date) => {
        const entry = COMPLIANCE_DATA.find(
          (d) => d.date === date && d.dietFormId === formId,
        )
        return { date, score: entry?.overallScore ?? null }
      }),
    }))
  }, [selectedDietForm, uniqueDietForms])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nährstoff-Compliance"
        description="Tägliche und wöchentliche Nährstoffkonformität der Menüpläne"
        helpText="Prüfen Sie, ob Ihre Menüpläne die Nährstoffvorgaben einhalten. Die Compliance-Übersicht zeigt Abweichungen von DGE-Referenzwerten auf Tages- und Wochenbasis."
      />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Durchschnittliche Compliance
            </CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatNumber(averageScore, 1)} %
              </span>
              <Badge className={cn("text-xs", getScoreColor(averageScore))}>
                {averageScore >= 85
                  ? "Gut"
                  : averageScore >= 70
                    ? "Akzeptabel"
                    : "Kritisch"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tage geprüft</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{uniqueDates.length}</span>
            <p className="text-muted-foreground text-xs mt-1">
              {uniqueDates.length > 0 &&
                `${formatDate(uniqueDates[0])} – ${formatDate(uniqueDates[uniqueDates.length - 1])}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Kostformen geprüft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{uniqueDietFormCount}</span>
            <p className="text-muted-foreground text-xs mt-1">
              {uniqueDietForms.map((id) => getDietFormName(id)).join(", ")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Diet Form Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Kostform:</span>
        <Select value={selectedDietForm} onValueChange={setSelectedDietForm}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Alle Kostformen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kostformen</SelectItem>
            {uniqueDietForms.map((id) => (
              <SelectItem key={id} value={id}>
                {getDietFormName(id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Trend Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance-Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trendData.map((form) => (
              <div key={form.formId} className="space-y-2">
                <p className="text-sm font-medium">{form.formName}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {form.entries.map((entry) =>
                    entry.score !== null ? (
                      <div key={entry.date} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatDate(entry.date)}
                          </span>
                          <span className="font-medium">
                            {formatNumber(entry.score, 0)} %
                          </span>
                        </div>
                        <Progress
                          value={entry.score}
                          className={cn("h-2", getScoreProgressColor(entry.score))}
                        />
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Compliance Cards */}
      <div className="space-y-4">
        {dataByDate.map(([date, entries]) => (
          <Card key={date}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{formatDate(date)}</CardTitle>
                <div className="flex gap-2">
                  {(() => {
                    const avgForDay =
                      entries.reduce((s, e) => s + e.overallScore, 0) /
                      entries.length
                    return (
                      <Badge
                        className={cn("text-xs", getScoreColor(avgForDay))}
                      >
                        {formatNumber(avgForDay, 1)} %
                      </Badge>
                    )
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                defaultValue={entries[0]?.dietFormId}
                className="space-y-4"
              >
                {entries.length > 1 && (
                  <TabsList>
                    {entries.map((entry) => (
                      <TabsTrigger
                        key={entry.dietFormId}
                        value={entry.dietFormId}
                      >
                        {getDietFormName(entry.dietFormId)}
                        <Badge
                          className={cn(
                            "ml-2 text-xs",
                            getScoreColor(entry.overallScore),
                          )}
                        >
                          {formatNumber(entry.overallScore, 0)} %
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                )}
                {entries.map((entry) => (
                  <TabsContent
                    key={entry.dietFormId}
                    value={entry.dietFormId}
                    className="space-y-2"
                  >
                    {entries.length === 1 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">
                          {getDietFormName(entry.dietFormId)}
                        </span>
                        <Badge
                          className={cn(
                            "text-xs",
                            getScoreColor(entry.overallScore),
                          )}
                        >
                          {formatNumber(entry.overallScore, 0)} %
                        </Badge>
                      </div>
                    )}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nährstoff</TableHead>
                            <TableHead className="text-right">
                              Ist-Wert
                            </TableHead>
                            <TableHead className="text-right">
                              Soll-Wert
                            </TableHead>
                            <TableHead className="text-right">
                              Bereich
                            </TableHead>
                            <TableHead className="text-right">
                              Erfüllung
                            </TableHead>
                            <TableHead className="w-10 text-center">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.results.map((result) => (
                            <TableRow key={result.nutrientId}>
                              <TableCell className="font-medium">
                                {result.nutrientName}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatNutrient(result.actual, result.unit)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatNutrient(result.target, result.unit)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground text-xs">
                                {result.min != null && result.max != null
                                  ? `${formatNumber(result.min)} – ${formatNumber(result.max)} ${result.unit}`
                                  : result.min != null
                                    ? `≥ ${formatNumber(result.min)} ${result.unit}`
                                    : result.max != null
                                      ? `≤ ${formatNumber(result.max)} ${result.unit}`
                                      : "–"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Progress
                                    value={Math.min(result.percentage, 100)}
                                    className={cn(
                                      "h-1.5 w-16",
                                      getScoreProgressColor(
                                        result.status === "ok"
                                          ? 85
                                          : result.status === "warning"
                                            ? 75
                                            : 50,
                                      ),
                                    )}
                                  />
                                  <span className="text-sm tabular-nums">
                                    {formatPercent(result.percentage)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <StatusIcon status={result.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
