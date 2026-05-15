"use client";

import Link from "next/link";
import { useCallback } from "react";
import dynamic from "next/dynamic";
import { Clock, Users, Pencil, Flame, Drumstick, Droplet, Wheat, Leaf, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomFoods } from "@/hooks/use-custom-foods";
import { useFoodSynonyms } from "@/hooks/use-food-synonyms";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import {
  calculateRecipeNutrients,
  calculatePerServing,
  getNutrientValue,
  scaleNutrients,
} from "@/lib/nutrients";
import { formatNumber, formatNutrient } from "@/lib/format";
import type { Recipe, Food, PatientAllergenEntry } from "@/lib/types";
import { useFoods } from "@/components/foods-provider";
import { fetchFoodsByIds } from "@/lib/data/foods-client";
import { useEffect, useMemo, useState } from "react";
import { checkAllergenConflicts } from "@/lib/allergen-warnings";
import { deriveRecipeAllergens, computeIngredientCo2 } from "@/lib/allergen-derivation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdditiveList } from "@/components/additive-list";

interface RecipeDetailContentProps {
  recipe: Recipe;
  patientAllergens?: PatientAllergenEntry[];
}

const MacroRingChart = dynamic(
  () => import("@/components/macro-ring-chart").then((mod) => mod.MacroRingChart),
  { ssr: false, loading: () => <div className="h-[240px] rounded-md bg-muted/40" /> },
);

