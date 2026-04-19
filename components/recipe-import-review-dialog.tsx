"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, Search, Trash2 } from "lucide-react";
import type { ParsedMealMasterRecipe } from "@/lib/meal-master-parser";
import { FoodSearchDialog } from "@/components/food-search-dialog";
import type { Food, Recipe, Ingredient } from "@/lib/types";

interface RecipeImportReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: ParsedMealMasterRecipe[];
  onComplete: (importedRecipes: Partial<Recipe>[]) => void;
}

interface MappedIngredient {
  id: string;
  originalLine: string;
  foodId: string | null;
  foodName: string | null;
  amount: number;
  unit?: string;
  ignore: boolean;
}

interface MappedRecipe extends ParsedMealMasterRecipe {
  mappedIngredients: MappedIngredient[];
}

export function RecipeImportReviewDialog({
  open,
  onOpenChange,
  recipes,
  onComplete,
}: RecipeImportReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [mappedRecipes, setMappedRecipes] = useState<MappedRecipe[]>([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMappedRecipes([]);
      setCurrentRecipeIndex(0);
      return;
    }

    if (recipes.length === 0) return;

    let cancelled = false;

    async function processMatches() {
      setLoading(true);
      try {
        const queries = recipes.flatMap(r => 
          r.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`.trim())
        );

        const res = await fetch("/api/foods/smart-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries }),
        });

        if (!res.ok) throw new Error("Failed to match ingredients");
        
        const { results } = await res.json();
        
        if (cancelled) return;

        let resultIndex = 0;
        const initialMapped = recipes.map(recipe => {
          const mappedIngredients = recipe.ingredients.map((ing, i) => {
            const matchResult = results[resultIndex].match;
            resultIndex++;
            return {
              id: `${recipe.title}-${i}`,
              originalLine: ing.originalLine,
              foodId: matchResult?.foodId ?? null,
              foodName: matchResult?.foodName ?? null,
              amount: matchResult?.amount ?? 100, // fallback 100g
              unit: matchResult?.unit,
              ignore: false,
            };
          });
          return { ...recipe, mappedIngredients };
        });

        setMappedRecipes(initialMapped);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    processMatches();

    return () => { cancelled = true; };
  }, [open, recipes]);

  const currentRecipe = mappedRecipes[currentRecipeIndex];

  if (!open || !currentRecipe) return null;

  const allResolved = currentRecipe.mappedIngredients.every(
    (i) => i.foodId !== null || i.ignore
  );

  function handleFoodSelect(food: Food) {
    if (!activeIngredientId) return;

    setMappedRecipes(prev => {
      const clone = [...prev];
      const recipe = clone[currentRecipeIndex];
      const index = recipe.mappedIngredients.findIndex(i => i.id === activeIngredientId);
      if (index !== -1) {
        recipe.mappedIngredients[index].foodId = food.id;
        recipe.mappedIngredients[index].foodName = food.name;
        recipe.mappedIngredients[index].ignore = false;
      }
      return clone;
    });
    
    setActiveIngredientId(null);
  }

  function toggleIgnore(ingredientId: string) {
    setMappedRecipes(prev => {
      const clone = [...prev];
      const recipe = clone[currentRecipeIndex];
      const index = recipe.mappedIngredients.findIndex(i => i.id === ingredientId);
      if (index !== -1) {
        recipe.mappedIngredients[index].ignore = !recipe.mappedIngredients[index].ignore;
        if (recipe.mappedIngredients[index].ignore) {
            recipe.mappedIngredients[index].foodId = null;
            recipe.mappedIngredients[index].foodName = null;
        }
      }
      return clone;
    });
  }

  function handleNextOrFinish() {
    if (currentRecipeIndex < mappedRecipes.length - 1) {
      setCurrentRecipeIndex(prev => prev + 1);
    } else {
      // Build final output
      const finalRecipes: Partial<Recipe>[] = mappedRecipes.map(r => {
        const ingredients: Ingredient[] = r.mappedIngredients
          .filter(i => !i.ignore && i.foodId)
          .map(i => ({ foodId: i.foodId!, amount: i.amount }));
        
        // Add ignored items to instructions
        const ignoredNotes = r.mappedIngredients
            .filter(i => i.ignore)
            .map(i => `[Fehlende Zutat]: ${i.originalLine}`);
            
        const finalInstructions = [...r.instructions];
        if (ignoredNotes.length > 0) {
            finalInstructions.unshift("--- Nicht zugeordnete Zutaten ---", ...ignoredNotes, "--------------------------------");
        }

        return {
          name: r.title,
          description: "Importiert aus Meal-Master",
          category: r.categories[0] ?? "Community",
          servings: r.servings,
          prepTime: 15,
          cookTime: 30,
          ingredients,
          instructions: finalInstructions.length > 0 ? finalInstructions : ["Keine Zubereitungsschritte gefunden"],
          sourceType: "personal" as const,
        };
      });

      onComplete(finalRecipes);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Zutaten zuordnen ({currentRecipeIndex + 1}/{mappedRecipes.length})</DialogTitle>
            <DialogDescription>
              &quot;{currentRecipe.title}&quot; - Bitte prüfen Sie die erkannten Zutaten.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Analysiere Zutaten mit Smart Match...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <div className="rounded-md border divide-y">
                {currentRecipe.mappedIngredients.map((ing) => (
                  <div key={ing.id} className={`p-3 flex items-center justify-between gap-4 ${ing.ignore ? 'opacity-50 bg-muted/50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={ing.originalLine}>
                        {ing.originalLine}
                      </p>
                      {ing.foodName && !ing.ignore ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {ing.foodName} ({ing.amount}g)
                        </p>
                      ) : ing.ignore ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Wird als Textnotiz gespeichert
                        </p>
                      ) : (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          Keine eindeutige Zuordnung
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={ing.foodId && !ing.ignore ? "outline" : "default"}
                        size="sm"
                        onClick={() => {
                          setActiveIngredientId(ing.id);
                          setSearchDialogOpen(true);
                        }}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Suchen
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={ing.ignore ? "Ignorieren aufheben" : "Als Notiz übernehmen (Ignorieren)"}
                        onClick={() => toggleIgnore(ing.id)}
                      >
                         <Trash2 className={`h-4 w-4 ${ing.ignore ? 'text-primary' : 'text-muted-foreground'}`} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button 
                onClick={handleNextOrFinish} 
                disabled={loading || !allResolved}
            >
              {currentRecipeIndex < mappedRecipes.length - 1 ? "Weiter zum nächsten Rezept" : "Import abschließen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FoodSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelect={handleFoodSelect}
        title="Zutat manuell zuordnen"
      />
    </>
  );
}
