"use client";

import { useMemo, useState } from "react";
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
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

import { useNutrientCalculation } from "@/hooks/use-nutrient-calculation";
import { getNutrientValue } from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import type { Recipe, Ingredient } from "@/lib/types";
import { useFoods } from "@/components/foods-provider";
import { persistPersonalRecipe } from "@/lib/data/recipes-client";
import { getLocalRecipes, saveLocalRecipes, upsertLocalRecipe } from "@/lib/data/local-recipes";

const RECIPE_CATEGORIES = [
  "Suppe",
  "Hauptgericht",
  "Beilage",
  "Frühstück",
  "Snack",
  "Salat",
  "Dessert",
  "Suppen",
  "Hauptgerichte",
  "Eintöpfe",
  "Salate",
  "Snacks",
  "Beilagen",
  "Desserts",
];

// Deduplicate categories
const UNIQUE_CATEGORIES = [...new Set(RECIPE_CATEGORIES)];

const RECIPE_ALLERGENS = [
  "Gluten",
  "Milch",
  "Ei",
  "Soja",
  "Schalenfrüchte",
  "Sellerie",
  "Fisch",
];

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
  const foods = useFoods();

  const defaultIngredients: { foodId: string; amount: number }[] =
    recipe?.ingredients.map((i) => ({
      foodId: i.foodId,
      amount: i.amount,
    })) ?? [];

  const defaultInstructions: { value: string }[] =
    recipe?.instructions.map((s) => ({ value: s })) ?? [{ value: "" }];

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

  // Build Ingredient[] for hook
  const ingredientsForCalc: Ingredient[] = (watchedIngredients ?? [])
    .filter((i) => i.foodId && i.amount > 0)
    .map((i) => ({ foodId: i.foodId, amount: i.amount }));

  const { totalNutrients, perServingNutrients } = useNutrientCalculation(
    ingredientsForCalc,
    foods,
    watchedServings ?? 1,
  );

  const totalKcal = getNutrientValue(totalNutrients, "energie");
  const perServingKcal = getNutrientValue(perServingNutrients, "energie");
  const perServingProtein = getNutrientValue(perServingNutrients, "eiweiss");
  const perServingFat = getNutrientValue(perServingNutrients, "fett");
  const perServingCarbs = getNutrientValue(perServingNutrients, "kohlenhydrate");

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);

  function getFoodName(foodId: string): string {
    return foodMap.get(foodId)?.name ?? "Unbekannt";
  }

  function handleAddFood(foodId: string) {
    // Don't add duplicates
    const existing = watchedIngredients?.find((i) => i.foodId === foodId);
    if (!existing) {
      appendIngredient({ foodId, amount: 100 });
    }
    setFoodDialogOpen(false);
  }

  async function onSubmit(values: RecipeFormValues) {
    setSaving(true);
    const now = new Date().toISOString();
    const additiveList = values.additives
      ? values.additives
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : undefined;

    const recipeData: Recipe = {
      id: recipe?.id ?? crypto.randomUUID(),
      name: values.name,
      description: values.description,
      category: values.category,
      servings: values.servings,
      prepTime: values.prepTime,
      cookTime: values.cookTime,
      imageUrl: values.imageUrl || recipe?.imageUrl,
      prodScore: values.prodScore ?? recipe?.prodScore,
      co2PerPortion: values.co2PerPortion ?? recipe?.co2PerPortion,
      allergens: values.allergens,
      additives: additiveList,
      sourceType: recipe?.sourceType ?? "personal",
      ingredients: values.ingredients.map((i) => ({
        foodId: i.foodId,
        amount: i.amount,
      })),
      instructions: values.instructions.map((s) => s.value),
      createdAt: recipe?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      if (isEditing && recipe) {
        const existing = getLocalRecipes(foods);
        const isLocalRecipe = existing.some((entry) => entry.id === recipe.id);
        const isPersistedRecipe =
          recipe.sourceType === "personal" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipe.id);

        if (!isLocalRecipe && !isPersistedRecipe) {
          toast.error("Standardrezepte können nicht bearbeitet werden.");
          return;
        }
      }

      let savedRecipe = recipeData;

      try {
        savedRecipe = await persistPersonalRecipe(recipeData);
        const remainingLocalRecipes = getLocalRecipes(foods).filter((entry) => entry.id !== recipeData.id);
        saveLocalRecipes(remainingLocalRecipes, foods);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message && message !== "AUTH_REQUIRED") {
          console.error("Failed to persist recipe to Supabase:", error);
        }
        savedRecipe = upsertLocalRecipe(recipeData, foods);
      }

      toast.success(isEditing ? "Rezept erfolgreich aktualisiert!" : "Rezept erfolgreich erstellt!");
      router.push(`/rezepte/${savedRecipe.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Already-selected food IDs for filtering
  const selectedFoodIds = new Set(
    (watchedIngredients ?? []).map((i) => i.foodId),
  );

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Form fields */}
            <div className="space-y-6 lg:col-span-2">
              {/* Basic info */}
              <Card>
                <CardHeader>
                  <CardTitle>Grunddaten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Rezeptname" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beschreibung</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Kurze Beschreibung des Rezepts"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategorie</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Kategorie wählen" />
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

                  <div className="grid grid-cols-3 gap-4">
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

                    <FormField
                      control={form.control}
                      name="prepTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vorbereitung (Min.)</FormLabel>
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

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Bild-URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="prodScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PRODIscore</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={100} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="co2PerPortion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CO₂ je Portion (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.01} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

              {/* Ingredients */}
              <Card>
                <CardHeader>
                  <CardTitle>Zutaten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ingredientFields.length > 0 && (
                    <div className="space-y-3">
                      {ingredientFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex items-center gap-3"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {getFoodName(
                                watchedIngredients?.[index]?.foodId ?? "",
                              )}
                            </p>
                          </div>
                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.amount`}
                            render={({ field: amountField }) => (
                              <FormItem className="w-24">
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    placeholder="g"
                                    {...amountField}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <span className="text-muted-foreground text-sm">g</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIngredient(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {form.formState.errors.ingredients?.root && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.ingredients.root.message}
                    </p>
                  )}
                  {form.formState.errors.ingredients?.message && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.ingredients.message}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFoodDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Zutat hinzufügen
                  </Button>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle>Zubereitung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {instructionFields.map((field, index) => (
                    <div key={field.id} className="flex gap-3">
                      <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                        {index + 1}
                      </span>
                      <FormField
                        control={form.control}
                        name={`instructions.${index}.value`}
                        render={({ field: stepField }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Textarea
                                placeholder={`Schritt ${index + 1}`}
                                {...stepField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {instructionFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInstruction(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {form.formState.errors.instructions?.root && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.instructions.root.message}
                    </p>
                  )}
                  {form.formState.errors.instructions?.message && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.instructions.message}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendInstruction({ value: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Schritt hinzufügen
                  </Button>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? "Rezept aktualisieren" : "Rezept erstellen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Abbrechen
                </Button>
              </div>
            </div>

            {/* Right: Live nutrition */}
            <div className="space-y-6">
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>Nährwerte (live)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-muted-foreground text-center text-sm">
                    Gesamt: {formatNumber(totalKcal, 0)} kcal
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          kcal / Portion
                        </p>
                        <p className="text-sm font-semibold">
                          {formatNumber(perServingKcal, 0)}
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
                    <p className="text-muted-foreground text-center text-xs">
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

      {/* Food search dialog */}
      <CommandDialog
        open={foodDialogOpen}
        onOpenChange={setFoodDialogOpen}
        title="Lebensmittel suchen"
        description="Wählen Sie ein Lebensmittel aus der Datenbank"
      >
        <CommandInput placeholder="Lebensmittel suchen..." />
        <CommandList>
          <CommandEmpty>Kein Lebensmittel gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {foods.filter((f) => !selectedFoodIds.has(f.id)).map((food) => (
              <CommandItem
                key={food.id}
                value={food.name}
                onSelect={() => handleAddFood(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {getNutrientValue(food.nutrients, "energie")} kcal/100g
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
