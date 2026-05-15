"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Printer,
  ShoppingBasket,
  Square,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useFoods } from "@/components/foods-provider";
import { createRecipeLookup } from "@/lib/recipes";
import {
  buildShoppingList,
  formatShoppingAmount,
  type ShoppingListSource,
} from "@/lib/shopping-list";
import { cn } from "@/lib/utils";
import type { DailyMealPlan, Recipe } from "@/lib/types";

interface EinkaufslisteClientProps {
  plans: DailyMealPlan[];
  recipes: Recipe[];
  presetPlanIds: string[];
}

const PLAN_STATUS_LABELS: Record<NonNullable<DailyMealPlan["status"]>, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  approved: "Freigegeben",
  archived: "Archiviert",
};

const MAX_SELECTABLE = 14;

function formatPlanDateLong(date: string): string {
  try {
    return format(parseISO(date), "EEE, dd.MM.yyyy", { locale: de });
  } catch {
    return date;
  }
}

function formatPlanDateShort(date: string): string {
  try {
    return format(parseISO(date), "dd.MM.", { locale: de });
  } catch {
    return date;
  }
}

function describeSource(source: ShoppingListSource): string {
  const date = formatPlanDateShort(source.planDate);
  const planLabel = source.planTitle?.trim() || date;
  const prefix = planLabel === date ? date : `${planLabel} · ${date}`;
  if (!source.viaRecipeName) return prefix;
  const servings = source.viaRecipeServings;
  const servingLabel =
    servings && servings > 0
      ? ` · ${servings.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Portion${servings === 1 ? "" : "en"}`
      : "";
  return `${prefix} · ${source.viaRecipeName}${servingLabel}`;
}

