"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Sigma,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useFoods } from "@/components/foods-provider";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { formatNumber } from "@/lib/format";
import { createRecipeLookup } from "@/lib/recipes";
import { buildPlanStatistics, type PlanStatRow } from "@/lib/plan-statistics";
import { useReferenceProfiles } from "@/hooks/use-reference-profiles";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";
import type { DailyMealPlan, NutrientDefinition, Recipe } from "@/lib/types";

interface PlanVergleichClientProps {
  plans: DailyMealPlan[];
  recipes: Recipe[];
  nutrientIds: string[];
  presetPlanIds: string[];
}

const PLAN_STATUS_LABELS: Record<NonNullable<DailyMealPlan["status"]>, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  approved: "Freigegeben",
  archived: "Archiviert",
};

const MAX_SELECTABLE = 8;

function nutrientDecimals(value: number, unit: string): number {
  if (unit === "kcal" || unit === "kJ") return 0;
  if (value >= 100) return 0;
  if (value >= 10) return 1;
  return 2;
}

function formatAmount(value: number, definition: NutrientDefinition): string {
  return `${formatNumber(value, nutrientDecimals(value, definition.unit))} ${definition.unit}`;
}

function formatPlanDateLong(date: string): string {
  try {
    return format(parseISO(date), "EEE, dd.MM.yyyy", { locale: de });
  } catch {
    return date;
  }
}

function formatPlanDateShort(date: string): string {
  try {
    return format(parseISO(date), "dd.MM.", { locale: de });
  } catch {
    return date;
  }
}

