"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useNutrientValueMaps, useNutrientValues } from "@/hooks/use-nutrient-values"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { formatNumber } from "@/lib/format"
import {
  calculatePerServing,
  calculateRecipeNutrients,
  getNutrientValue,
  scaleNutrients,
} from "@/lib/nutrients"
import type {
  DailyMealPlan,
  Food,
  FoodSearchItem,
  MealSlotType,
  Recipe,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const EXCHANGE_DELTA_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
] as const

interface PlanExchangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotType: MealSlotType | null
  entryId: string | null
  plan: DailyMealPlan
  foods: Food[]
  searchIndex: FoodSearchItem[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  onSelectFood: (foodId: string) => void
}

/**
 * Exchange list for swapping a plan entry against an alternative food.
 * Mount this lazily (only while open): its nutrient-value hooks fetch
 * whole nutrient columns from Supabase, which must not run on page load.
 */
export function PlanExchangeDialog({
  open,
  onOpenChange,
  slotType,
  entryId,
  plan,
  foods,
  searchIndex,
  foodMap,
  recipeMap,
  onSelectFood,
}: PlanExchangeDialogProps) {
  const [exchangeSearch, setExchangeSearch] = useState("")
  const [exchangeCategory, setExchangeCategory] = useState<string>("alle")
  const [exchangeNutrient, setExchangeNutrient] = useState("energie")

  const {
    values: exchangeNutrientValues,
    isLoading: exchangeNutrientLoading,
    error: exchangeNutrientError,
  } = useNutrientValues(exchangeNutrient, foods, {
    forceRemote: searchIndex.length > foods.length,
  })

  const exchangeDeltaNutrientIds = useMemo(() => {
    const ids = new Set<string>(EXCHANGE_DELTA_NUTRIENT_IDS)
    if (exchangeNutrient) ids.add(exchangeNutrient)
    return Array.from(ids)
  }, [exchangeNutrient])
  const { valuesByNutrient: exchangeDeltaValues } = useNutrientValueMaps(exchangeDeltaNutrientIds)

  const nutrientDefMap = useMemo(
    () => new Map(NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition])),
    [],
  )

  // Use the lightweight search index (instead of all full Food objects) when available.
  const exchangeSource: FoodSearchItem[] = searchIndex.length > 0 ? searchIndex : foods
  const filteredExchangeFoods = useMemo(() => {
    const query = exchangeSearch.toLowerCase()
    return exchangeSource
      .filter((food) => {
        const matchesSearch = !query || food.name.toLowerCase().includes(query)
        const matchesCategory = exchangeCategory === "alle" || food.categoryId === exchangeCategory
        return matchesSearch && matchesCategory
      })
      .sort((a, b) =>
        (exchangeNutrientValues.get(b.id) ?? 0) - (exchangeNutrientValues.get(a.id) ?? 0),
      )
  }, [exchangeCategory, exchangeNutrientValues, exchangeSearch, exchangeSource])

  const exchangeOriginal = useMemo(() => {
    if (!entryId || !slotType) return null
    const slot = plan.slots.find((item) => item.type === slotType)
    const entry = slot?.entries.find((item) => item.id === entryId)
    if (!entry) return null

    if (entry.type === "food") {
      const food = foodMap.get(entry.referenceId)
      if (!food) return null
      const scaled = scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
      const nutrients = new Map<string, number>()
      for (const id of exchangeDeltaNutrientIds) {
        nutrients.set(id, getNutrientValue(scaled, id))
      }
      return {
        kind: "food" as const,
        entry,
        name: food.name,
        amount: entry.amount,
        unitLabel: "g",
        nutrients,
      }
    }

    const recipe = recipeMap.get(entry.referenceId)
    if (!recipe) return null
    const totalNutrients = calculateRecipeNutrients(recipe, foods)
    const perServing = calculatePerServing(totalNutrients, recipe.servings)
    const scaled = scaleNutrients(perServing, 1, entry.amount)
    const nutrients = new Map<string, number>()
    for (const id of exchangeDeltaNutrientIds) {
      nutrients.set(id, getNutrientValue(scaled, id))
    }
    return {
      kind: "recipe" as const,
      entry,
      name: recipe.name,
      amount: entry.amount,
      unitLabel: entry.amount === 1 ? "Portion" : "Portionen",
      nutrients,
    }
  }, [plan, entryId, slotType, foodMap, recipeMap, foods, exchangeDeltaNutrientIds])

  const exchangeCompareAmount =
    exchangeOriginal?.kind === "food" ? exchangeOriginal.amount : 100
  const exchangeShowDelta = exchangeOriginal?.kind === "food"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {entryId ? "Eintrag austauschen" : "Austauschliste"} für{" "}
            {slotType ? MEAL_SLOT_LABELS[slotType] : "Slot"}
          </DialogTitle>
          <DialogDescription>
            {exchangeShowDelta
              ? "Werte und Δ beziehen sich auf die ursprüngliche Menge. Beim Austauschen bleibt die bisherige Menge erhalten."
              : "Werte je 100 g. Beim Austauschen bleibt die bisherige Menge erhalten."}
          </DialogDescription>
        </DialogHeader>
        {exchangeOriginal && (
          <div className="bg-muted/40 rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                  Original
                </div>
                <div className="text-sm font-medium">
                  {exchangeOriginal.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({formatNumber(exchangeOriginal.amount, 0)} {exchangeOriginal.unitLabel})
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {EXCHANGE_DELTA_NUTRIENT_IDS.map((nutrientId) => {
                  const def = nutrientDefMap.get(nutrientId)
                  const value = exchangeOriginal.nutrients.get(nutrientId) ?? 0
                  return (
                    <Badge key={nutrientId} variant="outline" className="bg-background">
                      {def?.shortName ?? nutrientId}:{" "}
                      {formatNumber(value, nutrientId === "energie" ? 0 : 1)} {def?.unit ?? ""}
                    </Badge>
                  )
                })}
              </div>
            </div>
            {exchangeOriginal.kind === "recipe" && (
              <p className="text-muted-foreground mt-2 text-[11px]">
                Hinweis: Beim Tausch eines Rezepts gegen ein Lebensmittel ist kein Δ-Vergleich
                möglich. Die Liste zeigt Werte je 100 g.
              </p>
            )}
          </div>
        )}
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
        <div className="mt-2 max-h-[420px] overflow-hidden rounded-md border">
          <ScrollArea className="h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lebensmittel</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">
                    {nutrientDefMap.get(exchangeNutrient)?.shortName ?? exchangeNutrient}
                    {exchangeShowDelta && (
                      <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                        ({formatNumber(exchangeCompareAmount, 0)} g)
                      </span>
                    )}
                  </TableHead>
                  <TableHead className="text-right">Makros</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExchangeFoods.slice(0, 20).map((food) => {
                  const pivotPer100 = exchangeNutrientValues.get(food.id) ?? 0
                  const pivotAbs = (pivotPer100 * exchangeCompareAmount) / 100
                  const pivotOriginalAbs = exchangeOriginal?.nutrients.get(exchangeNutrient) ?? 0
                  const pivotDelta = exchangeShowDelta ? pivotAbs - pivotOriginalAbs : null
                  const pivotDef = nutrientDefMap.get(exchangeNutrient)
                  const category = FOOD_CATEGORIES.find((cat) => cat.id === food.categoryId)
                  const pivotDecimals = exchangeNutrient === "energie" ? 0 : 1
                  return (
                    <TableRow key={food.id}>
                      <TableCell className="font-medium">{food.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {category?.name ?? "–"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span>
                            {formatNumber(pivotAbs, pivotDecimals)} {pivotDef?.unit ?? ""}
                          </span>
                          {pivotDelta !== null && (
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                Math.abs(pivotDelta) < 0.05
                                  ? "text-muted-foreground"
                                  : pivotDelta > 0
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-orange-600 dark:text-orange-400",
                              )}
                            >
                              {pivotDelta > 0 ? "+" : ""}
                              {formatNumber(pivotDelta, pivotDecimals)} {pivotDef?.unit ?? ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {EXCHANGE_DELTA_NUTRIENT_IDS.filter(
                            (id) => id !== exchangeNutrient,
                          ).map((nutrientId) => {
                            const def = nutrientDefMap.get(nutrientId)
                            const per100 =
                              exchangeDeltaValues.get(nutrientId)?.get(food.id) ?? 0
                            const abs = (per100 * exchangeCompareAmount) / 100
                            const originalAbs =
                              exchangeOriginal?.nutrients.get(nutrientId) ?? 0
                            const delta = exchangeShowDelta ? abs - originalAbs : null
                            const decimals = nutrientId === "energie" ? 0 : 1
                            if (delta === null) {
                              return (
                                <Badge
                                  key={nutrientId}
                                  variant="outline"
                                  className="text-[10px] font-normal"
                                >
                                  {def?.shortName ?? nutrientId} {formatNumber(abs, decimals)}
                                </Badge>
                              )
                            }
                            const isNeutral = Math.abs(delta) < 0.05
                            return (
                              <Badge
                                key={nutrientId}
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-medium",
                                  isNeutral
                                    ? "text-muted-foreground"
                                    : delta > 0
                                      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                                      : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200",
                                )}
                              >
                                {def?.shortName ?? nutrientId} {delta > 0 ? "+" : ""}
                                {formatNumber(delta, decimals)}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => onSelectFood(food.id)}>
                          {entryId ? "Ersetzen" : "Übernehmen"}
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
  )
}
