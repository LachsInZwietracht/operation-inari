"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers3, Scale, Search } from "lucide-react";
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
import { useFoodSearch } from "@/hooks/use-food-search";
import { useCustomFoods } from "@/hooks/use-custom-foods";
import {
  FOODS,
  FOOD_CATEGORIES,
  BRANDED_FOODS,
  FOOD_SOURCES,
} from "@/lib/mock-data";
import { getNutrientValue } from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import { calculateProdScore, getProdScoreBadge } from "@/lib/prodi-score";
import type { Food, FoodSourceId } from "@/lib/types";

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]));

export default function LebensmittelPage() {
  const router = useRouter();
  const { customFoods } = useCustomFoods();
  const [activeSource, setActiveSource] = useState<FoodSourceId | "all">("bls");
  const [activeTab, setActiveTab] = useState("datenbank");

  const combinedFoods = useMemo<Food[]>(() => [...FOODS, ...customFoods], [customFoods]);
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
  } = useFoodSearch(sourceFilteredFoods);

  const currentSource = activeSource === "all"
    ? null
    : FOOD_SOURCES.find((source) => source.id === activeSource);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lebensmittel"
        description="Datenbanken, Herstellerprodukte und eigene Einträge verwalten"
        helpText="Durchsuchen Sie den Bundeslebensmittelschlüssel (BLS) und weitere Datenbanken. Sie können eigene Lebensmittel anlegen, Nährwerte einsehen und Produkte miteinander vergleichen."
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
              Lebensmittel vergleichen
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
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Lebensmittel suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
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
                  {filteredFoods.length} Lebensmittel ·
                  {" "}
                  {activeSource === "all" ? "alle Quellen" : currentSource?.version}
                </p>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
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
                        <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                          Keine Lebensmittel gefunden.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFoods.map((food) => (
                        <TableRow
                          key={food.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/lebensmittel/${food.id}`)}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {food.name}
                            {food.isCustom && (
                              <Badge variant="outline" className="text-[10px] uppercase">
                                Custom
                              </Badge>
                            )}
                          </TableCell>
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
                                  <Badge className={`${badge.color} border-none px-2 py-0.5 text-[11px] font-semibold`}>
                                    {badge.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {score !== undefined ? formatNumber(score, 0) : "–"}
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {food.source}
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

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
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {BRANDED_FOODS.map((food) => {
              const score = food.prodScore ?? calculateProdScore(food.nutrients).score;
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
                      <p className="text-xs uppercase text-muted-foreground">PRODIscore</p>
                      <Badge className={`${badge.color} border-none px-2 py-0.5 text-xs font-semibold`}>
                        {badge.label} · {formatNumber(score, 0)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {food.allergens?.map((allergen) => (
                        <Badge key={allergen} variant="destructive" className="text-xs">
                          {allergen}
                        </Badge>
                    ))}
                    {food.additives?.map((additive) => (
                      <Badge key={additive} variant="secondary" className="text-xs">
                        {additive}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    CO₂-Bilanz: {food.co2PerPortion ? `${formatNumber(food.co2PerPortion, 2)} kg / Portion` : "in Prüfung"}
                  </p>
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">Energie</p>
                    <p className="text-lg font-semibold">
                      {formatNumber(getNutrientValue(food.nutrients, "energie"), 0)} kcal
                    </p>
                  </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
