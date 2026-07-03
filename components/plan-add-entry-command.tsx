"use client"

import { useState } from "react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { formatNumber } from "@/lib/format"
import { getNutrientValue } from "@/lib/nutrients"
import type { Food, FoodSearchItem, Recipe } from "@/lib/types"

const MAX_FOOD_RESULTS = 80
const MAX_RECIPE_RESULTS = 40

interface PlanAddEntryCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  foods: FoodSearchItem[]
  recipes: Recipe[]
  /** Fully hydrated foods for the kcal preview; search items may lack nutrients. */
  foodMap: Map<string, Food>
  onSelectFood: (foodId: string) => void
  onSelectRecipe: (recipeId: string) => void
}

/** Command palette for adding a food or recipe to the active meal slot. */
export function PlanAddEntryCommand({
  open,
  onOpenChange,
  foods,
  recipes,
  foodMap,
  onSelectFood,
  onSelectRecipe,
}: PlanAddEntryCommandProps) {
  const [query, setQuery] = useState("")

  const normalizedQuery = query.trim().toLowerCase()
  const filteredFoods = foods
    .filter((food) => !normalizedQuery || food.name.toLowerCase().includes(normalizedQuery))
    .slice(0, MAX_FOOD_RESULTS)
  const filteredRecipes = recipes
    .filter((recipe) => !normalizedQuery || recipe.name.toLowerCase().includes(normalizedQuery))
    .slice(0, MAX_RECIPE_RESULTS)

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setQuery("")
      }}
      title="Lebensmittel oder Rezept hinzufügen"
      description="Suche nach einem Lebensmittel oder Rezept."
    >
      <CommandInput
        placeholder="Lebensmittel oder Rezept suchen..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        <CommandGroup heading="Lebensmittel">
          {filteredFoods.map((food) => {
            const hydratedFood = foodMap.get(food.id)
            return (
              <CommandItem
                key={food.id}
                value={`${food.name} ${food.id}`}
                onSelect={() => {
                  setQuery("")
                  onSelectFood(food.id)
                }}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {hydratedFood
                    ? `${formatNumber(Math.round(getNutrientValue(hydratedFood.nutrients, "energie")))} kcal / 100g`
                    : "wird beim Einfügen geladen"}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <Separator />
        <CommandGroup heading="Rezepte">
          {filteredRecipes.map((recipe) => (
            <CommandItem
              key={recipe.id}
              value={`${recipe.name} ${recipe.id}`}
              onSelect={() => {
                setQuery("")
                onSelectRecipe(recipe.id)
              }}
            >
              <span>{recipe.name}</span>
              <span className="text-muted-foreground ml-auto text-xs">
                {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
