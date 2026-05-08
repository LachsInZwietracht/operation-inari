"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFoodSearch } from "@/components/foods-provider";
import { useNutrientValueMaps } from "@/hooks/use-nutrient-values";
import { searchFoodsInBrowser } from "@/lib/food-browser-search";
import type { Food, FoodSearchItem } from "@/lib/types";

type SortDir = "asc" | "desc";

const TABLE_NUTRIENT_IDS = ["energie", "eiweiss", "fett", "kohlenhydrate"];

type ExchangeTableFood = FoodSearchItem & Pick<Food, "blsCode" | "source">;

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

export function AustauschtabellenPageClient() {
  const { index: foods, isLoading: isIndexLoading, loadIndex } = useFoodSearch();
  const [selectedNutrient, setSelectedNutrient] = useState("energie");
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ExchangeTableFood[]>([]);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const isSearching = query.length >= 2;
    const sourceFoods = isSearching ? searchResults : foods;

    return sourceFoods
      .filter((food) => {
        const matchesSearch = isSearching || !query || food.name.toLowerCase().includes(query);
        const matchesCategory = categoryFilter === "alle" || food.categoryId === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const aVal = nutrientValues.get(a.id) ?? 0;
        const bVal = nutrientValues.get(b.id) ?? 0;
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [foods, searchResults, search, categoryFilter, sortDir, nutrientValues]);

  function getNutrientAmount(foodId: string, nutrientId: string) {
    return valuesByNutrient.get(nutrientId)?.get(foodId) ?? 0;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Austauschtabellen"
        description="Lebensmittel nach Nährstoffgehalt vergleichen und austauschen"
        helpText="Finden Sie Lebensmittel mit ähnlichem Nährstoffprofil als Austauschoptionen. Ideal für die Beratung bei Allergien, Unverträglichkeiten oder persönlichen Vorlieben Ihrer Patienten."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Lebensmittel suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
          <SelectTrigger className="w-full sm:w-[220px]">
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
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
            {filtered.length} Lebensmittel – sortiert nach {nutrientDef?.name ?? selectedNutrient}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lebensmittel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mr-3 h-auto p-1"
                    onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  >
                    {nutrientDef?.name ?? "Nährstoff"} ({nutrientDef?.unit ?? ""})
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Energie (kcal)</TableHead>
                <TableHead className="text-right">Eiweiß (g)</TableHead>
                <TableHead className="text-right">Fett (g)</TableHead>
                <TableHead className="text-right">Kohlenhydrate (g)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isTableLoading && filtered.map((food) => {
                const category = FOOD_CATEGORIES.find((c) => c.id === food.categoryId);
                const nutrientVal = nutrientValues.get(food.id) ?? 0;
                return (
                  <TableRow key={food.id}>
                    <TableCell className="font-medium">{food.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {category?.name ?? "–"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(nutrientVal, 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientAmount(food.id, "energie"), 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientAmount(food.id, "eiweiss"), 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientAmount(food.id, "fett"), 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientAmount(food.id, "kohlenhydrate"), 1)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isTableLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
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
