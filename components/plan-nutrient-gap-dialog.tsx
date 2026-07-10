"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Plus, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useNutrientGapSearch } from "@/hooks/use-nutrient-gap-search"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { formatNumber, formatNutrient } from "@/lib/format"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { chooseOptimizationSlot, type DietLineComplianceItem } from "@/lib/meal-plan-calc"
import type {
  NutrientGapConstraint,
  NutrientGapSortMode,
  NutrientGapSuggestion,
} from "@/lib/nutrient-gap"
import type {
  DailyMealPlan,
  Food,
  MealSlotType,
  PatientAllergenEntry,
  Recipe,
} from "@/lib/types"

const NUTRIENT_GROUP_LABELS: Record<string, string> = {
  makronaehrstoffe: "Makronährstoffe",
  vitamine: "Vitamine",
  mineralstoffe: "Mineralstoffe & Spurenelemente",
  fettsaeuren: "Fettsäuren",
  aminosaeuren: "Aminosäuren",
  sonstige: "Sonstige",
}
const NUTRIENT_GROUP_ORDER = [
  "makronaehrstoffe",
  "vitamine",
  "mineralstoffe",
  "fettsaeuren",
  "aminosaeuren",
  "sonstige",
]
// kJ duplicates kcal; BE is display-derived and not stored on foods.
const EXCLUDED_NUTRIENT_IDS = new Set(["energie_kj", "broteinheiten"])
const NUTRIENT_GROUPS = NUTRIENT_GROUP_ORDER.map((group) => ({
  group,
  label: NUTRIENT_GROUP_LABELS[group] ?? group,
  items: NUTRIENT_DEFINITIONS.filter(
    (definition) => definition.group === group && !EXCLUDED_NUTRIENT_IDS.has(definition.id),
  ).sort((a, b) => a.sortOrder - b.sortOrder),
})).filter((entry) => entry.items.length > 0)
const NUTRIENT_DEF_MAP = new Map(
  NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition]),
)
const MEAL_SLOT_TYPES = Object.keys(MEAL_SLOT_LABELS) as MealSlotType[]

const RESULT_PAGE = 20

const SORT_MODE_LABELS: Record<NutrientGapSortMode, string> = {
  score: "Empfohlen",
  kcal: "Wenigste kcal",
  coverage: "Größte Abdeckung",
}

type GapTypeFilter = "all" | "food" | "recipe"

interface ConstraintRow {
  id: string
  nutrientId: string
  bound: "max" | "min"
  amountInput: string
  mode: "hard" | "soft"
}

export interface NutrientGapAddPayload {
  type: "food" | "recipe"
  referenceId: string
  name: string
  /** Grams for foods, servings for recipes — matches MealEntry.amount. */
  amount: number
  allergens?: string[]
  slotType: MealSlotType
}

interface PlanNutrientGapDialogProps {
  dietLineCompliance: DietLineComplianceItem[]
  micronutrientCompliance: DietLineComplianceItem[]
  patientAllergens: PatientAllergenEntry[]
  plan: DailyMealPlan
  recipes: Recipe[]
  foods: Food[]
  isLocked: boolean
  onAdd: (payload: NutrientGapAddPayload) => void
}

/** Accepts German decimal commas; returns null for empty/invalid input. */
function parseAmount(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."))
  return Number.isFinite(value) ? value : null
}

/** Plain input-friendly number (dot removed, comma decimal, max 1 decimal). */
function toInputValue(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return String(rounded).replace(".", ",")
}

function formatServings(servings: number) {
  const value = formatNumber(servings, Number.isInteger(servings) ? 0 : 1)
  return `${value} ${servings === 1 ? "Portion" : "Portionen"}`
}

function suggestionSummary(suggestion: NutrientGapSuggestion, unit: string, hasGap: boolean) {
  if (suggestion.type === "recipe") {
    if (!hasGap) {
      return `pro Portion: ${formatNutrient(suggestion.density, unit)}`
    }
    const label = formatServings(suggestion.amount)
    const verb = suggestion.amount === 1 ? "deckt" : "decken"
    if (suggestion.capped) {
      return `max. ${label} · ${verb} ${formatNumber(suggestion.coverage * 100, 0)} %`
    }
    return `${label} ${verb} die Lücke`
  }
  if (!hasGap) {
    return `pro 100 g: ${formatNutrient(suggestion.density, unit)}`
  }
  if (suggestion.capped) {
    return `max. ${formatNumber(suggestion.amount, 0)} g · deckt ${formatNumber(
      suggestion.coverage * 100,
      0,
    )} %`
  }
  return `${formatNumber(suggestion.amount, 0)} g decken die Lücke`
}

/**
 * Working body of the Nährstoff-Lückenfüller: pick a nutrient and the amount
 * still missing today, get foods with the exact portion that closes the gap,
 * optionally constrained ("but ≤ 20 g carbs"), and add them to a meal slot.
 */
