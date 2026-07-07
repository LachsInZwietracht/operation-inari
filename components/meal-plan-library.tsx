"use client"

import { useMemo, useState, type DragEvent } from "react"
import { GripVertical, LayoutTemplate, MoreVertical, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
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
  FoodSourceId,
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

/**
 * "default" keeps the incoming (relevance/source) order; the nutrient sorts
 * order by the currently selected `sortNutrient` and only apply to recipes,
 * whose per-serving values we can compute from their ingredients.
 */
type SortMode = "default" | "name-asc" | "name-desc" | "nutrient-desc" | "nutrient-asc"

const RESULT_LIMITS = [30, 60, 0] as const
const DEFAULT_LIMIT = 30

/**
 * Nutrients offered for recipe sorting: the macros plus a few clinically
 * relevant micros. Labels and units resolve through the shared catalog.
 */
const SORTABLE_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "zucker",
  "gesaettigte_fettsaeuren",
  "salz",
  "calcium",
  "eisen",
  "kalium",
  "magnesium",
  "vitamin_c",
  "vitamin_d",
] as const

const DEFAULT_SORT_NUTRIENT = "energie"

const NUTRIENT_NAME_BY_ID = new Map(NUTRIENT_DEFINITIONS.map((def) => [def.id, def.name]))

function nutrientName(nutrientId: string) {
  return NUTRIENT_NAME_BY_ID.get(nutrientId) ?? nutrientId
}

/** Short badges for the source filter; falls back to the raw id for unmapped sources. */
const SOURCE_SHORT_LABELS: Record<FoodSourceId, string> = {
  bls: "BLS",
  sfk: "SFK",
  usda: "USDA",
  afcd: "AFCD",
  swiss: "Swiss",
  ciqual: "Ciqual",
  cofid: "CoFID",
  off: "OFF",
  hersteller: "Hersteller",
  custom: "Eigene",
}

