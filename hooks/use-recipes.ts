"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Food, Recipe } from "@/lib/types";
import {
  deletePersonalRecipeClient,
  fetchRecipesClient,
  persistPersonalRecipe,
} from "@/lib/data/recipes-client";
import { getLocalRecipes, saveLocalRecipes } from "@/lib/data/local-recipes";
import {
  isLocalMigrationCandidate,
  matchesRecordIdentity,
  upsertByIdentity,
} from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";

export function useRecipes(initialCommunityRecipes: Recipe[] = [], foods: Food[] = []) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => getLocalRecipes(foods));
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const customRecipesRef = useRef(customRecipes);

  useEffect(() => {
    customRecipesRef.current = customRecipes;
  }, [customRecipes]);

  useEffect(() => {
    saveLocalRecipes(customRecipes.filter(isLocalMigrationCandidate), foods);
  }, [customRecipes, foods]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoadingRemote(true);

    async function syncRecipes() {
      try {
        const remoteRecipes = await fetchRecipesClient({ sourceType: "personal" });
        if (cancelled) return;

        const localCandidates = customRecipesRef.current.filter(isLocalMigrationCandidate);
        const mergedRecipes = [...remoteRecipes];
        for (const localRecipe of localCandidates) {
          if (!mergedRecipes.some((remoteRecipe) => matchesRecordIdentity(remoteRecipe, localRecipe))) {
            mergedRecipes.push(localRecipe);
          }
        }

        setCustomRecipes(mergedRecipes);

        if (!migrationDone.current) {
          migrationDone.current = true;
          for (const recipe of localCandidates) {
            try {
              const persistedRecipe = await persistPersonalRecipe(recipe);
              if (cancelled) return;
              setCustomRecipes((prev) => upsertByIdentity(prev, persistedRecipe));
            } catch (err) {
              console.error(`Failed to migrate recipe ${recipe.name}:`, err);
            }
          }
        }
      } catch (error) {
        console.error("Failed to sync recipes from Supabase:", error);
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }

    void syncRecipes();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, foods]);

  const allRecipes = useMemo(() => {
    const community = initialCommunityRecipes.map(r => ({ ...r, sourceType: "community" as const }));
    const personal = customRecipes.map(r => ({ ...r, sourceType: "personal" as const }));
    
    const merged = [...community, ...personal];
    // De-duplicate by ID/legacyId
    return merged.filter((recipe, index, self) => 
      self.findIndex(r => 
        r.id === recipe.id || 
        (r.legacyId && r.legacyId === recipe.id) || 
        (recipe.legacyId && r.id === recipe.legacyId)
      ) === index
    );
  }, [initialCommunityRecipes, customRecipes]);

  const addRecipe = useCallback(async (recipe: Recipe) => {
    const now = new Date().toISOString();
    const newRecipe = { ...recipe, createdAt: now, updatedAt: now, sourceType: "personal" as const };

    setCustomRecipes((prev) => upsertByIdentity(prev, newRecipe));

    if (isAuthenticated) {
      try {
        const persisted = await persistPersonalRecipe(newRecipe);
        setCustomRecipes((prev) => upsertByIdentity(prev, persisted));
        return persisted;
      } catch (error) {
        console.error("Failed to persist recipe to Supabase:", error);
      }
    }
    return newRecipe;
  }, [isAuthenticated]);

  const deleteRecipe = useCallback(async (id: string) => {
    setCustomRecipes((prev) => prev.filter((recipe) => !matchesRecordIdentity(recipe, { id })));

    if (isAuthenticated) {
      try {
        await deletePersonalRecipeClient(id);
      } catch (error) {
        console.error("Failed to delete recipe from Supabase:", error);
      }
    }
  }, [isAuthenticated]);

  return {
    allRecipes,
    customRecipes,
    addRecipe,
    deleteRecipe,
    isLoadingRemote
  };
}
