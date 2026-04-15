"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RecipeForm } from "@/components/recipe-form";
import type { Recipe } from "@/lib/types";
import { useFoods } from "@/components/foods-provider";
import { normalizeRecipeFoodReferences } from "@/lib/data/food-reference-normalization";
import { fetchRecipeByIdClient } from "@/lib/data/recipes-client";
import { findLocalRecipeById } from "@/lib/data/local-recipes";

interface RezeptBearbeitenPageClientProps {
  recipeId: string;
  recipe: Recipe | null;
}

export function RezeptBearbeitenPageClient({ recipeId, recipe: initialRecipe }: RezeptBearbeitenPageClientProps) {
  const foods = useFoods();
  const normalizedInitialRecipe = initialRecipe
    ? normalizeRecipeFoodReferences(initialRecipe, foods)
    : null;
  const [recipe, setRecipe] = useState<Recipe | null>(normalizedInitialRecipe);
  const [loaded, setLoaded] = useState(Boolean(normalizedInitialRecipe));

  useEffect(() => {
    if (normalizedInitialRecipe) {
      setRecipe(normalizedInitialRecipe);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    async function loadRecipe() {
      try {
        const persistedRecipe = await fetchRecipeByIdClient(recipeId);
        if (cancelled) return;

        if (persistedRecipe) {
          setRecipe(normalizeRecipeFoodReferences(persistedRecipe, foods));
          setLoaded(true);
          return;
        }
      } catch (error) {
        console.error("Failed to load editable recipe from Supabase:", error);
      }

      if (cancelled) return;
      setRecipe(findLocalRecipeById(recipeId, foods));
      setLoaded(true);
    }

    void loadRecipe();

    return () => {
      cancelled = true;
    };
  }, [foods, normalizedInitialRecipe, recipeId]);

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

  const isSystemRecipe = Boolean(normalizedInitialRecipe);

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
