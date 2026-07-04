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
import { RecipeImage } from "@/components/recipe-image";
import type { Recipe, Food } from "@/lib/types";

interface RecipeCardProps {
  recipe: Recipe;
  foods: Food[];
  onImport?: () => void;
}

export function RecipeCard({ recipe, foods, onImport }: RecipeCardProps) {
  const totalKcal = recipe.cachedKcalPerPortion ?? (() => {
    const nutrients = calculateRecipeNutrients(recipe, foods);
    return getNutrientValue(nutrients, "energie");
  })();
  
  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <Link href={`/rezepte/${recipe.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <RecipeImage
          imageUrl={recipe.imageUrl}
          alt={recipe.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="h-32"
        />
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
