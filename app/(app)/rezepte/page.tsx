"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
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

export default function RezeptePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    setCustomRecipes(getCustomRecipes());
  }, []);

  const allRecipes = useMemo(
    () => [...RECIPES, ...customRecipes],
    [customRecipes],
  );

  const filtered = useMemo(() => {
    return allRecipes.filter((recipe) => {
      const matchesSearch =
        search === "" ||
        recipe.name.toLowerCase().includes(search.toLowerCase()) ||
        recipe.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        category === "Alle" || recipe.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [allRecipes, search, category]);

  return (
    <div className="space-y-6">
      <PageHeader title="Rezepte" description="Alle Rezepte verwalten">
        <Button asChild>
          <Link href="/rezepte/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neues Rezept
          </Link>
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
      </div>

      <p className="text-muted-foreground text-sm">
        {filtered.length} {filtered.length === 1 ? "Rezept" : "Rezepte"}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          Keine Rezepte gefunden.
        </div>
      )}
    </div>
  );
}
