"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { FoodSynonymManager } from "@/components/food-synonym-manager";
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
import { useFoodSearch, type SearchMode } from "@/hooks/use-food-search";
import { useCustomFoods } from "@/hooks/use-custom-foods";
import { useFoodSynonyms } from "@/hooks/use-food-synonyms";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";
import { FOOD_GROUPS, getFoodGroupName } from "@/lib/data/food-groups";
import { FOOD_SOURCES } from "@/lib/data/food-sources";
import { getNutrientValue } from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import { calculateProdScore, getProdScoreBadge } from "@/lib/prodi-score";
import type { Food, FoodSourceId, FoodGroupNode } from "@/lib/types";
import { useFoods } from "@/components/foods-provider";

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]));

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

function MatchTypeBadge({ matchType }: { matchType: string }) {
  if (matchType === "none") return null;

  const config: Record<string, { label: string; className: string }> = {
    exact: { label: "Exakt", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    prefix: { label: "Präfix", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    contains: { label: "Enthält", className: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200" },
    fuzzy: { label: "Ähnlich", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
    phonetic: { label: "Klingt wie", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
    group: { label: "Gruppe", className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  };

  const c = config[matchType];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

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
            <Collapsible key={group.id} defaultOpen={isSelected || group.children?.some(c => c.id === selectedId)}>
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="mr-1 rounded p-0.5 hover:bg-muted"
                  >
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
                  groups={group.children!}
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

export function LebensmittelPageClient() {
  const foods = useFoods();
  const brandedFoods = useMemo(() => {
    const branded = foods.filter(
      (food) => food.isBranded || food.sourceId === "hersteller" || Boolean(food.manufacturer)
    );
    return branded.length > 0 ? branded : foods.filter((food) => Boolean(food.manufacturer));
  }, [foods]);
  const router = useRouter();
  const { customFoods } = useCustomFoods(foods);
  const {
    getSynonymsForFood,
    getDisplayName,
    addSynonym,
    deleteSynonym,
    setPrimarySynonym,
    preferredSynonymMap,
  } = useFoodSynonyms();
  const [activeSource, setActiveSource] = useState<FoodSourceId | "all">("bls");
  const [activeTab, setActiveTab] = useState("datenbank");

  const combinedFoods = useMemo<Food[]>(() => [...foods, ...customFoods], [foods, customFoods]);
  const foodScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const food of combinedFoods) {
      const score = food.prodScore ?? calculateProdScore(food.nutrients).score;
      map.set(food.id, score);
    }
    return map;
  }, [combinedFoods]);

  const sourceFilteredFoods = useMemo(() => {
    if (activeSource === "all") return combinedFoods;
    return combinedFoods.filter((food) => food.sourceId === activeSource);
  }, [combinedFoods, activeSource]);

  const {
    filteredFoods,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    searchMode,
    setSearchMode,
    selectedFoodGroupId,
    setSelectedFoodGroupId,
    resultCount,
  } = useFoodSearch(sourceFilteredFoods, {
    getAliases: (food) => getSynonymsForFood(food.id).map((synonym) => synonym.name),
  });

  const currentSource =
    activeSource === "all"
      ? null
      : FOOD_SOURCES.find((source) => source.id === activeSource);

  const showMatchIndicators = searchMode === "name" && searchQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lebensmittel"
        description="Datenbanken, Herstellerprodukte und eigene Einträge verwalten"
        helpText="Durchsuchen Sie den Bundeslebensmittelschlüssel (BLS) und weitere Datenbanken. Nutzen Sie die Fuzzy-Suche für Tippfehler und phonetische Varianten oder suchen Sie nach BLS-Code und Lebensmittelgruppe."
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
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {/* Search Mode Selector */}
              <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
                <TooltipProvider delayDuration={300}>
                  {SEARCH_MODES.map((mode) => (
                    <Tooltip key={mode.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSearchMode(mode.id)}
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

              {/* Search Input Area — adapts to mode */}
              <div className="flex flex-col gap-4 sm:flex-row">
                {searchMode === "group" ? (
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="Innerhalb der Gruppe filtern..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                ) : (
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder={
                        searchMode === "name"
                          ? "Lebensmittel suchen (z.B. Karrote, Brokoli, Spinat)..."
                          : searchMode === "code"
                            ? "BLS-Code eingeben (z.B. G410100, R330)..."
                            : "Lebensmittel suchen..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    {searchMode === "name" && searchQuery.trim().length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      </div>
                    )}
                  </div>
                )}
                <Select
                  value={selectedCategoryId ?? "all"}
                  onValueChange={(value) =>
                    setSelectedCategoryId(value === "all" ? null : value)
                  }
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

              {/* Source filter + result count */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Select
                  value={activeSource}
                  onValueChange={(value) =>
                    setActiveSource(value as FoodSourceId | "all")
                  }
                >
                  <SelectTrigger className="w-full md:w-[240px]">
                    <SelectValue placeholder="Quelle wählen" />
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
                  {resultCount} Lebensmittel
                  {activeSource !== "all" && currentSource
                    ? ` · ${currentSource.version}`
                    : " · alle Quellen"}
                  {searchQuery.trim() && searchMode === "name" && (
                    <span className="ml-1 text-purple-500">· Fuzzy-Suche aktiv</span>
                  )}
                </p>
              </div>

              {/* Food Group Tree — visible in group mode */}
              {searchMode === "group" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      Lebensmittelgruppen (BLS)
                    </CardTitle>
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

              {/* Results Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {searchMode === "code" && (
                        <TableHead>BLS-Code</TableHead>
                      )}
                      {searchMode === "group" && (
                        <TableHead>Gruppe</TableHead>
                      )}
                      <TableHead>Kategorie</TableHead>
                      <TableHead className="text-right">PRODIscore</TableHead>
                      <TableHead className="text-right">Quelle</TableHead>
                      <TableHead className="text-right">Energie (kcal)</TableHead>
                      <TableHead className="text-right">Eiweiß (g)</TableHead>
                      <TableHead className="text-right">Fett (g)</TableHead>
                      <TableHead className="text-right">KH (g)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFoods.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={searchMode === "code" || searchMode === "group" ? 10 : 9}
                          className="text-muted-foreground h-24 text-center"
                        >
                          {searchMode === "name" && searchQuery.trim() ? (
                            <div className="space-y-1">
                              <p>Keine Lebensmittel gefunden.</p>
                              <p className="text-xs">
                                Die Suche berücksichtigt Tippfehler, Umlaute und phonetische Varianten.
                              </p>
                            </div>
                          ) : searchMode === "code" && searchQuery.trim() ? (
                            <div className="space-y-1">
                              <p>Kein Lebensmittel mit diesem Code gefunden.</p>
                              <p className="text-xs">
                                Geben Sie einen BLS-Code ein, z.B. &quot;G410100&quot; für Karotte.
                              </p>
                            </div>
                          ) : searchMode === "group" && selectedFoodGroupId ? (
                            <p>Keine Lebensmittel in dieser Gruppe.</p>
                          ) : (
                            <p>Keine Lebensmittel gefunden.</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFoods.map((food) => {
                        const displayName = getDisplayName(food.id, food.name) ?? food.name;
                        const synonyms = getSynonymsForFood(food.id);
                        const previewSynonyms = synonyms.slice(0, 3);
                        const remainingSynonyms = synonyms.length - previewSynonyms.length;
                        const matchedAlias =
                          food.matchedField === "synonym" && food.matchedValue
                            ? food.matchedValue
                            : null;
                        const primaryCandidate = preferredSynonymMap[food.id] ?? synonyms.find((syn) => syn.isPrimary)?.id ?? null;
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
                                    <span className="text-muted-foreground line-through decoration-dotted text-[11px]">
                                      {food.name}
                                    </span>
                                  )}
                                  {food.isCustom && (
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      Custom
                                    </Badge>
                                  )}
                                  {matchedAlias && (
                                    <Badge variant="secondary" className="text-[10px] font-normal">
                                      Alias „{matchedAlias}“
                                    </Badge>
                                  )}
                                  {showMatchIndicators && (
                                    <MatchTypeBadge matchType={food.matchType} />
                                  )}
                                </div>
                                {synonyms.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {previewSynonyms.map((synonym) => (
                                      <Badge
                                        key={synonym.id}
                                        variant="outline"
                                        className="text-[10px] font-normal"
                                      >
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
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {food.foodGroupId
                                  ? getFoodGroupName(food.foodGroupId) ?? "–"
                                  : "–"}
                              </span>
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="secondary">
                              {categoryMap.get(food.categoryId) ?? food.categoryId}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const score = foodScores.get(food.id);
                              const badge = getProdScoreBadge(score);
                              return (
                                <div className="flex items-center justify-end gap-2">
                                  <Badge
                                    className={`${badge.color} border-none px-2 py-0.5 text-[11px] font-semibold`}
                                  >
                                    {badge.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {score !== undefined
                                      ? formatNumber(score, 0)
                                      : "–"}
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {food.source}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              getNutrientValue(food.nutrients, "energie")
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              getNutrientValue(food.nutrients, "eiweiss"),
                              1
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              getNutrientValue(food.nutrients, "fett"),
                              1
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              getNutrientValue(food.nutrients, "kohlenhydrate"),
                              1
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Sidebar */}
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
                          Version {currentSource.version} · Stand{" "}
                          {currentSource.updatedAt}
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
                      Wählen Sie eine Quelle aus, um Release Notes und Umfang zu
                      sehen.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Search tips card */}
              {searchMode === "name" && (
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      Intelligente Suche
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>Die Suche erkennt automatisch:</p>
                    <ul className="space-y-1 pl-3">
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-purple-400" />
                        <span><strong>Tippfehler</strong> — &quot;Karrote&quot; findet Karotte</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-purple-400" />
                        <span><strong>Umlaute</strong> — &quot;Broetchen&quot; findet Brötchen</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-purple-400" />
                        <span><strong>Phonetik</strong> — &quot;Brokoli&quot; findet Brokkoli</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-purple-400" />
                        <span><strong>Teilwörter</strong> — &quot;brust&quot; findet Haehnchenbrust</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              )}

              {searchMode === "code" && (
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      <Hash className="h-3.5 w-3.5" />
                      BLS-Code Aufbau
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>Der BLS-Code folgt dem Schema:</p>
                    <div className="rounded-md bg-muted/50 p-2 font-mono text-[11px]">
                      <span className="text-blue-500">G</span>
                      <span className="text-green-500">4</span>
                      <span className="text-amber-500">10</span>
                      <span className="text-red-500">100</span>
                    </div>
                    <ul className="space-y-0.5 pl-1">
                      <li><span className="font-mono text-blue-500">G</span> = Hauptgruppe (Gemüse)</li>
                      <li><span className="font-mono text-green-500">4</span> = Untergruppe (Wurzelgemüse)</li>
                      <li><span className="font-mono text-amber-500">10</span> = Artikelnr.</li>
                      <li><span className="font-mono text-red-500">100</span> = Zubereitungsart</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4">
          {brandedFoods.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Keine Markenprodukte verfügbar
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Importiere Hersteller-Feeds oder setze <code>is_branded</code> in Supabase,
                um hier kuratierte Produkte anzuzeigen. Aktuell liefert der Datenbestand nur generische BLS-Einträge.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {brandedFoods.map((food) => {
                const score =
                  food.prodScore ?? calculateProdScore(food.nutrients).score;
                const badge = getProdScoreBadge(score);
                return (
                  <Card key={food.id} className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      {food.name}
                      <Badge variant="outline">{food.manufacturer}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase text-muted-foreground">
                        PRODIscore
                      </p>
                      <Badge
                        className={`${badge.color} border-none px-2 py-0.5 text-xs font-semibold`}
                      >
                        {badge.label} · {formatNumber(score, 0)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {food.allergens?.map((allergen) => (
                        <Badge
                          key={allergen}
                          variant="destructive"
                          className="text-xs"
                        >
                          {allergen}
                        </Badge>
                      ))}
                      {food.additives?.map((additive) => (
                        <Badge
                          key={additive}
                          variant="secondary"
                          className="text-xs"
                        >
                          {additive}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      CO₂-Bilanz:{" "}
                      {food.co2PerPortion
                        ? `${formatNumber(food.co2PerPortion, 2)} kg / Portion`
                        : "in Prüfung"}
                    </p>
                    <div className="rounded-md bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">Energie</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(
                          getNutrientValue(food.nutrients, "energie"),
                          0
                        )}{" "}
                        kcal
                      </p>
                    </div>
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
