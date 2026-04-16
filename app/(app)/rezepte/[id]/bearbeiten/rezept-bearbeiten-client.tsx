"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RecipeForm } from "@/components/recipe-form";
import type { Recipe } from "@/lib/types";
import { fetchRecipeByIdClient } from "@/lib/data/recipes-client";
import { findLocalRecipeById } from "@/lib/data/local-recipes";

interface RezeptBearbeitenPageClientProps {
  recipeId: string;
  recipe: Recipe | null;
}

export function RezeptBearbeitenPageClient({ recipeId, recipe: initialRecipe }: RezeptBearbeitenPageClientProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(initialRecipe);
  const [loaded, setLoaded] = useState(Boolean(initialRecipe));

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
      setLoaded(true);
      return;
    }

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
        console.error("Failed to load editable recipe from Supabase:", error);
      }

      if (cancelled) return;
      // Note: findLocalRecipeById typically needs full foods list for normalization
      // but we'll let RecipeForm handle the fetching of full food details for ingredients
      setRecipe(findLocalRecipeById(recipeId, [])); 
      setLoaded(true);
    }

    void loadRecipe();

    return () => {
      cancelled = true;
    };
  }, [initialRecipe, recipeId]);

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

  // If initialRecipe was provided, it's a system/community recipe being cloned/edited
  const isSystemRecipe = Boolean(initialRecipe && initialRecipe.sourceType !== 'personal');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezept bearbeiten"
        description={
          isSystemRecipe
            ? "Hinweis: Standardrezepte können nicht verändert werden."
            : `${recipe.name} bearbeiten`
        }
      />
      <RecipeForm recipe={recipe} isEditing />
    </div>
  );
}
