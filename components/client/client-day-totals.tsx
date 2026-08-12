"use client"

import { ClientMicronutrientPanel } from "@/components/client/client-micronutrient-panel"
import { Card, CardContent } from "@/components/ui/card"
import type { ClientMicronutrientRow } from "@/lib/client-micronutrients"
import {
  targetProgress,
  TARGET_SOURCE_LABELS,
  type ClientDayTarget,
} from "@/lib/client-targets"
import { getNutrientValue } from "@/lib/nutrients"
import { cn } from "@/lib/utils"
import type { NutrientValue } from "@/lib/types"

interface MacroRow {
  id: string
  label: string
  unit?: string
  digits: number
  target?: number
}

/**
 * The day's four numbers, against what they are supposed to be.
 *
 * Without a reference "1.840 kcal" is decoration. With one it is the answer to
 * the only question the client actually has. Where no reference exists — no
 * counselor, no plan — the numbers stand alone rather than being measured
 * against something invented for the occasion.
 *
 * There is no "over budget" state. A bar that turns red when someone eats
 * teaches them to stop opening the app, and judging an overshoot is the
 * counselor's job, not a progress bar's.
 */
export function ClientDayTotals({
  totals,
  target,
  micronutrients,
  microDataShare,
}: {
  totals: NutrientValue[]
  target: ClientDayTarget | null
  /** Empty when nobody has assigned this person a reference standard. */
  micronutrients: ClientMicronutrientRow[]
  microDataShare: number
}) {
  const rows: MacroRow[] = [
    { id: "energie", label: "kcal", digits: 0, target: target?.kcal },
    { id: "eiweiss", label: "Eiweiß", unit: "g", digits: 0, target: target?.protein },
    { id: "fett", label: "Fett", unit: "g", digits: 0, target: target?.fat },
    { id: "kohlenhydrate", label: "KH", unit: "g", digits: 0, target: target?.carbs },
  ]

  const kcal = getNutrientValue(totals, "energie")
  const remaining = target ? Math.round(target.kcal - kcal) : 0

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          {rows.map((row) => {
            const value = getNutrientValue(totals, row.id)
            const percent = targetProgress(value, row.target)

            return (
              <div key={row.id} className="space-y-1.5">
                <p className="text-lg font-semibold tabular-nums">
                  {value.toFixed(row.digits)}
                  {row.unit ? (
                    <span className="text-xs font-normal text-muted-foreground"> {row.unit}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.label}
                  {row.target ? (
                    <span className="tabular-nums"> / {row.target}</span>
                  ) : null}
                </p>
                {row.target ? (
                  <div
                    className="h-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${row.label}: ${percent} %`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        row.id === "energie" ? "bg-primary" : "bg-muted-foreground/50",
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {target ? (
          <p className="text-center text-xs text-muted-foreground">
            {remaining > 0
              ? `Noch ${remaining} kcal — Richtwert ${target.kcal} kcal (${TARGET_SOURCE_LABELS[target.source]})`
              : `Richtwert ${target.kcal} kcal (${TARGET_SOURCE_LABELS[target.source]})`}
          </p>
        ) : null}

        {/* Below the macros and folded away: the four numbers are the daily
            question, the micros are the one you ask when you want to. */}
        <ClientMicronutrientPanel rows={micronutrients} dataShare={microDataShare} />
      </CardContent>
    </Card>
  )
}
