"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Flame, Drumstick, Droplet, Wheat, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useNutrientCalculation } from "@/hooks/use-nutrient-calculation";
import { getNutrientValue } from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import type { Recipe, Ingredient, Food } from "@/lib/types";
import { useFoodSearch } from "@/components/foods-provider";
import { persistPersonalRecipe } from "@/lib/data/recipes-client";
import { upsertLocalRecipe } from "@/lib/data/local-recipes";
import { FoodSearchDialog } from "@/components/food-search-dialog";
import { fetchFoodsByIds } from "@/lib/data/foods-client";

const UNIQUE_CATEGORIES = [
  "Suppe",
  "Hauptgericht",
  "Beilage",
  "Frühstück",
  "Snack",
  "Salat",
  "Dessert",
  "Eintöpfe"
];

import { ALLERGEN_DEFINITIONS } from "@/lib/allergen-constants";

const RECIPE_ALLERGENS = ALLERGEN_DEFINITIONS.filter((a) => a.category === "eu14").map((a) => a.label);

const recipeSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string(),
  category: z.string().min(1, "Kategorie ist erforderlich"),
  servings: z.coerce.number().min(1, "Mindestens 1 Portion"),
  prepTime: z.coerce.number().min(0, "Darf nicht negativ sein"),
  cookTime: z.coerce.number().min(0, "Darf nicht negativ sein"),
  imageUrl: z.string().optional(),
  prodScore: z.coerce.number().min(0).max(100).optional(),
  co2PerPortion: z.coerce.number().min(0).optional(),
  allergens: z.array(z.string()).optional(),
  additives: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        foodId: z.string().min(1),
        amount: z.coerce.number().min(1, "Menge muss mindestens 1 g sein"),
      }),
    )
    .min(1, "Mindestens eine Zutat erforderlich"),
  instructions: z
    .array(
      z.object({
        value: z.string().min(1, "Schritt darf nicht leer sein"),
      }),
    )
    .min(1, "Mindestens ein Zubereitungsschritt erforderlich"),
});

type RecipeFormValues = z.infer<typeof recipeSchema>;

interface RecipeFormProps {
  recipe?: Recipe;
  isEditing?: boolean;
}

