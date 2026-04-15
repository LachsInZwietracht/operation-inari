"use client"

import { useCallback, useMemo, useState } from "react"
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  startOfWeek,
} from "date-fns"
import { de } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Printer,
  ChefHat,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  MealSlotCard,
  MEAL_PLAN_DRAG_ID,
  MEAL_PLAN_DRAG_TYPE,
} from "@/components/meal-slot"
import { NutrientBar } from "@/components/nutrient-bar"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMealPlan } from "@/hooks/use-meal-plan"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { DIET_LINES } from "@/lib/mock-data"
import {
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
  calculateRecipeNutrients,
  calculatePerServing,
} from "@/lib/nutrients"
import { formatNumber, formatNutrient } from "@/lib/format"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type {
  MealSlotType,
  MealEntry,
  NutrientValue,
  DailyMealPlan,
  Food,
  Recipe,
} from "@/lib/types"
import { calculateProdScore } from "@/lib/prodi-score"
import { evaluatePlanSustainability } from "@/lib/sustainability"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import { resolveReferenceForPatient } from "@/lib/reference-values"
import { useFoods } from "@/components/foods-provider"
import { createRecipeLookup } from "@/lib/recipes"
import { useNutrientValues } from "@/hooks/use-nutrient-values"

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

function calculateEntryNutrients(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  foods: Food[],
  recipeMap: Map<string, Recipe>,
): NutrientValue[] {
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

function getEntryLabel(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId)
    if (!food) return "Lebensmittel"
    return `${food.name} (${formatNumber(entry.amount, 0)} g)`
  }
  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return "Rezept"
  const portions = entry.amount === 1 ? "Portion" : "Portionen"
  return `${recipe.name} (${formatNumber(entry.amount, 0)} ${portions})`
}

function complianceBadge(value: number, min?: number, max?: number): "ok" | "low" | "high" {
  if (typeof min === "number" && value < min) return "low"
  if (typeof max === "number" && value > max) return "high"
  return "ok"
}

interface ErnaehrungsplanPageClientProps {
  recipes: Recipe[]
  initialPlans: DailyMealPlan[]
}

