"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NutrientBar } from "@/components/nutrient-bar";
import { MacroRingChart } from "@/components/macro-ring-chart";
import {
  FOOD_CATEGORIES,
  NUTRIENT_DEFINITIONS,
  REFERENCE_VALUES,
  FOOD_SOURCES,
} from "@/lib/mock-data";
import { getNutrientValue } from "@/lib/nutrients";
import { formatNumber, formatNutrient } from "@/lib/format";
import { NUTRIENT_GROUP_LABELS } from "@/lib/constants";
import type { Food, NutrientGroup } from "@/lib/types";
import { calculateProdScore } from "@/lib/prodi-score";
import { Progress } from "@/components/ui/progress";
import { estimateFoodCo2 } from "@/lib/sustainability";

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]));

const SUMMARY_NUTRIENTS = [
  { id: "energie", label: "Energie", unit: "kcal" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
] as const;

function getReferenceValue(nutrientId: string, gender: "m" | "w" = "m") {
  return (
    REFERENCE_VALUES.find((rv) => rv.nutrientId === nutrientId && rv.gender === gender)
      ?.amount ?? 0
  );
}

function getNutrientsByGroup(group: NutrientGroup) {
  return NUTRIENT_DEFINITIONS.filter((nd) => nd.group === group).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

interface NutrientTabContentProps {
  group: NutrientGroup;
  nutrients: { nutrientId: string; amount: number }[];
}

function NutrientTabContent({ group, nutrients }: NutrientTabContentProps) {
  const definitions = getNutrientsByGroup(group);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nährstoff</TableHead>
            <TableHead className="text-right">Menge</TableHead>
            <TableHead className="text-right">Referenz (DGE)</TableHead>
            <TableHead className="w-[200px]">Anteil</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.map((def) => {
            const value = getNutrientValue(nutrients, def.id);
            const ref = getReferenceValue(def.id);

            return (
              <TableRow key={def.id}>
                <TableCell className="font-medium">{def.name}</TableCell>
                <TableCell className="text-right">{formatNutrient(value, def.unit)}</TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {ref > 0 ? formatNutrient(ref, def.unit) : "–"}
                </TableCell>
                <TableCell>
                  {ref > 0 ? (
                    <NutrientBar label="" value={value} unit={def.unit} referenceValue={ref} />
                  ) : (
                    <span className="text-muted-foreground text-sm">–</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function FoodDetailContent({ food }: { food: Food }) {
  const categoryName = categoryMap.get(food.categoryId) ?? food.categoryId;
  const sourceMeta = food.sourceId ? FOOD_SOURCES.find((s) => s.id === food.sourceId) : null;
  const prodScore = useMemo(() => calculateProdScore(food.nutrients), [food]);
  const badge = prodScore.badge;
  const referencePortion = food.portionSizes?.[0];
  const co2PerBase = useMemo(() => {
    if (food.co2PerPortion && referencePortion) {
      const factor = referencePortion.amount > 0 ? food.baseAmount / referencePortion.amount : 1;
      return food.co2PerPortion * factor;
    }
    return estimateFoodCo2(food, food.baseAmount);
  }, [food, referencePortion]);
  const co2PerPortion = useMemo(() => {
    if (food.co2PerPortion) return food.co2PerPortion;
    if (referencePortion) return estimateFoodCo2(food, referencePortion.amount);
    return null;
  }, [food, referencePortion]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/lebensmittel"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>
      </div>

      <PageHeader title={food.name}>
        <Badge variant="secondary">{categoryName}</Badge>
        {food.isCustom && <Badge variant="outline">Custom</Badge>}
        {food.isRecipeDerived && <Badge variant="outline">Aus Rezept</Badge>}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quelle & Version</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Quelle: {food.source}
            </p>
            {food.sourceVersion && (
              <p className="text-xs text-muted-foreground">
                Version {food.sourceVersion}
              </p>
            )}
            {sourceMeta && (
              <div className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{sourceMeta.name}</p>
                <p>{sourceMeta.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produktinfos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {food.manufacturer && (
              <p>
                Hersteller: <span className="font-medium">{food.manufacturer}</span>
              </p>
            )}
            {food.co2PerPortion && (
              <p>
                CO₂ je Portion: <span className="font-medium">{formatNumber(food.co2PerPortion, 2)} kg</span>
              </p>
            )}
            {food.portionSizes && food.portionSizes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {food.portionSizes.map((portion) => (
                  <Badge key={portion.label} variant="outline">
                    {portion.label} ({formatNumber(portion.amount, 0)} g)
                  </Badge>
                ))}
              </div>
            )}
            {(food.allergens?.length || 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {food.allergens?.map((allergen) => (
                  <Badge key={allergen} variant="destructive" className="text-xs">
                    {allergen}
                  </Badge>
                ))}
              </div>
            )}
            {(food.additives?.length || 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {food.additives?.map((additive) => (
                  <Badge key={additive} variant="secondary" className="text-xs">
                    {additive}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualität & Nachhaltigkeit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">PRODIscore</p>
                <p className="text-3xl font-semibold">{formatNumber(prodScore.score, 0)}</p>
                <p className="text-muted-foreground text-xs">{prodScore.summary}</p>
              </div>
              <Badge className={`${badge.color} border-none px-3 py-1 text-xs font-bold`}>
                {badge.label}
              </Badge>
            </div>
            <Progress value={prodScore.score} />
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                CO₂ je {formatNumber(food.baseAmount, 0)} g
              </p>
              <p className="text-lg font-semibold">{formatNumber(co2PerBase, 2)} kg</p>
              {co2PerPortion !== null && referencePortion && (
                <p className="text-muted-foreground text-xs">
                  Portion {referencePortion.label}: {formatNumber(co2PerPortion, 2)} kg
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-sm">
        Nährwerte pro {formatNumber(food.baseAmount)} g · Quelle: {food.source}
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {SUMMARY_NUTRIENTS.map((sn) => {
          const value = getNutrientValue(food.nutrients, sn.id);
          return (
            <Card key={sn.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {sn.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatNumber(value, sn.id === "energie" ? 0 : 1)}
                </p>
                <p className="text-muted-foreground text-xs">{sn.unit}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Makronährstoff-Verteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <MacroRingChart nutrients={food.nutrients} />
        </CardContent>
      </Card>

      <Tabs defaultValue="makronaehrstoffe">
        <TabsList className="flex-wrap">
          {(Object.entries(NUTRIENT_GROUP_LABELS) as [NutrientGroup, string][]).map(
            ([group, label]) => (
              <TabsTrigger key={group} value={group}>
                {label}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        {(Object.keys(NUTRIENT_GROUP_LABELS) as NutrientGroup[]).map((group) => (
          <TabsContent key={group} value={group}>
            <NutrientTabContent group={group} nutrients={food.nutrients} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
