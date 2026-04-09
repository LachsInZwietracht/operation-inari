"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RecipeForm } from "@/components/recipe-form";
import { RECIPES } from "@/lib/mock-data";
import type { Recipe } from "@/lib/types";

function findRecipe(id: string): Recipe | null {
  const mock = RECIPES.find((r) => r.id === id);
  if (mock) return mock;

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

export default function RezeptBearbeitenPage() {
  const params = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const found = findRecipe(params.id);
    setRecipe(found);
    setLoaded(true);
  }, [params.id]);

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

  const isMock = RECIPES.some((r) => r.id === recipe.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezept bearbeiten"
        description={
          isMock
            ? "Hinweis: Standardrezepte können nicht verändert werden."
            : `${recipe.name} bearbeiten`
        }
      />
      <RecipeForm recipe={recipe} isEditing />
    </div>
  );
}
