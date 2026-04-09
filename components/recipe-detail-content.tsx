import Link from "next/link";
import { Clock, Users, Pencil, Flame, Drumstick, Droplet, Wheat } from "lucide-react";
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
import { MacroRingChart } from "@/components/macro-ring-chart";
import { FOODS, NUTRIENT_DEFINITIONS } from "@/lib/mock-data";
import {
  calculateRecipeNutrients,
  calculatePerServing,
  getNutrientValue,
  scaleNutrients,
} from "@/lib/nutrients";
import { formatNumber, formatNutrient } from "@/lib/format";
import type { Recipe } from "@/lib/types";

export function RecipeDetailContent({ recipe }: { recipe: Recipe }) {
  const totalNutrients = calculateRecipeNutrients(recipe, FOODS);
  const perServing = calculatePerServing(totalNutrients, recipe.servings);

  const totalKcal = getNutrientValue(totalNutrients, "energie");
  const perServingKcal = getNutrientValue(perServing, "energie");
  const protein = getNutrientValue(perServing, "eiweiss");
  const fat = getNutrientValue(perServing, "fett");
  const carbs = getNutrientValue(perServing, "kohlenhydrate");

  const foodMap = new Map(FOODS.map((f) => [f.id, f]));

  const vitaminHighlights = NUTRIENT_DEFINITIONS.filter(
    (nd) => nd.group === "vitamine",
  )
    .map((nd) => ({
      ...nd,
      value: getNutrientValue(perServing, nd.id),
    }))
    .filter((v) => v.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const mineralHighlights = NUTRIENT_DEFINITIONS.filter(
    (nd) => nd.group === "mineralstoffe",
  )
    .map((nd) => ({
      ...nd,
      value: getNutrientValue(perServing, nd.id),
    }))
    .filter((v) => v.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title={recipe.name}>
        <Badge variant="secondary">{recipe.category}</Badge>
        <Button variant="outline" asChild>
          <Link href={`/rezepte/${recipe.id}/bearbeiten`}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Info card */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">{recipe.description}</p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Clock className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Vorbereitung</p>
                    <p className="text-sm font-medium">{recipe.prepTime} Min.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kochzeit</p>
                    <p className="text-sm font-medium">{recipe.cookTime} Min.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Portionen</p>
                    <p className="text-sm font-medium">{recipe.servings}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Gesamt</p>
                    <p className="text-sm font-medium">
                      {formatNumber(totalKcal, 0)} kcal
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingredients table */}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipe.ingredients.map((ingredient) => {
                    const food = foodMap.get(ingredient.foodId);
                    if (!food) return null;
                    const scaled = scaleNutrients(
                      food.nutrients,
                      food.baseAmount,
                      ingredient.amount,
                    );
                    const kcal = getNutrientValue(scaled, "energie");
                    return (
                      <TableRow key={ingredient.foodId}>
                        <TableCell>{food.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(ingredient.amount, 0)} g
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(kcal, 0)} kcal
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Instructions */}
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

        {/* Right column */}
        <div className="space-y-6">
          {/* Nutrition summary */}
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

          {/* Macro chart */}
          <Card>
            <CardHeader>
              <CardTitle>Makronährstoff-Verteilung</CardTitle>
            </CardHeader>
            <CardContent>
              <MacroRingChart nutrients={perServing} />
            </CardContent>
          </Card>

          {/* Vitamin & mineral highlights */}
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
