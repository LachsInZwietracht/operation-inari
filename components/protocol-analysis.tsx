"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NutrientBar } from "@/components/nutrient-bar"
import { NutrientChart, type NutrientChartDataPoint } from "@/components/nutrient-chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
} from "@/lib/nutrients"
import { FOODS, NUTRIENT_DEFINITIONS, REFERENCE_VALUES } from "@/lib/mock-data"
import type { NutritionProtocol, Gender } from "@/lib/types"

interface ProtocolAnalysisProps {
  protocol: NutritionProtocol
  gender?: Gender
}

const foodMap = new Map(FOODS.map((f) => [f.id, f]))

function getReferenceForNutrient(nutrientId: string, gender: "m" | "w"): number {
  return REFERENCE_VALUES.find((r) => r.nutrientId === nutrientId && r.gender === gender)?.amount ?? 0
}

export function ProtocolAnalysis({ protocol, gender = "w" }: ProtocolAnalysisProps) {
  const refGender = gender === "d" ? "w" : gender

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
  }, [protocol])

  const macroIds = ["eiweiss", "fett", "kohlenhydrate", "ballaststoffe"]
  const macroChartData: NutrientChartDataPoint[] = macroIds.map((id) => {
    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
    return {
      name: def.name,
      value: getNutrientValue(averageNutrients, id),
      reference: getReferenceForNutrient(id, refGender),
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
  const refKcal = getReferenceForNutrient("energie", refGender)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Durchschnittliche Nährstoffzufuhr ({protocol.days.length} Tage)
          </CardTitle>
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
                const ref = getReferenceForNutrient(id, refGender)
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
                const ref = getReferenceForNutrient(def.id, refGender)
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
                const ref = getReferenceForNutrient(def.id, refGender)
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
