"use client"

import { useState } from "react"
import { ChevronUp, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DietLineComplianceItem } from "@/lib/meal-plan-calc"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DietLineOption {
  id: string
  name: string
  userId?: string | null
}

interface PlanBalanceRailProps {
  /** Selected day's macro target comparison, one row per tracked nutrient. */
  compliance: DietLineComplianceItem[]
  /** Vitamin / mineral coverage against the DGE reference values. */
  micronutrients?: DietLineComplianceItem[]
  dietLineName?: string
  /** Diet-line / reference profiles selectable from the expanded panel. */
  dietLines?: DietLineOption[]
  dietLineId?: string
  onDietLineChange?: (id: string) => void
  dietLineDisabled?: boolean
  /** Opens the diet-line / reference-profile management dialog. */
  onManageDietLine?: () => void
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

/** Full detail row used in the expanded panel: label, Ist/Soll figure, fill bar. */
function NutrientCell({ target }: { target: DietLineComplianceItem }) {
  const goal = target.max ?? target.min
  const pct = goal && goal > 0 ? Math.min(100, Math.round((target.value / goal) * 100)) : 0
  const decimals = decimalsFor(goal)

  return (
    <div className="min-w-0 space-y-1">
      <span className="text-muted-foreground block truncate text-[11px] font-semibold tracking-wide uppercase">
        {target.label}
      </span>
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
  dietLines,
  dietLineId,
  onDietLineChange,
  dietLineDisabled,
  onManageDietLine,
}: PlanBalanceRailProps) {
  const [expanded, setExpanded] = useState(false)
  const hasTargets = compliance.length > 0
  const canExpand = hasTargets || micronutrients.length > 0
  const canSelectDietLine = Boolean(onDietLineChange && dietLines && dietLines.length > 0)

  return (
    <Card className="gap-0 rounded-b-none border-b-0 bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] py-0 shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.45)]">
      {/* Animated reveal: the row track eases 0fr → 1fr (height 0 → auto) while
          the panel fades and slides in. Collapsed content is clipped, not
          unmounted, so it can animate both ways. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "max-h-[60dvh] space-y-4 overflow-y-auto border-b px-4 py-3 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
              expanded ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Tagesziele</span>
                {canSelectDietLine ? (
                  <Select
                    value={dietLineId}
                    onValueChange={onDietLineChange}
                    disabled={dietLineDisabled}
                  >
                    <SelectTrigger
                      size="sm"
                      className="bg-muted/40 h-7 w-[190px]"
                      aria-label="Referenzernährung"
                    >
                      <SelectValue placeholder="Kostform/Zielprofil" />
                    </SelectTrigger>
                    <SelectContent>
                      {dietLines!.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name}
                          {line.userId ? " (eigene)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {onManageDietLine ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onManageDietLine}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Zielprofil verwalten</span>
                  </Button>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">
                Ist / Soll
                {!canSelectDietLine && dietLineName ? ` · ${dietLineName}` : ""}
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
        </div>
      </div>

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
            className="text-muted-foreground hover:text-foreground flex flex-none items-center gap-1 text-xs font-medium transition-colors"
          >
            {expanded ? "Weniger" : "Mikronährstoffe"}
            <ChevronUp
              className={cn(
                "h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
    </Card>
  )
}
