"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { Card } from "@/components/ui/card"
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

/** Decimals: micronutrient references below 10 need one to stay legible. */
function decimalsFor(goal?: number) {
  return goal != null && goal < 10 ? 1 : 0
}

/** Compact glance tile for the collapsed dock: label + Ist/Soll over a fill bar. */
function GlanceItem({ target }: { target: DietLineComplianceItem }) {
  const goal = target.max ?? target.min
  const decimals = decimalsFor(goal)
  const pct = goal && goal > 0 ? Math.min(100, Math.round((target.value / goal) * 100)) : 0
  return (
    <div className="min-w-[132px] flex-none space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          {target.label}
        </span>
        <span className="font-mono text-sm">
          <span className="font-semibold">{formatNumber(target.value, decimals)}</span>
          {goal != null && (
            <span className="text-muted-foreground">/{formatNumber(goal, decimals)}</span>
          )}
          <span className="text-muted-foreground"> {target.unit}</span>
        </span>
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

/** Full detail row used in the expanded panel: label + delta, figure, fill bar. */
function NutrientCell({ target }: { target: DietLineComplianceItem }) {
  const goal = target.max ?? target.min
  const delta = goal != null ? target.value - goal : undefined
  const pct = goal && goal > 0 ? Math.min(100, Math.round((target.value / goal) * 100)) : 0
  const decimals = decimalsFor(goal)

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

const DETAIL_GRID =
  "grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"

/**
 * Tagesziele — the constant Soll/Ist reference used while building plans.
 * Rendered as a slim dock pinned to the bottom screen edge (via a `sticky
 * bottom-0` wrapper in the page): collapsed it gives a quick glance at the
 * macro targets, and the toggle expands it upward into a scrollable panel with
 * the full macro + micronutrient coverage.
 */
export function PlanBalanceRail({
  compliance,
  micronutrients = [],
  dietLineName,
}: PlanBalanceRailProps) {
  const [expanded, setExpanded] = useState(false)
  const hasTargets = compliance.length > 0
  const canExpand = hasTargets || micronutrients.length > 0

  return (
    <Card className="gap-0 rounded-b-none border-b-0 py-0 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)]">
      {expanded && (
        <div className="max-h-[60dvh] space-y-4 overflow-y-auto border-b px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">Tagesziele</span>
            <span className="text-muted-foreground text-xs">
              Ist / Soll · {dietLineName ?? "Kein Zielprofil"}
            </span>
          </div>
          {hasTargets && (
            <div className={DETAIL_GRID}>
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
              <div className={DETAIL_GRID}>
                {micronutrients.map((target) => (
                  <NutrientCell key={target.nutrientId} target={target} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-3">
        {hasTargets ? (
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {compliance.map((target) => (
                <GlanceItem key={target.nutrientId} target={target} />
              ))}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground flex-1 text-sm">
            Zielprofil auswählen, um die Tagesziele zu aktivieren.
          </span>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="text-muted-foreground hover:text-foreground flex flex-none items-center gap-1 text-xs font-medium"
          >
            {expanded ? (
              <>
                Weniger
                <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                Mikronährstoffe
                <ChevronUp className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
    </Card>
  )
}
