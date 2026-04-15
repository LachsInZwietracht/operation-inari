'use client';

import Link from "next/link";
import { Clock, Users, Flame, Download } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { calculateRecipeNutrients, getNutrientValue } from "@/lib/nutrients";
import type { Recipe, Food } from "@/lib/types";

interface RecipeCardProps {
  recipe: Recipe;
  foods: Food[];
  onImport?: () => void;
}

function getProdScoreBadge(score: number | undefined) {
  if (score === undefined) return { label: "–", color: "bg-slate-200 text-slate-900" };
  if (score >= 85) return { label: "A", color: "bg-emerald-100 text-emerald-900" };
  if (score >= 70) return { label: "B", color: "bg-lime-100 text-lime-900" };
  if (score >= 55) return { label: "C", color: "bg-amber-100 text-amber-900" };
  if (score >= 40) return { label: "D", color: "bg-orange-100 text-orange-900" };
  return { label: "E", color: "bg-red-100 text-red-900" };
}

export function RecipeCard({ recipe, foods, onImport }: RecipeCardProps) {
  const nutrients = calculateRecipeNutrients(recipe, foods);
  const totalKcal = getNutrientValue(nutrients, "energie");
  const totalTime = recipe.prepTime + recipe.cookTime;
  const scoreBadge = getProdScoreBadge(recipe.prodScore);

  return (
    <Link href={`/rezepte/${recipe.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div
          className="bg-muted relative h-32 w-full overflow-hidden"
          style={
            recipe.imageUrl
              ? {
                  backgroundImage: `url(${recipe.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute right-3 top-3">
            <Badge className={`${scoreBadge.color} border-none px-2 py-1 text-xs font-bold`}>
              PRODIscore {scoreBadge.label}
            </Badge>
          </div>
        </div>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1">{recipe.name}</CardTitle>
            <Badge variant="secondary" className="shrink-0">
              {recipe.category}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {recipe.description}
          </CardDescription>
          {recipe.sourceType && recipe.sourceType !== "personal" && (
            <Badge variant="outline" className="text-xs uppercase">
              Community
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {totalTime} Min.
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
            </span>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm font-medium">
            <Flame className="h-4 w-4 text-orange-500" />
            {formatNumber(totalKcal, 0)} kcal
          </span>
          {onImport && (
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onImport();
              }}
            >
              <Download className="mr-1 h-4 w-4" /> Import
            </Button>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
