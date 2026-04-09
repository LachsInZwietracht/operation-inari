"use client"

import { useState, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { MealSlotCard } from "@/components/meal-slot"
import { NutrientBar } from "@/components/nutrient-bar"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { useMealPlan } from "@/hooks/use-meal-plan"
import { FOODS, RECIPES, REFERENCE_VALUES, NUTRIENT_DEFINITIONS } from "@/lib/mock-data"
import {
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
  calculateRecipeNutrients,
  calculatePerServing,
} from "@/lib/nutrients"
import { formatNumber, formatNutrient } from "@/lib/format"
import type { MealSlotType, MealEntry, NutrientValue } from "@/lib/types"

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

const KEY_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "vitamin_c",
  "vitamin_d",
  "calcium",
  "eisen",
  "magnesium",
]

export default function ErnaehrungsplanPage() {
  const {
    currentDate,
    currentPlan,
    addEntry,
    removeEntry,
    updateEntryAmount,
    setDate,
    goToNextDay,
    goToPreviousDay,
  } = useMealPlan()

  const [commandOpen, setCommandOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState<MealSlotType>("fruehstueck")
  const [calendarOpen, setCalendarOpen] = useState(false)

  const parsedDate = parseISO(currentDate)
  const formattedDate = format(parsedDate, "EEEE, d. MMMM yyyy", { locale: de })

  const handleAddEntry = (slotType: MealSlotType) => {
    setActiveSlot(slotType)
    setCommandOpen(true)
  }

  const handleSelectFood = (foodId: string) => {
    addEntry(activeSlot, { type: "food", referenceId: foodId, amount: 100 })
    setCommandOpen(false)
  }

  const handleSelectRecipe = (recipeId: string) => {
    addEntry(activeSlot, { type: "recipe", referenceId: recipeId, amount: 1 })
    setCommandOpen(false)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setDate(format(date, "yyyy-MM-dd"))
      setCalendarOpen(false)
    }
  }

  // Calculate daily totals
  const dailyNutrients = useMemo(() => {
    const allEntryNutrients: NutrientValue[][] = []
    for (const slot of currentPlan.slots) {
      for (const entry of slot.entries) {
        allEntryNutrients.push(calculateEntryNutrients(entry))
      }
    }
    return sumNutrients(allEntryNutrients)
  }, [currentPlan])

  const totalKcal = getNutrientValue(dailyNutrients, "energie")
  const totalProtein = getNutrientValue(dailyNutrients, "eiweiss")
  const totalFat = getNutrientValue(dailyNutrients, "fett")
  const totalCarbs = getNutrientValue(dailyNutrients, "kohlenhydrate")

  // Reference values (default male)
  const referenceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const ref of REFERENCE_VALUES) {
      if (ref.gender === "m") {
        map.set(ref.nutrientId, ref.amount)
      }
    }
    return map
  }, [])

  const nutrientDefMap = useMemo(() => {
    return new Map(NUTRIENT_DEFINITIONS.map((nd) => [nd.id, nd]))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ernährungsplan"
        description={formattedDate}
      />

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Vorheriger Tag</span>
        </Button>

        <div className="text-sm font-medium capitalize">{formattedDate}</div>

        <Button variant="outline" size="icon" onClick={goToNextDay}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Nächster Tag</span>
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Datum wählen</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedDate}
              onSelect={handleDateSelect}
              locale={de}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Meal slots */}
        <div className="space-y-4">
          {currentPlan.slots.map((slot) => (
            <MealSlotCard
              key={slot.type}
              slot={slot}
              onAddEntry={handleAddEntry}
              onRemoveEntry={removeEntry}
              onUpdateAmount={updateEntryAmount}
            />
          ))}
        </div>

        {/* Daily summary sidebar */}
        <div className="space-y-4">
          {/* Macro summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tagesübersicht</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/30">
                  <p className="text-muted-foreground text-xs">Energie</p>
                  <p className="text-lg font-bold">{formatNumber(Math.round(totalKcal))} kcal</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                  <p className="text-muted-foreground text-xs">Eiweiß</p>
                  <p className="text-lg font-bold">{formatNutrient(totalProtein, "g")}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/30">
                  <p className="text-muted-foreground text-xs">Fett</p>
                  <p className="text-lg font-bold">{formatNutrient(totalFat, "g")}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                  <p className="text-muted-foreground text-xs">Kohlenhydrate</p>
                  <p className="text-lg font-bold">{formatNutrient(totalCarbs, "g")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nutrient bars vs reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nährstoffe vs. DGE-Referenz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {KEY_NUTRIENT_IDS.map((nutrientId) => {
                const def = nutrientDefMap.get(nutrientId)
                if (!def) return null
                const value = getNutrientValue(dailyNutrients, nutrientId)
                const refValue = referenceMap.get(nutrientId) ?? 0

                return (
                  <NutrientBar
                    key={nutrientId}
                    label={def.shortName}
                    value={value}
                    unit={def.unit}
                    referenceValue={refValue}
                  />
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Food/Recipe search dialog */}
      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Lebensmittel oder Rezept hinzufügen"
        description="Suche nach einem Lebensmittel oder Rezept."
      >
        <CommandInput placeholder="Suchen..." />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {FOODS.map((food) => (
              <CommandItem
                key={food.id}
                value={food.name}
                onSelect={() => handleSelectFood(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {formatNumber(Math.round(getNutrientValue(food.nutrients, "energie")))} kcal / 100g
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <Separator />
          <CommandGroup heading="Rezepte">
            {RECIPES.map((recipe) => (
              <CommandItem
                key={recipe.id}
                value={recipe.name}
                onSelect={() => handleSelectRecipe(recipe.id)}
              >
                <span>{recipe.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}
