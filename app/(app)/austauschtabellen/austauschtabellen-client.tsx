"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { formatNumber } from "@/lib/format";
import { Search, ArrowUpDown, Replace, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFoodSearch } from "@/components/foods-provider";
import { useNutrientValueMaps } from "@/hooks/use-nutrient-values";
import { searchFoodsInBrowser } from "@/lib/food-browser-search";
import { getNutrientValue, scaleNutrients } from "@/lib/nutrients";
import type { Food, FoodSearchItem } from "@/lib/types";

type SortMode = "similarity" | "desc" | "asc";

const CORE_EXCHANGE_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
] as const;

const TABLE_NUTRIENT_IDS = [...CORE_EXCHANGE_NUTRIENT_IDS];

type ExchangeTableFood = FoodSearchItem & Partial<Pick<Food, "blsCode" | "source">>;

interface RankedExchangeFood {
  food: ExchangeTableFood;
  score: number | null;
  equivalentAmount: number | null;
  pivotValue: number;
  pivotDelta: number | null;
  macroDeltas: Map<string, number>;
}

function mapBrowserFood(food: Food): ExchangeTableFood {
  return {
    id: food.id,
    name: food.name,
    categoryId: food.categoryId,
    sourceId: food.sourceId,
    isCustom: food.isCustom,
    blsCode: food.blsCode,
    source: food.source,
  };
}

function getDefinition(nutrientId: string) {
  return NUTRIENT_DEFINITIONS.find((definition) => definition.id === nutrientId);
}

function getDecimals(nutrientId: string) {
  return nutrientId === "energie" ? 0 : 1;
}

function getScaledFoodValue(food: Food | null, nutrientId: string, amount: number) {
  if (!food) return 0;
  return getNutrientValue(scaleNutrients(food.nutrients, food.baseAmount, amount), nutrientId);
}

