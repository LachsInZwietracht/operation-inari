"use client"

import { useMemo, useState, type DragEvent } from "react"
import { GripVertical, LayoutTemplate, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import {
  calculateRecipeNutrients,
  calculatePerServing,
  getNutrientValue,
} from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  Food,
  FoodSearchItem,
  MealEntry,
  MealPlanTemplate,
  MealSlotType,
  Recipe,
} from "@/lib/types"

export const MEAL_PLAN_DRAG_TYPE = "application/prodi-entry-type"
export const MEAL_PLAN_DRAG_ID = "application/prodi-entry-id"
export const MEAL_PLAN_DRAG_SOURCE_SLOT = "application/prodi-source-slot"
export const MEAL_PLAN_DRAG_SOURCE_ENTRY = "application/prodi-source-entry"

export type MealPlanDragPayload = { type: MealEntry["type"]; referenceId: string }

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

export function setMealPlanDragPayload(event: DragEvent, payload: MealPlanDragPayload) {
  event.dataTransfer.setData(MEAL_PLAN_DRAG_TYPE, payload.type)
  event.dataTransfer.setData(MEAL_PLAN_DRAG_ID, payload.referenceId)
  event.dataTransfer.effectAllowed = "copy"
}

export function readMealPlanDragPayload(event: DragEvent): MealPlanDragPayload | null {
  const type = event.dataTransfer.getData(MEAL_PLAN_DRAG_TYPE) as MealEntry["type"] | ""
  const referenceId = event.dataTransfer.getData(MEAL_PLAN_DRAG_ID)
  if (!type || !referenceId) return null
  return { type, referenceId }
}

type LibraryTab = "recipes" | "foods" | "templates"

interface MealPlanLibraryProps {
  foods: FoodSearchItem[]
  fullFoods: Food[]
  recipes: Recipe[]
  templates?: MealPlanTemplate[]
  categoryLabels: Map<string, string>
  isLocked?: boolean
  /** Click-to-add fallback for drag & drop: adds the item to the chosen slot of the active day. */
  onQuickAdd?: (payload: MealPlanDragPayload, slotType: MealSlotType) => void
  /** Applies a day template to the active day. */
  onApplyTemplate?: (template: MealPlanTemplate) => void
  className?: string
}

