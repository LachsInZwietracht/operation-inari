"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { shortNutrientLabel, topContributions } from "@/lib/client-micronutrients"
import { getNutrientValue, scaleNutrients } from "@/lib/nutrients"
import type { NutrientValue } from "@/lib/types"

/**
 * What a portion actually is, with the amount still open.
 *
 * Shared between adding something and correcting it afterwards. Editing used
 * to be a bare number field, which asked people to change a portion without
 * showing them what changing it does — the same screen answers both, so the
 * numbers move while you type either way.
 */
export function ClientEntryDetail({
  name,
  subtitle,
  nutrientsPerUnit,
  unit,
  amount,
  onAmountChange,
  portions,
  references,
  onReselect,
}: {
  name: string
  subtitle?: string
  /** Per 100 g for foods, per portion for recipes and meals. */
  nutrientsPerUnit?: NutrientValue[]
  unit: "g" | "portion"
  amount: string
  onAmountChange: (value: string) => void
  portions?: { label: string; amountGrams: number }[]
  references: Map<string, number>
  /** Offered only where there is something else to pick — not when editing. */
  onReselect?: () => void
}) {
  const parsed = parseEntryAmount(amount) ?? 0
  const isPortionUnit = unit === "portion"
  // Foods are priced per 100 g, portions per one — the same scaling either way.
  const scaled = nutrientsPerUnit
    ? scaleNutrients(nutrientsPerUnit, isPortionUnit ? 1 : 100, parsed)
    : undefined

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <p className="text-sm font-medium">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {onReselect && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onReselect}>
            Etwas anderes wählen
          </Button>
        )}
      </div>

      {scaled && parsed > 0 && <NutritionCard nutrients={scaled} references={references} />}

      <div className="space-y-2">
        <Label htmlFor="client-entry-amount">
          {isPortionUnit ? "Portionen" : "Menge in Gramm"}
        </Label>
        <Input
          id="client-entry-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
        />
        {portions && portions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {portions.map((portion) => (
              <Button
                key={`${portion.label}-${portion.amountGrams}`}
                type="button"
                variant={parsed === portion.amountGrams ? "secondary" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onAmountChange(String(portion.amountGrams))}
              >
                {portion.label} · {portion.amountGrams} g
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function parseEntryAmount(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** Macros for the amount actually being logged, not for an abstract 100 g. */
function NutritionCard({
  nutrients,
  references,
}: {
  nutrients: NutrientValue[]
  references: Map<string, number>
}) {
  const rows: [string, string, number][] = [
    ["kcal", "", getNutrientValue(nutrients, "energie")],
    ["Eiweiß", "g", getNutrientValue(nutrients, "eiweiss")],
    ["Fett", "g", getNutrientValue(nutrients, "fett")],
    ["KH", "g", getNutrientValue(nutrients, "kohlenhydrate")],
  ]

  // What this portion is good for, while the decision is still open.
  const contributions = topContributions({ nutrients, references })

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {rows.map(([label, unit, value]) => (
          <div key={label}>
            <p className="text-sm font-semibold tabular-nums">
              {Math.round(value)}
              {unit && <span className="text-xs font-normal text-muted-foreground"> {unit}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {contributions.length > 0 && (
        <p className="border-t pt-2 text-center text-xs text-muted-foreground">
          Deckt{" "}
          {contributions.map((entry) => `${entry.percent} % ${shortNutrientLabel(entry.label)}`).join(" · ")}
        </p>
      )}
    </div>
  )
}
