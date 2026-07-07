"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DietLineComplianceItem } from "@/lib/meal-plan-calc"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PlanBalanceRailProps {
  /** Selected day's macro target comparison, one row per tracked nutrient. */
  compliance: DietLineComplianceItem[]
  /** Vitamin / mineral coverage against the DGE reference values. */
  micronutrients?: DietLineComplianceItem[]
  dietLineName?: string
}

const STATUS_TEXT: Record<DietLineComplianceItem["status"], string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  low: "text-amber-700 dark:text-amber-400",
  high: "text-rose-700 dark:text-rose-400",
}

const STATUS_BAR: Record<DietLineComplianceItem["status"], string> = {
  ok: "bg-emerald-500",
  low: "bg-amber-500",
  high: "bg-rose-500",
}

/** Single row: label + delta, the Ist/Soll figure, and a fill bar. */
function NutrientCell({ target }: { target: DietLineComplianceItem }) {
  const goal = target.max ?? target.min
  const delta = goal != null ? target.value - goal : undefined
  const pct = goal && goal > 0 ? Math.min(100, Math.round((target.value / goal) * 100)) : 0
  // Micronutrient references are often below 10 (mg vitamins, µg traces), where
  // whole-number rounding would collapse them to 0 — keep one decimal there.
  const decimals = goal != null && goal < 10 ? 1 : 0

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-muted-foreground truncate text-[11px] font-semibold tracking-wide uppercase">
          {target.label}
        </span>
        {delta != null && (
          <span
            className={cn("font-mono text-[11px] font-semibold", STATUS_TEXT[target.status])}
          >
            {delta >= 0 ? "+" : "−"}
            {formatNumber(Math.abs(delta), decimals)}
          </span>
        )}
      </div>
      <div className="font-mono text-sm leading-none">
        <span className="font-semibold">{formatNumber(target.value, decimals)}</span>
        {goal != null && (
          <span className="text-muted-foreground"> / {formatNumber(goal, decimals)}</span>
        )}
        <span className="text-muted-foreground"> {target.unit}</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", STATUS_BAR[target.status])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const NUTRIENT_GRID = "grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-1"

/**
 * Tagesziele — the constant Soll/Ist reference used while building plans.
 * Pinned as a sticky left rail in both the day and week views (stacked into a
 * single column there) so the yardstick stays visible while the planner and the
 * library beneath it scroll. Macro targets sit on top, with the wider vitamin /
 * mineral coverage listed beneath; the list scrolls within the pinned rail when
 * it outgrows the viewport. Below xl it collapses to a full-width row.
 */
export function PlanBalanceRail({
  compliance,
  micronutrients = [],
  dietLineName,
}: PlanBalanceRailProps) {
  return (
    <Card className="gap-2 py-3 xl:max-h-[calc(100dvh-5rem)]">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-0">
        <CardTitle className="text-sm">Tagesziele</CardTitle>
        <span className="text-muted-foreground text-xs">
          Ist / Soll · {dietLineName ?? "Kein Zielprofil"}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 py-0 xl:min-h-0 xl:overflow-y-auto">
        {compliance.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Zielprofil auswählen, um die Tagesziele zu aktivieren.
          </p>
        ) : (
          <div className={NUTRIENT_GRID}>
            {compliance.map((target) => (
              <NutrientCell key={target.nutrientId} target={target} />
            ))}
          </div>
        )}

        {micronutrients.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Mikronährstoffe · Ist / DGE-Referenz
            </span>
            <div className={NUTRIENT_GRID}>
              {micronutrients.map((target) => (
                <NutrientCell key={target.nutrientId} target={target} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
