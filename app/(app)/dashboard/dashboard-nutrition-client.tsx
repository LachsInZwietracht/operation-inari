"use client"

import { useMemo } from "react"
import { Flame } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MacroRingChart } from "@/components/macro-ring-chart"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatNumber } from "@/lib/format"
import {
  calculateRecipeNutrients,
  calculatePerServing,
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
} from "@/lib/nutrients"
import type {
  NutrientValue,
  MealSlot,
  MealEntry,
  Recipe,
  DailyMealPlan,
  MealSlotType,
} from "@/lib/types"
import { useFoods } from "@/components/foods-provider"
import { createRecipeLookup } from "@/lib/recipes"

const SLOT_TYPES = Object.keys(MEAL_SLOT_LABELS) as MealSlotType[]

interface DashboardNutritionClientProps {
  recipes: Recipe[]
  mealPlans: DailyMealPlan[]
}

export function DashboardNutritionClient({ recipes, mealPlans }: DashboardNutritionClientProps) {
  const foods = useFoods()
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes])

  const calculateEntryNutrients = (entry: MealEntry): NutrientValue[] => {
    if (entry.type === "food") {
      const food = foodMap.get(entry.referenceId)
      if (!food) return []
      return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
    }

    const recipe = recipeMap.get(entry.referenceId)
    if (!recipe) return []
    const totalNutrients = calculateRecipeNutrients(recipe, foods)
    const perServing = calculatePerServing(totalNutrients, recipe.servings)
    return scaleNutrients(perServing, 1, entry.amount)
  }

  const calculateSlotNutrients = (slot: MealSlot): NutrientValue[] => {
    return sumNutrients(slot.entries.map(calculateEntryNutrients))
  }

  const getEntryName = (entry: MealEntry): string => {
    if (entry.type === "food") {
      const food = foodMap.get(entry.referenceId)
      return food?.name ?? "Unbekannt"
    }
    const recipe = recipeMap.get(entry.referenceId)
    return recipe?.name ?? "Unbekannt"
  }

  const getEntryDescription = (entry: MealEntry): string => {
    if (entry.type === "food") {
      return `${formatNumber(entry.amount, 0)} g`
    }
    return entry.amount === 1 ? "1 Portion" : `${formatNumber(entry.amount, 0)} Portionen`
  }

  const todayPlan = mealPlans[0]
  const planSlots: MealSlot[] = todayPlan
    ? todayPlan.slots
    : SLOT_TYPES.map((type) => ({ type, entries: [] }))

  const allSlotNutrients = planSlots.map(calculateSlotNutrients)
  const totalNutrients = sumNutrients(allSlotNutrients)
  const totalKcal = getNutrientValue(totalNutrients, "energie")

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Heutige Kalorien</CardTitle>
          <Flame className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(totalKcal, 0)} kcal</div>
          <p className="text-muted-foreground text-xs">geplante Aufnahme</p>
        </CardContent>
      </Card>

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
            {planSlots.map((slot, slotIndex) => {
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
    </>
  )
}
