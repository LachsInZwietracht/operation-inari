"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Hash,
  Layers3,
  List,
  Scale,
  Search,
  Sparkles,
  TextSearch,
  TreePine,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCustomFoods } from "@/hooks/use-custom-foods";
import { useFoodSynonyms } from "@/hooks/use-food-synonyms";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";
import {
  FOOD_GROUPS,
  getFoodGroupDescendants,
  getFoodGroupName,
} from "@/lib/data/food-groups";
import { FOOD_SOURCES } from "@/lib/data/food-sources";
import { formatNumber } from "@/lib/format";
import { getClinicalStatusClass, getFoodSourceTrustTone } from "@/lib/clinical-status";
import { calculateProdScore, getProdScoreBadge } from "@/lib/prodi-score";
import { fuzzySearchFoods, normalizeText } from "@/lib/search";
import { getNutrientValue } from "@/lib/nutrients";
import type { Food, FoodBrowserResult, FoodSourceId, FoodGroupNode } from "@/lib/types";

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]));
const FoodSynonymManager = dynamic(
  () => import("@/components/food-synonym-manager").then((mod) => mod.FoodSynonymManager),
  { ssr: false },
);

const PAGE_SIZE = 25;
const BRAND_PAGE_SIZE = 12;

const EMPTY_BRANDED_RESULT: FoodBrowserResult = {
  foods: [],
  totalCount: 0,
  page: 1,
  pageSize: BRAND_PAGE_SIZE,
  hasMore: false,
};

export type SearchMode = "name" | "code" | "group" | "browse";

const SEARCH_MODES: Array<{
  id: SearchMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: "name",
    label: "Name",
    icon: <TextSearch className="h-4 w-4" />,
    description: "Fuzzy-Suche mit phonetischer Erkennung",
  },
  {
    id: "code",
    label: "Code",
    icon: <Hash className="h-4 w-4" />,
    description: "Suche nach BLS-Code oder Kennung",
  },
  {
    id: "group",
    label: "Gruppe",
    icon: <TreePine className="h-4 w-4" />,
    description: "Navigation nach Lebensmittelgruppe",
  },
  {
    id: "browse",
    label: "Alle",
    icon: <List className="h-4 w-4" />,
    description: "Vollständige Datenbank durchsuchen",
  },
];

function FoodGroupTree({
  groups,
  selectedId,
  onSelect,
  level = 0,
}: {
  groups: FoodGroupNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  level?: number;
}) {
  return (
    <div className={level > 0 ? "ml-3 border-l pl-3" : ""}>
      {groups.map((group) => {
        const isSelected = selectedId === group.id;
        const hasChildren = group.children && group.children.length > 0;

        if (hasChildren) {
          return (
            <Collapsible key={group.id} defaultOpen={isSelected}>
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <button type="button" className="mr-1 rounded p-0.5 hover:bg-muted">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform [[data-state=open]>button>&]:rotate-90" />
                  </button>
                </CollapsibleTrigger>
                <button
                  type="button"
                  onClick={() => onSelect(group.id)}
                  className={`flex-1 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted ${
                    isSelected ? "bg-primary/10 font-medium text-primary" : ""
                  }`}
                >
                  {group.name}
                </button>
              </div>
              <CollapsibleContent>
                <FoodGroupTree
                  groups={group.children ?? []}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  level={level + 1}
                />
              </CollapsibleContent>
            </Collapsible>
          );
        }

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelect(group.id)}
            className={`block w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted ${
              isSelected ? "bg-primary/10 font-medium text-primary" : ""
            }`}
          >
            {group.name}
          </button>
        );
      })}
    </div>
  );
}

function buildBrowserUrl(params: {
  q?: string;
  mode: SearchMode;
  categoryId: string | null;
  dataSourceId: FoodSourceId | "all";
  groupId: string | null;
  page: number;
  pageSize: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  searchParams.set("mode", params.mode);
  if (params.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params.dataSourceId !== "all") searchParams.set("dataSourceId", params.dataSourceId);
  if (params.groupId) searchParams.set("groupId", params.groupId);
  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));
  return `/api/foods/browser?${searchParams.toString()}`;
}

