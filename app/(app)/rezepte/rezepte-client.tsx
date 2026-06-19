"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Import, Download, Filter } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RecipeCard } from "@/components/recipe-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Recipe } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRecipes } from "@/hooks/use-recipes";
import { ALLERGEN_DEFINITIONS } from "@/lib/allergen-constants";
import { parseMealMaster, type ParsedMealMasterRecipe } from "@/lib/meal-master-parser";
import { RecipeImportReviewDialog } from "@/components/recipe-import-review-dialog";

const RECIPE_CATEGORIES = [
  "Alle",
  "Suppen",
  "Hauptgerichte",
  "Beilagen",
  "Frühstück",
  "Snacks",
  "Salate",
  "Desserts",
  "Eintöpfe",
];

const DIET_FILTERS = [
  { id: "all", label: "Alle Ernährungsformen" },
  { id: "vegetarian", label: "Vegetarisch" },
  { id: "vegan", label: "Vegan" },
  { id: "keto", label: "Keto / Low Carb" },
] as const;

type DietFilter = (typeof DIET_FILTERS)[number]["id"];

const ALLERGEN_FILTERS = ALLERGEN_DEFINITIONS.map((definition) => definition.label);

const MEAT_OR_FISH_INGREDIENT_TOKENS = [
  "haehnchen",
  "hähnchen",
  "huhn",
  "pute",
  "rind",
  "schwein",
  "fleisch",
  "lachs",
  "thunfisch",
  "kabeljau",
  "garnelen",
  "fisch",
];

const ANIMAL_INGREDIENT_TOKENS = [
  ...MEAT_OR_FISH_INGREDIENT_TOKENS,
  "milch",
  "joghurt",
  "quark",
  "gouda",
  "kaese",
  "käse",
  "butter",
  "food_ei",
  "huehnerei",
  "hühnerei",
  " eier ",
  "honig",
];

const KETO_EXCLUSION_INGREDIENT_TOKENS = [
  "brot",
  "hafer",
  "kartoffel",
  "reis",
  "nudeln",
  "pasta",
  "mehl",
  "banane",
  "honig",
  "zucker",
  "linsen",
  "bohnen",
  "kichererbsen",
];

const SAMPLE_IMPORT_PAYLOAD = `[
  {
    "name": "Mediterraner Eintopf",
    "description": "Tomatiger Eintopf mit Bohnen",
    "category": "Eintöpfe",
    "servings": 4,
    "prepTime": 15,
    "cookTime": 35
  }
]`;

interface RezeptePageClientProps {
  recipes: Recipe[];
}

function normalize(value: string): string {
  return value.toLowerCase();
}

function recipeText(recipe: Recipe): string {
  return [
    recipe.name,
    recipe.description,
    recipe.category,
    ...(recipe.tags ?? []),
    ...(recipe.allergens ?? []),
    ...recipe.ingredients.map((ingredient) => ingredient.foodId),
  ]
    .join(" ")
    .toLowerCase();
}

function recipeHasAnyToken(recipe: Recipe, tokens: string[]): boolean {
  const text = recipeText(recipe);
  return tokens.some((token) => text.includes(normalize(token)));
}

function recipeMatchesAllergenFreeFilter(recipe: Recipe, excludedAllergens: string[]): boolean {
  if (excludedAllergens.length === 0) return true;

  const recipeAllergens = (recipe.allergens ?? []).map(normalize);
  const text = recipeText(recipe);
  return excludedAllergens.every((excludedAllergen) => {
    const definition = ALLERGEN_DEFINITIONS.find((item) => item.label === excludedAllergen);
    const matchTokens = [excludedAllergen, ...(definition?.foodMatchTokens ?? [])].map(normalize);

    const hasAllergen = recipeAllergens.some((allergen) =>
      matchTokens.some((token) => allergen.includes(token) || token.includes(allergen)),
    );
    const ingredientTokens =
      excludedAllergen === "Ei"
        ? ["food_ei", "huehnerei", "hühnerei", " eier "]
        : matchTokens.filter((token) => token.length > 2);
    const hasIngredientToken = ingredientTokens.some((token) => text.includes(token));

    return !hasAllergen && !hasIngredientToken;
  });
}

function recipeMatchesDietFilter(recipe: Recipe, dietFilter: DietFilter): boolean {
  if (dietFilter === "all") return true;

  const tags = (recipe.tags ?? []).map(normalize);
  const hasDietTag = (tokens: string[]) => tags.some((tag) => tokens.some((token) => tag.includes(token)));

  if (dietFilter === "vegetarian") {
    return !recipeHasAnyToken(recipe, MEAT_OR_FISH_INGREDIENT_TOKENS);
  }

  if (dietFilter === "vegan") {
    return !recipeHasAnyToken(recipe, ANIMAL_INGREDIENT_TOKENS);
  }

  const carbs = recipe.cachedCarbsPerPortion;
  if (typeof carbs === "number") {
    return carbs <= 20;
  }

  return hasDietTag(["keto", "ketogen", "low carb", "low-carb"]) || !recipeHasAnyToken(recipe, KETO_EXCLUSION_INGREDIENT_TOKENS);
}