export function PlanVergleichClient({
  plans,
  recipes,
  nutrientIds,
  presetPlanIds,
}: PlanVergleichClientProps) {
  const foods = useFoods();
  const { patients } = usePatients();
  const { getResolvedConfig } = useReferenceProfiles();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    presetPlanIds.filter((id) => plans.some((plan) => plan.id === id)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [chartNutrientId, setChartNutrientId] = useState<string>("energie");
  const [referencePatientId, setReferencePatientId] = useState<string>("none");

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => b.date.localeCompare(a.date)),
    [plans],
  );

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);

  const selectedPlans = useMemo(() => {
    const lookup = new Map(plans.map((plan) => [plan.id, plan]));
    return selectedIds
      .map((id) => lookup.get(id))
      .filter((plan): plan is DailyMealPlan => Boolean(plan))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [plans, selectedIds]);

  const statistics = useMemo(
    () => buildPlanStatistics(selectedPlans, foodMap, recipeMap, foods, nutrientIds),
    [selectedPlans, foodMap, recipeMap, foods, nutrientIds],
  );

  const referenceConfig = useMemo(() => {
    if (referencePatientId === "none") {
      return getResolvedConfig({});
    }
    const patient = patients.find((item) => item.id === referencePatientId);
    if (!patient) return getResolvedConfig({});
    return getResolvedConfig({
      patientId: patient.id,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
    });
  }, [getResolvedConfig, patients, referencePatientId]);

  const referenceAmounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const value of referenceConfig.values) {
      map.set(value.nutrientId, value.amount);
    }
    return map;
  }, [referenceConfig]);

  const nutrientDefinitions = useMemo(() => {
    const lookup = new Map(NUTRIENT_DEFINITIONS.map((def) => [def.id, def]));
    return nutrientIds
      .map((id) => lookup.get(id))
      .filter((def): def is NutrientDefinition => Boolean(def));
  }, [nutrientIds]);

  const groupedRows = useMemo(() => {
    const groups = new Map<
      NutrientDefinition["group"],
      Array<{ row: PlanStatRow; definition: NutrientDefinition }>
    >();
    for (const definition of nutrientDefinitions) {
      const row = statistics.rows.find((item) => item.nutrientId === definition.id);
      if (!row) continue;
      const entries = groups.get(definition.group) ?? [];
      entries.push({ row, definition });
      groups.set(definition.group, entries);
    }
    return groups;
  }, [nutrientDefinitions, statistics.rows]);

  const chartNutrient = nutrientDefinitions.find((def) => def.id === chartNutrientId);
  const chartRow = statistics.rows.find((row) => row.nutrientId === chartNutrientId);

  const chartData = useMemo(() => {
    if (!chartRow) return [];
    return statistics.plans.map((planTotals, index) => ({
      label: formatPlanDateShort(planTotals.date),
      title: planTotals.title ?? formatPlanDateLong(planTotals.date),
      value: chartRow.values[index] ?? 0,
    }));
  }, [chartRow, statistics.plans]);

  const filteredPickerPlans = useMemo(() => {
    const trimmed = pickerQuery.trim().toLowerCase();
    if (!trimmed) return sortedPlans;
    return sortedPlans.filter((plan) => {
      const haystack = [
        plan.title ?? "",
        plan.date,
        plan.status ?? "",
        plan.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [pickerQuery, sortedPlans]);

  const togglePlan = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= MAX_SELECTABLE) return current;
      return [...current, id];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const referencePatientOptions = useMemo(
    () =>
      patients
        .filter((patient) => Boolean(patient.firstName) || Boolean(patient.lastName))
        .map((patient) => ({
          id: patient.id,
          label: `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || patient.id,
        })),
    [patients],
  );

  const showStats = selectedPlans.length >= 2;
  const totalPlans = plans.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan-Vergleich & Statistik"
        description="Bis zu acht Tagespläne nebeneinander auswerten — pro Nährstoff Minimum, Maximum, Mittelwert und Streuung."
        helpText="Wähle mehrere bereits gespeicherte Pläne aus. Die Tabelle und das Diagramm zeigen die Nährstoff-Tageswerte sowie die deskriptive Statistik über die Auswahl (Stichproben-Standardabweichung, Variationskoeffizient)."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/ernaehrungsplan">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zum Plan
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="text-muted-foreground h-4 w-4" />
            Pläne auswählen
          </CardTitle>
          <CardDescription>
            {totalPlans === 0
              ? "Es sind noch keine Tagespläne gespeichert."
              : `${selectedPlans.length} von max. ${MAX_SELECTABLE} ausgewählt · ${totalPlans} verfügbar`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  disabled={totalPlans === 0}
                  className="min-w-[220px] justify-between"
                >
                  {selectedPlans.length === 0
                    ? "Pläne wählen…"
                    : `${selectedPlans.length} Plan${selectedPlans.length === 1 ? "" : "e"} ausgewählt`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <div className="border-b p-2">
                  <Input
                    placeholder="Datum, Titel oder Status suchen…"
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                    className="h-8"
                  />
                </div>
                <ScrollArea className="h-72">
                  <div className="p-1">
                    {filteredPickerPlans.length === 0 ? (
                      <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                        Keine Pläne gefunden.
                      </p>
                    ) : (
                      filteredPickerPlans.map((plan) => {
                        const checked = selectedIds.includes(plan.id);
                        const disabled =
                          !checked && selectedIds.length >= MAX_SELECTABLE;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => togglePlan(plan.id)}
                            disabled={disabled}
                            className={cn(
                              "hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                              disabled && "opacity-40",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              tabIndex={-1}
                              onCheckedChange={() => togglePlan(plan.id)}
                              className="pointer-events-none"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                  {plan.title?.trim() || formatPlanDateLong(plan.date)}
                                </span>
                                {plan.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {PLAN_STATUS_LABELS[plan.status]}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {formatPlanDateLong(plan.date)}
                              </div>
                            </div>
                            {checked && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {selectedPlans.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Auswahl leeren
              </Button>
            )}
          </div>

          {selectedPlans.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPlans.map((plan) => (
                <Badge
                  key={plan.id}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1 pl-2 pr-1 text-xs"
                >
                  <span className="font-medium">
                    {plan.title?.trim() || formatPlanDateLong(plan.date)}
                  </span>
                  <span className="text-muted-foreground">
                    · {formatPlanDateShort(plan.date)}
                  </span>
                  <button
                    type="button"
                    aria-label="Plan entfernen"
                    onClick={() => togglePlan(plan.id)}
                    className="hover:bg-muted ml-0.5 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="vergleich-reference">Referenzwerte</Label>
              <Select value={referencePatientId} onValueChange={setReferencePatientId}>
                <SelectTrigger id="vergleich-reference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Eigene Referenz ({referenceConfig.standardName})
                  </SelectItem>
                  {referencePatientOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Die Tabelle zeigt zusätzlich die Tagesreferenz aus dem aktuell aktiven Profil.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vergleich-chart-nutrient">Detail-Diagramm</Label>
              <Select value={chartNutrientId} onValueChange={setChartNutrientId}>
                <SelectTrigger id="vergleich-chart-nutrient">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nutrientDefinitions.map((definition) => (
                    <SelectItem key={definition.id} value={definition.id}>
                      {definition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Wähle den Nährstoff, der unten als Balkendiagramm dargestellt wird.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedPlans.length < 2 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <Sigma className="text-muted-foreground/60 h-6 w-6" />
            <p>
              Wähle mindestens zwei Pläne, um Vergleichswerte und Statistik anzuzeigen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="text-muted-foreground h-4 w-4" />
                Nährstoffvergleich
              </CardTitle>
              <CardDescription>
                Tagessummen pro Plan, gefolgt von deskriptiver Statistik über die Auswahl.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <ComparisonTable
                statistics={statistics}
                nutrientDefinitions={nutrientDefinitions}
                groupedRows={groupedRows}
                referenceAmounts={referenceAmounts}
                showStats={showStats}
                selectedPlans={selectedPlans}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="text-muted-foreground h-4 w-4" />
                {chartNutrient?.name ?? "Detail"}
              </CardTitle>
              <CardDescription>
                Werte pro Tag im Vergleich — Mittelwert{" "}
                {chartRow && chartNutrient
                  ? `${formatNumber(chartRow.mean, nutrientDecimals(chartRow.mean, chartNutrient.unit))} ${chartNutrient.unit}`
                  : ""}
                {referenceAmounts.has(chartNutrientId)
                  ? ` · Referenz ${formatNumber(referenceAmounts.get(chartNutrientId) ?? 0, 0)} ${chartNutrient?.unit ?? ""}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                      formatter={(value: unknown) => {
                        const numericValue = Number(value ?? 0);

                        return chartNutrient
                          ? [
                              `${formatNumber(numericValue, nutrientDecimals(numericValue, chartNutrient.unit))} ${chartNutrient.unit}`,
                              chartNutrient.name,
                            ]
                          : [numericValue, ""];
                      }}
                      labelFormatter={(label: unknown, payload) => {
                        const point = payload?.[0]?.payload as
                          | { title?: string }
                          | undefined;
                        return point?.title ?? String(label ?? "");
                      }}
                      contentStyle={{
                        background: "var(--color-background)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    {chartRow && (
                      <ReferenceLine
                        y={chartRow.mean}
                        stroke="var(--color-chart-2)"
                        strokeDasharray="4 4"
                        label={{
                          value: "⌀",
                          fill: "var(--color-chart-2)",
                          fontSize: 11,
                          position: "right",
                        }}
                      />
                    )}
                    {referenceAmounts.has(chartNutrientId) && (
                      <ReferenceLine
                        y={referenceAmounts.get(chartNutrientId)}
                        stroke="var(--color-chart-3)"
                        strokeDasharray="2 4"
                        label={{
                          value: "Ref.",
                          fill: "var(--color-chart-3)",
                          fontSize: 11,
                          position: "right",
                        }}
                      />
                    )}
                    <Bar
                      dataKey="value"
                      name={chartNutrient?.name ?? ""}
                      fill="var(--color-chart-1)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

interface ComparisonTableProps {
  statistics: ReturnType<typeof buildPlanStatistics>;
  nutrientDefinitions: NutrientDefinition[];
  groupedRows: Map<
    NutrientDefinition["group"],
    Array<{ row: PlanStatRow; definition: NutrientDefinition }>
  >;
  referenceAmounts: Map<string, number>;
  showStats: boolean;
  selectedPlans: DailyMealPlan[];
}

const GROUP_LABELS: Record<NutrientDefinition["group"], string> = {
  makronaehrstoffe: "Makronährstoffe",
  vitamine: "Vitamine",
  mineralstoffe: "Mineralstoffe",
  aminosaeuren: "Aminosäuren",
  fettsaeuren: "Fettsäuren",
  sonstige: "Sonstige",
};

const GROUP_ORDER: NutrientDefinition["group"][] = [
  "makronaehrstoffe",
  "vitamine",
  "mineralstoffe",
  "fettsaeuren",
  "aminosaeuren",
  "sonstige",
];

function ComparisonTable({
  statistics,
  groupedRows,
  referenceAmounts,
  showStats,
  selectedPlans,
}: ComparisonTableProps) {
  const planCount = statistics.plans.length;
  const orderedGroups = GROUP_ORDER.filter((group) => groupedRows.has(group));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="bg-muted/40 sticky left-0 z-10 min-w-[180px]">
            Nährstoff
          </TableHead>
          {selectedPlans.map((plan) => (
            <TableHead key={plan.id} className="min-w-[120px] text-right">
              <div className="font-medium">
                {plan.title?.trim() || formatPlanDateShort(plan.date)}
              </div>
              <div className="text-muted-foreground text-xs font-normal">
                {formatPlanDateShort(plan.date)}
              </div>
            </TableHead>
          ))}
          {showStats && (
            <>
              <TableHead className="min-w-[80px] text-right">Min</TableHead>
              <TableHead className="min-w-[80px] text-right">Max</TableHead>
              <TableHead className="min-w-[80px] text-right">⌀</TableHead>
              <TableHead className="min-w-[80px] text-right">Median</TableHead>
              <TableHead className="min-w-[80px] text-right">SD</TableHead>
              <TableHead className="min-w-[80px] text-right">CV</TableHead>
            </>
          )}
          <TableHead className="min-w-[100px] text-right">Referenz</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orderedGroups.map((group) => {
          const entries = groupedRows.get(group);
          if (!entries || entries.length === 0) return null;
          return (
            <Fragment key={`group-${group}`}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell
                  colSpan={1 + planCount + (showStats ? 6 : 0) + 1}
                  className="text-muted-foreground py-2 text-xs font-semibold uppercase tracking-wide"
                >
                  {GROUP_LABELS[group]}
                </TableCell>
              </TableRow>
              {entries.map(({ row, definition }) => {
                const reference = referenceAmounts.get(definition.id);
                return (
                  <TableRow key={definition.id}>
                    <TableCell className="bg-background sticky left-0 z-10 font-medium">
                      <div className="flex flex-col">
                        <span>{definition.name}</span>
                        <span className="text-muted-foreground text-xs font-normal">
                          {definition.unit}
                        </span>
                      </div>
                    </TableCell>
                    {row.values.map((value, index) => {
                      const isMin = showStats && value === row.min && row.min !== row.max;
                      const isMax = showStats && value === row.max && row.min !== row.max;
                      return (
                        <TableCell
                          key={`${definition.id}-${statistics.plans[index]?.planId ?? index}`}
                          className={cn(
                            "text-right tabular-nums",
                            isMin && "text-amber-700 dark:text-amber-400",
                            isMax && "text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {formatAmount(value, definition)}
                        </TableCell>
                      );
                    })}
                    {showStats && (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(row.min, definition)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(row.max, definition)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatAmount(row.mean, definition)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(row.median, definition)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(row.stddev, definition)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {row.mean === 0
                            ? "—"
                            : `${formatNumber(row.cv * 100, 1)} %`}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {reference && reference > 0
                        ? `${formatNumber(reference, 0)} ${definition.unit}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
