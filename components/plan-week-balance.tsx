"use client"

import { useMemo, useState } from "react"
import { ChevronDown, CircleAlert, CircleCheck, ClipboardList } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import { formatNumber } from "@/lib/format"
import {
  calculateEntryNutrients,
  complianceBadge,
  getEnergyTargetStatus,
  isMealEntryNutrientEvaluable,
  type DietLineComplianceItem,
  type EnergyTargetStatus,
} from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
import { cn } from "@/lib/utils"
import type {
  DailyMealPlan,
  DietLinePreset,
  Food,
  Recipe,
  ResolvedReferenceConfig,
} from "@/lib/types"

const CORE_MACROS = ["energie", "eiweiss", "kohlenhydrate", "fett"] as const

interface PlanWeekBalanceProps {
  weekPlans: DailyMealPlan[]
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  dietLine?: DietLinePreset
  energyTarget?: number
  refConfig: ResolvedReferenceConfig
  /** Patient/diet-line targets merged with resolved reference-profile targets. */
  nutrientTargets: DietLineComplianceItem[]
}

function statusLabel(status: EnergyTargetStatus) {
  if (status === "in-range") return "im Zielkorridor"
  if (status === "low") return "unter Zielkorridor"
  if (status === "high") return "über Zielkorridor"
  return "ohne Energieziel"
}

/**
 * Weekly analysis deliberately averages over all seven calendar days. Empty
 * days stay visible as incomplete instead of disappearing from the average.
 * A micronutrient is only rated when every planned entry has that nutrient
 * available in its loaded source data; an absent value is never promoted to 0.
 */
