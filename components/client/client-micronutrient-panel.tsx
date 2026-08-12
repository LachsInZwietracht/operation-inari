"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NUTRIENT_GROUP_LABELS } from "@/lib/constants"
import {
  COVERAGE_WARN_THRESHOLD,
  countReached,
  formatMicroAmount,
  rowsByGroup,
  rowsByShortfall,
  type ClientMicronutrientRow,
} from "@/lib/client-micronutrients"
import { cn } from "@/lib/utils"
import type { NutrientGroup } from "@/lib/types"

/** How many rows the first level shows before "alle anzeigen". */
const FOCUS_COUNT = 6

/**
 * The day's micronutrients, folded away until someone wants them.
 *
 * Eighteen bars on open is a wall, and a wall gets ignored — so this opens on
 * the handful furthest from target, which is the only part that is actionable
 * today. The full list is one more tap for the people who want it.
 *
 * No red anywhere, same rule as the macro card: over target is simply full.
 * Nutrients that are ceilings rather than goals get a number and no bar at
 * all, because a bar that fills up is an instruction to fill it.
 */
export function ClientMicronutrientPanel({
  rows,
  dataShare,
}: {
  rows: ClientMicronutrientRow[]
  /** Share of the day's energy that carries micronutrient data at all. */
  dataShare: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  if (rows.length === 0) return null

  const { reached, total } = countReached(rows)
  const focus = rowsByShortfall(rows).slice(0, FOCUS_COUNT)
  const visible = showAll ? rowsByGroup(rows) : focus

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="text-sm font-medium">Mikronährstoffe</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {reached} von {total} erreicht
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* Said once, at the top, instead of under every row: a caveat
              repeated eighteen times stops being read. */}
          {dataShare < 0.99 && (
            <p className="text-xs text-muted-foreground">
              Berechnet aus {Math.round(dataShare * 100)} % deines Tages — Produkte ohne
              Nährstoffangaben zählen nicht mit.
            </p>
          )}

          {showAll ? (
            groupRows(visible).map(([group, groupRows]) => (
              <div key={group} className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{NUTRIENT_GROUP_LABELS[group]}</p>
                {groupRows.map((row) => (
                  <MicroRow key={row.nutrientId} row={row} dataShare={dataShare} />
                ))}
              </div>
            ))
          ) : (
            <div className="space-y-1.5">
              {/* Ordered by shortfall: the top of this list is what today is
                  actually about. */}
              <p className="text-xs text-muted-foreground">Am weitesten entfernt</p>
              {visible.map((row) => (
                <MicroRow key={row.nutrientId} row={row} dataShare={dataShare} />
              ))}
            </div>
          )}

          {rows.length > focus.length && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setShowAll((all) => !all)}
            >
              {/* No count: the header counts goals, this list also holds
                  ceilings, and two different numbers read as a bug. */}
              {showAll ? "Weniger anzeigen" : "Alle anzeigen"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function MicroRow({ row, dataShare }: { row: ClientMicronutrientRow; dataShare: number }) {
  const isPartial = row.coverage < COVERAGE_WARN_THRESHOLD
  // Only where this nutrient is meaningfully thinner than the day as a whole —
  // the general case is already stated once at the top of the panel.
  const isThinnerThanMost = row.coverage < dataShare - 0.1

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">{row.label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {formatMicroAmount(row.value, row.unit)}
          {row.target !== undefined && (
            <>
              {" "}
              / {formatMicroAmount(row.target, row.unit)}
              {row.kind === "limit" && <span className="ml-1">max.</span>}
            </>
          )}
        </span>
      </div>

      {/* A ceiling gets no bar — filling one up is exactly the wrong lesson. */}
      {row.kind === "reach" && row.percent !== undefined && (
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={row.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${row.label}: ${row.percent} %`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              // Striped where the day is only partly described, so a thin bar
              // reads as "we don't know" rather than "you didn't eat it".
              isPartial ? "bg-muted-foreground/30" : "bg-muted-foreground/60",
            )}
            style={{ width: `${row.percent}%` }}
          />
        </div>
      )}

      {isThinnerThanMost && (
        <p className="text-[11px] text-muted-foreground">
          Nur {Math.round(row.coverage * 100)} % des Tages haben Angaben dazu
        </p>
      )}
    </div>
  )
}

function groupRows(rows: ClientMicronutrientRow[]): [NutrientGroup, ClientMicronutrientRow[]][] {
  const groups = new Map<NutrientGroup, ClientMicronutrientRow[]>()
  for (const row of rows) {
    const existing = groups.get(row.group)
    if (existing) existing.push(row)
    else groups.set(row.group, [row])
  }
  return [...groups.entries()]
}