export function PlanNutrientGapDialog({
  dietLineCompliance,
  micronutrientCompliance,
  patientAllergens,
  plan,
  recipes,
  foods,
  isLocked,
  onAdd,
}: PlanNutrientGapDialogProps) {
  const [nutrientId, setNutrientId] = useState<string | null>(null)
  const [amountInput, setAmountInput] = useState("")
  const [constraintRows, setConstraintRows] = useState<ConstraintRow[]>([])
  const [slotOverride, setSlotOverride] = useState<MealSlotType | null>(null)
  const [typeFilter, setTypeFilter] = useState<GapTypeFilter>("all")
  const [sortMode, setSortMode] = useState<NutrientGapSortMode>("score")
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE)

  const nutrientDef = nutrientId ? NUTRIENT_DEF_MAP.get(nutrientId) : undefined
  const parsedAmount = parseAmount(amountInput)
  const gapAmount = parsedAmount != null && parsedAmount > 0 ? parsedAmount : null

  // Real remaining gaps of the active day; diet-line targets win over the
  // reference-based micronutrient row when both track the same nutrient.
  const gapChips = useMemo(() => {
    const merged = new Map<string, { nutrientId: string; label: string; unit: string; gap: number }>()
    for (const item of [...micronutrientCompliance, ...dietLineCompliance]) {
      if (item.status !== "low" || typeof item.min !== "number") continue
      if (EXCLUDED_NUTRIENT_IDS.has(item.nutrientId) || !NUTRIENT_DEF_MAP.has(item.nutrientId)) continue
      const gap = item.min - item.value
      if (gap <= 0) continue
      merged.set(item.nutrientId, {
        nutrientId: item.nutrientId,
        label: item.label,
        unit: item.unit,
        gap,
      })
    }
    return Array.from(merged.values())
  }, [dietLineCompliance, micronutrientCompliance])

  const constraints = useMemo<NutrientGapConstraint[]>(
    () =>
      constraintRows.flatMap((row) => {
        const amount = parseAmount(row.amountInput)
        if (!row.nutrientId || amount == null || amount < 0) return []
        return [
          {
            id: row.id,
            nutrientId: row.nutrientId,
            bound: row.bound,
            amount,
            mode: row.mode,
          },
        ]
      }),
    [constraintRows],
  )

  const { suggestions, isLoading, error } = useNutrientGapSearch({
    nutrientId,
    gapAmount,
    constraints,
    patientAllergens,
    recipes,
    foods,
    sortMode,
    enabled: true,
  })

  const slotType = slotOverride ?? (nutrientId ? chooseOptimizationSlot(nutrientId, plan) : "mittagessen")

  const selectNutrient = (id: string) => {
    setNutrientId(id)
    setVisibleCount(RESULT_PAGE)
  }

  const addConstraintRow = () => {
    setConstraintRows((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        nutrientId: "kohlenhydrate",
        bound: "max",
        amountInput: "",
        mode: "hard",
      },
    ])
  }

  const updateConstraintRow = (id: string, patch: Partial<ConstraintRow>) => {
    setConstraintRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const filteredSuggestions =
    typeFilter === "all"
      ? suggestions
      : suggestions.filter((suggestion) => suggestion.type === typeFilter)
  const visibleSuggestions = filteredSuggestions.slice(0, visibleCount)

  return (
    <div className="space-y-5 text-sm">
      {gapChips.length > 0 && (
        <section className="space-y-2">
          <Label className="text-muted-foreground text-xs font-medium">
            Offene Lücken des aktiven Tages
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {gapChips.map((chip) => (
              <button
                key={chip.nutrientId}
                type="button"
                onClick={() => {
                  selectNutrient(chip.nutrientId)
                  setAmountInput(toInputValue(chip.gap))
                }}
                className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <Badge
                  variant={nutrientId === chip.nutrientId ? "default" : "secondary"}
                  className="cursor-pointer font-normal"
                >
                  {chip.label} · noch {formatNutrient(chip.gap, chip.unit)}
                </Badge>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gap-nutrient">Nährstoff</Label>
          <Select value={nutrientId ?? ""} onValueChange={selectNutrient}>
            <SelectTrigger id="gap-nutrient" className="w-full">
              <SelectValue placeholder="Nährstoff wählen" />
            </SelectTrigger>
            <SelectContent>
              {NUTRIENT_GROUPS.map((group) => (
                <SelectGroup key={group.group}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((definition) => (
                    <SelectItem key={definition.id} value={definition.id}>
                      {definition.name} ({definition.unit})
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gap-amount">Fehlmenge</Label>
          <div className="relative">
            <Input
              id="gap-amount"
              inputMode="decimal"
              placeholder="z. B. 400"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className="pr-12"
            />
            {nutrientDef && (
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
                {nutrientDef.unit}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Leer lassen für reine Recherche („Was ist reich an …?“).
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-muted-foreground text-xs font-medium">
          Nebenbedingungen — gelten für die berechnete Portion, nicht pro 100 g
        </Label>
        {constraintRows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-1.5">
            <Select
              value={row.nutrientId}
              onValueChange={(value) => updateConstraintRow(row.id, { nutrientId: value })}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUTRIENT_GROUPS.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((definition) => (
                      <SelectItem key={definition.id} value={definition.id}>
                        {definition.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={row.bound}
              onValueChange={(value) =>
                updateConstraintRow(row.id, { bound: value as ConstraintRow["bound"] })
              }
            >
              <SelectTrigger className="h-8 w-[60px] text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="max">≤</SelectItem>
                <SelectItem value="min">≥</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={row.amountInput}
                onChange={(event) => updateConstraintRow(row.id, { amountInput: event.target.value })}
                placeholder="Menge"
                className="h-8 w-24 pr-9 text-xs"
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px]">
                {NUTRIENT_DEF_MAP.get(row.nutrientId)?.unit}
              </span>
            </div>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={row.mode}
              onValueChange={(value) => {
                if (value === "hard" || value === "soft") {
                  updateConstraintRow(row.id, { mode: value })
                }
              }}
            >
              <ToggleGroupItem value="hard" className="h-8 px-2 text-xs">
                Hart
              </ToggleGroupItem>
              <ToggleGroupItem value="soft" className="h-8 px-2 text-xs">
                Weich
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Bedingung entfernen"
              onClick={() => setConstraintRows((rows) => rows.filter((r) => r.id !== row.id))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={addConstraintRow}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Bedingung hinzufügen
        </Button>
      </section>

      <section className="space-y-1.5">
        <Label htmlFor="gap-slot">Mahlzeit für die Übernahme</Label>
        <Select
          value={slotType}
          onValueChange={(value) => setSlotOverride(value as MealSlotType)}
        >
          <SelectTrigger id="gap-slot" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_SLOT_TYPES.map((slot) => (
              <SelectItem key={slot} value={slot}>
                {MEAL_SLOT_LABELS[slot]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-2">
        {nutrientId && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={typeFilter}
              onValueChange={(value) => {
                if (value === "all" || value === "food" || value === "recipe") {
                  setTypeFilter(value)
                  setVisibleCount(RESULT_PAGE)
                }
              }}
            >
              <ToggleGroupItem value="all" className="h-8 px-2.5 text-xs">
                Beide
              </ToggleGroupItem>
              <ToggleGroupItem value="food" className="h-8 px-2.5 text-xs">
                Lebensmittel
              </ToggleGroupItem>
              <ToggleGroupItem value="recipe" className="h-8 px-2.5 text-xs">
                Rezepte
              </ToggleGroupItem>
            </ToggleGroup>
            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as NutrientGapSortMode)}
            >
              <SelectTrigger size="sm" className="h-8 w-[170px] text-xs" aria-label="Sortierung">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_MODE_LABELS) as NutrientGapSortMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {SORT_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!nutrientId ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
            Nährstoff wählen, um passende Lebensmittel und Rezepte zu finden.
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="text-destructive rounded-md border p-4 text-center text-xs">{error}</p>
        ) : filteredSuggestions.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
            Keine passenden Treffer gefunden. Bedingungen lockern?
          </p>
        ) : (
          <>
            {visibleSuggestions.map((suggestion) => (
              <div
                key={`${suggestion.type}-${suggestion.referenceId}`}
                data-testid="gap-suggestion"
                className="hover:bg-muted/40 flex items-start justify-between gap-3 rounded-md border p-2.5 transition"
              >
                <div className="min-w-0">
                  <p data-testid="gap-suggestion-name" className="truncate text-sm font-medium">
                    {suggestion.name}
                    {suggestion.type === "recipe" && (
                      <Badge variant="secondary" className="ml-1.5 align-middle text-[10px] font-normal">
                        Rezept
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {suggestionSummary(suggestion, nutrientDef?.unit ?? "", gapAmount != null)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge
                      variant="outline"
                      data-testid="gap-suggestion-kcal"
                      className="text-[10px] font-normal"
                    >
                      +{formatNumber(suggestion.kcal, 0)} kcal
                    </Badge>
                    {suggestion.constraintResults.map(({ constraint, value, violated }) => {
                      const definition = NUTRIENT_DEF_MAP.get(constraint.nutrientId)
                      if (!definition) return null
                      return (
                        <Badge
                          key={constraint.id}
                          variant="outline"
                          className={`text-[10px] font-normal ${
                            violated ? "border-amber-500/60 text-amber-600 dark:text-amber-500" : ""
                          }`}
                        >
                          +{formatNutrient(value, definition.unit)} {definition.shortName}
                        </Badge>
                      )
                    })}
                    {suggestion.allergenWarnings.map((warning) => (
                      <Badge
                        key={warning.allergenId}
                        variant="outline"
                        className="border-amber-500/60 text-[10px] font-normal text-amber-600 dark:text-amber-500"
                      >
                        <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                        {warning.allergenLabel}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0"
                  disabled={isLocked}
                  onClick={() =>
                    onAdd({
                      type: suggestion.type,
                      referenceId: suggestion.referenceId,
                      name: suggestion.name,
                      amount: suggestion.amount,
                      allergens: suggestion.allergens,
                      slotType,
                    })
                  }
                >
                  Übernehmen
                </Button>
              </div>
            ))}
            {filteredSuggestions.length > visibleCount && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setVisibleCount((count) => count + RESULT_PAGE)}
              >
                Mehr anzeigen ({filteredSuggestions.length - visibleCount} weitere)
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