export function RecipeForm({ recipe, isEditing }: RecipeFormProps) {
  const router = useRouter();
  const [foodDialogOpen, setFoodDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableFoods, setAvailableFoods] = useState<Food[]>([]);
  const { loadIndex } = useFoodSearch();

  // Pre-load ingredients' full food data
  useEffect(() => {
    if (!recipe?.ingredients.length) return;
    
    async function loadIngredientFoods() {
      try {
        const ids = recipe!.ingredients.map(i => i.foodId);
        const foods = await fetchFoodsByIds(ids);
        setAvailableFoods(foods);
      } catch (err) {
        console.error("Failed to pre-load ingredient foods:", err);
      }
    }
    
    void loadIngredientFoods();
  }, [recipe]);

  const defaultIngredients = useMemo(() => 
    recipe?.ingredients.map((i) => ({
      foodId: i.foodId,
      amount: i.amount,
    })) ?? [], [recipe]);

  const defaultInstructions = useMemo(() => 
    recipe?.instructions.map((s) => ({ value: s })) ?? [{ value: "" }], [recipe]);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: recipe?.name ?? "",
      description: recipe?.description ?? "",
      category: recipe?.category ?? "",
      servings: recipe?.servings ?? 2,
      prepTime: recipe?.prepTime ?? 10,
      cookTime: recipe?.cookTime ?? 20,
      imageUrl: recipe?.imageUrl ?? "",
      prodScore: recipe?.prodScore ?? 75,
      co2PerPortion: recipe?.co2PerPortion ?? 0,
      allergens: recipe?.allergens ?? [],
      additives: recipe?.additives?.join(", ") ?? "",
      ingredients: defaultIngredients.length > 0 ? defaultIngredients : [],
      instructions: defaultInstructions,
    },
  });

  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
  } = useFieldArray({ control: form.control, name: "ingredients" });

  const {
    fields: instructionFields,
    append: appendInstruction,
    remove: removeInstruction,
  } = useFieldArray({ control: form.control, name: "instructions" });

  const watchedIngredients = form.watch("ingredients");
  const watchedServings = form.watch("servings");

  const ingredientsForCalc: Ingredient[] = (watchedIngredients ?? [])
    .filter((i) => i.foodId && i.amount > 0)
    .map((i) => ({ foodId: i.foodId, amount: i.amount }));

  const { perServingNutrients } = useNutrientCalculation(
    ingredientsForCalc,
    availableFoods,
    watchedServings ?? 1,
  );

  const perServingKcal = getNutrientValue(perServingNutrients, "energie");
  const perServingProtein = getNutrientValue(perServingNutrients, "eiweiss");
  const perServingFat = getNutrientValue(perServingNutrients, "fett");
  const perServingCarbs = getNutrientValue(perServingNutrients, "kohlenhydrate");

  const foodMap = useMemo(() => new Map(availableFoods.map((food) => [food.id, food])), [availableFoods]);

  function getFoodName(foodId: string): string {
    return foodMap.get(foodId)?.name ?? "Wird geladen...";
  }

  function handleFoodSelected(food: Food) {
    setAvailableFoods(prev => {
      if (prev.find(f => f.id === food.id)) return prev;
      return [...prev, food];
    });
    
    const existing = watchedIngredients?.find((i) => i.foodId === food.id);
    if (!existing) {
      appendIngredient({ foodId: food.id, amount: 100 });
    }
  }

  async function onSubmit(values: RecipeFormValues) {
    setSaving(true);
    try {
      const formattedRecipe: Recipe = {
        id: recipe?.id ?? `recipe_${Date.now()}`,
        name: values.name,
        description: values.description,
        category: values.category,
        servings: values.servings,
        prepTime: values.prepTime,
        cookTime: values.cookTime,
        imageUrl: values.imageUrl || undefined,
        prodScore: values.prodScore,
        co2PerPortion: values.co2PerPortion,
        allergens: values.allergens,
        additives: values.additives ? values.additives.split(",").map(s => s.trim()) : undefined,
        ingredients: values.ingredients.map(i => ({ foodId: i.foodId, amount: i.amount })),
        instructions: values.instructions.map(s => s.value),
        sourceType: recipe?.sourceType ?? "personal",
        createdAt: recipe?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Save cached nutrient values for list view performance
        cachedKcalPerPortion: perServingKcal,
        cachedProteinPerPortion: perServingProtein,
        cachedFatPerPortion: perServingFat,
        cachedCarbsPerPortion: perServingCarbs,
      };

      // Always try to persist to Supabase if possible
      try {
        await persistPersonalRecipe(formattedRecipe);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "AUTH_REQUIRED") {
          console.info("Recipe saved locally only (not authenticated)");
        } else {
          console.error("Supabase sync failed, falling back to local storage:", error);
        }
      }

      // Always update local storage as a reliable fallback/cache
      upsertLocalRecipe(formattedRecipe, availableFoods);
      
      toast.success(isEditing ? "Rezept aktualisiert" : "Rezept erstellt");
      router.push("/rezepte");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column: Form Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Allgemeine Informationen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name des Rezepts</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Mediterrane Gemüsepfanne" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kategorie</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wählen..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {UNIQUE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="servings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portionen</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="prepTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vorbereitungszeit (Min.)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cookTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kochzeit (Min.)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beschreibung</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Kurze Beschreibung des Gerichts..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Ingredients */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Zutaten</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFoodDialogOpen(true)}
                    onMouseEnter={() => loadIndex()}
                    onFocus={() => loadIndex()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Zutat hinzufügen
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ingredientFields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-4">
                        <div className="flex-1">
                          <p className="mb-1 text-sm font-medium">
                            {getFoodName(watchedIngredients?.[index]?.foodId ?? "")}
                          </p>
                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="flex items-center gap-2">
                                    <Input type="number" min={1} className="w-24" {...field} />
                                    <span className="text-sm text-muted-foreground">g</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIngredient(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {ingredientFields.length === 0 && (
                      <div className="text-muted-foreground py-8 text-center text-sm border-2 border-dashed rounded-lg">
                        Noch keine Zutaten hinzugefügt.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Zubereitung</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendInstruction({ value: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Schritt hinzufügen
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {instructionFields.map((field, index) => (
                      <div key={field.id} className="flex gap-4">
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name={`instructions.${index}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Schritt {index + 1}</FormLabel>
                                <div className="flex gap-3">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                                    {index + 1}
                                  </span>
                                  <FormControl>
                                    <Textarea
                                      placeholder={`Schritt ${index + 1} beschreiben...`}
                                      {...field}
                                    />
                                  </FormControl>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInstruction(index)}
                          className="mt-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? "Rezept speichern" : "Rezept erstellen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Abbrechen
                </Button>
              </div>
            </div>

            {/* Right Column: Nutrition Preview */}
            <div className="space-y-6">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Nährwert-Vorschau</CardTitle>
                  <p className="text-xs text-muted-foreground">Pro Portion ({watchedServings} Portionen)</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Energie</p>
                        <p className="text-sm font-semibold">
                          {formatNumber(perServingKcal, 0)} kcal
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Drumstick className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Eiweiß</p>
                        <p className="text-sm font-semibold">
                          {formatNumber(perServingProtein, 1)} g
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-yellow-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Fett</p>
                        <p className="text-sm font-semibold">
                          {formatNumber(perServingFat, 1)} g
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wheat className="h-4 w-4 text-amber-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Kohlenhydrate
                        </p>
                        <p className="text-sm font-semibold">
                          {formatNumber(perServingCarbs, 1)} g
                        </p>
                      </div>
                    </div>
                  </div>

                  {ingredientsForCalc.length === 0 && (
                    <p className="text-muted-foreground text-center text-xs mt-4">
                      Zutaten hinzufügen, um die Nährwerte zu sehen.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Allergene & Zusatzstoffe</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="allergens"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Allergene</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {RECIPE_ALLERGENS.map((allergen) => {
                            const checked = field.value?.includes(allergen) ?? false;
                            return (
                              <label key={allergen} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border"
                                  checked={checked}
                                  onChange={(event) => {
                                    const current = field.value ?? [];
                                    if (event.target.checked) {
                                      field.onChange([...current, allergen]);
                                    } else {
                                      field.onChange(current.filter((item) => item !== allergen));
                                    }
                                  }}
                                />
                                {allergen}
                              </label>
                            );
                          })}
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="additives"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Zusatzstoffe (kommagetrennt)</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. E300, E471" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>

      <FoodSearchDialog
        open={foodDialogOpen}
        onOpenChange={setFoodDialogOpen}
        onSelect={handleFoodSelected}
      />
    </>
  );
}