function byName(a: { name: string }, b: { name: string }, direction: 1 | -1) {
  return direction * a.name.localeCompare(b.name, "de")
}

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
  const [sort, setSort] = useState<SortMode>("default")
  const [sortNutrient, setSortNutrient] = useState<string>(DEFAULT_SORT_NUTRIENT)
  const [recipeCategory, setRecipeCategory] = useState<string>("all")
  const [foodCategory, setFoodCategory] = useState<string>("all")
  const [foodSource, setFoodSource] = useState<FoodSourceId | "all">("all")
  const [customOnly, setCustomOnly] = useState(false)
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT)

  const normalizedQuery = query.trim().toLowerCase()

  // kcal per portion for every recipe, so sorting and filtering can see the
  // whole set before it is sliced down to the visible page.
  const recipeKcal = useMemo(() => {
    const map = new Map<string, number>()
    for (const recipe of recipes) {
      const kcal =
        recipe.cachedKcalPerPortion ??
        getNutrientValue(
          calculatePerServing(calculateRecipeNutrients(recipe, fullFoods), recipe.servings),
          "energie",
        )
      map.set(recipe.id, kcal)
    }
    return map
  }, [recipes, fullFoods])

  // Per-serving amount of the selected sort nutrient, computed only while a
  // nutrient sort is active so the default path keeps the cheap kcal cache.
  const recipeSortValue = useMemo(() => {
    const map = new Map<string, number>()
    if (sort !== "nutrient-desc" && sort !== "nutrient-asc") return map
    for (const recipe of recipes) {
      const value =
        sortNutrient === "energie"
          ? (recipeKcal.get(recipe.id) ?? 0)
          : getNutrientValue(
              calculatePerServing(
                calculateRecipeNutrients(recipe, fullFoods),
                recipe.servings,
              ),
              sortNutrient,
            )
      map.set(recipe.id, value)
    }
    return map
  }, [sort, sortNutrient, recipes, fullFoods, recipeKcal])

  // Filter options are derived from the loaded data so we only ever offer
  // categories/sources that can actually return a hit.
  const recipeCategories = useMemo(() => {
    const set = new Set<string>()
    for (const recipe of recipes) if (recipe.category) set.add(recipe.category)
    return [...set].sort((a, b) => a.localeCompare(b, "de"))
  }, [recipes])

  const foodCategoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const food of foods) if (food.categoryId) set.add(food.categoryId)
    return [...set]
      .map((id) => ({ id, label: categoryLabels.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"))
  }, [foods, categoryLabels])

  const foodSourceOptions = useMemo(() => {
    const set = new Set<FoodSourceId>()
    for (const food of foods) if (food.sourceId) set.add(food.sourceId)
    return [...set].sort((a, b) =>
      (SOURCE_SHORT_LABELS[a] ?? a).localeCompare(SOURCE_SHORT_LABELS[b] ?? b, "de"),
    )
  }, [foods])

  const filteredFoods = useMemo(() => {
    const result = foods.filter(
      (food) =>
        (!normalizedQuery || food.name.toLowerCase().includes(normalizedQuery)) &&
        (foodCategory === "all" || food.categoryId === foodCategory) &&
        (foodSource === "all" || food.sourceId === foodSource) &&
        (!customOnly || food.isCustom),
    )
    if (sort === "name-asc") result.sort((a, b) => byName(a, b, 1))
    else if (sort === "name-desc") result.sort((a, b) => byName(a, b, -1))
    return limit > 0 ? result.slice(0, limit) : result
  }, [foods, normalizedQuery, foodCategory, foodSource, customOnly, sort, limit])

  const filteredRecipes = useMemo(() => {
    const result = recipes.filter(
      (recipe) =>
        (!normalizedQuery ||
          recipe.name.toLowerCase().includes(normalizedQuery) ||
          recipe.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))) &&
        (recipeCategory === "all" || recipe.category === recipeCategory),
    )
    if (sort === "name-asc") result.sort((a, b) => byName(a, b, 1))
    else if (sort === "name-desc") result.sort((a, b) => byName(a, b, -1))
    else if (sort === "nutrient-desc")
      result.sort((a, b) => (recipeSortValue.get(b.id) ?? 0) - (recipeSortValue.get(a.id) ?? 0))
    else if (sort === "nutrient-asc")
      result.sort((a, b) => (recipeSortValue.get(a.id) ?? 0) - (recipeSortValue.get(b.id) ?? 0))
    return limit > 0 ? result.slice(0, limit) : result
  }, [recipes, normalizedQuery, recipeCategory, sort, recipeSortValue, limit])

  const filteredTemplates = useMemo(() => {
    const result = templates.filter(
      (template) =>
        !normalizedQuery ||
        template.name.toLowerCase().includes(normalizedQuery) ||
        template.indication?.toLowerCase().includes(normalizedQuery),
    )
    if (sort === "name-asc") result.sort((a, b) => byName(a, b, 1))
    else if (sort === "name-desc") result.sort((a, b) => byName(a, b, -1))
    return limit > 0 ? result.slice(0, limit) : result
  }, [templates, normalizedQuery, sort, limit])

  // Badge count on the kebab so an active filter set is visible while collapsed.
  const activeFilterCount =
    (sort !== "default" ? 1 : 0) +
    (tab === "recipes" && recipeCategory !== "all" ? 1 : 0) +
    (tab === "foods" && foodCategory !== "all" ? 1 : 0) +
    (tab === "foods" && foodSource !== "all" ? 1 : 0) +
    (tab === "foods" && customOnly ? 1 : 0) +
    (limit !== DEFAULT_LIMIT ? 1 : 0)

  const tabs: Array<{ id: LibraryTab; label: string }> = [
    { id: "recipes", label: "Rezepte" },
    { id: "foods", label: "Lebensmittel" },
    { id: "templates", label: "Vorlagen" },
  ]

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 xl:min-h-0">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Bibliothek</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground relative -mr-1 h-7 w-7"
                aria-label="Filter & Sortierung"
              >
                <MoreVertical className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="bg-primary absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sortierung</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(value as SortMode)}
              >
                <DropdownMenuRadioItem value="default">Standard</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-asc">Name (A–Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-desc">Name (Z–A)</DropdownMenuRadioItem>
                {tab === "recipes" && (
                  <>
                    <DropdownMenuRadioItem value="nutrient-desc">
                      {nutrientName(sortNutrient)} (hoch → niedrig)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="nutrient-asc">
                      {nutrientName(sortNutrient)} (niedrig → hoch)
                    </DropdownMenuRadioItem>
                  </>
                )}
              </DropdownMenuRadioGroup>

              {tab === "recipes" && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Nährstoff: {nutrientName(sortNutrient)}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuRadioGroup
                      value={sortNutrient}
                      onValueChange={(value) => {
                        setSortNutrient(value)
                        // Picking a nutrient implies sorting by it — switch out
                        // of a non-nutrient sort so the choice takes effect.
                        setSort((current) =>
                          current === "nutrient-asc" || current === "nutrient-desc"
                            ? current
                            : "nutrient-desc",
                        )
                      }}
                    >
                      {SORTABLE_NUTRIENT_IDS.map((id) => (
                        <DropdownMenuRadioItem key={id} value={id}>
                          {nutrientName(id)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {tab === "recipes" && recipeCategories.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Kategorie</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={recipeCategory} onValueChange={setRecipeCategory}>
                    <DropdownMenuRadioItem value="all">Alle Kategorien</DropdownMenuRadioItem>
                    {recipeCategories.map((category) => (
                      <DropdownMenuRadioItem key={category} value={category}>
                        {category}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}

              {tab === "foods" && foodCategoryOptions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Kategorie</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={foodCategory} onValueChange={setFoodCategory}>
                    <DropdownMenuRadioItem value="all">Alle Kategorien</DropdownMenuRadioItem>
                    {foodCategoryOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.id} value={option.id}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}

              {tab === "foods" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Quelle</DropdownMenuLabel>
                  {foodSourceOptions.length > 0 && (
                    <DropdownMenuRadioGroup
                      value={foodSource}
                      onValueChange={(value) => setFoodSource(value as FoodSourceId | "all")}
                    >
                      <DropdownMenuRadioItem value="all">Alle Quellen</DropdownMenuRadioItem>
                      {foodSourceOptions.map((source) => (
                        <DropdownMenuRadioItem key={source} value={source}>
                          {SOURCE_SHORT_LABELS[source] ?? source}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  )}
                  <DropdownMenuCheckboxItem
                    checked={customOnly}
                    onCheckedChange={(checked) => setCustomOnly(checked === true)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    Nur eigene Lebensmittel
                  </DropdownMenuCheckboxItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Trefferanzahl</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={String(limit)}
                onValueChange={(value) => setLimit(Number(value))}
              >
                {RESULT_LIMITS.map((value) => (
                  <DropdownMenuRadioItem key={value} value={String(value)}>
                    {value === 0 ? "Alle anzeigen" : `${value} Treffer`}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
