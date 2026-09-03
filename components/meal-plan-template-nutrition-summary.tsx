"use client"

import { useMemo, useState } from "react"
import { Activity, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { formatNumber } from "@/lib/format"
import { calculateEntryNutrients, isMealEntryNutrientEvaluable } from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import { cn } from "@/lib/utils"
import type { Food, MealPlanTemplateDayBlock, NutrientDefinition, Recipe } from "@/lib/types"

const MACRO_IDS = ["energie", "eiweiss", "kohlenhydrate", "fett", "ballaststoffe"] as const
const MICRO_IDS = [
  "vitamin_a", "vitamin_b1", "vitamin_b2", "vitamin_b6", "vitamin_b12",
  "vitamin_c", "vitamin_d", "vitamin_e", "folsaeure", "calcium", "eisen",
  "magnesium", "kalium", "natrium", "zink", "jod", "selen",
] as const

export function MealPlanTemplateNutritionSummary({
  days,
  foods,
  recipes,
}: {
  days: MealPlanTemplateDayBlock[]
  foods: Food[]
  recipes: Recipe[]
}) {
  const [microsOpen, setMicrosOpen] = useState(false)
  const definitions = useMemo(
    () => new Map(NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition])),
    [],
  )
  const foodMap = useMemo(() => {
    const map = new Map<string, Food>()
    for (const food of foods) {
      map.set(food.id, food)
      if (food.legacyId) map.set(food.legacyId, food)
    }
    return map
  }, [foods])
  const recipeMap = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes])
  const entries = useMemo(
    () => days.flatMap((day) => day.slots.flatMap((slot) => slot.entries)),
    [days],
  )
  const totals = useMemo(
    () => sumNutrients(entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap))),
    [entries, foodMap, foods, recipeMap],
  )
  const values = (ids: readonly string[]) => ids.map((nutrientId) => ({
    nutrientId,
    definition: definitions.get(nutrientId)!,
    value: getNutrientValue(totals, nutrientId) / days.length,
    evaluable: entries.length > 0 && entries.every((entry) =>
      isMealEntryNutrientEvaluable(entry, nutrientId, foodMap, recipeMap),
    ),
  }))
  const macros = values(MACRO_IDS)
  const micros = values(MICRO_IDS)
  const filledDays = days.filter((day) => day.slots.some((slot) => slot.entries.length > 0)).length

  return (
    <Card className="border-primary/15 bg-[color-mix(in_oklab,var(--primary)_3%,var(--card))]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="text-primary size-4" />
              Durchschnittliche Nährwerte pro Tag
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Gesamte Vorlage geteilt durch {days.length} {days.length === 1 ? "Vorlagentag" : "Vorlagentage"} · {filledDays} belegt. Freie Tage zählen mit.
            </p>
          </div>
          {entries.length === 0 ? <span className="text-muted-foreground text-xs">Noch keine Mahlzeiten</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <section aria-labelledby="template-macro-heading" className="space-y-2">
          <h3 id="template-macro-heading" className="text-xs font-semibold uppercase tracking-wide">Energie & Makros · Ø pro Tag</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {macros.map((item) => <NutrientTile key={item.nutrientId} {...item} />)}
          </div>
        </section>

        <Collapsible open={microsOpen} onOpenChange={setMicrosOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between border-t px-0 pt-4 hover:bg-transparent" aria-controls="template-micronutrients">
              <span className="text-xs font-semibold uppercase tracking-wide">Vitamine & Mineralstoffe · Ø pro Tag</span>
              <span className="text-muted-foreground flex items-center gap-2 text-xs normal-case">
                {microsOpen ? "Einklappen" : "Anzeigen"}
                <ChevronDown className={cn("size-4 transition-transform", microsOpen && "rotate-180")} />
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent id="template-micronutrients" className="pt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {micros.map((item) => <NutrientTile key={item.nutrientId} {...item} compact />)}
            </div>
            {entries.length > 0 && [...macros, ...micros].some((item) => !item.evaluable) ? (
              <p className="text-muted-foreground mt-3 text-xs">
                „Nicht verfügbar“ bedeutet, dass mindestens ein eingeplanter Eintrag für diesen Nährstoff keine belastbaren Daten liefert.
              </p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

function NutrientTile({
  definition,
  value,
  evaluable,
  nutrientId,
  compact = false,
}: {
  definition: NutrientDefinition
  value: number
  evaluable: boolean
  nutrientId: string
  compact?: boolean
}) {
  return (
    <div className="rounded-lg border bg-background/80 px-3 py-2">
      <div className="text-muted-foreground truncate text-[11px] font-medium" title={definition.name}>{definition.shortName}</div>
      <div className={cn("font-mono font-semibold", compact ? "text-xs" : "text-sm")}>
        {evaluable ? `${formatNumber(value, nutrientId === "energie" ? 0 : value < 10 ? 1 : 0)} ${definition.unit}` : <span className="font-sans font-normal text-muted-foreground">nicht verfügbar</span>}
      </div>
    </div>
  )
}
