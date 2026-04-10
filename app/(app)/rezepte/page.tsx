"use client";

import { useState, useEffect, useMemo } from "react";
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
import { RECIPES } from "@/lib/mock-data";
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

function getCustomRecipes(): Recipe[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("prodi_custom_recipes");
    if (!stored) return [];
    return JSON.parse(stored) as Recipe[];
  } catch {
    return [];
  }
}

function saveCustomRecipes(recipes: Recipe[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("prodi_custom_recipes", JSON.stringify(recipes));
}

export default function RezeptePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<"all" | "personal" | "community">("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importPayload, setImportPayload] = useState(SAMPLE_IMPORT_PAYLOAD);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");

  useEffect(() => {
    setCustomRecipes(getCustomRecipes());
  }, []);

  const allRecipes = useMemo(() => {
    const withFlags = RECIPES.map((recipe) => ({
      ...recipe,
      sourceType: recipe.sourceType ?? "community",
    }));
    const customWithMeta = customRecipes.map((recipe) => ({
      ...recipe,
      sourceType: "personal" as const,
    }));
    return [...withFlags, ...customWithMeta];
  }, [customRecipes]);

  const filtered = useMemo(() => {
    return allRecipes.filter((recipe) => {
      const matchesSearch =
        search === "" ||
        recipe.name.toLowerCase().includes(search.toLowerCase()) ||
        recipe.description.toLowerCase().includes(search.toLowerCase());
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

  function addCustomRecipe(recipe: Recipe) {
    setCustomRecipes((prev) => {
      const next = [...prev, recipe];
      saveCustomRecipes(next);
      return next;
    });
  }

  function handleImportRecipe(recipe: Recipe) {
    const now = new Date().toISOString();
    const clone: Recipe = {
      ...recipe,
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      sourceType: "personal",
    };
    addCustomRecipe(clone);
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

  function handleImportSubmit() {
    try {
      if (importFormat === "json") {
        const parsed = JSON.parse(importPayload) as Partial<Recipe>[];
        parsed.forEach((item) => {
          if (!item.name) return;
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
          addCustomRecipe(recipe);
        });
      } else {
        const rows = importPayload.trim().split(/\n+/).slice(1);
        rows.forEach((row) => {
          const [name, category, servings, prep, cook] = row.split(",");
          if (!name) return;
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
          addCustomRecipe(recipe);
        });
      }
      toast.success("Import abgeschlossen");
      setImportDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Import fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Rezepte" description="Alle Rezepte verwalten">
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
              Fügen Sie JSON oder CSV ein, um mehrere Rezepte zu übernehmen. Zutaten können später ergänzt werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Select value={importFormat} onValueChange={(v) => setImportFormat(v as "json" | "csv")}>
              <SelectTrigger>
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <Textarea rows={8} value={importPayload} onChange={(e) => setImportPayload(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleImportSubmit}>Import starten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
