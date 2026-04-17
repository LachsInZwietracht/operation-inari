"use client"

import Link from "next/link"
import { Apple, ChefHat, CalendarDays, Plus, Pencil, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatNumber } from "@/lib/format"
import type { DailyMealPlan } from "@/lib/types"

interface DashboardMetricsClientProps {
  foodCount: number
  recipeCount: number
  todayPlan: DailyMealPlan | null
}

export function DashboardMetricsClient({ foodCount, recipeCount, todayPlan }: DashboardMetricsClientProps) {
  const metrics = [
    {
      title: "Lebensmittel",
      value: formatNumber(foodCount),
      description: "in der Datenbank",
      icon: Apple,
    },
    {
      title: "Rezepte",
      value: formatNumber(recipeCount),
      description: "verfügbar",
      icon: ChefHat,
    },
    {
      title: "Aktiver Plan",
      value: todayPlan ? formatDate(todayPlan.date) : "kein Plan",
      description: todayPlan ? "aktueller Ernährungsplan" : "kein Plan aktiv",
      icon: CalendarDays,
    },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Übersicht über Ihre Ernährungsdaten"
        helpText="Ihr persönliches Dashboard zeigt die wichtigsten Kennzahlen zu Patienten, Terminen und Ernährungsplänen auf einen Blick. Nutzen Sie die Kacheln als Schnelleinstieg in die jeweiligen Bereiche."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-muted-foreground text-xs">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/rezepte/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neues Rezept
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/ernaehrungsplan">
            <Pencil className="mr-2 h-4 w-4" />
            Plan bearbeiten
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/lebensmittel">
            <Search className="mr-2 h-4 w-4" />
            Lebensmittel suchen
          </Link>
        </Button>
      </div>
    </>
  )
}
