"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { PageHeader } from "@/components/page-header"
import { NutrientChart, type NutrientChartDataPoint } from "@/components/nutrient-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FOODS,
  RECIPES,
  MEAL_PLANS,
  NUTRIENT_DEFINITIONS,
  REFERENCE_VALUES,
} from "@/lib/mock-data"
import {
  scaleNutrients,
  sumNutrients,
  calculateRecipeNutrients,
  calculatePerServing,
  getNutrientValue,
  percentOfReference,
} from "@/lib/nutrients"
import { formatNumber, formatNutrient, formatPercent, formatDate } from "@/lib/format"
import type { DailyMealPlan, NutrientValue } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOCALSTORAGE_KEY = "prodi_meal_plans"

function loadLocalStoragePlans(): DailyMealPlan[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // The meal plan hook stores plans as Record<string, DailyMealPlan>
    if (Array.isArray(parsed)) return parsed as DailyMealPlan[]
    if (typeof parsed === "object" && parsed !== null) {
      return Object.values(parsed) as DailyMealPlan[]
    }
    return []
  } catch {
    return []
  }
}

function getAllPlans(lsPlans: DailyMealPlan[]): DailyMealPlan[] {
  const mockIds = new Set(MEAL_PLANS.map((p) => p.id))
  const extra = lsPlans.filter((p) => !mockIds.has(p.id))
  return [...MEAL_PLANS, ...extra].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

function calculatePlanNutrients(plan: DailyMealPlan): NutrientValue[] {
  const foodMap = new Map(FOODS.map((f) => [f.id, f]))
  const recipeMap = new Map(RECIPES.map((r) => [r.id, r]))
  const arrays: NutrientValue[][] = []

  for (const slot of plan.slots) {
    for (const entry of slot.entries) {
      if (entry.type === "food") {
        const food = foodMap.get(entry.referenceId)
        if (!food) continue
        arrays.push(scaleNutrients(food.nutrients, food.baseAmount, entry.amount))
      } else {
        const recipe = recipeMap.get(entry.referenceId)
        if (!recipe) continue
        const totalRecipeNutrients = calculateRecipeNutrients(recipe, FOODS)
        const perServing = calculatePerServing(totalRecipeNutrients, recipe.servings)
        // entry.amount = number of servings
        arrays.push(
          perServing.map((nv) => ({ nutrientId: nv.nutrientId, amount: nv.amount * entry.amount })),
        )
      }
    }
  }

  return sumNutrients(arrays)
}

function getReferenceForNutrient(nutrientId: string, gender: "m" | "w"): number {
  return REFERENCE_VALUES.find((r) => r.nutrientId === nutrientId && r.gender === gender)?.amount ?? 0
}

function getStatusColor(percent: number): string {
  if (percent >= 80) return "var(--color-chart-2)" // green
  if (percent >= 50) return "var(--color-chart-4)" // yellow / amber
  return "var(--color-chart-5)" // red
}

// ---------------------------------------------------------------------------
// Percent Bar Tooltip
// ---------------------------------------------------------------------------

interface PercentDataPoint {
  name: string
  percent: number
  value: number
  reference: number
  unit: string
}

interface PercentTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: PercentDataPoint }>
  label?: string
}