export function EinkaufslisteClient({
  plans,
  recipes,
  presetPlanIds,
}: EinkaufslisteClientProps) {
  const foods = useFoods();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    presetPlanIds.filter((id) => plans.some((plan) => plan.id === id)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => b.date.localeCompare(a.date)),
    [plans],
  );

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);

  const selectedPlans = useMemo(() => {
    const lookup = new Map(plans.map((plan) => [plan.id, plan]));
    return selectedIds
      .map((id) => lookup.get(id))
      .filter((plan): plan is DailyMealPlan => Boolean(plan))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [plans, selectedIds]);

  const shoppingList = useMemo(
    () => buildShoppingList(selectedPlans, foodMap, recipeMap),
    [selectedPlans, foodMap, recipeMap],
  );

  const filteredPickerPlans = useMemo(() => {
    const trimmed = pickerQuery.trim().toLowerCase();
    if (!trimmed) return sortedPlans;
    return sortedPlans.filter((plan) => {
      const haystack = [
        plan.title ?? "",
        plan.date,
        plan.status ?? "",
        plan.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [pickerQuery, sortedPlans]);

  const togglePlan = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= MAX_SELECTABLE) return current;
      return [...current, id];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const toggleItem = (foodId: string) => {
    setCheckedItems((current) => {
      const next = new Set(current);
      if (next.has(foodId)) {
        next.delete(foodId);
      } else {
        next.add(foodId);
      }
      return next;
    });
  };

  const toggleSourceExpanded = (foodId: string) => {
    setExpandedSources((current) => {
      const next = new Set(current);
      if (next.has(foodId)) {
        next.delete(foodId);
      } else {
        next.add(foodId);
      }
      return next;
    });
  };

  const allChecked =
    shoppingList.itemCount > 0 && checkedItems.size === shoppingList.itemCount;

  const toggleAllChecked = () => {
    if (allChecked) {
      setCheckedItems(new Set());
      return;
    }
    const next = new Set<string>();
    for (const group of shoppingList.groups) {
      for (const item of group.items) {
        next.add(item.foodId);
      }
    }
    setCheckedItems(next);
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const totalPlans = plans.length;
  const hasSelection = selectedPlans.length > 0;
  const hasItems = shoppingList.itemCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einkaufsliste"
        description="Aggregiert alle Zutaten der gewählten Tagespläne und Rezepte zu einer gruppierten Einkaufsliste."
        helpText="Wähle einen oder mehrere Tagespläne aus. Direkte Lebensmittel werden mit ihrer Grammzahl übernommen; Rezepte werden anhand der Portionsangabe automatisch auf die enthaltenen Zutaten heruntergerechnet. Gleiche Lebensmittel werden über alle Pläne und Rezepte zusammengeführt und nach Warengruppen sortiert."
      >
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ernaehrungsplan">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zum Plan
            </Link>
          </Button>
          {hasItems && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Drucken
            </Button>
          )}
        </div>
      </PageHeader>

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="text-muted-foreground h-4 w-4" />
            Pläne auswählen
          </CardTitle>
          <CardDescription>
            {totalPlans === 0
              ? "Es sind noch keine Tagespläne gespeichert."
              : `${selectedPlans.length} von max. ${MAX_SELECTABLE} ausgewählt · ${totalPlans} verfügbar`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  disabled={totalPlans === 0}
                  className="min-w-[220px] justify-between"
                >
                  {selectedPlans.length === 0
                    ? "Pläne wählen…"
                    : `${selectedPlans.length} Plan${selectedPlans.length === 1 ? "" : "e"} ausgewählt`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <div className="border-b p-2">
                  <Input
                    placeholder="Datum, Titel oder Status suchen…"
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                    className="h-8"
                  />
                </div>
                <ScrollArea className="h-72">
                  <div className="p-1">
                    {filteredPickerPlans.length === 0 ? (
                      <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                        Keine Pläne gefunden.
                      </p>
                    ) : (
                      filteredPickerPlans.map((plan) => {
                        const checked = selectedIds.includes(plan.id);
                        const disabled =
                          !checked && selectedIds.length >= MAX_SELECTABLE;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => togglePlan(plan.id)}
                            disabled={disabled}
                            className={cn(
                              "hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                              disabled && "opacity-40",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              tabIndex={-1}
                              onCheckedChange={() => togglePlan(plan.id)}
                              className="pointer-events-none"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                  {plan.title?.trim() || formatPlanDateLong(plan.date)}
                                </span>
                                {plan.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {PLAN_STATUS_LABELS[plan.status]}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {formatPlanDateLong(plan.date)}
                              </div>
                            </div>
                            {checked && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {selectedPlans.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Auswahl leeren
              </Button>
            )}
          </div>

          {selectedPlans.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPlans.map((plan) => (
                <Badge
                  key={plan.id}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1 pl-2 pr-1 text-xs"
                >
                  <span className="font-medium">
                    {plan.title?.trim() || formatPlanDateLong(plan.date)}
                  </span>
                  <span className="text-muted-foreground">
                    · {formatPlanDateShort(plan.date)}
                  </span>
                  <button
                    type="button"
                    aria-label="Plan entfernen"
                    onClick={() => togglePlan(plan.id)}
                    className="hover:bg-muted ml-0.5 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasSelection ? (
        <Card className="print:hidden">
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <ShoppingBasket className="text-muted-foreground/60 h-6 w-6" />
            <p>Wähle mindestens einen Plan, um eine Einkaufsliste zu erzeugen.</p>
          </CardContent>
        </Card>
      ) : !hasItems ? (
        <Card className="print:hidden">
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <ShoppingBasket className="text-muted-foreground/60 h-6 w-6" />
            <p>
              Die ausgewählten Pläne enthalten noch keine Zutaten oder Rezepte mit
              Mengenangaben.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingBasket className="text-muted-foreground h-4 w-4" />
                    Einkaufsliste
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {selectedPlans.length} Plan{selectedPlans.length === 1 ? "" : "e"} ·{" "}
                    {shoppingList.itemCount} Position
                    {shoppingList.itemCount === 1 ? "" : "en"} ·{" "}
                    {formatShoppingAmount(shoppingList.totalGrams)} gesamt
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllChecked}
                  className="print:hidden"
                >
                  {allChecked ? (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      Auswahl leeren
                    </>
                  ) : (
                    <>
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Alles abhaken
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {shoppingList.groups.map((group) => (
                <section
                  key={group.categoryId}
                  className="space-y-2 print:break-inside-avoid"
                >
                  <div className="flex items-baseline justify-between border-b pb-1">
                    <h2 className="text-sm font-semibold uppercase tracking-wide">
                      {group.categoryLabel}
                    </h2>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {group.items.length} ·{" "}
                      {formatShoppingAmount(group.totalGrams)}
                    </span>
                  </div>
                  <ul className="divide-border divide-y">
                    {group.items.map((item) => {
                      const isChecked = checkedItems.has(item.foodId);
                      const isExpanded = expandedSources.has(item.foodId);
                      const sourceCount = item.sources.length;
                      return (
                        <li
                          key={item.foodId}
                          className="flex flex-col gap-1 py-2 print:break-inside-avoid"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`item-${item.foodId}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleItem(item.foodId)}
                              aria-label={`${item.name} abhaken`}
                            />
                            <label
                              htmlFor={`item-${item.foodId}`}
                              className={cn(
                                "flex-1 cursor-pointer text-sm",
                                isChecked &&
                                  "text-muted-foreground line-through decoration-muted-foreground/60",
                              )}
                            >
                              {item.name}
                            </label>
                            <span
                              className={cn(
                                "text-sm font-medium tabular-nums",
                                isChecked && "text-muted-foreground line-through",
                              )}
                            >
                              {formatShoppingAmount(item.totalGrams)}
                            </span>
                          </div>
                          {sourceCount > 0 && (
                            <Collapsible
                              open={isExpanded}
                              onOpenChange={() => toggleSourceExpanded(item.foodId)}
                            >
                              <CollapsibleTrigger
                                className="text-muted-foreground hover:text-foreground ml-8 flex items-center gap-1 text-xs print:hidden"
                                type="button"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {sourceCount} Herkunft
                                {sourceCount === 1 ? "" : "e"}
                              </CollapsibleTrigger>
                              <CollapsibleContent className="ml-8 mt-1 space-y-0.5 text-xs">
                                {item.sources.map((source, index) => (
                                  <div
                                    key={`${source.planId}-${source.viaRecipeId ?? "direct"}-${index}`}
                                    className="text-muted-foreground flex items-baseline justify-between gap-2"
                                  >
                                    <span className="truncate">
                                      {describeSource(source)}
                                    </span>
                                    <span className="tabular-nums">
                                      {formatShoppingAmount(source.grams)}
                                    </span>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {shoppingList.missing.length > 0 && (
                <>
                  <Separator className="print:hidden" />
                  <div className="text-muted-foreground flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs print:hidden">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-foreground font-medium">
                        {shoppingList.missing.length} Verweis
                        {shoppingList.missing.length === 1 ? "" : "e"} konnten nicht
                        aufgelöst werden.
                      </p>
                      <p>
                        Diese Lebensmittel oder Rezepte wurden nach der Plan-Erstellung
                        entfernt und sind in der Liste nicht enthalten.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
