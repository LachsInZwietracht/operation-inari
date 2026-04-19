"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Printer,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { DIET_FORMS, DAY_LABELS } from "@/lib/mock-data";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { formatNumber } from "@/lib/format";
import { useInstitutionMenu } from "@/hooks/use-institution-menu";
import type { MealSlotType, ProductionItem, ShoppingItem, Recipe, InstitutionMenu } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dietFormMap = new Map(DIET_FORMS.map((df) => [df.id, df.name]));

function getDietFormName(id: string): string {
  return dietFormMap.get(id) ?? id;
}

function formatAmount(amount: number, unit: string): { value: string; unit: string } {
  if (unit === "ml" || unit === "l") {
    if (amount >= 1000 && unit === "ml") {
      return { value: formatNumber(amount / 1000, 2), unit: "l" };
    }
    return { value: formatNumber(amount, 1), unit };
  }
  if (amount >= 1000) {
    return { value: formatNumber(amount / 1000, 2), unit: "kg" };
  }
  return { value: formatNumber(amount, 1), unit: "g" };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

const MEAL_SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ProduktionPageClientProps {
  recipes: Recipe[];
  initialMenus?: InstitutionMenu[];
}

export function ProduktionPageClient({ recipes, initialMenus }: ProduktionPageClientProps) {
  const { activeMenu, generateProductionList, generateShoppingList } =
    useInstitutionMenu(initialMenus, recipes);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [portionScale, setPortionScale] = useState<number>(1);

  // --- Production data (generated from active menu) -------------------------
  const productionItems: ProductionItem[] = useMemo(() => {
    if (!activeMenu) return [];
    return generateProductionList(activeMenu.id, selectedWeek, selectedDay);
  }, [activeMenu, selectedWeek, selectedDay, generateProductionList]);

  const groupedByMealSlot = useMemo(() => {
    const groups = new Map<MealSlotType, ProductionItem[]>();
    for (const item of productionItems) {
      const existing = groups.get(item.mealSlot) ?? [];
      existing.push(item);
      groups.set(item.mealSlot, existing);
    }
    return MEAL_SLOT_ORDER.filter((slot) => groups.has(slot)).map((slot) => ({
      slot,
      label: MEAL_SLOT_LABELS[slot],
      items: groups.get(slot)!,
    }));
  }, [productionItems]);

  const productionSummary = useMemo(() => {
    const totalRecipes = productionItems.length;
    const totalPortions = productionItems.reduce((s, i) => s + i.portionCount, 0);
    const totalIngredients = productionItems.reduce(
      (s, i) => s + i.ingredients.length,
      0,
    );
    return { totalRecipes, totalPortions, totalIngredients };
  }, [productionItems]);

  // --- Shopping data (generated from active menu) ---------------------------
  const shoppingItems: ShoppingItem[] = useMemo(() => {
    if (!activeMenu) return [];
    return generateShoppingList(activeMenu.id, selectedWeek);
  }, [activeMenu, selectedWeek, generateShoppingList]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { categoryName: string; items: ShoppingItem[]; subtotal: number }
    >();
    for (const item of shoppingItems) {
      const existing = groups.get(item.categoryId) ?? {
        categoryName: item.categoryName,
        items: [],
        subtotal: 0,
      };
      existing.items.push(item);
      existing.subtotal += item.estimatedCost;
      groups.set(item.categoryId, existing);
    }
    return Array.from(groups.values());
  }, [shoppingItems]);

  const scaledTotalCost =
    shoppingItems.reduce((s, i) => s + i.estimatedCost, 0) * portionScale;

  // --- Toggle row expansion --------------------------------------------------
  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produktionsmanagement"
        description="Produktions- und Einkaufslisten aus dem aktiven Menüplan"
        helpText="Listen werden automatisch aus dem aktiven Menüplan generiert. Änderungen im Wochenplan spiegeln sich direkt hier wider."
      />

      {!activeMenu && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Kein aktiver Menüplan vorhanden. Erstellen und aktivieren Sie einen Menüplan unter Menüplanung.
          </CardContent>
        </Card>
      )}

      {activeMenu && (
        <>
          {/* Week selector (for multi-week cycles) */}
          {activeMenu.cycleLength > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Woche:</span>
              <Select
                value={selectedWeek.toString()}
                onValueChange={(v) => setSelectedWeek(parseInt(v, 10))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeMenu.weeks.map((w) => (
                    <SelectItem key={w.weekNumber} value={w.weekNumber.toString()}>
                      Woche {w.weekNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                <Select
                  value={selectedDay.toString()}
                  onValueChange={(v) => setSelectedDay(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_LABELS.map((day, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {day} (Tag {idx + 1})
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

              {/* Empty state */}
              {productionItems.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Keine Rezepte für {DAY_LABELS[selectedDay]} geplant.
                  </CardContent>
                </Card>
              )}

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
                          const rowKey = `${item.recipeId}_${item.dietFormId}_${item.mealSlot}`;
                          const isOpen = expandedRows.has(rowKey);

                          return (
                            <TableRow
                              key={rowKey}
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
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Expanded ingredient details */}
                    {group.items
                      .filter((item) =>
                        expandedRows.has(
                          `${item.recipeId}_${item.dietFormId}_${item.mealSlot}`,
                        ),
                      )
                      .map((item) => (
                        <div
                          key={`detail-${item.recipeId}_${item.dietFormId}`}
                          className="border-t bg-muted/30 px-6 py-3"
                        >
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Zutatenliste ({item.portionCount} Portionen)
                          </p>
                          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                            {item.ingredients.map((ing) => {
                              const fmt = formatAmount(ing.totalAmount, ing.unit);
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
                              );
                            })}
                          </div>
                        </div>
                      ))}
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
                  Woche {selectedWeek} &middot;{" "}
                  <span className="font-medium text-foreground">
                    {shoppingItems.length} Positionen
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
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) setPortionScale(v);
                    }}
                    className="w-20"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const csv = [
                      "Lebensmittel;Menge;Einheit;Kategorie;Kosten",
                      ...shoppingItems.map((i) => {
                        const fmt = formatAmount(i.totalAmount * portionScale, "g");
                        return `${i.foodName};${fmt.value};${fmt.unit};${i.categoryName};${formatCurrency(i.estimatedCost * portionScale)}`;
                      }),
                    ].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "einkaufsliste.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("CSV-Export heruntergeladen");
                  }}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Als CSV exportieren
                </Button>
              </div>

              {/* Empty state */}
              {shoppingItems.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Keine Einkaufsdaten verfügbar. Planen Sie Rezepte im Wochenplan.
                  </CardContent>
                </Card>
              )}

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
                          const scaledAmount = item.totalAmount * portionScale;
                          const fmt = formatAmount(scaledAmount, "g");
                          const scaledCost = item.estimatedCost * portionScale;
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}

              {/* Grand total */}
              {shoppingItems.length > 0 && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="flex items-center justify-between py-5">
                    <div className="text-sm font-medium text-muted-foreground">
                      Gesamtkosten (Woche {selectedWeek})
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(scaledTotalCost)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
