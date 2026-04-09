import Link from "next/link"
import { Apple, ChefHat, Flame, CalendarDays, Plus, Pencil, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MacroRingChart } from "@/components/macro-ring-chart"
import { FOODS, RECIPES, MEAL_PLANS } from "@/lib/mock-data"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatDate, formatNumber } from "@/lib/format"
import {
  calculateRecipeNutrients,
  calculatePerServing,
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
} from "@/lib/nutrients"
import type { NutrientValue, MealSlot, MealEntry } from "@/lib/types"

function calculateEntryNutrients(entry: MealEntry): NutrientValue[] {
  if (entry.type === "food") {
    const food = FOODS.find((f) => f.id === entry.referenceId)
    if (!food) return []
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
  }

  const recipe = RECIPES.find((r) => r.id === entry.referenceId)
  if (!recipe) return []
  const totalNutrients = calculateRecipeNutrients(recipe, FOODS)
  const perServing = calculatePerServing(totalNutrients, recipe.servings)
  return scaleNutrients(perServing, 1, entry.amount)
}

function calculateSlotNutrients(slot: MealSlot): NutrientValue[] {
  return sumNutrients(slot.entries.map(calculateEntryNutrients))
}

function getEntryName(entry: MealEntry): string {
  if (entry.type === "food") {
    const food = FOODS.find((f) => f.id === entry.referenceId)
    return food?.name ?? "Unbekannt"
  }
  const recipe = RECIPES.find((r) => r.id === entry.referenceId)
  return recipe?.name ?? "Unbekannt"
}

function getEntryDescription(entry: MealEntry): string {
  if (entry.type === "food") {
    return `${formatNumber(entry.amount, 0)} g`
  }
  return entry.amount === 1
    ? "1 Portion"
    : `${formatNumber(entry.amount, 0)} Portionen`
}

export default function DashboardPage() {
  const todayPlan = MEAL_PLANS[0]

  const allSlotNutrients = todayPlan.slots.map(calculateSlotNutrients)
  const totalNutrients = sumNutrients(allSlotNutrients)

  const totalKcal = getNutrientValue(totalNutrients, "energie")

  const metrics = [
    {
      title: "Lebensmittel",
      value: formatNumber(FOODS.length),
      description: "in der Datenbank",
      icon: Apple,
    },
    {
      title: "Rezepte",
      value: formatNumber(RECIPES.length),
      description: "verfügbar",
      icon: ChefHat,
    },
    {
      title: "Heutige Kalorien",
      value: `${formatNumber(totalKcal, 0)} kcal`,
      description: "geplante Aufnahme",
      icon: Flame,
    },
    {
      title: "Aktiver Plan",
      value: formatDate(todayPlan.date),
      description: "aktueller Ernährungsplan",
      icon: CalendarDays,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Übersicht über Ihre Ernährungsdaten"
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* Chart + Today's plan */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Makronährstoff-Verteilung</CardTitle>
          </CardHeader>
          <CardContent>
            <MacroRingChart nutrients={totalNutrients} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Heutiger Ernährungsplan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayPlan.slots.map((slot, slotIndex) => {
              const slotKcal = getNutrientValue(
                allSlotNutrients[slotIndex],
                "energie",
              )
              return (
                <div key={slot.type} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {MEAL_SLOT_LABELS[slot.type]}
                    </span>
                    <Badge variant="secondary">
                      {formatNumber(slotKcal, 0)} kcal
                    </Badge>
                  </div>
                  <ul className="text-muted-foreground space-y-0.5 text-sm">
                    {slot.entries.map((entry) => (
                      <li key={entry.id} className="flex justify-between">
                        <span>{getEntryName(entry)}</span>
                        <span className="text-xs">
                          {getEntryDescription(entry)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
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
    </div>
  )
}
