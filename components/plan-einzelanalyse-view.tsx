"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"

import { EinzelanalyseTableView } from "@/components/einzelanalyse-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { buildEinzelanalyseTable } from "@/lib/einzelanalyse"
import { formatNumber } from "@/lib/format"
import type { DailyMealPlan, Food, Recipe } from "@/lib/types"
import { cn } from "@/lib/utils"

// Default columns mirror the macros surfaced in the daily-total card
// (Energie/Eiweiß/Fett/KH/BE) plus Ballaststoffe — the same nutrients
// clinicians scan when reviewing whether a single food carries the plan.
const DEFAULT_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "broteinheiten",
  "ballaststoffe",
]

interface PlanEinzelanalyseViewProps {
  plan: DailyMealPlan
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  /** Latest measured patient weight; enables the per-kg toggle. */
  bodyWeightKg?: number
}

/** Einzelanalyse tab: per-entry nutrient contributions with configurable columns. */
export function PlanEinzelanalyseView({
  plan,
  foods,
  foodMap,
  recipeMap,
  bodyWeightKg,
}: PlanEinzelanalyseViewProps) {
  const [nutrientIds, setNutrientIds] = useState<string[]>(DEFAULT_NUTRIENT_IDS)
  const [perKgEnabled, setPerKgEnabled] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const table = useMemo(
    () =>
      buildEinzelanalyseTable(plan, foodMap, recipeMap, foods, nutrientIds, {
        perKgBodyWeight:
          perKgEnabled && typeof bodyWeightKg === "number" ? bodyWeightKg : undefined,
      }),
    [plan, foodMap, recipeMap, foods, nutrientIds, perKgEnabled, bodyWeightKg],
  )

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Einzelanalyse</CardTitle>
            <CardDescription>
              Beitrag jedes Lebensmittels und Rezepts zum Tagestotal. Die größte
              Quelle pro Nährstoff ist hervorgehoben.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="einzel-per-kg"
                checked={perKgEnabled}
                onCheckedChange={setPerKgEnabled}
                disabled={typeof bodyWeightKg !== "number"}
              />
              <Label
                htmlFor="einzel-per-kg"
                className="cursor-pointer text-sm font-normal"
              >
                pro kg KG
                {typeof bodyWeightKg === "number" ? (
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({formatNumber(bodyWeightKg, 0)} kg)
                  </span>
                ) : (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (Gewicht fehlt)
                  </span>
                )}
              </Label>
            </div>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  Nährstoffe ({nutrientIds.length})
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-1" align="end">
                <div className="max-h-80 overflow-y-auto">
                  {NUTRIENT_DEFINITIONS.map((def) => {
                    const isActive = nutrientIds.includes(def.id)
                    // Block deselecting the last column — an empty table
                    // has no rows to render and offers no signal.
                    const isLastSelected = isActive && nutrientIds.length === 1
                    return (
                      <label
                        key={def.id}
                        className={cn(
                          "hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                          isLastSelected && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={isActive}
                          disabled={isLastSelected}
                          onCheckedChange={() => {
                            setNutrientIds((prev) =>
                              prev.includes(def.id)
                                ? prev.filter((id) => id !== def.id)
                                : [...prev, def.id],
                            )
                          }}
                        />
                        <span className="flex-1">{def.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {def.unit}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <EinzelanalyseTableView
          table={table}
          nutrientDefinitions={NUTRIENT_DEFINITIONS}
          slotLabels={MEAL_SLOT_LABELS}
          bodyWeightKg={bodyWeightKg}
        />
      </CardContent>
    </Card>
  )
}
