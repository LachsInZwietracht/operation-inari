"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Printer,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react"
import { toast } from "sonner"

import {
  PRODUCTION_LISTS,
  SHOPPING_LISTS,
  DIET_FORMS,
  KITCHEN_STATIONS,
} from "@/lib/mock-data"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { PageHeader } from "@/components/page-header"
import { formatNumber } from "@/lib/format"
import type { MealSlotType } from "@/lib/types"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dietFormMap = new Map(DIET_FORMS.map((df) => [df.id, df.name]))

function getDietFormName(id: string): string {
  return dietFormMap.get(id) ?? id
}

/** Display amount: >= 1000 g -> kg, otherwise g. Respects original unit for ml/l. */
function formatAmount(amount: number, unit: string): { value: string; unit: string } {
  if (unit === "ml" || unit === "l") {
    if (amount >= 1000 && unit === "ml") {
      return { value: formatNumber(amount / 1000, 2), unit: "l" }
    }
    return { value: formatNumber(amount, 1), unit }
  }
  if (amount >= 1000) {
    return { value: formatNumber(amount / 1000, 2), unit: "kg" }
  }
  return { value: formatNumber(amount, 1), unit: "g" }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

/** Format a date string (ISO) to German dd.MM.yyyy */
function formatDateDE(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

// Stable ordering for meal slots
const MEAL_SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProduktionPage() {
  const [stationFilter, setStationFilter] = useState<string>("alle")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [portionScale, setPortionScale] = useState<number>(1)

  // --- Production data -------------------------------------------------------
  const productionList = PRODUCTION_LISTS[0]

  const filteredItems = useMemo(() => {
    if (stationFilter === "alle") return productionList.items
    // Currently all items belong to productionList.station; filter is ready for
    // multi-station data in the future.
    return productionList.station === stationFilter ? productionList.items : []
  }, [productionList, stationFilter])

  const groupedByMealSlot = useMemo(() => {
    const groups = new Map<MealSlotType, typeof filteredItems>()
    for (const item of filteredItems) {
      const existing = groups.get(item.mealSlot) ?? []
      existing.push(item)
      groups.set(item.mealSlot, existing)
    }
    // Sort by meal slot order
    return MEAL_SLOT_ORDER.filter((slot) => groups.has(slot)).map((slot) => ({
      slot,
      label: MEAL_SLOT_LABELS[slot],
      items: groups.get(slot)!,
    }))
  }, [filteredItems])

  const productionSummary = useMemo(() => {
    const totalRecipes = filteredItems.length
    const totalPortions = filteredItems.reduce((s, i) => s + i.portionCount, 0)
    const totalIngredients = filteredItems.reduce(
      (s, i) => s + i.ingredients.length,
      0,
    )
    return { totalRecipes, totalPortions, totalIngredients }
  }, [filteredItems])

  // --- Shopping data ---------------------------------------------------------
  const shoppingList = SHOPPING_LISTS[0]

  const groupedByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { categoryName: string; items: typeof shoppingList.items; subtotal: number }
    >()
    for (const item of shoppingList.items) {
      const existing = groups.get(item.categoryId) ?? {
        categoryName: item.categoryName,
        items: [],
        subtotal: 0,
      }
      existing.items.push(item)
      existing.subtotal += item.estimatedCost
      groups.set(item.categoryId, existing)
    }
    return Array.from(groups.values())
  }, [shoppingList])

  const scaledTotalCost = shoppingList.totalCost * portionScale

  // --- Toggle row expansion --------------------------------------------------
  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produktionsmanagement"
        description="Produktions- und Einkaufslisten für die Großküche"
        helpText="Generieren Sie Produktions- und Einkaufslisten aus Ihren Menüplänen. Planen Sie Mengen für die Großküche und behalten Sie den Überblick über Bestellungen und Lagerbestände."
      />

      <Tabs defaultValue="produktion">
        <TabsList>
          <TabsTrigger value="produktion" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Produktionsliste
          </TabsTrigger>
          <TabsTrigger value="einkauf" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Einkaufsliste
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Produktionsliste */}
        {/* ================================================================ */}
        <TabsContent value="produktion" className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Datum:{" "}
              <span className="font-medium text-foreground">
                {formatDateDE(productionList.date)}
              </span>
            </div>

            <Select value={stationFilter} onValueChange={setStationFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Station filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Stationen</SelectItem>
                {KITCHEN_STATIONS.map((station) => (
                  <SelectItem key={station} value={station}>
                    {station}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast("Druckansicht wird vorbereitet...")}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Drucken
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Rezepte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{productionSummary.totalRecipes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Portionen gesamt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatNumber(productionSummary.totalPortions)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Zutaten gesamt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {productionSummary.totalIngredients}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Grouped production table */}
          {groupedByMealSlot.map((group) => (
            <Card key={group.slot}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  {group.label}
                  <Badge variant="secondary" className="ml-1">
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "Rezept" : "Rezepte"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Rezept</TableHead>
                      <TableHead>Kostform</TableHead>
                      <TableHead className="text-right">Portionen</TableHead>
                      <TableHead className="text-right">Zutaten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => {
                      const rowKey = `${item.recipeId}_${item.dietFormId}_${item.mealSlot}`
                      const isOpen = expandedRows.has(rowKey)

                      return (
                        <Collapsible key={rowKey} asChild open={isOpen}>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleRow(rowKey)}
                              >
                                <TableCell>
                                  {isOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {item.recipeName}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {getDietFormName(item.dietFormId)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.portionCount}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.ingredients.length}
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell />
                                <TableCell colSpan={4}>
                                  <div className="py-2">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                      Zutatenliste
                                    </p>
                                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                      {item.ingredients.map((ing) => {
                                        const fmt = formatAmount(
                                          ing.totalAmount,
                                          ing.unit,
                                        )
                                        return (
                                          <div
                                            key={ing.foodId}
                                            className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm"
                                          >
                                            <span>{ing.foodName}</span>
                                            <span className="ml-2 font-medium tabular-nums">
                                              {fmt.value} {fmt.unit}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ================================================================ */}
        {/* Einkaufsliste */}
        {/* ================================================================ */}
        <TabsContent value="einkauf" className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Kalenderwoche:{" "}
              <span className="font-medium text-foreground">
                KW {shoppingList.weekNumber}
              </span>
              <span className="ml-2 text-xs">
                ({formatDateDE(shoppingList.dateRange.start)} &ndash;{" "}
                {formatDateDE(shoppingList.dateRange.end)})
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label
                htmlFor="portion-scale"
                className="text-sm text-muted-foreground whitespace-nowrap"
              >
                Portionsfaktor:
              </label>
              <Input
                id="portion-scale"
                type="number"
                min={0.1}
                step={0.1}
                value={portionScale}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v) && v > 0) setPortionScale(v)
                }}
                className="w-20"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => toast("Export wird vorbereitet...")}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Als CSV exportieren
            </Button>
          </div>

          {/* Category tables */}
          {groupedByCategory.map((group) => (
            <Card key={group.categoryName}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{group.categoryName}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Zwischensumme:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(group.subtotal * portionScale)}
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lebensmittel</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead>Einheit</TableHead>
                      <TableHead className="text-right">
                        Geschätzte Kosten
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => {
                      const scaledAmount = item.totalAmount * portionScale
                      const fmt = formatAmount(scaledAmount, "g")
                      const scaledCost = item.estimatedCost * portionScale
                      return (
                        <TableRow key={item.foodId}>
                          <TableCell className="font-medium">
                            {item.foodName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt.value}
                          </TableCell>
                          <TableCell>{fmt.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(scaledCost)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {/* Grand total */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-5">
              <div className="text-sm font-medium text-muted-foreground">
                Gesamtkosten (KW {shoppingList.weekNumber})
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(scaledTotalCost)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
