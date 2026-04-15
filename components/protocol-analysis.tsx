"use client"

import { useMemo } from "react"
import { subYears } from "date-fns"
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NutrientBar } from "@/components/nutrient-bar"
import { NutrientChart, type NutrientChartDataPoint } from "@/components/nutrient-chart"
import { ReferenceProfileSelector } from "@/components/reference-profile-selector"
import {
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
} from "@/lib/nutrients"
import {
  resolveReferenceForPatient,
  getReferenceAmount,
} from "@/lib/reference-values"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import {
  ASSESSMENT_METHOD_LABELS,
  MEAL_SLOT_LABELS,
  PROTOCOL_TYPE_LABELS,
} from "@/lib/constants"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import type {
  Gender,
  MealSlotType,
  NutritionProtocol,
  ResolvedReferenceConfig,
} from "@/lib/types"
import { useFoods } from "@/components/foods-provider"

interface ProtocolAnalysisProps {
  protocol: NutritionProtocol
  gender?: Gender
  dateOfBirth?: string
}
const MEAL_SLOTS: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

export function ProtocolAnalysis({ protocol, gender = "w", dateOfBirth }: ProtocolAnalysisProps) {
  const foods = useFoods()
  const { standardId, lifeStage } = useReferenceProfiles()
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const method = protocol.metadata?.assessmentMethod
  const methodLabel = method
    ? ASSESSMENT_METHOD_LABELS[method]
    : PROTOCOL_TYPE_LABELS[protocol.type]
  const derivedGender = protocol.metadata?.participantGender ?? gender
  const derivedDateOfBirth = useMemo(() => {
    if (protocol.metadata?.participantAge) {
      return subYears(new Date(), protocol.metadata.participantAge)
        .toISOString()
        .slice(0, 10)
    }
    return dateOfBirth
  }, [dateOfBirth, protocol.metadata?.participantAge])

  const refConfig = useMemo<ResolvedReferenceConfig>(() => {
    return resolveReferenceForPatient({
      standardId,
      dateOfBirth: derivedDateOfBirth ?? "1990-01-01",
      gender: derivedGender,
      lifeStage,
    })
  }, [derivedDateOfBirth, derivedGender, lifeStage, standardId])

  const averageNutrients = useMemo(() => {
    if (protocol.days.length === 0) return []

    const allDayNutrients = protocol.days.map((day) =>
      sumNutrients(
        day.entries.map((entry) => {
          const food = foodMap.get(entry.foodId)
          if (!food) return []
          return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
        }),
      ),
    )

    const total = sumNutrients(allDayNutrients)
    const numDays = protocol.days.length
    return total.map((nv) => ({
      nutrientId: nv.nutrientId,
      amount: nv.amount / numDays,
    }))
  }, [protocol, foodMap])

  const macroIds = ["eiweiss", "fett", "kohlenhydrate", "ballaststoffe"]
  const macroChartData: NutrientChartDataPoint[] = macroIds.map((id) => {
    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
    return {
      name: def.name,
      value: getNutrientValue(averageNutrients, id),
      reference: getReferenceAmount(refConfig, id),
      unit: def.unit,
    }
  })

  const vitaminDefs = NUTRIENT_DEFINITIONS.filter((d) => d.group === "vitamine").sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const mineralDefs = NUTRIENT_DEFINITIONS.filter((d) => d.group === "mineralstoffe").sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const avgKcal = getNutrientValue(averageNutrients, "energie")
  const refKcal = getReferenceAmount(refConfig, "energie")
  const documentedDays = protocol.metadata?.documentedDays ?? protocol.days.length

  const dailyEnergy = useMemo(
    () =>
      protocol.days.map((day) => {
        const dayKcal = day.entries.reduce((sum, entry) => {
          const food = foodMap.get(entry.foodId)
          if (!food) return sum
          const nutrients = scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
          return sum + getNutrientValue(nutrients, "energie")
        }, 0)
        return {
          date: day.date,
          value: dayKcal,
        }
      }),
    [protocol.days, foodMap],
  )

  const energyStats = useMemo(() => {
    if (!dailyEnergy.length) return null
    const values = dailyEnergy.map((item) => item.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    return { min, max, avg, range: max - min }
  }, [dailyEnergy])

  const mealDistribution = useMemo(() => {
    const totals = new Map<MealSlotType, number>()
    MEAL_SLOTS.forEach((slot) => totals.set(slot, 0))
    protocol.days.forEach((day) => {
      day.entries.forEach((entry) => {
        const food = foodMap.get(entry.foodId)
        if (!food) return
        const nutrients = scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
        const entryKcal = getNutrientValue(nutrients, "energie")
        totals.set(entry.mealSlot, (totals.get(entry.mealSlot) ?? 0) + entryKcal)
      })
    })
    const totalEnergy = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)
    return MEAL_SLOTS.map((slot) => ({
      slot,
      value: totals.get(slot) ?? 0,
      percentage: totalEnergy ? Math.round(((totals.get(slot) ?? 0) / totalEnergy) * 100) : 0,
    }))
  }, [protocol.days, foodMap])

  const totalEntries = protocol.days.reduce((sum, day) => sum + day.entries.length, 0)
  const householdEntries = protocol.days.reduce(
    (sum, day) =>
      sum +
      day.entries.filter((entry) => entry.householdMeasurement || entry.measurementMode === "household")
        .length,
    0,
  )
  const measurementShare = totalEntries ? Math.round((householdEntries / totalEntries) * 100) : 0

  const weekendDays = protocol.days.filter((day) => {
    try {
      const jsDate = new Date(day.date)
      const weekday = jsDate.getDay()
      return weekday === 0 || weekday === 6
    } catch {
      return false
    }
  }).length

  const uniqueFoods = new Set(protocol.days.flatMap((day) => day.entries.map((entry) => entry.foodId)))
  const uniqueFoodGroups = new Set(
    protocol.days.flatMap((day) =>
      day.entries.map((entry) => foodMap.get(entry.foodId)?.foodGroupId).filter(Boolean),
    ),
  )

  function isPlantBasedFood(foodId: string) {
    const food = foodMap.get(foodId)
    if (!food) return false
    const id = food.id.toLowerCase()
    const animalHints = ["haehnchen", "puten", "rinder", "schwein", "lachs", "thunfisch", "kabeljau", "gouda", "butter", "joghurt", "milch", "ei", "magerquark"]
    if (animalHints.some((keyword) => id.includes(keyword))) return false
    const plantHints = ["gemuese", "obst", "linsen", "kicher", "quinoa", "edamame", "pakchoi", "kidney", "mandel", "walnuss", "sfg", "hafer"]
    if (plantHints.some((keyword) => id.includes(keyword))) return true
    return !id.includes("fisch") && !id.includes("fleisch")
  }

  const plantEntries = protocol.days.reduce(
    (sum, day) => sum + day.entries.filter((entry) => isPlantBasedFood(entry.foodId)).length,
    0,
  )
  const plantShare = totalEntries ? Math.round((plantEntries / totalEntries) * 100) : 0

  const earliestTime = useMemo(() => {
    const minutes = protocol.days
      .flatMap((day) => day.entries.map((entry) => entry.time))
      .filter((time): time is string => Boolean(time))
      .map((time) => {
        const [hh, mm] = time.split(":").map(Number)
        return hh * 60 + mm
      })
    if (!minutes.length) return null
    const min = Math.min(...minutes)
    const hours = String(Math.floor(min / 60)).padStart(2, "0")
    const mins = String(min % 60).padStart(2, "0")
    return `${hours}:${mins}`
  }, [protocol.days])

  const latestTime = useMemo(() => {
    const minutes = protocol.days
      .flatMap((day) => day.entries.map((entry) => entry.time))
      .filter((time): time is string => Boolean(time))
      .map((time) => {
        const [hh, mm] = time.split(":").map(Number)
        return hh * 60 + mm
      })
    if (!minutes.length) return null
    const max = Math.max(...minutes)
    const hours = String(Math.floor(max / 60)).padStart(2, "0")
    const mins = String(max % 60).padStart(2, "0")
    return `${hours}:${mins}`
  }, [protocol.days])

  const nutrientHotspots = useMemo(() => {
    const trackedIds = [
      "eiweiss",
      "ballaststoffe",
      "vitamin_c",
      "calcium",
      "eisen",
      "vitamin_b12",
    ]
    const entries = trackedIds
      .map((id) => {
        const def = NUTRIENT_DEFINITIONS.find((nutrient) => nutrient.id === id)
        if (!def) return null
        const value = getNutrientValue(averageNutrients, id)
        const ref = getReferenceAmount(refConfig, id)
        if (!ref) return null
        const ratio = value / ref
        return { id, label: def.name, ratio, value, ref }
      })
      .filter(Boolean) as Array<{ id: string; label: string; ratio: number; value: number; ref: number }>

    return entries
      .filter((entry) => entry.ratio < 0.85 || entry.ratio > 1.15)
      .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1))
      .slice(0, 3)
  }, [averageNutrients, refConfig])

  const methodInsights = useMemo(() => {
    const insights: { title: string; detail: string; tone?: "default" | "warning" }[] = []
    if (!protocol.days.length) return insights
    if (method === "24h_recall") {
      if (earliestTime && latestTime) {
        insights.push({
          title: "Erfasster Tageskorridor",
          detail: `${earliestTime} – ${latestTime}`,
        })
      }
      if (energyStats) {
        insights.push({
          title: "Varianz Energie",
          detail: `${Math.round(energyStats.range)} kcal Differenz`,
        })
      }
    } else if (method === "ffq") {
      insights.push({ title: "Erfasste Lebensmittel", detail: `${uniqueFoods.size} Varianten` })
      insights.push({
        title: "Lebensmittelgruppen",
        detail: `${uniqueFoodGroups.size} Gruppen abgedeckt`,
      })
    } else if (method === "diet_diary") {
      insights.push({
        title: "Wochenenden",
        detail: weekendDays > 0 ? `${weekendDays} Wochenende(n) enthalten` : "Nur Werktage",
        tone: weekendDays === 0 ? "warning" : "default",
      })
      if (energyStats) {
        insights.push({
          title: "Durchschnitt pro Tag",
          detail: `${Math.round(energyStats.avg)} kcal`,
        })
      }
    } else if (method === "household") {
      insights.push({
        title: "Haushaltsmaße",
        detail: `${measurementShare}% der Einträge`,
      })
      insights.push({
        title: "Schnellerfassung",
        detail: `${totalEntries} Einträge über ${protocol.days.length} Tage`,
      })
    } else if (method === "vegetarian" || method === "vegan") {
      insights.push({ title: "Pflanzenanteil", detail: `${plantShare}% aller Einträge` })
      if (nutrientHotspots.length === 0) {
        insights.push({ title: "Nährstoff-Hotspots", detail: "Keine Auffälligkeiten" })
      }
    } else if (method === "freiburg") {
      insights.push({
        title: "Formularabdeckung",
        detail: `${protocol.days.length} Tage im DIN-A4 Layout`,
      })
      insights.push({
        title: "Zeitschiene",
        detail: earliestTime && latestTime ? `${earliestTime} – ${latestTime}` : "Keine Zeiten",
      })
    }

    if (!insights.length && energyStats) {
      insights.push({ title: "Ø Energie", detail: `${Math.round(energyStats.avg)} kcal` })
    }

    return insights
  }, [
    method,
    earliestTime,
    energyStats,
    measurementShare,
    nutrientHotspots,
    plantShare,
    protocol.days.length,
    totalEntries,
    uniqueFoodGroups.size,
    uniqueFoods.size,
    weekendDays,
    latestTime,
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Durchschnittliche Nährstoffzufuhr ({protocol.days.length} Tage)
            </CardTitle>
            <ReferenceProfileSelector
              dateOfBirth={derivedDateOfBirth}
              gender={derivedGender}
              compact
            />
          </div>
        </CardHeader>
        <CardContent>
          <NutrientBar
            label="Energie"
            value={avgKcal}
            unit="kcal"
            referenceValue={refKcal}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dokumentationsprofil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Methode</p>
              <Badge variant="secondary" className="mt-1">
                {methodLabel}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Dokumentierte Tage</p>
                <p className="font-semibold">{documentedDays}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wochenenden</p>
                <p className="font-semibold">
                  {weekendDays > 0 ? `${weekendDays}` : "0"}
                  <span className="text-xs text-muted-foreground"> {weekendDays > 0 ? "enthalten" : "–"}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Haushaltsmaße</p>
                <p className="font-semibold">{measurementShare}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pflanzenanteil</p>
                <p className="font-semibold">{plantShare}%</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Erfasste Lebensmittel</p>
              <p className="font-semibold">{uniqueFoods.size}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tagesenergie-Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {dailyEnergy.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyEnergy} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${Math.round(value)} kcal`} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Einträge vorhanden.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mahlzeitenverteilung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mealDistribution.map((item) => (
              <div key={item.slot}>
                <div className="flex items-center justify-between text-xs">
                  <span>{MEAL_SLOT_LABELS[item.slot]}</span>
                  <span>{item.percentage}%</span>
                </div>
                <Progress value={item.percentage} className="mt-1" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Methodische Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {methodInsights.length > 0 ? (
              methodInsights.map((insight) => (
                <div key={insight.title} className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold">{insight.title}</p>
                  <p
                    className={
                      insight.tone === "warning" ? "text-amber-600" : "text-muted-foreground"
                    }
                  >
                    {insight.detail}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">Keine zusätzlichen Hinweise.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nährstoff-Hotspots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {nutrientHotspots.length > 0 ? (
              nutrientHotspots.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3">
                  <p className="font-semibold">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(entry.value)} {NUTRIENT_DEFINITIONS.find((d) => d.id === entry.id)?.unit} · {Math.round(entry.ratio * 100)}% des Referenzwerts
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">Alle überwachten Nährstoffe liegen im Zielbereich.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="makro">
        <TabsList>
          <TabsTrigger value="makro">Makronährstoffe</TabsTrigger>
          <TabsTrigger value="vitamine">Vitamine</TabsTrigger>
          <TabsTrigger value="mineralstoffe">Mineralstoffe</TabsTrigger>
        </TabsList>

        <TabsContent value="makro" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Makronährstoffe – Ist vs. Referenz</CardTitle>
            </CardHeader>
            <CardContent>
              <NutrientChart data={macroChartData} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              {macroIds.map((id) => {
                const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
                const value = getNutrientValue(averageNutrients, id)
                const ref = getReferenceAmount(refConfig, id)
                return (
                  <NutrientBar
                    key={id}
                    label={def.name}
                    value={value}
                    unit={def.unit}
                    referenceValue={ref}
                  />
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitamine" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {vitaminDefs.map((def) => {
                const value = getNutrientValue(averageNutrients, def.id)
                const ref = getReferenceAmount(refConfig, def.id)
                return (
                  <NutrientBar
                    key={def.id}
                    label={def.name}
                    value={value}
                    unit={def.unit}
                    referenceValue={ref}
                  />
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mineralstoffe" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {mineralDefs.map((def) => {
                const value = getNutrientValue(averageNutrients, def.id)
                const ref = getReferenceAmount(refConfig, def.id)
                return (
                  <NutrientBar
                    key={def.id}
                    label={def.name}
                    value={value}
                    unit={def.unit}
                    referenceValue={ref}
                  />
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
