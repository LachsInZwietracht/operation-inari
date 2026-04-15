"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Food, Recipe } from "@/lib/types";
import { fetchRecipesClient, persistPersonalRecipe } from "@/lib/data/recipes-client";
import { getLocalRecipes, saveLocalRecipes } from "@/lib/data/local-recipes";
import { useAuth } from "@/hooks/use-auth";

export function useRecipes(initialCommunityRecipes: Recipe[] = [], foods: Food[] = []) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => getLocalRecipes(foods));
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);

  // Sync to local storage
  useEffect(() => {
    saveLocalRecipes(customRecipes, foods);
  }, [customRecipes, foods]);

  // Load from Supabase when authenticated
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoadingRemote(true);

    async function syncRecipes() {
      try {
        const remoteRecipes = await fetchRecipesClient({ sourceType: "personal" });
        if (cancelled) return;

        setCustomRecipes((prev) => {
          const localOnly = prev.filter(p => 
            !remoteRecipes.some(r => r.id === p.id || r.legacyId === p.id)
          );
          return [...remoteRecipes, ...localOnly];
        });

        // Migration of local-only recipes
        if (!migrationDone.current) {
          migrationDone.current = true;
          const localOnly = customRecipes.filter(p => 
            !remoteRecipes.some(r => r.id === p.id || r.legacyId === p.id)
          );
          
          for (const recipe of localOnly) {
            void persistPersonalRecipe(recipe).catch(err => {
              console.error(`Failed to migrate recipe ${recipe.name}:`, err);
            });
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
    
    setCustomRecipes(prev => [...prev.filter(r => r.id !== recipe.id), newRecipe]);

    if (isAuthenticated) {
      try {
        const persisted = await persistPersonalRecipe(newRecipe);
        setCustomRecipes(prev => prev.map(r => r.id === newRecipe.id ? persisted : r));
        return persisted;
      } catch (error) {
        console.error("Failed to persist recipe to Supabase:", error);
      }
    }
    return newRecipe;
  }, [isAuthenticated]);

  const deleteRecipe = useCallback(async (id: string) => {
     // Note: we might need a deleteRecipeClient in recipes-client.ts if it doesn't exist yet
     setCustomRecipes(prev => prev.filter(r => r.id !== id && r.legacyId !== id));
     // For now, only local delete as I don't see a deleteRecipeClient in the current codebase
  }, []);

  return {
    allRecipes,
    customRecipes,
    addRecipe,
    deleteRecipe,
    isLoadingRemote
  };
}