export function RezeptePageClient({ recipes: initialRecipes }: RezeptePageClientProps) {
  const { allRecipes, addRecipe } = useRecipes(initialRecipes, []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "personal" | "community">("all");
  const [dietFilter, setDietFilter] = useState<DietFilter>("all");
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  
  // Import states
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"json" | "csv" | "mmf">("json");
  const [importPayload, setImportPayload] = useState(SAMPLE_IMPORT_PAYLOAD);
  
  // MMF Review states
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [mmfRecipes, setMmfRecipes] = useState<ParsedMealMasterRecipe[]>([]);

  // Export states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");

  const filtered = useMemo(() => {
    return allRecipes.filter((recipe) => {
      const matchesSearch =
        search === "" ||
        recipe.name.toLowerCase().includes(search.toLowerCase()) ||
        (recipe.description && recipe.description.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory =
        category === "Alle" || recipe.category === category;
      const matchesLibrary =
        libraryFilter === "all"
          ? true
          : libraryFilter === "personal"
          ? recipe.sourceType === "personal"
          : recipe.sourceType !== "personal";
      const matchesDiet = recipeMatchesDietFilter(recipe, dietFilter);
      const matchesAllergens = recipeMatchesAllergenFreeFilter(recipe, excludedAllergens);
      return matchesSearch && matchesCategory && matchesLibrary && matchesDiet && matchesAllergens;
    });
  }, [allRecipes, search, category, libraryFilter, dietFilter, excludedAllergens]);

  const hasClinicalFilters = dietFilter !== "all" || excludedAllergens.length > 0;

  function toggleExcludedAllergen(allergen: string, checked: boolean) {
    setExcludedAllergens((current) =>
      checked ? [...current, allergen] : current.filter((item) => item !== allergen),
    );
  }

  async function handleImportRecipe(recipe: Recipe) {
    const now = new Date().toISOString();
    const clone: Recipe = {
      ...recipe,
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      sourceType: "personal",
    };
    await addRecipe(clone);
    toast.success("Rezept in eigene Sammlung importiert");
  }

  function handleExport() {
    const payload = exportFormat === "json" ? JSON.stringify(filtered, null, 2) : toCsv(filtered);
    const blob = new Blob([payload], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rezepte.${exportFormat === "json" ? "json" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export gestartet");
    setExportDialogOpen(false);
  }

  function toCsv(recipes: Recipe[]) {
    const headers = ["name", "category", "servings", "prepTime", "cookTime"];
    const rows = recipes.map((recipe) =>
      [recipe.name, recipe.category, recipe.servings, recipe.prepTime, recipe.cookTime].join(","),
    );
    return [headers.join(","), ...rows].join("\n");
  }

  async function handleImportSubmit() {
    try {
      if (importFormat === "mmf") {
        const parsed = parseMealMaster(importPayload);
        if (parsed.length === 0) {
          toast.error("Keine gültigen Meal-Master Rezepte gefunden");
          return;
        }
        setMmfRecipes(parsed);
        setImportDialogOpen(false);
        setReviewDialogOpen(true);
        return;
      }

      if (importFormat === "json") {
        const parsed = JSON.parse(importPayload) as Partial<Recipe>[];
        for (const item of parsed) {
          if (!item.name) continue;
          const now = new Date().toISOString();
          const recipe: Recipe = {
            id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: item.name,
            description: item.description ?? "Importiertes Rezept",
            category: item.category ?? "Community",
            servings: item.servings ?? 2,
            prepTime: item.prepTime ?? 10,
            cookTime: item.cookTime ?? 20,
            ingredients: [],
            instructions: ["Bitte Angaben ergänzen"],
            createdAt: now,
            updatedAt: now,
            sourceType: "personal",
          };
          await addRecipe(recipe);
        }
      } else if (importFormat === "csv") {
        const rows = importPayload.trim().split(/\n+/).slice(1);
        for (const row of rows) {
          const [name, category, servings, prep, cook] = row.split(",");
          if (!name) continue;
          const now = new Date().toISOString();
          const recipe: Recipe = {
            id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            description: "Importiertes Rezept",
            category: category ?? "Community",
            servings: Number(servings) || 2,
            prepTime: Number(prep) || 10,
            cookTime: Number(cook) || 20,
            ingredients: [],
            instructions: ["Bitte Angaben ergänzen"],
            createdAt: now,
            updatedAt: now,
            sourceType: "personal",
          };
          await addRecipe(recipe);
        }
      }
      toast.success("Import abgeschlossen");
      setImportDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Import fehlgeschlagen");
    }
  }

  async function handleReviewComplete(importedRecipes: Partial<Recipe>[]) {
    try {
      for (const item of importedRecipes) {
        if (!item.name) continue;
        const now = new Date().toISOString();
        const recipe: Recipe = {
          id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: item.name,
          description: item.description ?? "Importiertes Rezept",
          category: item.category ?? "Community",
          servings: item.servings ?? 2,
          prepTime: item.prepTime ?? 10,
          cookTime: item.cookTime ?? 20,
          ingredients: item.ingredients ?? [],
          instructions: item.instructions ?? ["Bitte Angaben ergänzen"],
          createdAt: now,
          updatedAt: now,
          sourceType: "personal",
        };
        await addRecipe(recipe);
      }
      toast.success(`${importedRecipes.length} Rezepte erfolgreich importiert`);
    } catch (error) {
      console.error(error);
      toast.error("Speichern der Rezepte fehlgeschlagen");
    } finally {
      setReviewDialogOpen(false);
      setMmfRecipes([]);
    }
  }

  // Helper to prefill payload based on format change if it's the default
  function handleFormatChange(v: "json" | "csv" | "mmf") {
    setImportFormat(v);
    if (importPayload === SAMPLE_IMPORT_PAYLOAD && v === "csv") {
        setImportPayload("name,category,servings,prepTime,cookTime\nMediterraner Eintopf,Eintöpfe,4,15,35");
    } else if (v === "mmf") {
        setImportPayload("MMMMM----- Meal-Master Recipe\n\n      Title: Classic Apple Pie\n Categories: Desserts, Pies\n      Yield: 8 Servings\n\n      6 ea Large granny smith apples\n    3/4 c  Sugar\n\n  Preheat oven to 425 degrees F.\nMMMMM");
    } else if (v === "json" && importPayload.startsWith("name,") || importPayload.startsWith("MMMMM")) {
        setImportPayload(SAMPLE_IMPORT_PAYLOAD);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Rezepte" description="Alle Rezepte verwalten" helpText="Verwalten Sie Ihre Rezeptsammlung mit automatischer Nährstoffberechnung. Erstellen Sie neue Rezepte, importieren Sie bestehende oder exportieren Sie diese für Ihre Patienten.">
        <Button asChild>
          <Link href="/rezepte/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neues Rezept
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <Import className="mr-2 h-4 w-4" />
          Importieren
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
          <Download className="mr-2 h-4 w-4" />
          Exportieren
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Rezept suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            {RECIPE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={libraryFilter} onValueChange={(value) => setLibraryFilter(value as typeof libraryFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Bibliothek" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            <SelectItem value="personal">Eigene Rezepte</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dietFilter} onValueChange={(value) => setDietFilter(value as DietFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Ernährungsform" />
          </SelectTrigger>
          <SelectContent>
            {DIET_FILTERS.map((filter) => (
              <SelectItem key={filter.id} value={filter.id}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Frei von Allergenen / Intoleranzen</p>
            <p className="text-muted-foreground text-xs">
              Rezepte mit passenden Allergen-Hinweisen werden ausgeblendet.
            </p>
          </div>
          {hasClinicalFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDietFilter("all");
                setExcludedAllergens([]);
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ALLERGEN_FILTERS.map((allergen) => (
            <label key={allergen} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={excludedAllergens.includes(allergen)}
                onCheckedChange={(checked) => toggleExcludedAllergen(allergen, checked === true)}
              />
              <span>{allergen}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm flex items-center gap-2">
        <Filter className="h-4 w-4" />
        {filtered.length} {filtered.length === 1 ? "Rezept" : "Rezepte"} – {libraryFilter === "all" ? "Alle Sammlungen" : libraryFilter === "personal" ? "Eigene" : "Community"}
        {dietFilter !== "all" && (
          <Badge variant="outline">
            {DIET_FILTERS.find((filter) => filter.id === dietFilter)?.label}
          </Badge>
        )}
        {excludedAllergens.map((allergen) => (
          <Badge key={allergen} variant="outline">
            frei von {allergen}
          </Badge>
        ))}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            foods={[]}
            onImport={
              recipe.sourceType !== "personal"
                ? () => handleImportRecipe(recipe)
                : undefined
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          Keine Rezepte gefunden.
        </div>
      )}

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rezepte importieren</DialogTitle>
            <DialogDescription>
              Fügen Sie JSON, CSV oder Meal-Master (.mmf/.txt) Formate ein, um Rezepte zu übernehmen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Select value={importFormat} onValueChange={(v) => handleFormatChange(v as "json" | "csv" | "mmf")}>
              <SelectTrigger>
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="mmf">Meal-Master (.mmf)</SelectItem>
              </SelectContent>
            </Select>
            <Textarea rows={8} value={importPayload} onChange={(e) => setImportPayload(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleImportSubmit}>
                {importFormat === "mmf" ? "Zutaten zuordnen" : "Import starten"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecipeImportReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        recipes={mmfRecipes}
        onComplete={handleReviewComplete}
      />

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rezepte exportieren</DialogTitle>
            <DialogDescription>
              Aktuelle Filterung als Datei herunterladen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as "json" | "csv") }>
              <SelectTrigger>
                <SelectValue placeholder="Format wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {filtered.length} Rezepte werden exportiert.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleExport}>Download starten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
