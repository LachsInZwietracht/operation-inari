"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, ClipboardList, XCircle, TrendingUp } from "lucide-react";

import type { InstitutionAnalyticsResult } from "@/lib/institution-analytics";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatNutrient, formatNumber, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function getScoreColor(score: number) {
  if (score >= 85) return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (score >= 70) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}

function getScoreProgressColor(score: number) {
  if (score >= 85) return "[&>div]:bg-green-500";
  if (score >= 70) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

function StatusIcon({ status }: { status: "ok" | "warning" | "critical" }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case "critical":
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
  }
}

interface ComplianceClientProps {
  analytics: InstitutionAnalyticsResult;
}

export function ComplianceClient({ analytics }: ComplianceClientProps) {
  const [selectedDietForm, setSelectedDietForm] = useState("alle");

  const filteredByDate = useMemo(() => {
    if (selectedDietForm === "alle") return analytics.complianceByDate;

    return analytics.complianceByDate
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => entry.dietFormId === selectedDietForm),
      }))
      .filter((group) => group.entries.length > 0)
      .map((group) => ({
        ...group,
        averageScore: round(group.entries.reduce((sum, entry) => sum + entry.overallScore, 0) / group.entries.length),
      }));
  }, [analytics.complianceByDate, selectedDietForm]);

  const visibleAverage = useMemo(() => {
    const entries = filteredByDate.flatMap((group) => group.entries);
    if (entries.length === 0) return 0;
    return round(entries.reduce((sum, entry) => sum + entry.overallScore, 0) / entries.length);
  }, [filteredByDate]);

  if (!analytics.activeMenu || analytics.complianceByDate.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nährstoff-Compliance"
          description="Tägliche und zyklische Nährstoffkonformität der Menüpläne"
          helpText="Die Seite bewertet den aktiven Menüzyklus anhand realer Rezept-, Zutaten- und Kostformdaten."
        />

        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Es gibt noch keinen aktiven Menüzyklus mit berechenbaren Nährstoffdaten.
          </CardContent>
        </Card>
      </div>
    );
  }

  const cycleLabel = `${formatDate(analytics.cycleDates[0])} – ${formatDate(analytics.cycleDates[analytics.cycleDates.length - 1])}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nährstoff-Compliance"
        description="Tägliche und zyklische Nährstoffkonformität der Menüpläne"
        helpText="Die Seite bewertet den aktiven Menüzyklus anhand realer Rezept-, Zutaten- und Kostformdaten."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Durchschnittliche Compliance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatNumber(visibleAverage, 1)} %</span>
              <Badge className={cn("text-xs", getScoreColor(visibleAverage))}>
                {visibleAverage >= 85 ? "Gut" : visibleAverage >= 70 ? "Akzeptabel" : "Kritisch"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktiver Zyklus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{analytics.activeMenu.name}</div>
            <p className="mt-1 text-xs text-muted-foreground">{cycleLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tage geprüft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredByDate.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">mit berechenbaren Menüdaten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Kostformen geprüft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.dietFormCounts.length || analytics.activeMenu.dietFormIds.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {analytics.activeMenu.dietFormIds.length} Kostformen im aktiven Menü
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Kostform:</span>
        <Select value={selectedDietForm} onValueChange={setSelectedDietForm}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Alle Kostformen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kostformen</SelectItem>
            {analytics.activeMenu.dietFormIds.map((dietFormId) => (
              <SelectItem key={dietFormId} value={dietFormId}>
                {analytics.dietFormCounts.find((entry) => entry.dietFormId === dietFormId)?.dietFormName ?? dietFormId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance-Trend im aktiven Zyklus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredByDate.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatDate(group.date)}</span>
                  <span className="text-muted-foreground">{formatNumber(group.averageScore, 1)} %</span>
                </div>
                <Progress
                  value={group.averageScore}
                  className={cn("h-2", getScoreProgressColor(group.averageScore))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredByDate.map((group) => (
          <Card key={group.date}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{formatDate(group.date)}</CardTitle>
                <Badge className={cn("text-xs", getScoreColor(group.averageScore))}>
                  {formatNumber(group.averageScore, 1)} %
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={group.entries[0]?.dietFormId} className="space-y-4">
                {group.entries.length > 1 ? (
                  <TabsList>
                    {group.entries.map((entry) => (
                      <TabsTrigger key={entry.dietFormId} value={entry.dietFormId}>
                        {analytics.dietFormCounts.find((item) => item.dietFormId === entry.dietFormId)?.dietFormName ?? entry.dietFormId}
                        <Badge className={cn("ml-2 text-xs", getScoreColor(entry.overallScore))}>
                          {formatNumber(entry.overallScore, 0)} %
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                ) : null}

                {group.entries.map((entry) => (
                  <TabsContent key={entry.dietFormId} value={entry.dietFormId} className="space-y-2">
                    {group.entries.length === 1 ? (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {analytics.dietFormCounts.find((item) => item.dietFormId === entry.dietFormId)?.dietFormName ?? entry.dietFormId}
                        </span>
                        <Badge className={cn("text-xs", getScoreColor(entry.overallScore))}>
                          {formatNumber(entry.overallScore, 0)} %
                        </Badge>
                      </div>
                    ) : null}

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nährstoff</TableHead>
                            <TableHead className="text-right">Ist-Wert</TableHead>
                            <TableHead className="text-right">Soll-Wert</TableHead>
                            <TableHead className="text-right">Bereich</TableHead>
                            <TableHead className="text-right">Erfüllung</TableHead>
                            <TableHead className="w-10 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.results.map((result) => (
                            <TableRow key={result.nutrientId}>
                              <TableCell className="font-medium">{result.nutrientName}</TableCell>
                              <TableCell className="text-right">{formatNutrient(result.actual, result.unit)}</TableCell>
                              <TableCell className="text-right">{formatNutrient(result.target, result.unit)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
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
                                        result.status === "ok" ? 85 : result.status === "warning" ? 75 : 50,
                                      ),
                                    )}
                                  />
                                  <span className="text-sm tabular-nums">{formatPercent(result.percentage)}</span>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Hinweise zur Berechnung
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Die Compliance wird aus den real geplanten Rezepten des aktiven Menüzyklus, den hinterlegten Zutatenmengen
          und den Nährstoffzielen der jeweiligen Kostform berechnet.
        </CardContent>
      </Card>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