export function RecipeDetailContent({ recipe, patientAllergens }: RecipeDetailContentProps) {
  const foods = useFoods();
  const [availableFoods, setAvailableFoods] = useState<Food[]>(foods);
  const { convertRecipeToFood } = useCustomFoods(availableFoods);
  const { getDisplayName } = useFoodSynonyms();

  useEffect(() => {
    const ingredientIds = recipe.ingredients.map(i => i.foodId);
    const missingIds = ingredientIds.filter(id => !availableFoods.some(f => f.id === id));

    if (missingIds.length > 0) {
      fetchFoodsByIds(missingIds).then(newFoods => {
        setAvailableFoods(prev => [...prev, ...newFoods]);
      });
    }
  }, [recipe.ingredients, availableFoods]);

  const totalNutrients = calculateRecipeNutrients(recipe, availableFoods);
  const perServing = calculatePerServing(totalNutrients, recipe.servings);

  const totalKcal = totalNutrients.length > 0
    ? getNutrientValue(totalNutrients, "energie")
    : (recipe.cachedKcalPerPortion ? recipe.cachedKcalPerPortion * recipe.servings : 0);

  const perServingKcal = perServing.length > 0
    ? getNutrientValue(perServing, "energie")
    : (recipe.cachedKcalPerPortion ?? 0);

  const protein = perServing.length > 0
    ? getNutrientValue(perServing, "eiweiss")
    : (recipe.cachedProteinPerPortion ?? 0);

  const fat = perServing.length > 0
    ? getNutrientValue(perServing, "fett")
    : (recipe.cachedFatPerPortion ?? 0);

  const carbs = perServing.length > 0
    ? getNutrientValue(perServing, "kohlenhydrate")
    : (recipe.cachedCarbsPerPortion ?? 0);

  const foodMap = new Map(availableFoods.map((f) => [f.id, f]));

  // ── Dynamic CO₂ ──
  const co2Breakdown = useMemo(
    () => computeIngredientCo2(recipe.ingredients, availableFoods),
    [recipe.ingredients, availableFoods],
  );

  const co2PerPortion = useMemo(() => {
    if (co2Breakdown.totalCo2 > 0) {
      return recipe.servings > 0 ? co2Breakdown.totalCo2 / recipe.servings : co2Breakdown.totalCo2;
    }
    return recipe.co2PerPortion ?? null;
  }, [co2Breakdown.totalCo2, recipe.servings, recipe.co2PerPortion]);

  // ── Allergen derivation ──
  const derivedAllergens = useMemo(
    () => deriveRecipeAllergens(recipe.ingredients, availableFoods),
    [recipe.ingredients, availableFoods],
  );

  const manualAllergens = useMemo(() => recipe.allergens ?? [], [recipe.allergens]);

  const allAllergens = useMemo(() => {
    const combined = new Set([...manualAllergens, ...derivedAllergens]);
    return Array.from(combined).sort((a, b) => a.localeCompare(b, "de"));
  }, [manualAllergens, derivedAllergens]);

  const allergenWarnings = useMemo(() => {
    if (!patientAllergens?.length || !allAllergens.length) return [];
    return checkAllergenConflicts(allAllergens, patientAllergens);
  }, [allAllergens, patientAllergens]);

  const vitaminHighlights = NUTRIENT_DEFINITIONS.filter((nd) => nd.group === "vitamine")
    .map((nd) => ({ ...nd, value: getNutrientValue(perServing, nd.id) }))
    .filter((v) => v.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const mineralHighlights = NUTRIENT_DEFINITIONS.filter((nd) => nd.group === "mineralstoffe")
    .map((nd) => ({ ...nd, value: getNutrientValue(perServing, nd.id) }))
    .filter((v) => v.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const handleConvert = useCallback(() => {
    convertRecipeToFood(recipe);
    toast.success("Rezept als Lebensmittel gespeichert");
  }, [convertRecipeToFood, recipe]);

  return (
    <div className="space-y-6">
      <div
        className="bg-muted relative h-56 w-full overflow-hidden rounded-xl"
        style={
          recipe.imageUrl
            ? {
                backgroundImage: `url(${recipe.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <PageHeader title={recipe.name}>
        <Badge variant="secondary">{recipe.category}</Badge>
        <Button variant="outline" asChild>
          <Link href={`/rezepte/${recipe.id}/bearbeiten`}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Link>
        </Button>
        <Button onClick={handleConvert}>Als Lebensmittel speichern</Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-muted-foreground">{recipe.description}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="text-muted-foreground h-5 w-5" />
                  {recipe.prepTime} Min. Vorbereitung
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="text-muted-foreground h-5 w-5" />
                  {recipe.cookTime} Min. Kochzeit
                </span>
                <span className="flex items-center gap-2">
                  <Users className="text-muted-foreground h-5 w-5" />
                  {recipe.servings} Portionen
                </span>
                <span className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  {formatNumber(totalKcal, 0)} kcal gesamt
                </span>
              </div>
              {allergenWarnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Allergenwarnung</AlertTitle>
                  <AlertDescription>
                    Dieses Rezept enthält: {allergenWarnings.map((w) => w.allergenLabel).join(", ")}
                  </AlertDescription>
                </Alert>
              )}
              {allAllergens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Allergendeklaration (LMIV)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allAllergens.map((allergen) => {
                      const isAutoDetected = derivedAllergens.includes(allergen) && !manualAllergens.includes(allergen);
                      return (
                        <Badge
                          key={allergen}
                          variant="destructive"
                          className={`text-xs ${isAutoDetected ? "border-dashed border-2" : ""}`}
                        >
                          {allergen}
                          {isAutoDetected && (
                            <span className="ml-1 opacity-70" title="Automatisch aus Zutaten erkannt">*</span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                  {derivedAllergens.some((a) => !manualAllergens.includes(a)) && (
                    <p className="text-xs text-muted-foreground">
                      * Automatisch aus Zutaten abgeleitet
                    </p>
                  )}
                </div>
              )}
              {recipe.additives && recipe.additives.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Zusatzstoffe
                  </p>
                  <AdditiveList codes={recipe.additives} variant="compact" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zutaten</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lebensmittel</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Kalorien</TableHead>
                    <TableHead className="text-right">CO₂</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipe.ingredients.map((ingredient) => {
                    const food = foodMap.get(ingredient.foodId);
                    if (!food) return null;
                    const scaled = scaleNutrients(food.nutrients, food.baseAmount, ingredient.amount);
                    const kcal = getNutrientValue(scaled, "energie");
                    const displayName = getDisplayName(food.id, food.name) ?? food.name;
                    const ingredientCo2 = co2Breakdown.entries.find((e) => e.foodId === ingredient.foodId);
                    return (
                      <TableRow key={ingredient.foodId}>
                        <TableCell>{displayName}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(ingredient.amount, 0)} g
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(kcal, 0)} kcal
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {ingredientCo2 ? `${formatNumber(ingredientCo2.co2, 3)} kg` : "–"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zubereitung</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {recipe.instructions.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nährwerte pro Portion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kalorien</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(perServingKcal, 0)} kcal
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Drumstick className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Eiweiß</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(protein, 1)} g
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fett</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(fat, 1)} g
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kohlenhydrate</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(carbs, 1)} g
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Sustainability Card ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nachhaltigkeit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">CO₂ je Portion</p>
                  <p className="text-2xl font-semibold">
                    {co2PerPortion !== null ? `${formatNumber(co2PerPortion, 2)} kg` : "n. a."}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-muted-foreground">Gesamt</p>
                  <p className="font-semibold">
                    {co2Breakdown.totalCo2 > 0 ? `${formatNumber(co2Breakdown.totalCo2, 2)} kg` : "–"}
                  </p>
                </div>
              </div>
              {co2Breakdown.totalCo2 > 0 && (
                <>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Leaf className="h-3 w-3" /> Pflanzlich
                      </span>
                      <span>Tierisch</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-emerald-400 transition-all"
                        style={{ width: `${co2Breakdown.plantShare * 100}%` }}
                      />
                      <div
                        className="bg-orange-400 transition-all"
                        style={{ width: `${co2Breakdown.animalShare * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(co2Breakdown.plantShare * 100, 0)}%</span>
                      <span>{formatNumber(co2Breakdown.animalShare * 100, 0)}%</span>
                    </div>
                  </div>
                  {co2Breakdown.entries.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Top-Verursacher
                      </p>
                      <div className="space-y-1">
                        {co2Breakdown.entries.slice(0, 3).map((entry) => (
                          <div key={entry.foodId} className="flex items-center justify-between text-xs">
                            <span className="truncate mr-2">{entry.foodName}</span>
                            <span className="text-muted-foreground shrink-0">{formatNumber(entry.co2, 3)} kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {recipe.referenceTargets && recipe.referenceTargets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vergleich Zielwerte</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead className="text-right">Ist</TableHead>
                      <TableHead className="text-right">Ziel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipe.referenceTargets.map((target) => (
                      <TableRow key={target.id}>
                        <TableCell>{target.label}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(getNutrientValue(perServing, target.nutrientId), target.unit)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNutrient(target.target, target.unit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Makronährstoff-Verteilung</CardTitle>
            </CardHeader>
            <CardContent>
              <MacroRingChart nutrients={perServing} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vitamine & Mineralstoffe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vitaminHighlights.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Vitamine
                  </p>
                  <div className="space-y-1">
                    {vitaminHighlights.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{v.name}</span>
                        <span className="text-muted-foreground">
                          {formatNutrient(v.value, v.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mineralHighlights.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Mineralstoffe
                  </p>
                  <div className="space-y-1">
                    {mineralHighlights.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{m.name}</span>
                        <span className="text-muted-foreground">
                          {formatNutrient(m.value, m.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
