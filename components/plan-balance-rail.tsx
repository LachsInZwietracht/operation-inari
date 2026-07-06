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

/**
 * Tagesbilanz — the constant Soll/Ist reference used while building plans.
 * Rendered as a compact horizontal strip at the top of both the day and week
 * views so the yardstick keeps the same place when the user switches tabs
 * without stealing width from the workspace below it.
 */
export function PlanBalanceRail({ compliance, dietLineName }: PlanBalanceRailProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-3">
        <CardTitle className="text-sm">Tagesbilanz</CardTitle>
        <span className="text-muted-foreground text-xs">
          Ist / Soll · {dietLineName ?? "Kein Zielprofil"}
        </span>
      </CardHeader>
      <CardContent className="py-3">
        {compliance.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Zielprofil auswählen, um die Tagesbilanz zu aktivieren.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {compliance.map((target) => {
              const goal = target.max ?? target.min
              const delta = goal != null ? target.value - goal : undefined
              const pct =
                goal && goal > 0 ? Math.min(100, Math.round((target.value / goal) * 100)) : 0
              return (
                <div key={target.nutrientId} className="min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-muted-foreground truncate text-[11px] font-semibold tracking-wide uppercase">
                      {target.label}
                    </span>
                    {delta != null && (
                      <span
                        className={cn(
                          "font-mono text-[11px] font-semibold",
                          STATUS_TEXT[target.status],
                        )}
                      >
                        {delta >= 0 ? "+" : "−"}
                        {formatNumber(Math.abs(delta), 0)}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm leading-none">
                    <span className="font-semibold">{formatNumber(target.value, 0)}</span>
                    {goal != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        / {formatNumber(goal, 0)}
                      </span>
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