function scoreCandidate({
  originalFood,
  candidateFoodId,
  amount,
  nutrientIds,
  valuesByNutrient,
}: {
  originalFood: Food;
  candidateFoodId: string;
  amount: number;
  nutrientIds: string[];
  valuesByNutrient: Map<string, Map<string, number>>;
}) {
  let weightedPenalty = 0;
  let weightTotal = 0;

  for (const nutrientId of nutrientIds) {
    const original = getScaledFoodValue(originalFood, nutrientId, amount);
    const candidate = ((valuesByNutrient.get(nutrientId)?.get(candidateFoodId) ?? 0) * amount) / 100;
    const baseline = Math.max(Math.abs(original), 1);
    const relativeDiff = Math.min(Math.abs(candidate - original) / baseline, 2);
    const weight = nutrientId === "energie" ? 1.5 : 1;
    weightedPenalty += relativeDiff * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;
  return Math.max(0, Math.round((1 - weightedPenalty / weightTotal) * 100));
}

function OriginalFoodPicker({
  food,
  onSelect,
  onClear,
}: {
  food: Food | null;
  onSelect: (food: Food) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      setError(null);
      void (async () => {
        try {
          const result = await searchFoodsInBrowser(trimmed, {
            signal: controller.signal,
            pageSize: 12,
          });
          setResults(result.foods);
        } catch (searchError) {
          if (!controller.signal.aborted) {
            setResults([]);
            setError(searchError instanceof Error ? searchError.message : "Suche fehlgeschlagen");
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Replace className="h-4 w-4" />
          Original-Lebensmittel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="exchange-original-search">Original suchen</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="exchange-original-search"
              placeholder="Original-Lebensmittel suchen..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {query.trim().length >= 2 && (
          <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
            {isSearching ? (
              <div className="p-3 text-sm text-muted-foreground">Suche läuft …</div>
            ) : error ? (
              <div className="p-3 text-sm text-destructive">{error}</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Keine Treffer gefunden.</div>
            ) : (
              results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onSelect(result);
                    setQuery("");
                    setResults([]);
                  }}
                >
                  <span className="font-medium">{result.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {result.blsCode ?? result.sourceId?.toUpperCase() ?? "–"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {food ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{food.name}</p>
                <p className="text-xs text-muted-foreground">
                  {food.blsCode ?? food.source ?? food.sourceId?.toUpperCase() ?? "–"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClear}>
                <X className="h-4 w-4" />
                <span className="sr-only">Original entfernen</span>
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              {CORE_EXCHANGE_NUTRIENT_IDS.map((nutrientId) => {
                const definition = getDefinition(nutrientId);
                return (
                  <div key={nutrientId} className="rounded-md bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">{definition?.shortName ?? definition?.name}</p>
                    <p className="font-semibold">
                      {formatNumber(getNutrientValue(food.nutrients, nutrientId), getDecimals(nutrientId))}{" "}
                      {definition?.unit}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Wählen Sie ein Original, um Austauschmengen, Deltas und Ähnlichkeit zu berechnen.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AustauschtabellenPageClient() {
  const { index: foods, isLoading: isIndexLoading, loadIndex } = useFoodSearch();
  const [originalFood, setOriginalFood] = useState<Food | null>(null);
  const [originalAmount, setOriginalAmount] = useState(100);
  const [selectedNutrient, setSelectedNutrient] = useState("energie");
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ExchangeTableFood[]>([]);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("similarity");

  const nutrientDef = NUTRIENT_DEFINITIONS.find((d) => d.id === selectedNutrient);
  const nutrientIds = useMemo(
    () => Array.from(new Set([selectedNutrient, ...TABLE_NUTRIENT_IDS])),
    [selectedNutrient],
  );
  const { valuesByNutrient, isLoading: nutrientLoading, error: nutrientError } =
    useNutrientValueMaps(nutrientIds);
  const isTableLoading = isIndexLoading || nutrientLoading || isRemoteSearching;
  const nutrientValues = useMemo(
    () => valuesByNutrient.get(selectedNutrient) ?? new Map<string, number>(),
    [selectedNutrient, valuesByNutrient],
  );

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsRemoteSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsRemoteSearching(true);
      setSearchError(null);
      void (async () => {
        try {
          const result = await searchFoodsInBrowser(query, {
            signal: controller.signal,
            pageSize: 50,
            categoryId: categoryFilter === "alle" ? null : categoryFilter,
          });
          setSearchResults(result.foods.map(mapBrowserFood));
        } catch (error) {
          if (!controller.signal.aborted) {
            setSearchResults([]);
            setSearchError(error instanceof Error ? error.message : "Suche fehlgeschlagen");
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsRemoteSearching(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, categoryFilter]);

  const originalNutrients = useMemo(() => {
    if (!originalFood) return new Map<string, number>();
    const scaled = new Map<string, number>();
    for (const nutrientId of nutrientIds) {
      scaled.set(nutrientId, getScaledFoodValue(originalFood, nutrientId, originalAmount));
    }
    return scaled;
  }, [originalFood, originalAmount, nutrientIds]);

  const rankedFoods = useMemo<RankedExchangeFood[]>(() => {
    const query = search.trim().toLowerCase();
    const isSearching = query.length >= 2;
    const sourceFoods = isSearching ? searchResults : foods;

    const rows = sourceFoods
      .filter((food) => {
        const matchesSearch = isSearching || !query || food.name.toLowerCase().includes(query);
        const matchesCategory = categoryFilter === "alle" || food.categoryId === categoryFilter;
        return matchesSearch && matchesCategory && food.id !== originalFood?.id;
      })
      .map((food) => {
        const pivotValue = nutrientValues.get(food.id) ?? 0;
        const originalPivot = originalNutrients.get(selectedNutrient) ?? 0;
        const candidatePivotAtOriginalAmount = (pivotValue * originalAmount) / 100;
        const macroDeltas = new Map<string, number>();
        for (const nutrientId of TABLE_NUTRIENT_IDS) {
          const originalValue = originalNutrients.get(nutrientId) ?? 0;
          const candidateValue =
            ((valuesByNutrient.get(nutrientId)?.get(food.id) ?? 0) * originalAmount) / 100;
          macroDeltas.set(nutrientId, candidateValue - originalValue);
        }

        return {
          food,
          score: originalFood
            ? scoreCandidate({
                originalFood,
                candidateFoodId: food.id,
                amount: originalAmount,
                nutrientIds,
                valuesByNutrient,
              })
            : null,
          equivalentAmount:
            originalFood && pivotValue > 0 && originalPivot > 0
              ? (originalPivot / pivotValue) * 100
              : null,
          pivotValue,
          pivotDelta: originalFood ? candidatePivotAtOriginalAmount - originalPivot : null,
          macroDeltas,
        };
      });

    return rows.sort((a, b) => {
      if (sortMode === "similarity" && originalFood) {
        return (b.score ?? -1) - (a.score ?? -1);
      }
      return sortMode === "asc" ? a.pivotValue - b.pivotValue : b.pivotValue - a.pivotValue;
    });
  }, [
    foods,
    searchResults,
    search,
    categoryFilter,
    originalFood,
    selectedNutrient,
    sortMode,
    nutrientValues,
    originalAmount,
    originalNutrients,
    nutrientIds,
    valuesByNutrient,
  ]);

  const topMatches = originalFood ? rankedFoods.slice(0, 3) : [];

  function handleAmountChange(value: string) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) {
      setOriginalAmount(parsed);
    } else if (value.trim() === "") {
      setOriginalAmount(0);
    }
  }

  function renderDelta(delta: number | null, nutrientId: string) {
    const definition = getDefinition(nutrientId);
    if (delta === null) return <span className="text-muted-foreground">–</span>;
    const neutral = Math.abs(delta) < 0.05;
    return (
      <span className={neutral ? "text-muted-foreground" : delta > 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}>
        {delta > 0 ? "+" : ""}
        {formatNumber(delta, getDecimals(nutrientId))} {definition?.unit ?? ""}
      </span>
    );
  }

  function copyExchangeLine(row: RankedExchangeFood) {
    const originalLabel = originalFood ? `${formatNumber(originalAmount, 0)} g ${originalFood.name}` : "Original";
    const candidateLabel = row.equivalentAmount
      ? `${formatNumber(row.equivalentAmount, 0)} g ${row.food.name}`
      : `${formatNumber(originalAmount, 0)} g ${row.food.name}`;
    const line = `${originalLabel} -> ${candidateLabel} (${nutrientDef?.name ?? selectedNutrient}; Ähnlichkeit ${row.score ?? "n. a."} %)`;
    void navigator.clipboard?.writeText(line);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Austauschtabellen"
        description="Lebensmittel gezielt ersetzen, Mengen angleichen und Nährstoffdeltas prüfen"
        helpText="Wählen Sie ein Original-Lebensmittel, definieren Sie die Menge und finden Sie passende Austauschoptionen mit Äquivalenzmengen und Nährstoffabweichungen."
      />

      <OriginalFoodPicker
        food={originalFood}
        onSelect={(food) => {
          setOriginalFood(food);
          setSortMode("similarity");
        }}
        onClear={() => setOriginalFood(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Austauschparameter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[160px_1fr_220px_200px_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="exchange-original-amount">Originalmenge</Label>
            <Input
              id="exchange-original-amount"
              inputMode="decimal"
              value={String(originalAmount || "")}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exchange-candidate-search">Kandidaten suchen</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="exchange-candidate-search"
                placeholder="Austauschoptionen suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Leitnährstoff</Label>
            <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
              <SelectTrigger>
                <SelectValue placeholder="Nährstoff wählen" />
              </SelectTrigger>
              <SelectContent>
                {NUTRIENT_DEFINITIONS.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.name} ({def.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Kategorien" />
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
          </div>
          <div className="space-y-1.5">
            <Label>Sortierung</Label>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="similarity">Ähnlichkeit</SelectItem>
                <SelectItem value="desc">Nährstoff hoch</SelectItem>
                <SelectItem value="asc">Nährstoff niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {originalFood && !isTableLoading && topMatches.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {topMatches.map((match) => (
            <Card key={match.food.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium leading-tight">{match.food.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {match.equivalentAmount
                        ? `${formatNumber(match.equivalentAmount, 0)} g für gleichen ${nutrientDef?.shortName ?? nutrientDef?.name}`
                        : `${formatNumber(originalAmount, 0)} g Vergleichsmenge`}
                    </p>
                  </div>
                  <Badge variant="secondary">{match.score ?? 0} %</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isTableLoading && (
        <p className="text-muted-foreground text-sm">Nährstoffwerte werden geladen …</p>
      )}
      {searchError && (
        <p className="text-destructive text-sm">
          Lebensmittel konnten nicht gesucht werden: {searchError}
        </p>
      )}
      {nutrientError && (
        <p className="text-destructive text-sm">
          Nährstoffwerte konnten nicht geladen werden: {nutrientError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rankedFoods.length} Austauschoptionen
            {originalFood
              ? ` für ${formatNumber(originalAmount, 0)} g ${originalFood.name}`
              : ` – sortiert nach ${nutrientDef?.name ?? selectedNutrient}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lebensmittel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Ähnlichkeit</TableHead>
                <TableHead className="text-right">Äquiv. Menge</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mr-3 h-auto p-1"
                    onClick={() => setSortMode((mode) => (mode === "desc" ? "asc" : "desc"))}
                  >
                    {nutrientDef?.name ?? "Nährstoff"} ({nutrientDef?.unit ?? ""})
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">Makros</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isTableLoading && rankedFoods.map((row) => {
                const category = FOOD_CATEGORIES.find((c) => c.id === row.food.categoryId);
                return (
                  <TableRow key={row.food.id}>
                    <TableCell className="font-medium">{row.food.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {category?.name ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.score !== null ? (
                        <Badge variant={row.score >= 80 ? "default" : "secondary"}>{row.score} %</Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.equivalentAmount
                        ? `${formatNumber(row.equivalentAmount, 0)} g`
                        : "–"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(row.pivotValue, getDecimals(selectedNutrient))}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {renderDelta(row.pivotDelta, selectedNutrient)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {TABLE_NUTRIENT_IDS.map((nutrientId) => {
                          const definition = getDefinition(nutrientId);
                          const delta = row.macroDeltas.get(nutrientId);
                          const neutral = delta == null || Math.abs(delta) < 0.05;
                          return (
                            <Badge
                              key={nutrientId}
                              variant="outline"
                              className={
                                neutral
                                  ? "text-[10px] font-normal text-muted-foreground"
                                  : delta > 0
                                    ? "border-blue-200 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                                    : "border-orange-200 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200"
                              }
                            >
                              {definition?.shortName ?? nutrientId} {delta && delta > 0 ? "+" : ""}
                              {formatNumber(delta ?? 0, getDecimals(nutrientId))}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => copyExchangeLine(row)} disabled={!originalFood}>
                          Kopieren
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setOriginalFood({
                              ...row.food,
                              source: row.food.source ?? row.food.sourceId?.toUpperCase() ?? "",
                              baseAmount: 100,
                              nutrients: nutrientIds.map((nutrientId) => ({
                                nutrientId,
                                amount: valuesByNutrient.get(nutrientId)?.get(row.food.id) ?? 0,
                              })),
                              portionSizes: [],
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            } as Food)
                          }
                        >
                          Als Original
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isTableLoading && rankedFoods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Keine passenden Lebensmittel gefunden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
