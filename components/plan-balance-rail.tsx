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
  /** Selected day's target comparison, one row per tracked nutrient. */
  compliance: DietLineComplianceItem[]
  dietLineName?: string
}

/**
 * Tagesbilanz card — the constant Soll/Ist reference used while building plans.
 * Rendered in the same right rail position in both the day and week views so
 * the yardstick never changes place when the user switches tabs.
 */
export function PlanBalanceRail({ compliance, dietLineName }: PlanBalanceRailProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-base">Tagesbilanz</CardTitle>
          <span className="text-muted-foreground text-xs">
            Ist / Soll · {dietLineName ?? "Kein Zielprofil"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {compliance.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Zielprofil auswählen, um die Tagesbilanz zu aktivieren.
          </p>
        )}
        {compliance.map((target) => {
          const goal = target.max ?? target.min
          const delta = goal != null ? target.value - goal : undefined
          const pct =
            goal && goal > 0 ? Math.min(100, Math.round((target.value / goal) * 100)) : 0
          return (
            <div key={target.nutrientId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{target.label}</span>
                <span className="font-mono text-xs">
                  {formatNumber(target.value, 0)}
                  {goal != null && (
                    <span className="text-muted-foreground"> / {formatNumber(goal, 0)}</span>
                  )}{" "}
                  {target.unit}
                  {delta != null && (
                    <span
                      className={cn(
                        "ml-1.5 font-semibold",
                        target.status === "ok"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : target.status === "low"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-rose-700 dark:text-rose-400",
                      )}
                    >
                      {delta >= 0 ? "+" : "−"}
                      {formatNumber(Math.abs(delta), 0)}
                    </span>
                  )}
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    target.status === "ok" && "bg-emerald-500",
                    target.status === "low" && "bg-amber-500",
                    target.status === "high" && "bg-rose-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
