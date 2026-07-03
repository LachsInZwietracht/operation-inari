"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChefHat, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Toggle } from "@/components/ui/toggle"
import { checkAllergenConflicts } from "@/lib/allergen-warnings"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatNumber } from "@/lib/format"
import {
  calculatePerServing,
  calculateRecipeNutrients,
  getNutrientValue,
} from "@/lib/nutrients"
import type { Food, MealSlotType, PatientAllergenEntry, Recipe } from "@/lib/types"

type PaletteSort = "name" | "kcalAsc" | "kcalDesc" | "prep"

interface PlanRecipePaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipes: Recipe[]
  foods: Food[]
  patientIndications: string[]
  patientAllergens: PatientAllergenEntry[]
  isLocked: boolean
  onQuickAdd: (recipeId: string, slotType: MealSlotType) => void
}

/** Recipe library sheet: search, filter, and quick-add recipes into a chosen meal slot. */
export function PlanRecipePalette({
  open,
  onOpenChange,
  recipes,
  foods,
  patientIndications,
  patientAllergens,
  isLocked,
  onQuickAdd,
}: PlanRecipePaletteProps) {
  const [recipeSearch, setRecipeSearch] = useState("")
  const [paletteSlot, setPaletteSlot] = useState<MealSlotType>("mittagessen")
  const [paletteCategory, setPaletteCategory] = useState<string>("alle")
  const [paletteSort, setPaletteSort] = useState<PaletteSort>("name")
  const [paletteIndicationOnly, setPaletteIndicationOnly] = useState(false)
  const [paletteAllergenSafeOnly, setPaletteAllergenSafeOnly] = useState(false)

  const recipeCategories = useMemo(() => {
    const set = new Set<string>()
    for (const recipe of recipes) {
      if (recipe.category) set.add(recipe.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"))
  }, [recipes])

  const paletteRecipes = useMemo(() => {
    const search = recipeSearch.trim().toLowerCase()
    const indicationTokens = patientIndications
      .map((indication) => indication.trim().toLowerCase())
      .filter(Boolean)

    type EnrichedRecipe = {
      recipe: Recipe
      kcal: number
      totalTime: number
      conflictCount: number
    }

    const enriched: EnrichedRecipe[] = recipes
      .map((recipe) => {
        const kcal =
          recipe.cachedKcalPerPortion ??
          (() => {
            const total = calculateRecipeNutrients(recipe, foods)
            const perServing = calculatePerServing(total, recipe.servings)
            return getNutrientValue(perServing, "energie")
          })()
        const conflictCount =
          patientAllergens.length > 0 && recipe.allergens?.length
            ? checkAllergenConflicts(recipe.allergens, patientAllergens).length
            : 0
        return {
          recipe,
          kcal,
          totalTime: (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0),
          conflictCount,
        }
      })
      .filter(({ recipe, conflictCount }) => {
        if (search) {
          const matchesSearch =
            recipe.name.toLowerCase().includes(search) ||
            recipe.tags?.some((tag) => tag.toLowerCase().includes(search))
          if (!matchesSearch) return false
        }
        if (paletteCategory !== "alle" && recipe.category !== paletteCategory) return false
        if (paletteIndicationOnly && indicationTokens.length > 0) {
          const description = recipe.description?.toLowerCase() ?? ""
          const matches = indicationTokens.some((token) =>
            recipe.tags?.some((tag) => tag.toLowerCase().includes(token)) ||
            description.includes(token),
          )
          if (!matches) return false
        }
        if (paletteAllergenSafeOnly && conflictCount > 0) return false
        return true
      })

    enriched.sort((a, b) => {
      switch (paletteSort) {
        case "kcalAsc":
          return a.kcal - b.kcal
        case "kcalDesc":
          return b.kcal - a.kcal
        case "prep":
          return a.totalTime - b.totalTime
        case "name":
        default:
          return a.recipe.name.localeCompare(b.recipe.name, "de")
      }
    })

    return enriched
  }, [
    recipes,
    foods,
    recipeSearch,
    paletteCategory,
    paletteSort,
    paletteIndicationOnly,
    paletteAllergenSafeOnly,
    patientIndications,
    patientAllergens,
  ])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ChefHat className="text-primary h-4 w-4" />
            Rezeptbibliothek
          </SheetTitle>
          <SheetDescription>
            {paletteRecipes.length} von {recipes.length} Rezepten ·{" "}
            Treffer landen in {MEAL_SLOT_LABELS[paletteSlot]}.
          </SheetDescription>
        </SheetHeader>
        <div className="border-b p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
              <Input
                value={recipeSearch}
                onChange={(event) => setRecipeSearch(event.target.value)}
                placeholder="Name oder Tag..."
                className="pl-8"
              />
            </div>
            <Select
              value={paletteSlot}
              onValueChange={(value) => setPaletteSlot(value as MealSlotType)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Slot" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MEAL_SLOT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={paletteCategory} onValueChange={setPaletteCategory}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {recipeCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paletteSort}
              onValueChange={(value) => setPaletteSort(value as PaletteSort)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Sortierung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A→Z)</SelectItem>
                <SelectItem value="kcalAsc">kcal aufsteigend</SelectItem>
                <SelectItem value="kcalDesc">kcal absteigend</SelectItem>
                <SelectItem value="prep">Zubereitungszeit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(patientIndications.length || patientAllergens.length > 0) ? (
            <div className="flex flex-wrap gap-2">
              {patientIndications.length ? (
                <Toggle
                  size="sm"
                  pressed={paletteIndicationOnly}
                  onPressedChange={setPaletteIndicationOnly}
                  className="h-7 text-xs"
                >
                  Indikation passt
                </Toggle>
              ) : null}
              {patientAllergens.length > 0 && (
                <Toggle
                  size="sm"
                  pressed={paletteAllergenSafeOnly}
                  onPressedChange={setPaletteAllergenSafeOnly}
                  className="h-7 text-xs"
                >
                  Allergen-sicher
                </Toggle>
              )}
            </div>
          ) : null}
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-4">
            {paletteRecipes.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Keine Rezepte entsprechen den aktuellen Filtern.
              </p>
            )}
            {paletteRecipes.map(({ recipe, kcal, totalTime, conflictCount }) => {
              const tags = (recipe.tags ?? []).slice(0, 3)
              return (
                <div
                  key={recipe.id}
                  className="hover:border-primary/40 hover:bg-muted/50 rounded-lg border p-3 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        {recipe.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {recipe.category}
                        {tags.length > 0 ? ` · ${tags.join(", ")}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLocked}
                      onClick={() => {
                        onQuickAdd(recipe.id, paletteSlot)
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Hinzufügen
                    </Button>
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span>{formatNumber(kcal, 0)} kcal/Portion</span>
                    {totalTime > 0 && <span>· {totalTime} min</span>}
                    {conflictCount > 0 && (
                      <Badge
                        variant="outline"
                        className="border-orange-200 bg-orange-50 text-[10px] text-orange-700"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {conflictCount} Allergen-Konflikt
                        {conflictCount === 1 ? "" : "e"}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
