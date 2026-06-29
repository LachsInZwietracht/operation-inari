"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChevronRight,
  Hash,
  Layers3,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  TextSearch,
  TreePine,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { Label } from "@/components/ui/label";
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
import { useFoodSourcePreference } from "@/hooks/use-food-source-preference";
import { useFoodSynonyms } from "@/hooks/use-food-synonyms";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";
import {
  FOOD_GROUPS,
  getFoodGroupDescendants,
  getFoodGroupName,
} from "@/lib/data/food-groups";
import { FOOD_SOURCES } from "@/lib/data/food-sources";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { canAccessDataSource } from "@/lib/data/entitlements";
import { formatNumber } from "@/lib/format";
import { getClinicalStatusClass, getFoodSourceTrustTone } from "@/lib/clinical-status";
import { fuzzySearchFoods, normalizeText } from "@/lib/search";
import { getNutrientValue } from "@/lib/nutrients";
import type {
  Food,
  FoodBrowserResult,
  FoodSourceId,
  FoodGroupNode,
  NutrientSortDirection,
} from "@/lib/types";

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]));

// Nutrient sort/filter (PRODI-feedback #4): pick one nutrient, order by it and
// optionally threshold-filter (per 100 g). Energy in kJ and Broteinheiten are
// excluded — they duplicate / derive from values already offered.
const NUTRIENT_GROUP_LABELS: Record<string, string> = {
  makronaehrstoffe: "Makronährstoffe",
  vitamine: "Vitamine",
  mineralstoffe: "Mineralstoffe & Spurenelemente",
  fettsaeuren: "Fettsäuren",
  aminosaeuren: "Aminosäuren",
  sonstige: "Sonstige",
};
const NUTRIENT_GROUP_ORDER = [
  "makronaehrstoffe",
  "vitamine",
  "mineralstoffe",
  "fettsaeuren",
  "aminosaeuren",
  "sonstige",
];
const EXCLUDED_SORT_NUTRIENT_IDS = new Set(["energie_kj", "broteinheiten"]);
const BASE_MACRO_NUTRIENT_IDS = new Set(["energie", "eiweiss", "fett", "kohlenhydrate"]);
const SORT_NUTRIENT_GROUPS = NUTRIENT_GROUP_ORDER.map((group) => ({
  group,
  label: NUTRIENT_GROUP_LABELS[group] ?? group,
  items: NUTRIENT_DEFINITIONS.filter(
    (definition) => definition.group === group && !EXCLUDED_SORT_NUTRIENT_IDS.has(definition.id),
  ).sort((a, b) => a.sortOrder - b.sortOrder),
})).filter((entry) => entry.items.length > 0);
const nutrientDefinitionById = new Map(
  NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

function parseNutrientBound(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function nutrientDecimalsForUnit(unit: string): number {
  if (unit === "kcal" || unit === "kJ") return 0;
  if (unit === "g") return 1;
  return 2;
}
const FoodSynonymManager = dynamic(
  () => import("@/components/food-synonym-manager").then((mod) => mod.FoodSynonymManager),
  { ssr: false },
);

const PAGE_SIZE = 25;
const BRAND_PAGE_SIZE = 12;
const ACTIVE_FOOD_BROWSER_SOURCE_IDS = new Set<FoodSourceId>(["bls", "sfk", "off", "custom"]);

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
  nutrientId?: string | null;
  nutrientSort?: NutrientSortDirection | null;
  nutrientMin?: number | null;
  nutrientMax?: number | null;
  page: number;
  pageSize: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  searchParams.set("mode", params.mode);
  if (params.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params.dataSourceId !== "all") searchParams.set("dataSourceId", params.dataSourceId);
  if (params.groupId) searchParams.set("groupId", params.groupId);
  if (params.nutrientId) {
    searchParams.set("nutrientId", params.nutrientId);
    if (params.nutrientSort) searchParams.set("nutrientSort", params.nutrientSort);
    if (params.nutrientMin != null) searchParams.set("nutrientMin", String(params.nutrientMin));
    if (params.nutrientMax != null) searchParams.set("nutrientMax", String(params.nutrientMax));
  }
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
  nutrientId: string | null;
  nutrientMin: number | null;
  nutrientMax: number | null;
  nutrientSort: NutrientSortDirection;
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
  if (query) {
    if (params.mode === "name" || params.mode === "browse" || params.mode === "group") {
      filtered = fuzzySearchFoods(query, filtered, { getAliases: params.getAliases });
    } else if (params.mode === "code") {
      const normalized = normalizeText(query);
      filtered = filtered.filter((food) => {
        const code = food.blsCode?.toLowerCase() ?? "";
        const id = food.id.toLowerCase();
        return code.includes(normalized) || id.includes(normalized);
      });
    }
  }

  if (params.nutrientId) {
    const nutrientId = params.nutrientId;
    if (params.nutrientMin != null) {
      filtered = filtered.filter(
        (food) => getNutrientValue(food.nutrients, nutrientId) >= params.nutrientMin!,
      );
    }
    if (params.nutrientMax != null) {
      filtered = filtered.filter(
        (food) => getNutrientValue(food.nutrients, nutrientId) <= params.nutrientMax!,
      );
    }
    const direction = params.nutrientSort === "asc" ? 1 : -1;
    filtered = [...filtered].sort(
      (a, b) =>
        (getNutrientValue(a.nutrients, nutrientId) - getNutrientValue(b.nutrients, nutrientId)) *
        direction,
    );
  }

  return filtered;
}

export function LebensmittelPageClient({
  initialResult,
  disabledSourceIds = [],
}: {
  initialResult: FoodBrowserResult;
  disabledSourceIds?: FoodSourceId[];
}) {
  const router = useRouter();
  const { activeSource, setActiveSource } = useFoodSourcePreference();
  const [activeTab, setActiveTab] = useState("datenbank");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [selectedFoodGroupId, setSelectedFoodGroupId] = useState<string | null>(null);
  const [nutrientFilterId, setNutrientFilterId] = useState<string | null>(null);
  const [nutrientSort, setNutrientSort] = useState<NutrientSortDirection>("desc");
  const [nutrientMin, setNutrientMin] = useState("");
  const [nutrientMax, setNutrientMax] = useState("");
  const [nutrientPanelOpen, setNutrientPanelOpen] = useState(false);
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

  const nutrientActive = Boolean(nutrientFilterId);
  const nutrientDef = nutrientFilterId ? nutrientDefinitionById.get(nutrientFilterId) ?? null : null;
  const nutrientMinValue = parseNutrientBound(nutrientMin);
  const nutrientMaxValue = parseNutrientBound(nutrientMax);
  const showNutrientColumn = Boolean(nutrientDef) && !BASE_MACRO_NUTRIENT_IDS.has(nutrientFilterId ?? "");
  const nutrientDecimals = nutrientDef ? nutrientDecimalsForUnit(nutrientDef.unit) : 1;

  function clearNutrientFilter() {
    setNutrientFilterId(null);
    setNutrientSort("desc");
    setNutrientMin("");
    setNutrientMax("");
  }

  useEffect(() => {
    setPage(1);
  }, [
    deferredQuery,
    selectedCategoryId,
    activeSource,
    selectedFoodGroupId,
    searchMode,
    nutrientFilterId,
    nutrientSort,
    nutrientMinValue,
    nutrientMaxValue,
  ]);

  // If a previously saved source was deactivated for the org, fall back to "all"
  // so the selector never shows a value the org can no longer use.
  useEffect(() => {
    if (activeSource !== "all" && disabledSourceIds.includes(activeSource)) {
      setActiveSource("all");
    }
  }, [activeSource, disabledSourceIds, setActiveSource]);

  useEffect(() => {
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      if (
        activeSource === "all" &&
        searchMode === "name" &&
        !selectedCategoryId &&
        !selectedFoodGroupId &&
        !nutrientFilterId &&
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
            nutrientId: nutrientFilterId,
            nutrientSort: nutrientFilterId ? nutrientSort : null,
            nutrientMin: nutrientFilterId ? nutrientMinValue : null,
            nutrientMax: nutrientFilterId ? nutrientMaxValue : null,
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
  }, [
    activeSource,
    deferredQuery,
    page,
    searchMode,
    selectedCategoryId,
    selectedFoodGroupId,
    nutrientFilterId,
    nutrientSort,
    nutrientMinValue,
    nutrientMaxValue,
  ]);

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
        nutrientId: nutrientFilterId,
        nutrientMin: nutrientFilterId ? nutrientMinValue : null,
        nutrientMax: nutrientFilterId ? nutrientMaxValue : null,
        nutrientSort,
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
      nutrientFilterId,
      nutrientMinValue,
      nutrientMaxValue,
      nutrientSort,
    ],
  );

  const visibleFoods = useMemo(() => {
    if (page !== 1 || localCustomMatches.length === 0) return result.foods;
    const ids = new Set(localCustomMatches.map((food) => food.id));
    const merged = [...localCustomMatches, ...result.foods.filter((food) => !ids.has(food.id))];
    // When sorting by a nutrient, re-order the merged page so locally-held
    // custom foods slot into the correct position instead of pinning to the top.
    if (nutrientActive && nutrientFilterId) {
      const direction = nutrientSort === "asc" ? 1 : -1;
      return [...merged].sort(
        (a, b) =>
          (getNutrientValue(a.nutrients, nutrientFilterId) -
            getNutrientValue(b.nutrients, nutrientFilterId)) *
          direction,
      );
    }
    return merged;
  }, [localCustomMatches, page, result.foods, nutrientActive, nutrientFilterId, nutrientSort]);

  const resultCount = result.totalCount + (page === 1 ? localCustomMatches.length : 0);
  const resultCountLabel =
    result.hasMore && result.totalCount <= result.page * result.pageSize
      ? `${resultCount}+`
      : `${resultCount}`;
  const currentSource =
    activeSource === "all"
      ? null
      : FOOD_SOURCES.find((source) => source.id === activeSource);
  const selectableFoodSources = useMemo(() => {
    const disabled = new Set(disabledSourceIds);
    return FOOD_SOURCES.filter(
      (source) =>
        ACTIVE_FOOD_BROWSER_SOURCE_IDS.has(source.id) &&
        canAccessDataSource(source.id) &&
        !disabled.has(source.id),
    );
  }, [disabledSourceIds]);
  const pageCount = result.hasMore
    ? Math.max(page + 1, Math.ceil(Math.max(result.totalCount, 1) / result.pageSize))
    : Math.max(1, Math.ceil(Math.max(result.totalCount, 1) / result.pageSize));
  const tableColSpan =
    6 +
    (searchMode === "code" ? 1 : 0) +
    (searchMode === "group" ? 1 : 0) +
    (showNutrientColumn ? 1 : 0);

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
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="datenbank">Datenbanken</TabsTrigger>
          <TabsTrigger value="brands">Herstellerprodukte</TabsTrigger>
        </TabsList>

        <TabsContent value="datenbank" className="space-y-4">
          <div className={`grid min-w-0 gap-4 ${activeSource === "off" ? "lg:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
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
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Aktive Datenbank</Label>
                    <Badge
                      variant={activeSource === "all" ? "outline" : "secondary"}
                      className="text-[10px]"
                    >
                      {activeSource === "all" ? "Alle Quellen" : "Gespeichert"}
                    </Badge>
                  </div>
                  <Select
                    value={activeSource}
                    onValueChange={(value) => setActiveSource(value as FoodSourceId | "all")}
                  >
                    <SelectTrigger className="w-full md:w-[240px]">
                      <SelectValue placeholder="Quelle waehlen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Quellen</SelectItem>
                      {selectableFoodSources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-sm md:self-end md:pb-2">
                  {resultCountLabel} Lebensmittel
                  {activeSource !== "all" && currentSource ? ` · ${currentSource.version}` : " · alle Quellen"}
                  {searchQuery.trim() && searchMode === "name" && (
                    <span className="ml-1 text-purple-500">· Fuzzy-Suche aktiv</span>
                  )}
                  {nutrientActive && nutrientDef && (
                    <span className="ml-1 text-primary">
                      · nach {nutrientDef.shortName} {nutrientSort === "desc" ? "↓" : "↑"}
                    </span>
                  )}
                </p>
              </div>

              <Collapsible
                open={nutrientPanelOpen}
                onOpenChange={setNutrientPanelOpen}
                className="rounded-lg border bg-muted/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Nach Nährstoff sortieren &amp; filtern</span>
                    {nutrientActive && nutrientDef && (
                      <Badge variant="secondary" className="text-[10px]">
                        {nutrientDef.shortName} ·{" "}
                        {nutrientSort === "desc" ? "höchste zuerst" : "niedrigste zuerst"}
                        {nutrientMinValue != null || nutrientMaxValue != null ? " · gefiltert" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {nutrientActive && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={clearNutrientFilter}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Zurücksetzen
                      </Button>
                    )}
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2">
                        <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent className="space-y-3 border-t p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nährstoff</Label>
                      <Select
                        value={nutrientFilterId ?? "none"}
                        onValueChange={(value) =>
                          setNutrientFilterId(value === "none" ? null : value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Nährstoff wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kein Nährstoff</SelectItem>
                          {SORT_NUTRIENT_GROUPS.map((entry) => (
                            <SelectGroup key={entry.group}>
                              <SelectLabel>{entry.label}</SelectLabel>
                              {entry.items.map((definition) => (
                                <SelectItem key={definition.id} value={definition.id}>
                                  {definition.name}
                                  {definition.unit ? ` (${definition.unit})` : ""}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reihenfolge</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant={nutrientSort === "desc" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          disabled={!nutrientActive}
                          onClick={() => setNutrientSort("desc")}
                        >
                          <ArrowDownWideNarrow className="mr-1 h-3.5 w-3.5" />
                          Höchste
                        </Button>
                        <Button
                          type="button"
                          variant={nutrientSort === "asc" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          disabled={!nutrientActive}
                          onClick={() => setNutrientSort("asc")}
                        >
                          <ArrowUpWideNarrow className="mr-1 h-3.5 w-3.5" />
                          Niedrigste
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Min.{nutrientDef ? ` (${nutrientDef.unit})` : ""}
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="z. B. 10"
                        value={nutrientMin}
                        disabled={!nutrientActive}
                        onChange={(event) => setNutrientMin(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Max.{nutrientDef ? ` (${nutrientDef.unit})` : ""}
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="optional"
                        value={nutrientMax}
                        disabled={!nutrientActive}
                        onChange={(event) => setNutrientMax(event.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Werte beziehen sich auf 100&nbsp;g. Beispiel: Eiweiß, „Höchste&quot;, Min.&nbsp;10
                    zeigt Lebensmittel mit mehr als 10&nbsp;g Eiweiß je 100&nbsp;g.
                  </p>
                </CollapsibleContent>
              </Collapsible>

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
                          {showNutrientColumn && nutrientDef && nutrientFilterId && (
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-[11px] text-primary">
                                {nutrientDef.shortName}:{" "}
                                {formatNumber(
                                  getNutrientValue(food.nutrients, nutrientFilterId),
                                  nutrientDecimals,
                                )}{" "}
                                {nutrientDef.unit}
                              </Badge>
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
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {showNutrientColumn && nutrientDef && (
                        <TableHead className="text-right text-primary">
                          {nutrientDef.shortName} ({nutrientDef.unit})
                        </TableHead>
                      )}
                      {searchMode === "code" && <TableHead>BLS-Code</TableHead>}
                      {searchMode === "group" && <TableHead>Gruppe</TableHead>}
                      <TableHead>Kategorie</TableHead>
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
                          colSpan={tableColSpan}
                          className="text-muted-foreground h-24 text-center"
                        >
                          Ergebnisse werden geladen...
                        </TableCell>
                      </TableRow>
                    ) : visibleFoods.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={tableColSpan}
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
                            {showNutrientColumn && nutrientFilterId && (
                              <TableCell className="text-right font-semibold text-primary">
                                {formatNumber(
                                  getNutrientValue(food.nutrients, nutrientFilterId),
                                  nutrientDecimals,
                                )}
                              </TableCell>
                            )}
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

            {activeSource === "off" && (
              <div className="space-y-4">
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Open Food Facts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>Produktdaten von Open Food Facts.</p>
                    <p>Nur validierte und in den Hauptkatalog uebernommene Produkte erscheinen hier.</p>
                  </CardContent>
                </Card>
              </div>
            )}
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
