import type { Food, Recipe } from "@/lib/types";

import { normalizeRecipeFoodReferences } from "@/lib/data/food-reference-normalization";

const CUSTOM_RECIPES_STORAGE_KEY = "prodi_custom_recipes";

export function getLocalRecipes(foods: Food[] = []): Recipe[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(CUSTOM_RECIPES_STORAGE_KEY);
    if (!stored) return [];

    return (JSON.parse(stored) as Recipe[]).map((recipe) =>
      normalizeRecipeFoodReferences(recipe, foods),
    );
  } catch {
    return [];
  }
}

export function saveLocalRecipes(recipes: Recipe[], foods: Food[] = []) {
  if (typeof window === "undefined") return;

  const normalized = recipes.map((recipe) => normalizeRecipeFoodReferences(recipe, foods));
  localStorage.setItem(CUSTOM_RECIPES_STORAGE_KEY, JSON.stringify(normalized));
}

export function findLocalRecipeById(recipeId: string, foods: Food[] = []): Recipe | null {
  return getLocalRecipes(foods).find((recipe) => recipe.id === recipeId) ?? null;
}

export function upsertLocalRecipe(recipe: Recipe, foods: Food[] = []): Recipe {
  const recipes = getLocalRecipes(foods);
  const existingIndex = recipes.findIndex((entry) => entry.id === recipe.id);

  if (existingIndex >= 0) {
    recipes[existingIndex] = recipe;
  } else {
    recipes.push(recipe);
  }

  saveLocalRecipes(recipes, foods);
  return recipe;
}