function PercentTooltip({ active, payload, label }: PercentTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as PercentDataPoint | undefined
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-sm">
        Istwert: {formatNumber(point.value, 1)} {point.unit}
      </p>
      <p className="text-muted-foreground text-sm">
        Referenz: {formatNumber(point.reference, 1)} {point.unit}
      </p>
      <p className="text-muted-foreground text-sm">
        Abdeckung: {formatPercent(point.percent)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function BerichtePage() {
  const [lsPlans, setLsPlans] = useState<DailyMealPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")

  useEffect(() => {
    setLsPlans(loadLocalStoragePlans())
  }, [])

  const allPlans = useMemo(() => getAllPlans(lsPlans), [lsPlans])

  // Default selection
  useEffect(() => {
    if (!selectedPlanId && allPlans.length > 0) {
      setSelectedPlanId(allPlans[0].id)
    }
  }, [allPlans, selectedPlanId])

  const selectedPlan = useMemo(
    () => allPlans.find((p) => p.id === selectedPlanId),
    [allPlans, selectedPlanId],
  )

  const planNutrients = useMemo(
    () => (selectedPlan ? calculatePlanNutrients(selectedPlan) : []),
    [selectedPlan],
  )

  const gender: "m" | "w" = "m"

  // ---- Macro data --------------------------------------------------------

  const macroIds = ["eiweiss", "fett", "kohlenhydrate", "ballaststoffe"]
  const macroChartData: NutrientChartDataPoint[] = macroIds.map((id) => {
    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
    return {
      name: def.name,
      value: getNutrientValue(planNutrients, id),
      reference: getReferenceForNutrient(id, gender),
      unit: def.unit,
    }
  })

  const energieValue = getNutrientValue(planNutrients, "energie")
  const energieRef = getReferenceForNutrient("energie", gender)
  const energieDef = NUTRIENT_DEFINITIONS.find((d) => d.id === "energie")!

  const macroTableIds = ["energie", ...macroIds, "zucker", "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren"]

  // ---- Vitamin data -------------------------------------------------------

  const vitaminDefs = NUTRIENT_DEFINITIONS.filter((d) => d.group === "vitamine").sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const vitaminPercentData = vitaminDefs.map((def) => {
    const value = getNutrientValue(planNutrients, def.id)
    const ref = getReferenceForNutrient(def.id, gender)
    const pct = percentOfReference(value, ref)
    return { name: def.shortName, percent: pct, value, reference: ref, unit: def.unit }
  })

  // ---- Mineral data -------------------------------------------------------

  const mineralDefs = NUTRIENT_DEFINITIONS.filter((d) => d.group === "mineralstoffe").sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const mineralPercentData = mineralDefs.map((def) => {
    const value = getNutrientValue(planNutrients, def.id)
    const ref = getReferenceForNutrient(def.id, gender)
    const pct = percentOfReference(value, ref)
    return { name: def.shortName, percent: pct, value, reference: ref, unit: def.unit }
  })

  // ---- Render -------------------------------------------------------------

  if (allPlans.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Berichte" description="Nährstoffanalyse und Auswertungen" />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Keine Ernährungspläne vorhanden. Erstelle zuerst einen Ernährungsplan.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Berichte" description="Nährstoffanalyse und Auswertungen" />

      {/* Plan selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Ernährungsplan:</span>
        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Plan auswählen" />
          </SelectTrigger>
          <SelectContent>
            {allPlans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {formatDate(plan.date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="makro">
        <TabsList>
          <TabsTrigger value="makro">Makronährstoffe</TabsTrigger>
          <TabsTrigger value="vitamine">Vitamine</TabsTrigger>
          <TabsTrigger value="mineralstoffe">Mineralstoffe</TabsTrigger>
        </TabsList>

        {/* ── Makronährstoffe ────────────────────────────── */}
        <TabsContent value="makro" className="space-y-6">
          {/* Energy highlight card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Energiezufuhr</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {formatNumber(energieValue, 0)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {energieDef.unit}
                </span>
                <span className="text-muted-foreground text-sm">
                  von {formatNumber(energieRef, 0)} {energieDef.unit} Referenzwert
                </span>
                <span
                  className="ml-2 rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor:
                      percentOfReference(energieValue, energieRef) >= 80
                        ? "var(--color-chart-2)"
                        : percentOfReference(energieValue, energieRef) >= 50
                          ? "var(--color-chart-4)"
                          : "var(--color-chart-5)",
                    color: "white",
                  }}
                >
                  {formatPercent(percentOfReference(energieValue, energieRef))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Makronährstoffe &ndash; Ist vs. Referenz
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NutrientChart data={macroChartData} />
            </CardContent>
          </Card>

          {/* Detail table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nährstoff</TableHead>
                    <TableHead className="text-right">Istwert</TableHead>
                    <TableHead className="text-right">Einheit</TableHead>
                    <TableHead className="text-right">Referenzwert</TableHead>
                    <TableHead className="text-right">% der Referenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {macroTableIds.map((id) => {
                    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
                    const val = getNutrientValue(planNutrients, id)
                    const ref = getReferenceForNutrient(id, gender)
                    const pct = percentOfReference(val, ref)
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-medium">{def.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(val, 1)}
                        </TableCell>
                        <TableCell className="text-right">{def.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(ref, 1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(pct)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vitamine ───────────────────────────────────── */}
        <TabsContent value="vitamine" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Vitamine &ndash; Abdeckung der DGE-Referenzwerte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(300, vitaminPercentData.length * 50)}
              >
                <BarChart
                  data={vitaminPercentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit=" %" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={75}
                  />
                  <Tooltip content={<PercentTooltip />} />
                  <Bar dataKey="percent" name="% der Referenz" radius={[0, 4, 4, 0]} barSize={18}>
                    {vitaminPercentData.map((entry, idx) => (
                      <Cell key={idx} fill={getStatusColor(entry.percent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vitamin</TableHead>
                    <TableHead className="text-right">Istwert</TableHead>
                    <TableHead className="text-right">Einheit</TableHead>
                    <TableHead className="text-right">Referenzwert</TableHead>
                    <TableHead className="text-right">% der Referenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitaminDefs.map((def) => {
                    const val = getNutrientValue(planNutrients, def.id)
                    const ref = getReferenceForNutrient(def.id, gender)
                    const pct = percentOfReference(val, ref)
                    return (
                      <TableRow key={def.id}>
                        <TableCell className="font-medium">{def.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(val, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">{def.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(ref, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(pct)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Mineralstoffe ──────────────────────────────── */}
        <TabsContent value="mineralstoffe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Mineralstoffe &ndash; Abdeckung der DGE-Referenzwerte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(300, mineralPercentData.length * 50)}
              >
                <BarChart
                  data={mineralPercentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit=" %" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={75}
                  />
                  <Tooltip content={<PercentTooltip />} />
                  <Bar dataKey="percent" name="% der Referenz" radius={[0, 4, 4, 0]} barSize={18}>
                    {mineralPercentData.map((entry, idx) => (
                      <Cell key={idx} fill={getStatusColor(entry.percent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mineralstoff</TableHead>
                    <TableHead className="text-right">Istwert</TableHead>
                    <TableHead className="text-right">Einheit</TableHead>
                    <TableHead className="text-right">Referenzwert</TableHead>
                    <TableHead className="text-right">% der Referenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mineralDefs.map((def) => {
                    const val = getNutrientValue(planNutrients, def.id)
                    const ref = getReferenceForNutrient(def.id, gender)
                    const pct = percentOfReference(val, ref)
                    return (
                      <TableRow key={def.id}>
                        <TableCell className="font-medium">{def.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(val, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">{def.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(ref, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(pct)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
