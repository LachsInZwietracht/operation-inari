"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Import, Download, Filter } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
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

export function RezeptePageClient({ recipes: initialRecipes }: RezeptePageClientProps) {
  const { allRecipes, addRecipe } = useRecipes(initialRecipes, []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "personal" | "community">("all");
  
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
      return matchesSearch && matchesCategory && matchesLibrary;
    });
  }, [allRecipes, search, category, libraryFilter]);

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
      </div>

      <p className="text-muted-foreground text-sm flex items-center gap-2">
        <Filter className="h-4 w-4" />
        {filtered.length} {filtered.length === 1 ? "Rezept" : "Rezepte"} – {libraryFilter === "all" ? "Alle Sammlungen" : libraryFilter === "personal" ? "Eigene" : "Community"}
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
