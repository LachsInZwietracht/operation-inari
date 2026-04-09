"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { Recipe } from "@/lib/types";
import { RecipeDetailContent } from "@/components/recipe-detail-content";

function getCustomRecipe(id: string): Recipe | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("prodi_custom_recipes");
    if (!stored) return null;
    const recipes: Recipe[] = JSON.parse(stored);
    return recipes.find((r) => r.id === id) ?? null;
  } catch {
    return null;
  }
}

export function RecipeDetailClient({ recipeId }: { recipeId: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const found = getCustomRecipe(recipeId);
    setRecipe(found);
    setLoaded(true);
  }, [recipeId]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!recipe) {
    notFound();
  }

  return <RecipeDetailContent recipe={recipe} />;
}
