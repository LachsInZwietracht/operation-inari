import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
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
import { NutrientBar } from "@/components/nutrient-bar"
import { MacroRingChart } from "@/components/macro-ring-chart"
import { FOODS, FOOD_CATEGORIES, NUTRIENT_DEFINITIONS, REFERENCE_VALUES } from "@/lib/mock-data"
import { getNutrientValue } from "@/lib/nutrients"
import { formatNumber, formatNutrient } from "@/lib/format"
import { NUTRIENT_GROUP_LABELS } from "@/lib/constants"
import type { NutrientGroup } from "@/lib/types"

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]))

function getReferenceValue(nutrientId: string, gender: "m" | "w" = "m"): number {
  return REFERENCE_VALUES.find(
    (rv) => rv.nutrientId === nutrientId && rv.gender === gender
  )?.amount ?? 0
}

function getNutrientsByGroup(group: NutrientGroup) {
  return NUTRIENT_DEFINITIONS
    .filter((nd) => nd.group === group)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const SUMMARY_NUTRIENTS = [
  { id: "energie", label: "Energie", unit: "kcal" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
] as const

interface NutrientTabContentProps {
  group: NutrientGroup
  nutrients: { nutrientId: string; amount: number }[]
}

function NutrientTabContent({ group, nutrients }: NutrientTabContentProps) {
  const definitions = getNutrientsByGroup(group)

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nährstoff</TableHead>
            <TableHead className="text-right">Menge</TableHead>
            <TableHead className="text-right">Referenz (DGE)</TableHead>
            <TableHead className="w-[200px]">Anteil</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.map((def) => {
            const value = getNutrientValue(nutrients, def.id)
            const ref = getReferenceValue(def.id)

            return (
              <TableRow key={def.id}>
                <TableCell className="font-medium">{def.name}</TableCell>
                <TableCell className="text-right">
                  {formatNutrient(value, def.unit)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {ref > 0 ? formatNutrient(ref, def.unit) : "–"}
                </TableCell>
                <TableCell>
                  {ref > 0 ? (
                    <NutrientBar
                      label=""
                      value={value}
                      unit={def.unit}
                      referenceValue={ref}
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">–</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function LebensmittelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const food = FOODS.find((f) => f.id === id)

  if (!food) {
    notFound()
  }

  const categoryName = categoryMap.get(food.categoryId) ?? food.categoryId

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/lebensmittel"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>
      </div>

      <PageHeader title={food.name}>
        <Badge variant="secondary">{categoryName}</Badge>
      </PageHeader>

      <p className="text-muted-foreground text-sm">
        Nährwerte pro {formatNumber(food.baseAmount)} g · Quelle: {food.source}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {SUMMARY_NUTRIENTS.map((sn) => {
          const value = getNutrientValue(food.nutrients, sn.id)
          return (
            <Card key={sn.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {sn.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatNumber(value, sn.id === "energie" ? 0 : 1)}
                </p>
                <p className="text-muted-foreground text-xs">{sn.unit}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Macro Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Makronährstoff-Verteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <MacroRingChart nutrients={food.nutrients} />
        </CardContent>
      </Card>

      {/* Nutrient Tabs */}
      <Tabs defaultValue="makronaehrstoffe">
        <TabsList>
          {(Object.entries(NUTRIENT_GROUP_LABELS) as [NutrientGroup, string][]).map(
            ([group, label]) => (
              <TabsTrigger key={group} value={group}>
                {label}
              </TabsTrigger>
            )
          )}
        </TabsList>
        {(Object.keys(NUTRIENT_GROUP_LABELS) as NutrientGroup[]).map((group) => (
          <TabsContent key={group} value={group}>
            <NutrientTabContent group={group} nutrients={food.nutrients} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
