"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { Recipe } from "@/lib/types";
import { RecipeDetailContent } from "@/components/recipe-detail-content";
import { fetchRecipeByIdClient } from "@/lib/data/recipes-client";
import { findLocalRecipeById } from "@/lib/data/local-recipes";

export function RecipeDetailClient({ recipeId }: { recipeId: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecipe() {
      try {
        const persistedRecipe = await fetchRecipeByIdClient(recipeId);
        if (cancelled) return;

        if (persistedRecipe) {
          setRecipe(persistedRecipe);
          setLoaded(true);
          return;
        }
      } catch (error) {
        console.error("Failed to load recipe from Supabase:", error);
      }

      if (cancelled) return;
      // Pass empty list since full list is not available. 
      // Detail content will handle ingredient hydration.
      setRecipe(findLocalRecipeById(recipeId, []));
      setLoaded(true);
    }

    void loadRecipe();

    return () => {
      cancelled = true;
    };
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