export function ErnaehrungsplanPageClient({ recipes, initialPlans }: ErnaehrungsplanPageClientProps) {
  const foods = useFoods()
  const {
    currentDate,
    currentPlan,
    getPlansInRange,
    addEntry,
    removeEntry,
    updateEntryAmount,
    setDate,
    goToNextDay,
    goToPreviousDay,
  } = useMealPlan(initialPlans, foods)

  const [commandOpen, setCommandOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState<MealSlotType>("fruehstueck")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [view, setView] = useState("day")
  const [paletteSlot, setPaletteSlot] = useState<MealSlotType>("mittagessen")
  const [recipeSearch, setRecipeSearch] = useState("")
  const [dietLineId, setDietLineId] = useState(DIET_LINES[0]?.id ?? "")
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false)
  const [exchangeSlot, setExchangeSlot] = useState<MealSlotType | null>(null)
  const [exchangeSearch, setExchangeSearch] = useState("")
  const [exchangeCategory, setExchangeCategory] = useState<string>("alle")
  const [exchangeNutrient, setExchangeNutrient] = useState("energie")
  const {
    values: exchangeNutrientValues,
    isLoading: exchangeNutrientLoading,
    error: exchangeNutrientError,
  } = useNutrientValues(exchangeNutrient, foods)
  const [weekOffset, setWeekOffset] = useState(0)
  const [cycleOffset, setCycleOffset] = useState(0)

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods])
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes])

  const aggregatePlanNutrients = useCallback(
    (plan: DailyMealPlan): NutrientValue[] =>
      sumNutrients(
        plan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      ),
    [foodMap, foods, recipeMap],
  )

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

  const handleDropPayload = (slotType: MealSlotType, payload: { type: MealEntry["type"]; referenceId: string }) => {
    if (payload.type === "recipe") {
      addEntry(slotType, { type: "recipe", referenceId: payload.referenceId, amount: 1 })
    } else {
      addEntry(slotType, { type: "food", referenceId: payload.referenceId, amount: 120 })
    }
  }

  const handleQuickAddRecipe = (recipeId: string) => {
    addEntry(paletteSlot, { type: "recipe", referenceId: recipeId, amount: 1 })
  }

  const handleOpenExchange = (slotType: MealSlotType) => {
    setExchangeSlot(slotType)
    setExchangeDialogOpen(true)
  }

  const handleSelectExchangeFood = (foodId: string) => {
    if (!exchangeSlot) return
    addEntry(exchangeSlot, { type: "food", referenceId: foodId, amount: 100 })
    setExchangeDialogOpen(false)
    setExchangeSlot(null)
  }

  const dietLine = useMemo(() => {
    return DIET_LINES.find((line) => line.id === dietLineId) ?? DIET_LINES[0]
  }, [dietLineId])

  const dailyNutrients = useMemo(() => {
    const allEntryNutrients: NutrientValue[][] = []
    for (const slot of currentPlan.slots) {
      for (const entry of slot.entries) {
        allEntryNutrients.push(calculateEntryNutrients(entry, foodMap, foods, recipeMap))
      }
    }
    return sumNutrients(allEntryNutrients)
  }, [currentPlan, foodMap, foods, recipeMap])

  const totalKcal = getNutrientValue(dailyNutrients, "energie")
  const totalProtein = getNutrientValue(dailyNutrients, "eiweiss")
  const totalFat = getNutrientValue(dailyNutrients, "fett")
  const totalCarbs = getNutrientValue(dailyNutrients, "kohlenhydrate")
  const planProdScore = useMemo(() => calculateProdScore(dailyNutrients), [dailyNutrients])
  const positivePlanDrivers = useMemo(
    () =>
      planProdScore.drivers
        .filter((driver) => driver.impact > 0)
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 2),
    [planProdScore],
  )
  const negativePlanDrivers = useMemo(
    () =>
      planProdScore.drivers
        .filter((driver) => driver.impact < 0)
        .sort((a, b) => a.impact - b.impact)
        .slice(0, 2),
    [planProdScore],
  )
  const planSustainability = useMemo(
    () => evaluatePlanSustainability(currentPlan, foods, recipes),
    [currentPlan, foods, recipes],
  )

  const { standardId, lifeStage } = useReferenceProfiles()
  const refConfig = useMemo(() => {
    return resolveReferenceForPatient({
      standardId,
      dateOfBirth: "1990-01-01",
      gender: "m",
      lifeStage,
    })
  }, [standardId, lifeStage])

  const referenceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of refConfig.values) {
      map.set(v.nutrientId, v.amount)
    }
    return map
  }, [refConfig.values])

  const nutrientDefMap = useMemo(() => {
    return new Map(NUTRIENT_DEFINITIONS.map((nd) => [nd.id, nd]))
  }, [])

  const slotCompliance = useMemo(() => {
    if (!dietLine) return {} as Record<MealSlotType, { label: string; status: "ok" | "low" | "high" }[]>
    const slotCount = currentPlan.slots.length || 1
    const map = {} as Record<MealSlotType, { label: string; status: "ok" | "low" | "high" }[]>

    for (const slot of currentPlan.slots) {
      const summed = sumNutrients(
        slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
      )
      map[slot.type] = dietLine.targets.map((target) => {
        const value = getNutrientValue(summed, target.nutrientId)
        const perSlotMin = typeof target.min === "number" ? target.min / slotCount : undefined
        const perSlotMax = typeof target.max === "number" ? target.max / slotCount : undefined
        return {
          label: target.label,
          status: complianceBadge(value, perSlotMin, perSlotMax),
        }
      })
    }

    return map
  }, [currentPlan.slots, dietLine, foodMap, foods, recipeMap])

  const filteredRecipes = useMemo(() => {
    const search = recipeSearch.toLowerCase()
    return recipes.filter((recipe) =>
      recipe.name.toLowerCase().includes(search) || recipe.tags?.some((tag) => tag.toLowerCase().includes(search)),
    )
  }, [recipeSearch, recipes])

  const filteredExchangeFoods = useMemo(() => {
    const query = exchangeSearch.toLowerCase()
    return foods
      .filter((food) => {
        const matchesSearch = !query || food.name.toLowerCase().includes(query)
        const matchesCategory = exchangeCategory === "alle" || food.categoryId === exchangeCategory
        return matchesSearch && matchesCategory
      })
      .sort((a, b) =>
        (exchangeNutrientValues.get(b.id) ?? 0) - (exchangeNutrientValues.get(a.id) ?? 0),
      )
  }, [exchangeCategory, exchangeNutrientValues, exchangeSearch, foods])

  const baseWeekStart = startOfWeek(parsedDate, { weekStartsOn: 1 })
  const computedWeekStart = addWeeks(baseWeekStart, weekOffset)
  const computedWeekStartIso = format(computedWeekStart, "yyyy-MM-dd")
  const weekPlans = useMemo(() => getPlansInRange(computedWeekStartIso, 7), [computedWeekStartIso, getPlansInRange])
  const weekRangeLabel = `${format(computedWeekStart, "d. MMM", { locale: de })} – ${format(
    addDays(computedWeekStart, 6),
    "d. MMM yyyy",
    { locale: de },
  )}`

  const cycleStart = addWeeks(baseWeekStart, cycleOffset * 4)
  const cycleStartIso = format(cycleStart, "yyyy-MM-dd")
  const cyclePlans = useMemo(() => getPlansInRange(cycleStartIso, 28), [cycleStartIso, getPlansInRange])
  const cycleEnd = addDays(cycleStart, 27)
  const cycleRangeLabel = `${format(cycleStart, "d. MMM", { locale: de })} – ${format(cycleEnd, "d. MMM yyyy", { locale: de })}`

  const weekSummaries = useMemo(() => {
    return weekPlans.map((plan) => ({ plan, totals: aggregatePlanNutrients(plan) }))
  }, [aggregatePlanNutrients, weekPlans])

  const teachingKitchenRows = useMemo(() => {
    return weekPlans.map((plan) => {
      const dateLabel = format(parseISO(plan.date), "EEE, dd.MM.", { locale: de })
      const lunch = plan.slots.find((slot) => slot.type === "mittagessen")
      const dinner = plan.slots.find((slot) => slot.type === "abendessen")
      return {
        dateLabel,
        lunch:
          lunch && lunch.entries[0]
            ? getEntryLabel(lunch.entries[0], foodMap, recipeMap)
            : "noch offen",
        dinner:
          dinner && dinner.entries[0]
            ? getEntryLabel(dinner.entries[0], foodMap, recipeMap)
            : "Snack-/Buffetplanung",
        kcal: formatNumber(Math.round(getNutrientValue(aggregatePlanNutrients(plan), "energie"))),
      }
    })
  }, [aggregatePlanNutrients, foodMap, recipeMap, weekPlans])

  const cycleWeekChunks = useMemo(() => {
    return Array.from({ length: 4 }, (_, index) => cyclePlans.slice(index * 7, index * 7 + 7))
  }, [cyclePlans])

  const cycleWeekStats = useMemo(() => {
    return cycleWeekChunks.map((days, index) => {
      const totalsPerDay = days.map((plan) => aggregatePlanNutrients(plan))
      const weeklyTotals = sumNutrients(totalsPerDay)
      const avgEnergy = getNutrientValue(weeklyTotals, "energie") / (days.length || 1)
      const avgProtein = getNutrientValue(weeklyTotals, "eiweiss") / (days.length || 1)
      const avgCarbs = getNutrientValue(weeklyTotals, "kohlenhydrate") / (days.length || 1)
      const highlights = Array.from(
        new Set(
          days
            .map((plan) => plan.slots.find((slot) => slot.type === "mittagessen")?.entries[0])
            .filter(Boolean)
            .map((entry) => getEntryLabel(entry as MealEntry, foodMap, recipeMap)),
        ),
      ).slice(0, 3)
      const energyTarget = dietLine?.targets.find((target) => target.nutrientId === "energie")
      const complianceState = complianceBadge(avgEnergy, energyTarget?.min, energyTarget?.max)
      return {
        weekLabel: `Woche ${index + 1}`,
        avgEnergy,
        avgProtein,
        avgCarbs,
        highlights,
        compliance: complianceState,
      }
    })
  }, [aggregatePlanNutrients, cycleWeekChunks, dietLine, foodMap, recipeMap])

  const dietLineCompliance = useMemo(() => {
    if (!dietLine)
      return [] as {
        nutrientId: string
        label: string
        status: "ok" | "low" | "high"
        value: number
        unit: string
        min?: number
        max?: number
      }[]

    return dietLine.targets.map((target) => {
      const value = getNutrientValue(dailyNutrients, target.nutrientId)
      return {
        nutrientId: target.nutrientId,
        label: target.label,
        status: complianceBadge(value, target.min, target.max),
        value,
        unit: target.unit,
        min: target.min,
        max: target.max,
      }
    })
  }, [dailyNutrients, dietLine])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ernährungsplan"
        description={`Steuerung für Tag, Woche oder Zyklus – aktuell ${formattedDate}`}
        helpText="Planen Sie Mahlzeiten für einzelne Tage, Wochen oder Zyklen. Der PRODIscore zeigt die Qualität der Planung an und vergleicht die Nährstoffzufuhr mit den DGE-Referenzwerten."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PRODIscore Tagesplan</CardTitle>
            <CardDescription>Qualität der heutigen Planung auf einen Blick.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Ø Score</p>
                <p className="text-3xl font-semibold">{formatNumber(planProdScore.score, 0)}</p>
                <p className="text-muted-foreground text-xs">{planProdScore.summary}</p>
              </div>
              <Badge className={`${planProdScore.badge.color} border-none px-3 py-1 text-xs font-bold`}>
                PRODIscore {planProdScore.badge.label}
              </Badge>
            </div>
            <Progress value={planProdScore.score} />
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              {positivePlanDrivers.map((driver) => (
                <div key={driver.id} className="rounded-md bg-emerald-50/70 p-2">
                  <p className="font-medium">{driver.label}</p>
                  <p className="text-muted-foreground">{driver.description}</p>
                </div>
              ))}
              {negativePlanDrivers.map((driver) => (
                <div key={driver.id} className="rounded-md bg-red-50/70 p-2">
                  <p className="font-medium">{driver.label}</p>
                  <p className="text-muted-foreground">{driver.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nachhaltigkeit</CardTitle>
            <CardDescription>CO₂-Fußabdruck & Top-Verursacher des Plans.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-semibold">
                  {formatNumber(planSustainability.totalCo2, 2)} kg CO₂e
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Pflanzlich</p>
                <p className="font-semibold">
                  {formatNumber(planSustainability.plantShare * 100, 0)}%
                </p>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Pflanzlich</span>
                <span>{formatNumber(planSustainability.plantShare * 100, 0)}%</span>
              </div>
              <Progress value={planSustainability.plantShare * 100} />
              <div className="mt-2 mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Tierisch</span>
                <span>{formatNumber(planSustainability.animalShare * 100, 0)}%</span>
              </div>
              <Progress value={planSustainability.animalShare * 100} className="bg-orange-100" />
            </div>
            <div className="space-y-1 text-xs">
              {planSustainability.topEmitters.slice(0, 3).map((emitter) => (
                <div key={emitter.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {MEAL_SLOT_LABELS[emitter.slot] ?? emitter.slot}
                    </Badge>
                    <span>{emitter.label}</span>
                  </div>
                  <span className="font-medium">
                    {formatNumber(emitter.co2, 2)} kg
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="day">Tag</TabsTrigger>
          <TabsTrigger value="week">Woche</TabsTrigger>
          <TabsTrigger value="cycle">4-Wochen-Zyklus</TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
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
                <Calendar mode="single" selected={parsedDate} onSelect={handleDateSelect} locale={de} />
              </PopoverContent>
            </Popover>
            <div className="ml-auto flex items-center gap-2">
              <Select value={dietLineId} onValueChange={setDietLineId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Diet-Line" />
                </SelectTrigger>
                <SelectContent>
                  {DIET_LINES.length === 0 && <SelectItem value="">Keine Vorgabe</SelectItem>}
                  {DIET_LINES.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              {currentPlan.slots.map((slot) => (
                <MealSlotCard
                  key={slot.type}
                  slot={slot}
                  onAddEntry={handleAddEntry}
                  onRemoveEntry={removeEntry}
                  onUpdateAmount={updateEntryAmount}
                  onDropPayload={handleDropPayload}
                  complianceIndicators={slotCompliance[slot.type]}
                  onOpenExchange={handleOpenExchange}
                  foods={foods}
                  recipes={recipes}
                />
              ))}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Diet-Line Vorgaben</CardTitle>
                  <CardDescription>{dietLine?.description ?? "Ziele setzen"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dietLineCompliance.map((target) => (
                    <div key={target.label} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{target.label}</p>
                        <p className="text-muted-foreground text-xs">
                          Ziel {target.min != null ? formatNumber(target.min, 0) : "–"}–
                          {target.max != null ? formatNumber(target.max, 0) : "–"} {target.unit}
                        </p>
                      </div>
                      <Badge
                        variant={target.status === "ok" ? "secondary" : "outline"}
                        className={
                          target.status === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : target.status === "low"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }
                      >
                        {formatNumber(target.value, 0)} {target.unit}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

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

              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base">Rezeptbibliothek (Drag & Drop)</CardTitle>
                  <CardDescription>
                    Ziehe Rezepte direkt in einen Slot oder füge sie per Klick hinzu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Rezepte durchsuchen..."
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                  <Select value={paletteSlot} onValueChange={(value) => setPaletteSlot(value as MealSlotType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Slot wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEAL_SLOT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ScrollArea className="h-[360px] pr-2">
                    <div className="space-y-2">
                      {filteredRecipes.map((recipe) => (
                        <div
                          key={recipe.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData(MEAL_PLAN_DRAG_TYPE, "recipe")
                            event.dataTransfer.setData(MEAL_PLAN_DRAG_ID, recipe.id)
                            event.dataTransfer.effectAllowed = "copy"
                          }}
                          className="cursor-grab rounded-lg border p-3 transition hover:bg-muted active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium leading-tight">{recipe.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {(recipe.tags ?? []).slice(0, 2).join(", ") || recipe.category}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleQuickAddRecipe(recipe.id)}>
                              In {MEAL_SLOT_LABELS[paletteSlot]}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filteredRecipes.length === 0 && (
                        <p className="text-muted-foreground text-sm">Keine passenden Rezepte gefunden.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Vorherige Woche</span>
            </Button>
            <div className="text-sm font-medium">{weekRangeLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((prev) => prev + 1)}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Nächste Woche</span>
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              Bezug: {dietLine?.name ?? "Diet-Line auswählen"}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_1fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {weekSummaries.map(({ plan, totals }) => (
                  <Card key={plan.date}>
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-base">
                        {format(parseISO(plan.date), "EEE, dd.MM.", { locale: de })}
                      </CardTitle>
                      <CardDescription>
                        {formatNumber(Math.round(getNutrientValue(totals, "energie")))} kcal ·{' '}
                        {formatNumber(getNutrientValue(totals, "eiweiss"), 0)} g Eiweiß
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-sm">
                      {plan.slots.map((slot) => (
                        <div key={slot.type} className="flex items-start justify-between gap-2">
                          <span className="font-medium text-muted-foreground">
                            {MEAL_SLOT_LABELS[slot.type]}
                          </span>
                          <span className="text-right">
                            {slot.entries.length > 0
                              ? slot.entries
                                  .map((entry) =>
                                    getEntryLabel(entry, foodMap, recipeMap).split("(")[0]?.trim(),
                                  )
                                  .slice(0, 2)
                                  .join(", ")
                              : "–"}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Wöchentliche Kennzahlen</CardTitle>
                  <CardDescription>Vergleich mit {dietLine?.name ?? "Diet-Line"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dietLineCompliance.map((target) => {
                    const weekTotal = weekSummaries.reduce(
                      (sum, { totals }) => sum + getNutrientValue(totals, target.nutrientId),
                      0,
                    )
                    const divisor = weekSummaries.length || 1
                    const weekAvg = weekTotal / divisor
                    return (
                      <div key={target.label} className="flex items-center justify-between">
                        <span>{target.label}</span>
                        <span className="text-right">
                          {formatNumber(weekAvg, 0)} {target.unit}
                        </span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Lehrküchenplan</CardTitle>
                    <CardDescription>Preview für Aushänge & Druck</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.print()
                      }
                    }}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Druckvorschau
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tag</TableHead>
                        <TableHead>Mittag</TableHead>
                        <TableHead>Abend</TableHead>
                        <TableHead className="text-right">kcal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachingKitchenRows.map((row) => (
                        <TableRow key={row.dateLabel}>
                          <TableCell className="font-medium">{row.dateLabel}</TableCell>
                          <TableCell>{row.lunch}</TableCell>
                          <TableCell>{row.dinner}</TableCell>
                          <TableCell className="text-right">{row.kcal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Exchange-Listen Notizen</CardTitle>
                  <CardDescription>Markierte Lebensmittel aus Austauschlisten</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Kombiniere Snack-Slots mit ballaststoffreichen Optionen aus den Austauschlisten.
                  Tippe auf einen Slot im Tagesmodus, um Alternativen einzufügen.
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cycle" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCycleOffset((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Vorheriger Zyklus</span>
            </Button>
            <div className="text-sm font-medium">{cycleRangeLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setCycleOffset((prev) => prev + 1)}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Nächster Zyklus</span>
            </Button>
            <Badge variant="secondary" className="ml-auto">
              {dietLine?.name ?? "Diet-Line"}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wochensummen & Zielerreichung</CardTitle>
                <CardDescription>Durchschnittswerte pro Woche</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Woche</TableHead>
                      <TableHead>Ø kcal</TableHead>
                      <TableHead>Ø Eiweiß</TableHead>
                      <TableHead>Ø Kohlenhydrate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycleWeekStats.map((week) => (
                      <TableRow key={week.weekLabel}>
                        <TableCell className="font-medium">{week.weekLabel}</TableCell>
                        <TableCell>{formatNumber(week.avgEnergy, 0)}</TableCell>
                        <TableCell>{formatNumber(week.avgProtein, 0)} g</TableCell>
                        <TableCell>{formatNumber(week.avgCarbs, 0)} g</TableCell>
                        <TableCell>
                          <Badge
                            variant={week.compliance === "ok" ? "secondary" : "outline"}
                            className={
                              week.compliance === "ok"
                                ? "bg-emerald-50 text-emerald-700"
                                : week.compliance === "low"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                            }
                          >
                            {week.compliance === "ok" ? "im Ziel" : week.compliance === "low" ? "unter Ziel" : "über Ziel"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">Menürotation & Highlights</CardTitle>
                <CardDescription>
                  Zeigt Signature-Dishes für Lehrküche und Stationsversorgung.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cycleWeekStats.map((week) => (
                  <div key={week.weekLabel} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                      {week.weekLabel}
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
                      {week.highlights.length > 0 ? (
                        week.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)
                      ) : (
                        <li className="text-muted-foreground">Noch keine Highlights geplant.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
            {foods.map((food) => (
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
            {recipes.map((recipe) => (
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

      <Dialog
        open={exchangeDialogOpen}
        onOpenChange={(open) => {
          setExchangeDialogOpen(open)
          if (!open) setExchangeSlot(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Austauschliste für {exchangeSlot ? MEAL_SLOT_LABELS[exchangeSlot] : "Slot"}</DialogTitle>
            <DialogDescription>
              Filtere nach Quelle, Kategorie oder Nährstoff und übertrage Alternativen per Klick.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Lebensmittel suchen..."
              value={exchangeSearch}
              onChange={(e) => setExchangeSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={exchangeCategory} onValueChange={setExchangeCategory}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {FOOD_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={exchangeNutrient} onValueChange={setExchangeNutrient}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Nährstoff" />
              </SelectTrigger>
              <SelectContent>
                {NUTRIENT_DEFINITIONS.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {exchangeNutrientLoading && (
            <p className="text-muted-foreground mt-2 text-sm">
              Nährstoffwerte werden geladen …
            </p>
          )}
          {exchangeNutrientError && (
            <p className="text-destructive mt-2 text-sm">
              Nährstoffe konnten nicht geladen werden: {exchangeNutrientError}
            </p>
          )}
          <div className="mt-4 max-h-[360px] overflow-hidden rounded-md border">
            <ScrollArea className="h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lebensmittel</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">
                      {nutrientDefMap.get(exchangeNutrient)?.shortName ?? exchangeNutrient}
                    </TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExchangeFoods.slice(0, 20).map((food) => {
                    const nutrientVal = exchangeNutrientValues.get(food.id) ?? 0
                    const category = FOOD_CATEGORIES.find((cat) => cat.id === food.categoryId)
                    return (
                      <TableRow key={food.id}>
                        <TableCell className="font-medium">{food.name}</TableCell>
                        <TableCell className="text-muted-foreground">{category?.name ?? "–"}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(nutrientVal, 1)} {nutrientDefMap.get(exchangeNutrient)?.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleSelectExchangeFood(food.id)}>
                            Übernehmen
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