function QuickAddMenu({
  disabled,
  onSelectSlot,
}: {
  disabled?: boolean
  onSelectSlot: (slotType: MealSlotType) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-none"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          aria-label="Zur Mahlzeit hinzufügen"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Hinzufügen zu …</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SLOT_ORDER.map((slotType) => (
          <DropdownMenuItem key={slotType} onSelect={() => onSelectSlot(slotType)}>
            {MEAL_SLOT_LABELS[slotType]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Shared build source for the meal planner: the same library feeds the day
 * workspace and the week board, via drag & drop or click-to-add.
 */
export function MealPlanLibrary({
  foods,
  fullFoods,
  recipes,
  templates = [],
  categoryLabels,
  isLocked,
  onQuickAdd,
  onApplyTemplate,
  className,
}: MealPlanLibraryProps) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<LibraryTab>("recipes")

  const normalizedQuery = query.trim().toLowerCase()

  const filteredFoods = useMemo(() => {
    return foods
      .filter((food) => !normalizedQuery || food.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 30)
  }, [foods, normalizedQuery])

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter(
        (recipe) =>
          !normalizedQuery ||
          recipe.name.toLowerCase().includes(normalizedQuery) ||
          recipe.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 30)
  }, [normalizedQuery, recipes])

  const filteredTemplates = useMemo(() => {
    return templates
      .filter(
        (template) =>
          !normalizedQuery ||
          template.name.toLowerCase().includes(normalizedQuery) ||
          template.indication?.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 30)
  }, [normalizedQuery, templates])

  const recipeKcal = useMemo(() => {
    const map = new Map<string, number>()
    for (const recipe of filteredRecipes) {
      const kcal =
        recipe.cachedKcalPerPortion ??
        getNutrientValue(
          calculatePerServing(calculateRecipeNutrients(recipe, fullFoods), recipe.servings),
          "energie",
        )
      map.set(recipe.id, kcal)
    }
    return map
  }, [filteredRecipes, fullFoods])

  const tabs: Array<{ id: LibraryTab; label: string }> = [
    { id: "recipes", label: "Rezepte" },
    { id: "foods", label: "Lebensmittel" },
    { id: "templates", label: "Vorlagen" },
  ]

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 xl:min-h-0">
        <div className="text-sm font-semibold">Bibliothek</div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lebensmittel, Rezept oder Vorlage …"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex gap-4 border-b text-xs font-semibold">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "border-b-2 pb-2 transition-colors",
                tab === item.id
                  ? "border-primary text-foreground"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1">
          {tab === "recipes" &&
            filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                draggable={!isLocked}
                onDragStart={(event) =>
                  setMealPlanDragPayload(event, { type: "recipe", referenceId: recipe.id })
                }
                className="hover:bg-accent group flex cursor-grab items-center gap-2 rounded-md border p-2 active:cursor-grabbing"
              >
                <GripVertical className="text-muted-foreground h-4 w-4 flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{recipe.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {recipe.category ?? "Rezept"} · 1 Portion
                  </div>
                </div>
                <span className="text-muted-foreground flex-none font-mono text-[11px]">
                  {formatNumber(Math.round(recipeKcal.get(recipe.id) ?? 0))} kcal
                </span>
                {onQuickAdd && (
                  <QuickAddMenu
                    disabled={isLocked}
                    onSelectSlot={(slotType) =>
                      onQuickAdd({ type: "recipe", referenceId: recipe.id }, slotType)
                    }
                  />
                )}
              </div>
            ))}
          {tab === "recipes" && filteredRecipes.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-xs">Keine Rezepte gefunden.</p>
          )}
          {tab === "foods" &&
            filteredFoods.map((food) => (
              <div
                key={food.id}
                draggable={!isLocked}
                onDragStart={(event) =>
                  setMealPlanDragPayload(event, { type: "food", referenceId: food.id })
                }
                className="hover:bg-accent group flex cursor-grab items-center gap-2 rounded-md border p-2 active:cursor-grabbing"
              >
                <GripVertical className="text-muted-foreground h-4 w-4 flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{food.name}</div>
                  <div className="text-muted-foreground truncate text-[11px]">
                    {categoryLabels.get(food.categoryId) ?? "Lebensmittel"} · 120 g
                  </div>
                </div>
                {onQuickAdd && (
                  <QuickAddMenu
                    disabled={isLocked}
                    onSelectSlot={(slotType) =>
                      onQuickAdd({ type: "food", referenceId: food.id }, slotType)
                    }
                  />
                )}
              </div>
            ))}
          {tab === "foods" && filteredFoods.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Keine Lebensmittel gefunden.
            </p>
          )}
          {tab === "templates" &&
            filteredTemplates.map((template) => {
              const entryCount = template.slots.reduce(
                (sum, slot) => sum + slot.entries.length,
                0,
              )
              return (
                <div
                  key={template.id}
                  className="hover:bg-accent flex items-center gap-2 rounded-md border p-2"
                >
                  <LayoutTemplate className="text-muted-foreground h-4 w-4 flex-none" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{template.name}</div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {template.indication || template.description || "Tagesplan"} · {entryCount}{" "}
                      Einträge
                    </div>
                  </div>
                  {onApplyTemplate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 flex-none px-2 text-[11px]"
                      disabled={isLocked}
                      onClick={() => onApplyTemplate(template)}
                    >
                      Anwenden
                    </Button>
                  )}
                </div>
              )
            })}
          {tab === "templates" && filteredTemplates.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Keine Vorlagen gefunden.
            </p>
          )}
        </div>
        <p className="text-muted-foreground text-[11px]">
          {tab === "templates"
            ? "Vorlagen füllen den aktiven Tag komplett."
            : "Per Drag & Drop auf eine Mahlzeit ziehen oder über + hinzufügen."}
        </p>
      </CardContent>
    </Card>
  )
}
