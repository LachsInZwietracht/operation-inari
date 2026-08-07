"use client"

import { useMemo } from "react"
import { Check, Minus, Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DIET_EXCLUSION_LABELS } from "@/lib/diet-constants"
import {
  buildPrinciples,
  describeDietFrame,
  isPrincipleMet,
  type PrincipleInput,
} from "@/lib/nutrition/principles"

interface PlanPrinciplesCardProps extends PrincipleInput {
  /** Nutrient totals reached on the currently selected day, by nutrient id. */
  dayTotals?: Record<string, number>
}

/**
 * The strategy layer of a plan: a handful of rules the patient can follow
 * without the plan in front of them. The day below is one way to hit them —
 * swapping a food is fine as long as the rule stays green.
 */
export function PlanPrinciplesCard({ dayTotals, ...input }: PlanPrinciplesCardProps) {
  const principles = useMemo(
    () =>
      buildPrinciples({
        calorieGoal: input.calorieGoal,
        macroPreset: input.macroPreset,
        dietStyle: input.dietStyle,
        exclusions: input.exclusions,
        weightKg: input.weightKg,
        dietLineTargets: input.dietLineTargets,
      }),
    [
      input.calorieGoal,
      input.macroPreset,
      input.dietStyle,
      input.exclusions,
      input.weightKg,
      input.dietLineTargets,
    ],
  )

  const frame = describeDietFrame(input.dietStyle, input.exclusions, DIET_EXCLUSION_LABELS)

  if (principles.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Prinzipien
        </CardTitle>
        <CardDescription>
          Die Strategie hinter dem Plan. Der Tag darunter ist ein Weg dorthin — tauschen
          ist erlaubt, solange die Prinzipien stehen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {frame ? (
          <Badge variant="outline" className="mb-1">
            {frame}
          </Badge>
        ) : null}

        <ul className="space-y-2">
          {principles.map((principle) => {
            const actual =
              principle.metricKey !== undefined ? dayTotals?.[principle.metricKey] : undefined
            const met = actual !== undefined ? isPrincipleMet(principle, actual) : undefined

            return (
              <li key={principle.id} className="flex items-start gap-2.5 text-sm">
                <span
                  className={
                    met === undefined
                      ? "mt-0.5 text-muted-foreground"
                      : met
                        ? "mt-0.5 text-emerald-600 dark:text-emerald-500"
                        : "mt-0.5 text-amber-600 dark:text-amber-500"
                  }
                >
                  {met === undefined ? (
                    <Minus className="h-4 w-4" />
                  ) : met ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      {principle.text}
                      {actual !== undefined && principle.unit ? (
                        <span className="ml-1 text-muted-foreground">
                          (aktuell {Math.round(actual)} {principle.unit})
                        </span>
                      ) : null}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Quelle: {principle.source}</p>
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