function filterLocalCustomFoods(params: {
  foods: Food[];
  q: string;
  mode: SearchMode;
  categoryId: string | null;
  dataSourceId: FoodSourceId | "all";
  groupId: string | null;
  getAliases: (food: Food) => string[];
}) {
  let filtered = params.foods.filter((food) => food.isCustom);

  if (params.dataSourceId !== "all") {
    filtered = filtered.filter((food) => food.sourceId === params.dataSourceId);
  }
  if (params.categoryId) {
    filtered = filtered.filter((food) => food.categoryId === params.categoryId);
  }
  if (params.groupId) {
    const descendants = new Set(getFoodGroupDescendants(params.groupId));
    filtered = filtered.filter((food) => food.foodGroupId && descendants.has(food.foodGroupId));
  }

  const query = params.q.trim();
  if (!query) return filtered;

  if (params.mode === "name" || params.mode === "browse" || params.mode === "group") {
    return fuzzySearchFoods(query, filtered, { getAliases: params.getAliases });
  }

  if (params.mode === "code") {
    const normalized = normalizeText(query);
    return filtered.filter((food) => {
      const code = food.blsCode?.toLowerCase() ?? "";
      const id = food.id.toLowerCase();
      return code.includes(normalized) || id.includes(normalized);
    });
  }

  return filtered;
}

