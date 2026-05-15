"use client";

import Link from "next/link";
import { useMemo } from "react";
import dynamic from "next/dynamic";
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
import { ReferenceProfileSelector } from "@/components/reference-profile-selector";
import { canAccessDataSource } from "@/lib/data/entitlements";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { FOOD_SOURCES } from "@/lib/data/food-sources";
import { getNutrientValue } from "@/lib/nutrients";
import { getReferenceAmount } from "@/lib/reference-values";
import { useReferenceProfiles } from "@/hooks/use-reference-profiles";
import { formatNumber, formatNutrient } from "@/lib/format";
import { NUTRIENT_GROUP_LABELS } from "@/lib/constants";
import type { Food, NutrientGroup, PatientAllergenEntry, ResolvedReferenceConfig } from "@/lib/types";
import { estimateFoodCo2 } from "@/lib/sustainability";
import { checkAllergenConflicts } from "@/lib/allergen-warnings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { AdditiveList } from "@/components/additive-list";

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]));

const MacroRingChart = dynamic(
  () => import("@/components/macro-ring-chart").then((mod) => mod.MacroRingChart),
  { ssr: false, loading: () => <div className="h-[240px] rounded-md bg-muted/40" /> },
);

const SUMMARY_NUTRIENTS = [
  { id: "energie", label: "Energie", unit: "kcal" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
] as const;

function getNutrientsByGroup(group: NutrientGroup) {
  return NUTRIENT_DEFINITIONS.filter((nd) => nd.group === group).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

interface NutrientTabContentProps {
  group: NutrientGroup;
  nutrients: { nutrientId: string; amount: number }[];
  refConfig: ResolvedReferenceConfig;
}

function NutrientTabContent({ group, nutrients, refConfig }: NutrientTabContentProps) {
  const definitions = getNutrientsByGroup(group);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nährstoff</TableHead>
            <TableHead className="text-right">Menge</TableHead>
            <TableHead className="text-right">Referenz ({refConfig.standardName})</TableHead>
            <TableHead className="w-[200px]">Anteil</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.map((def) => {
            const value = getNutrientValue(nutrients, def.id);
            const ref = getReferenceAmount(refConfig, def.id);

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

function NutrientTabs({
  nutrients,
  refConfig,
}: {
  nutrients: { nutrientId: string; amount: number }[];
  refConfig: ResolvedReferenceConfig;
}) {
  const availableGroups = useMemo(() => {
    return (Object.keys(NUTRIENT_GROUP_LABELS) as NutrientGroup[]).filter((group) => {
      const defs = getNutrientsByGroup(group);
      return defs.some((d) => nutrients.some((n) => n.nutrientId === d.id && n.amount > 0));
    });
  }, [nutrients]);

  const defaultTab = availableGroups[0] ?? "makronaehrstoffe";

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="flex-wrap">
        {availableGroups.map((group) => (
          <TabsTrigger key={group} value={group}>
            {NUTRIENT_GROUP_LABELS[group]}
          </TabsTrigger>
        ))}
      </TabsList>
      {availableGroups.map((group) => (
        <TabsContent key={group} value={group}>
          <NutrientTabContent group={group} nutrients={nutrients} refConfig={refConfig} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface FoodDetailContentProps {
  food: Food;
  patientAllergens?: PatientAllergenEntry[];
}

export function FoodDetailContent({ food, patientAllergens }: FoodDetailContentProps) {
  const { getResolvedConfig } = useReferenceProfiles();
  const refConfig = useMemo(() => {
    return getResolvedConfig({
      dateOfBirth: "1990-01-01", // Default adult context for food detail view
      gender: "w",
    });
  }, [getResolvedConfig]);

  const categoryName = categoryMap.get(food.categoryId) ?? food.categoryId;
  const sourceMeta = food.sourceId ? FOOD_SOURCES.find((s) => s.id === food.sourceId) : null;
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

  const allergenWarnings = useMemo(() => {
    if (!patientAllergens?.length || !food.allergens?.length) return [];
    return checkAllergenConflicts(food.allergens, patientAllergens);
  }, [food.allergens, patientAllergens]);

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
        {food.sourceId === "off" && <Badge variant="outline">Open Food Facts</Badge>}
        {food.sourceId === "sfk" && <Badge variant="outline">SFK</Badge>}
      </PageHeader>

      {food.sourceId === "sfk" && !canAccessDataSource("sfk") ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Lizenzhinweis</AlertTitle>
          <AlertDescription>
            Dieses Lebensmittel stammt aus der Souci-Fachmann-Kraut-Datenbank. Der Zugriff auf SFK-Daten erfordert eine
            aktive Plus-Datenbank-Lizenz.
          </AlertDescription>
        </Alert>
      ) : null}

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
            {food.sourceId === "off" && (
              <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Produktdaten von Open Food Facts</p>
                <p>Nur validierte und in den Hauptkatalog uebernommene Produkte werden angezeigt.</p>
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
            {allergenWarnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Allergenwarnung</AlertTitle>
                <AlertDescription>
                  Dieses Lebensmittel enthält: {allergenWarnings.map((w) => w.allergenLabel).join(", ")}
                </AlertDescription>
              </Alert>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nachhaltigkeit & Datenqualität</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {food.dataQualityScore !== undefined && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Datenqualitaet</p>
                <p className="text-lg font-semibold">{formatNumber(food.dataQualityScore, 0)} / 100</p>
                <p className="text-muted-foreground text-xs">
                  {food.dataQualityScore >= 80
                    ? "Vollstaendig genug fuer den Hauptkatalog."
                    : "Naehrstoffbild ist sichtbar, kann aber unvollstaendig sein."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(food.additives?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zusatzstoffe</CardTitle>
          </CardHeader>
          <CardContent>
            <AdditiveList codes={food.additives ?? []} variant="detailed" />
          </CardContent>
        </Card>
      )}

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

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Nährstoffanalyse</h3>
        <ReferenceProfileSelector compact />
      </div>

      <NutrientTabs nutrients={food.nutrients} refConfig={refConfig} />
    </div>
  );
}