export function PlanWeekBalance({
  weekPlans,
  foods,
  foodMap,
  recipeMap,
  dietLine,
  energyTarget,
  refConfig,
  nutrientTargets,
}: PlanWeekBalanceProps) {
  const [open, setOpen] = useState(false)
  const definitions = useMemo(
    () => new Map(NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition])),
    [],
  )

  const balance = useMemo(() => {
    const planEntries = weekPlans.flatMap((plan) => plan.slots.flatMap((slot) => slot.entries))
    const entryNutrients = planEntries.map((entry) =>
      calculateEntryNutrients(entry, foodMap, foods, recipeMap),
    )
    const totals = sumNutrients(entryNutrients)
    const plannedDays = weekPlans.filter((plan) => plan.slots.some((slot) => slot.entries.length > 0)).length
    const unresolvedEntries = entryNutrients.filter((nutrients) => nutrients.length === 0).length
    const average = (nutrientId: string) => getNutrientValue(totals, nutrientId) / 7
    const isNutrientEvaluable = (nutrientId: string) =>
      entryNutrients.length > 0 &&
      unresolvedEntries === 0 &&
      planEntries.every((entry) =>
        isMealEntryNutrientEvaluable(entry, nutrientId, foodMap, recipeMap),
      )

    const micros = nutrientTargets
      .filter((target) => {
        const group = definitions.get(target.nutrientId)?.group
        return (
          group === "vitamine" ||
          group === "mineralstoffe" ||
          target.nutrientId === "ballaststoffe"
        )
      })
      .map((target) => {
        const value = average(target.nutrientId)
        const evaluable = isNutrientEvaluable(target.nutrientId)
        return {
          ...target,
          value,
          evaluable,
          status: evaluable ? complianceBadge(value, target.min, target.max) : null,
          definition: definitions.get(target.nutrientId),
        }
      })
      .filter((item) => item.definition)
      .sort((a, b) => (a.definition!.sortOrder ?? 0) - (b.definition!.sortOrder ?? 0))

    const macros = CORE_MACROS.map((nutrientId) => ({
      nutrientId,
      definition: definitions.get(nutrientId)!,
      value: average(nutrientId),
      evaluable: isNutrientEvaluable(nutrientId),
      target: dietLine?.targets.find((target) => target.nutrientId === nutrientId),
    }))
    const energyEvaluable = macros.find((macro) => macro.nutrientId === "energie")?.evaluable ?? false

    return {
      average,
      plannedDays,
      unresolvedEntries,
      energyEvaluable,
      energyStatus: energyEvaluable
        ? getEnergyTargetStatus(average("energie"), energyTarget)
        : "no-target" as const,
      macros,
      micros,
    }
  }, [definitions, dietLine, energyTarget, foodMap, foods, nutrientTargets, recipeMap, weekPlans])

  const missingDays = 7 - balance.plannedDays
  const openMicros = balance.micros.filter((item) => item.evaluable && item.status !== "ok")
  const evaluableMicros = balance.micros.filter((item) => item.evaluable)
  const unevaluableMicros = balance.micros.filter((item) => !item.evaluable)
  const energyNeedsAttention = Boolean(
    energyTarget && balance.energyEvaluable && balance.energyStatus !== "in-range",
  )
  const hasDataIssue =
    balance.unresolvedEntries > 0 ||
    balance.macros.some((item) => !item.evaluable) ||
    unevaluableMicros.length > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/15 bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))] py-0">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-left"
          aria-expanded={open}
          aria-controls="week-balance-details"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ClipboardList className="text-primary h-4 w-4" />
            Wochenbilanz
          </span>
          <span className="text-muted-foreground text-sm">
            {balance.plannedDays}/7 Tage belegt
          </span>
          <span className="text-muted-foreground text-sm">
            {balance.energyEvaluable
              ? `Ø ${formatNumber(Math.round(balance.average("energie")))}${energyTarget ? ` / ${formatNumber(Math.round(energyTarget))}` : ""} kcal/Tag`
              : "Energie nicht beurteilbar"}
          </span>
          <span className="ml-auto flex items-center gap-2 text-xs">
            {missingDays > 0 || energyNeedsAttention || openMicros.length > 0 || hasDataIssue ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                {missingDays > 0
                  ? `${missingDays} Tage offen`
                  : hasDataIssue
                    ? "Daten prüfen"
                    : `${openMicros.length} Punkte prüfen`}
              </Badge>
            ) : evaluableMicros.length > 0 ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                Wochenmittel im Rahmen
              </Badge>
            ) : (
              <Badge variant="outline">Auswertung offen</Badge>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </span>
        </button>

        <CollapsibleContent id="week-balance-details">
          <CardContent className="space-y-5 border-t px-4 py-4">
            <p className="text-muted-foreground text-sm">
              Vergleich: durchschnittliche Tageszufuhr dieser Kalenderwoche mit dem gewählten Zielprofil und {refConfig.standardName}-Referenzwerten. Leere Tage bleiben in der Berechnung enthalten.
            </p>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">Als Nächstes</h3>
              <div className="space-y-1.5 text-sm">
                {missingDays > 0 ? <Action text={`${missingDays} von 7 Tagen sind noch nicht belegt.`} /> : null}
                {energyNeedsAttention ? (
                  <Action
                    text={`Ø Energie ${statusLabel(balance.energyStatus)} (${formatNumber(Math.round(balance.average("energie")))} kcal/Tag).`}
                  />
                ) : null}
                {openMicros.slice(0, 4).map((item) => (
                  <Action
                    key={item.nutrientId}
                    text={`${item.definition!.name}: Ø ${formatNumber(item.value, (item.min ?? item.max ?? 0) < 10 ? 1 : 0)} ${item.definition!.unit} · ${formatTarget(item)}.`}
                  />
                ))}
                {hasDataIssue ? (
                  <Action
                    text={
                      balance.unresolvedEntries > 0
                        ? `${balance.unresolvedEntries} geplante Einträge sind mit den aktuell geladenen Daten nicht auswertbar.`
                        : "Nicht für alle Einträge liegen die Nährwertfelder des Referenzprofils vor. Rezeptwerte sind nur beurteilbar, wenn jede geladene Zutat den jeweiligen Nährwert enthält."
                    }
                  />
                ) : null}
                {missingDays === 0 && !energyNeedsAttention && openMicros.length === 0 && !hasDataIssue ? (
                  <p className="flex items-center gap-2 text-emerald-800">
                    <CircleCheck className="h-4 w-4" />
                    Für die vollständig auswertbaren Werte liegt das Wochenmittel im Rahmen.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">Energie & Makros · Ø pro Tag</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {balance.macros.map((macro) => {
                  const target = macro.target?.min ?? macro.target?.max
                  return (
                    <div key={macro.nutrientId} className="rounded-lg border bg-card px-3 py-2">
                      <div className="text-muted-foreground text-[11px] font-medium">{macro.definition.shortName}</div>
                      {macro.evaluable ? (
                        <div className="font-mono text-sm font-semibold">
                          {formatNumber(macro.value, macro.nutrientId === "energie" ? 0 : 1)} {macro.definition.unit}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">nicht beurteilbar</div>
                      )}
                      {macro.evaluable && target != null ? (
                        <div className="text-muted-foreground text-[11px]">
                          Ziel {formatNumber(target, macro.nutrientId === "energie" ? 0 : 1)}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-wide uppercase">Ballaststoffe, Vitamine & Mineralstoffe · Ø pro Tag</h3>
                <span className="text-muted-foreground text-xs">gegen tägliches Ziel-/Referenzprofil</span>
              </div>
              {balance.micros.length === 0 ? (
                <p className="text-muted-foreground text-sm">Für das aktuelle Referenzprofil sind keine Mikronährstoffwerte verfügbar.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {balance.micros.map((item) => (
                    <div key={item.nutrientId} className="rounded-lg border bg-card px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.definition!.shortName}</span>
                        {item.evaluable ? (
                          item.status === "ok" ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> : <CircleAlert className="h-3.5 w-3.5 text-amber-600" />
                        ) : <span className="text-muted-foreground text-[10px]">nicht beurteilbar</span>}
                      </div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {item.evaluable
                          ? `Ø ${formatNumber(item.value, (item.min ?? item.max ?? 0) < 10 ? 1 : 0)} ${item.definition!.unit} · ${formatTarget(item)}`
                          : "nicht für alle Einträge beurteilbar"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function Action({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      {text}
    </p>
  )
}

function formatTarget(target: Pick<DietLineComplianceItem, "min" | "max">) {
  const decimals = (target.min ?? target.max ?? 0) < 10 ? 1 : 0
  if (target.min != null && target.max != null) {
    return `Ziel ${formatNumber(target.min, decimals)}–${formatNumber(target.max, decimals)}`
  }
  if (target.min != null) return `mind. ${formatNumber(target.min, decimals)}`
  if (target.max != null) return `max. ${formatNumber(target.max, decimals)}`
  return "kein Zielwert"
}