export function LebensmittelPageClient({
  initialResult,
}: {
  initialResult: FoodBrowserResult;
}) {
  const router = useRouter();
  const [activeSource, setActiveSource] = useState<FoodSourceId | "all">("all");
  const [activeTab, setActiveTab] = useState("datenbank");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [selectedFoodGroupId, setSelectedFoodGroupId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initialResult);
  const [brandsResult, setBrandsResult] = useState(EMPTY_BRANDED_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [isBrandsLoading, setIsBrandsLoading] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);
  const skippedInitialFetch = useRef(false);
  const { customFoods } = useCustomFoods([]);
  const {
    getSynonymsForFood,
    getDisplayName,
    addSynonym,
    deleteSynonym,
    setPrimarySynonym,
    preferredSynonymMap,
  } = useFoodSynonyms();

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, selectedCategoryId, activeSource, selectedFoodGroupId, searchMode]);

  useEffect(() => {
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      if (
        activeSource === "all" &&
        searchMode === "name" &&
        !selectedCategoryId &&
        !selectedFoodGroupId &&
        page === 1 &&
        deferredQuery.trim() === ""
      ) {
        return;
      }
    }

    let cancelled = false;
    setIsLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          buildBrowserUrl({
            q: deferredQuery.trim() || undefined,
            mode: searchMode,
            categoryId: selectedCategoryId,
            dataSourceId: activeSource,
            groupId: selectedFoodGroupId,
            page,
            pageSize: PAGE_SIZE,
          }),
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const nextResult = (await response.json()) as FoodBrowserResult;
        if (!cancelled) {
          startTransition(() => setResult(nextResult));
        }
      } catch (error) {
        console.error("Failed to load food browser page:", error);
        if (!cancelled) {
          startTransition(() =>
            setResult({
              foods: [],
              totalCount: 0,
              page,
              pageSize: PAGE_SIZE,
              hasMore: false,
            }),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeSource, deferredQuery, page, searchMode, selectedCategoryId, selectedFoodGroupId]);

  useEffect(() => {
    if (activeTab !== "brands") return;
    let cancelled = false;
    setIsBrandsLoading(true);

    void (async () => {
      try {
        const response = await fetch(
          buildBrowserUrl({
            mode: "browse",
            categoryId: null,
            dataSourceId: "off",
            groupId: null,
            page: 1,
            pageSize: BRAND_PAGE_SIZE,
          }),
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const nextResult = (await response.json()) as FoodBrowserResult;
        if (!cancelled) {
          startTransition(() => setBrandsResult(nextResult));
        }
      } catch (error) {
        console.error("Failed to load OFF branded foods:", error);
      } finally {
        if (!cancelled) setIsBrandsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const localCustomMatches = useMemo(
    () =>
      filterLocalCustomFoods({
        foods: customFoods,
        q: deferredQuery,
        mode: searchMode,
        categoryId: selectedCategoryId,
        dataSourceId: activeSource,
        groupId: selectedFoodGroupId,
        getAliases: (food) => getSynonymsForFood(food.id).map((synonym) => synonym.name),
      }),
    [
      activeSource,
      customFoods,
      deferredQuery,
      getSynonymsForFood,
      searchMode,
      selectedCategoryId,
      selectedFoodGroupId,
    ],
  );

  const visibleFoods = useMemo(() => {
    if (page !== 1 || localCustomMatches.length === 0) return result.foods;
    const ids = new Set(localCustomMatches.map((food) => food.id));
    return [...localCustomMatches, ...result.foods.filter((food) => !ids.has(food.id))];
  }, [localCustomMatches, page, result.foods]);

  const foodScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const food of visibleFoods) {
      const score = food.prodScore ?? calculateProdScore(food.nutrients).score;
      map.set(food.id, score);
    }
    return map;
  }, [visibleFoods]);

  const resultCount = result.totalCount + (page === 1 ? localCustomMatches.length : 0);
  const resultCountLabel =
    result.hasMore && result.totalCount <= result.page * result.pageSize
      ? `${resultCount}+`
      : `${resultCount}`;
  const currentSource =
    activeSource === "all"
      ? null
      : FOOD_SOURCES.find((source) => source.id === activeSource);
  const pageCount = result.hasMore
    ? Math.max(page + 1, Math.ceil(Math.max(result.totalCount, 1) / result.pageSize))
    : Math.max(1, Math.ceil(Math.max(result.totalCount, 1) / result.pageSize));

  function handleSearchModeChange(mode: SearchMode) {
    setSearchMode(mode);
    setSearchQuery("");
    setSelectedFoodGroupId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lebensmittel"
        description="Datenbanken, Herstellerprodukte und eigene Einträge verwalten"
        helpText="Durchsuchen Sie den Bundeslebensmittelschluessel und Open Food Facts. Die Listenansicht laedt Ergebnisse paginiert vom Server, ohne den gesamten Katalog in den Browser zu laden."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/lebensmittel/neu">
              <Layers3 className="mr-1.5 h-4 w-4" />
              Neues Lebensmittel
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/lebensmittel/vergleichen">
              <Scale className="mr-1.5 h-4 w-4" />
              Vergleichen
            </Link>
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="datenbank">Datenbanken</TabsTrigger>
          <TabsTrigger value="brands">Herstellerprodukte</TabsTrigger>
        </TabsList>

        <TabsContent value="datenbank" className="space-y-4">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-4">
              <div className="overflow-x-auto rounded-lg border bg-muted/30 p-1">
                <div className="flex min-w-max items-center gap-1">
                <TooltipProvider delayDuration={300}>
                  {SEARCH_MODES.map((mode) => (
                    <Tooltip key={mode.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSearchModeChange(mode.id)}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            searchMode === mode.id
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {mode.icon}
                          <span className="hidden sm:inline">{mode.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{mode.label}</p>
                        <p className="text-xs text-muted-foreground">{mode.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder={
                      searchMode === "group"
                        ? "Innerhalb der Gruppe filtern..."
                        : searchMode === "name"
                          ? "Lebensmittel suchen (z.B. Karrote, Brokoli, Spinat)..."
                          : searchMode === "code"
                            ? "BLS-Code eingeben (z.B. G410100, R330)..."
                            : "Lebensmittel suchen..."
                    }
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                  {searchMode === "name" && searchQuery.trim() && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                  )}
                </div>
                <Select
                  value={selectedCategoryId ?? "all"}
                  onValueChange={(value) => setSelectedCategoryId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Alle Kategorien" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kategorien</SelectItem>
                    {FOOD_CATEGORIES.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Select
                  value={activeSource}
                  onValueChange={(value) => setActiveSource(value as FoodSourceId | "all")}
                >
                  <SelectTrigger className="w-full md:w-[240px]">
                    <SelectValue placeholder="Quelle waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Quellen</SelectItem>
                    {FOOD_SOURCES.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm">
                  {resultCountLabel} Lebensmittel
                  {activeSource !== "all" && currentSource ? ` · ${currentSource.version}` : " · alle Quellen"}
                  {searchQuery.trim() && searchMode === "name" && (
                    <span className="ml-1 text-purple-500">· Fuzzy-Suche aktiv</span>
                  )}
                </p>
              </div>

              {searchMode === "group" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Lebensmittelgruppen (BLS)</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-64 overflow-y-auto">
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedFoodGroupId(null)}
                        className={`block w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted ${
                          !selectedFoodGroupId ? "bg-primary/10 font-medium text-primary" : ""
                        }`}
                      >
                        Alle Gruppen
                      </button>
                      <FoodGroupTree
                        groups={FOOD_GROUPS}
                        selectedId={selectedFoodGroupId}
                        onSelect={setSelectedFoodGroupId}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-3 md:hidden">
                {isLoading ? (
                  <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
                    Ergebnisse werden geladen...
                  </div>
                ) : visibleFoods.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
                    Keine Lebensmittel gefunden.
                  </div>
                ) : (
                  visibleFoods.map((food) => {
                    const displayName = getDisplayName(food.id, food.name) ?? food.name;
                    const synonyms = getSynonymsForFood(food.id);
                    const previewSynonyms = synonyms.slice(0, 2);
                    const primaryCandidate =
                      preferredSynonymMap[food.id] ??
                      synonyms.find((synonym) => synonym.isPrimary)?.id ??
                      null;
                    const score = foodScores.get(food.id);
                    const badge = getProdScoreBadge(score);

                    return (
                      <div key={food.id} className="rounded-md border bg-card p-3 text-card-foreground shadow-xs">
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => router.push(`/lebensmittel/${food.id}`)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{displayName}</p>
                              {displayName !== food.name && (
                                <p className="text-muted-foreground text-xs line-through decoration-dotted">
                                  {food.name}
                                </p>
                              )}
                            </div>
                            <Badge className={`${badge.color} shrink-0 border-none px-2 py-0.5 text-[11px] font-semibold`}>
                              {badge.label}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">
                              {categoryMap.get(food.categoryId) ?? food.categoryId}
                            </Badge>
                            <Badge variant="outline" className={getClinicalStatusClass(getFoodSourceTrustTone(food.sourceId))}>
                              {food.source}
                            </Badge>
                            {food.blsCode && <Badge variant="outline">{food.blsCode}</Badge>}
                          </div>
                          {previewSynonyms.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {previewSynonyms.map((synonym) => (
                                <Badge key={synonym.id} variant="outline" className="text-[10px] font-normal">
                                  {synonym.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-[11px]">kcal</p>
                              <p className="font-medium">{formatNumber(getNutrientValue(food.nutrients, "energie"))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">Eiweiß</p>
                              <p className="font-medium">{formatNumber(getNutrientValue(food.nutrients, "eiweiss"), 1)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">Fett</p>
                              <p className="font-medium">{formatNumber(getNutrientValue(food.nutrients, "fett"), 1)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">Kohlenhydrate</p>
                              <p className="font-medium">{formatNumber(getNutrientValue(food.nutrients, "kohlenhydrate"), 1)}</p>
                            </div>
                          </div>
                        </button>
                        <Collapsible className="mt-2 border-t pt-2">
                          <CollapsibleTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="group h-8 px-0 text-xs text-muted-foreground">
                              Aliase verwalten
                              <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2">
                            <FoodSynonymManager
                              food={food}
                              synonyms={synonyms}
                              activeSynonymId={primaryCandidate}
                              addSynonym={addSynonym}
                              deleteSynonym={deleteSynonym}
                              setPrimarySynonym={setPrimarySynonym}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden overflow-x-auto rounded-md border md:block">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {searchMode === "code" && <TableHead>BLS-Code</TableHead>}
                      {searchMode === "group" && <TableHead>Gruppe</TableHead>}
                      <TableHead>Kategorie</TableHead>
                      <TableHead className="text-right">PRODIscore</TableHead>
                      <TableHead className="text-right">Quelle</TableHead>
                      <TableHead className="text-right">Energie (kcal)</TableHead>
                      <TableHead className="text-right">Eiweiß (g)</TableHead>
                      <TableHead className="text-right">Fett (g)</TableHead>
                      <TableHead className="text-right">Kohlenhydrate (g)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={searchMode === "code" || searchMode === "group" ? 10 : 9}
                          className="text-muted-foreground h-24 text-center"
                        >
                          Ergebnisse werden geladen...
                        </TableCell>
                      </TableRow>
                    ) : visibleFoods.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={searchMode === "code" || searchMode === "group" ? 10 : 9}
                          className="text-muted-foreground h-24 text-center"
                        >
                          Keine Lebensmittel gefunden.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleFoods.map((food) => {
                        const displayName = getDisplayName(food.id, food.name) ?? food.name;
                        const synonyms = getSynonymsForFood(food.id);
                        const previewSynonyms = synonyms.slice(0, 3);
                        const remainingSynonyms = synonyms.length - previewSynonyms.length;
                        const primaryCandidate =
                          preferredSynonymMap[food.id] ??
                          synonyms.find((synonym) => synonym.isPrimary)?.id ??
                          null;
                        const score = foodScores.get(food.id);
                        const badge = getProdScoreBadge(score);

                        return (
                          <TableRow
                            key={food.id}
                            className="cursor-pointer"
                            onClick={() => router.push(`/lebensmittel/${food.id}`)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{displayName}</span>
                                  {displayName !== food.name && (
                                    <span className="text-muted-foreground text-[11px] line-through decoration-dotted">
                                      {food.name}
                                    </span>
                                  )}
                                  {food.isCustom && (
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      Custom
                                    </Badge>
                                  )}
                                  {food.sourceId === "off" && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      OFF
                                    </Badge>
                                  )}
                                </div>
                                {previewSynonyms.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {previewSynonyms.map((synonym) => (
                                      <Badge key={synonym.id} variant="outline" className="text-[10px] font-normal">
                                        {synonym.name}
                                      </Badge>
                                    ))}
                                    {remainingSynonyms > 0 && (
                                      <Badge variant="outline" className="text-[10px] font-normal">
                                        +{remainingSynonyms}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <FoodSynonymManager
                                  food={food}
                                  synonyms={synonyms}
                                  activeSynonymId={primaryCandidate}
                                  addSynonym={addSynonym}
                                  deleteSynonym={deleteSynonym}
                                  setPrimarySynonym={setPrimarySynonym}
                                />
                              </div>
                            </TableCell>
                            {searchMode === "code" && (
                              <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                  {food.blsCode ?? "–"}
                                </code>
                              </TableCell>
                            )}
                            {searchMode === "group" && (
                              <TableCell className="text-xs text-muted-foreground">
                                {food.foodGroupId ? getFoodGroupName(food.foodGroupId) ?? "–" : "–"}
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant="secondary">
                                {categoryMap.get(food.categoryId) ?? food.categoryId}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge className={`${badge.color} border-none px-2 py-0.5 text-[11px] font-semibold`}>
                                  {badge.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {score !== undefined ? formatNumber(score, 0) : "–"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <Badge variant="outline" className={getClinicalStatusClass(getFoodSourceTrustTone(food.sourceId))}>
                                {food.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(getNutrientValue(food.nutrients, "energie"))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(getNutrientValue(food.nutrients, "eiweiss"), 1)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(getNutrientValue(food.nutrients, "fett"), 1)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(getNutrientValue(food.nutrients, "kohlenhydrate"), 1)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  Seite {page} von {pageCount}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isLoading}>
                    Zurueck
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={!result.hasMore || isLoading}>
                    Weiter
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Metadaten & Versionen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {currentSource ? (
                    <>
                      <div>
                        <p className="font-semibold">{currentSource.name}</p>
                        <p className="text-muted-foreground text-xs">
                          Version {currentSource.version} · Stand {currentSource.updatedAt}
                        </p>
                      </div>
                      <p>{currentSource.description}</p>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Abdeckung</p>
                        <p className="font-medium">{currentSource.coverage}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Wählen Sie eine Quelle aus, um Release Notes und Umfang zu sehen.
                    </p>
                  )}
                </CardContent>
              </Card>

              {searchMode === "name" && (
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      Intelligente Suche
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>Die Suche erkennt automatisch Tippfehler, Umlaute und phonetische Varianten.</p>
                    <p>Beispiel: &quot;Brokoli&quot; findet weiterhin &quot;Broccoli&quot; ueber die serverseitige Suche.</p>
                  </CardContent>
                </Card>
              )}

              {activeSource === "off" && (
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Open Food Facts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>Produktdaten von Open Food Facts.</p>
                    <p>Nur validierte und in den Hauptkatalog uebernommene Produkte erscheinen hier.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4">
          {isBrandsLoading ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">
                Markenprodukte werden geladen...
              </CardContent>
            </Card>
          ) : brandsResult.foods.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Keine Markenprodukte verfuegbar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Importieren Sie OFF-Daten oder Hersteller-Feeds, um hier kuratierte Produkte anzuzeigen.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {brandsResult.foods.map((food) => {
                const score = food.prodScore ?? calculateProdScore(food.nutrients).score;
                const badge = getProdScoreBadge(score);
                return (
                  <Card
                    key={food.id}
                    className="cursor-pointer border-l-4 border-l-primary"
                    onClick={() => router.push(`/lebensmittel/${food.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        {food.name}
                        <Badge variant="outline">{food.manufacturer ?? "OFF"}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase text-muted-foreground">PRODIscore</p>
                        <Badge className={`${badge.color} border-none px-2 py-0.5 text-xs font-semibold`}>
                          {badge.label} · {formatNumber(score, 0)}
                        </Badge>
                      </div>
                      {food.dataQualityScore !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Datenqualitaet: {formatNumber(food.dataQualityScore, 0)} / 100
                        </p>
                      )}
                      <div className="rounded-md bg-muted/60 p-3">
                        <p className="text-xs text-muted-foreground">Energie</p>
                        <p className="text-lg font-semibold">
                          {formatNumber(getNutrientValue(food.nutrients, "energie"), 0)} kcal
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">Produktdaten von Open Food Facts.</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
