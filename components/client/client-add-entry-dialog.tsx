"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ClientBarcodePanel } from "@/components/client/client-barcode-panel"
import type { BarcodeCustomPick } from "@/components/client/client-barcode-panel"
import { ClientFoodSearchList } from "@/components/client/client-food-search-list"
import { isClientCapabilityEnabled } from "@/lib/client-modules"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { clientLogEntryLabel, type ClientLogSuggestion } from "@/lib/client-food-log"
import { KIND_LABELS, type ClientSearchItem } from "@/lib/client-food-search"
import {
  addClientFoodLogEntry,
  ensureClientFoodLogDay,
  fetchFoodPortions,
} from "@/lib/data/client-food-log-client"
import { ensureClientCustomFood } from "@/lib/data/client-custom-foods-client"
import { getNutrientValue, scaleNutrients } from "@/lib/nutrients"
import type { ClientSavedMeal, Food, MealSlotType, NutrientValue } from "@/lib/types"

/**
 * What is about to be logged.
 *
 * Catalog foods and the client's own products both keep a food id, so the
 * counselor sees a traceable product either way. A recipe keeps its own id and
 * counts portions. A saved meal is not a thing at all — it is the list of
 * things it stands for, and logging it writes those.
 */
type EntryDraft =
  | {
      kind: "food"
      id: string
      name: string
      subtitle?: string
      nutrientsPer100g?: NutrientValue[]
    }
  | { kind: "recipe"; id: string; name: string; kcalPerPortion?: number }
  | { kind: "meal"; meal: ClientSavedMeal }

function parseAmount(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** Mounted per open by the caller, so it always starts from a clean state. */
export function ClientAddEntryDialog({
  slot,
  date,
  dayId,
  suggestions,
  foods,
  savedMeals,
  onClose,
  onSaved,
}: {
  slot: MealSlotType
  date: string
  dayId: string | null
  /** What this person usually eats in this slot, most frequent first. */
  suggestions: ClientLogSuggestion[]
  foods: Map<string, Food>
  savedMeals: ClientSavedMeal[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<EntryDraft | null>(null)
  const [mode, setMode] = useState<"search" | "barcode">("search")
  const [amount, setAmount] = useState("100")
  const [portionsByFood, setPortionsByFood] = useState<
    Map<string, { label: string; amountGrams: number }[]>
  >(new Map())
  const [isSaving, setIsSaving] = useState(false)

  // A suggestion or a search hit brings its own amount; the portion default
  // must not overwrite it.
  const keepAmountRef = useRef(false)

  const barcodeEnabled = isClientCapabilityEnabled("barcode")

  useEffect(() => {
    if (selected?.kind !== "food") return
    const foodId = selected.id

    let cancelled = false
    void fetchFoodPortions([foodId])
      .then((byFood) => {
        if (cancelled) return
        const list = byFood.get(foodId) ?? []
        setPortionsByFood((prev) => new Map(prev).set(foodId, list))

        if (keepAmountRef.current) {
          keepAmountRef.current = false
          return
        }
        if (list.length > 0) setAmount(String(list[0].amountGrams))
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [selected])

  const portions = selected?.kind === "food" ? (portionsByFood.get(selected.id) ?? []) : []

  function pick(item: ClientSearchItem) {
    keepAmountRef.current = true
    setAmount(String(item.defaultAmount))

    if (item.kind === "food") {
      setSelected({
        kind: "food",
        id: item.id,
        name: item.name,
        // Carried through so the confirmation still says *which* protein bar.
        subtitle: item.subtitle,
        nutrientsPer100g: item.nutrientsPerUnit,
      })
      return
    }
    if (item.kind === "recipe") {
      setSelected({
        kind: "recipe",
        id: item.id,
        name: item.name,
        kcalPerPortion: item.kcalPerUnit,
      })
      return
    }
    const meal = savedMeals.find((entry) => entry.id === item.id)
    if (meal) setSelected({ kind: "meal", meal })
  }

  async function handleSave() {
    if (!selected) return

    const parsed = parseAmount(amount)
    if (parsed === undefined) {
      toast.error(
        selected.kind === "food"
          ? "Bitte gib eine Menge in Gramm ein."
          : "Bitte gib eine Menge ein.",
      )
      return
    }

    setIsSaving(true)
    try {
      // The day row is created lazily on the first entry of that date.
      const resolvedDayId = dayId ?? (await ensureClientFoodLogDay(date)).id

      if (selected.kind === "meal") {
        // A saved meal *is* its items, so logging it writes them. One opaque
        // line for something assembled out of four would be a line the person
        // cannot correct piece by piece.
        for (const item of selected.meal.items) {
          await addClientFoodLogEntry({
            dayId: resolvedDayId,
            slotType: slot,
            sourceType: item.sourceType,
            foodId: item.foodId,
            customName: item.customName,
            customNutrients: item.customNutrients,
            amount: item.amount * parsed,
          })
        }
      } else if (selected.kind === "recipe") {
        await addClientFoodLogEntry({
          dayId: resolvedDayId,
          slotType: slot,
          sourceType: "recipe",
          recipeId: selected.id,
          amount: parsed,
        })
      } else {
        await addClientFoodLogEntry({
          dayId: resolvedDayId,
          slotType: slot,
          sourceType: "food",
          foodId: selected.id,
          amount: parsed,
        })
      }

      onSaved()
    } catch (error) {
      console.error("Failed to add food log entry:", error)
      toast.error("Der Eintrag konnte nicht gespeichert werden.")
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * A scanned or hand-entered product becomes a real food owned by this client,
   * so the next scan of the same bar finds it instead of making a second copy.
   */
  async function adoptCustomProduct(product: BarcodeCustomPick) {
    try {
      const foodId = await ensureClientCustomFood({
        name: product.name,
        nutrients: product.nutrients,
        barcode: product.barcode,
      })
      keepAmountRef.current = true
      setAmount("100")
      setSelected({
        kind: "food",
        id: foodId,
        name: product.name,
        nutrientsPer100g: product.nutrients,
      })
    } catch (error) {
      console.error("Failed to save the scanned product:", error)
      toast.error("Das Produkt konnte nicht gespeichert werden.")
    }
  }

  const parsedAmount = parseAmount(amount) ?? 0
  const isPortionUnit = selected !== null && selected.kind !== "food"

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{MEAL_SLOT_LABELS[slot]}</DialogTitle>
          <DialogDescription>
            {mode === "barcode" && !selected
              ? "Tipp den Barcode ein — wir suchen im Katalog und bei Open Food Facts."
              : "Suche ein Lebensmittel, ein Rezept oder eine gespeicherte Mahlzeit."}
          </DialogDescription>
        </DialogHeader>

        {barcodeEnabled && !selected && (
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {(
              [
                ["search", "Suche"],
                ["barcode", "Barcode"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                className={`flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors ${
                  mode === value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">
                {selected.kind === "meal" ? selected.meal.name : selected.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.kind === "meal"
                  ? `${selected.meal.items.length} Zutaten`
                  : (selected.kind === "food" && selected.subtitle) || KIND_LABELS[selected.kind]}
              </p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setSelected(null)}
              >
                Etwas anderes wählen
              </Button>
            </div>

            {/* The full picture before confirming — the answer to "is this the
                protein bar I meant?" */}
            {selected.kind === "food" && selected.nutrientsPer100g && parsedAmount > 0 && (
              <NutritionCard nutrients={selected.nutrientsPer100g} grams={parsedAmount} />
            )}
            {selected.kind === "recipe" && selected.kcalPerPortion !== undefined && (
              <p className="text-xs tabular-nums text-muted-foreground">
                ≈ {Math.round(selected.kcalPerPortion * parsedAmount)} kcal
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="client-entry-amount">
                {isPortionUnit ? "Portionen" : "Menge in Gramm"}
              </Label>
              <Input
                id="client-entry-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {portions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {portions.map((portion) => (
                    <Button
                      key={`${portion.label}-${portion.amountGrams}`}
                      type="button"
                      variant={parsedAmount === portion.amountGrams ? "secondary" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setAmount(String(portion.amountGrams))}
                    >
                      {portion.label} · {portion.amountGrams} g
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : mode === "barcode" ? (
          <ClientBarcodePanel
            onPickCatalogFood={(food) => {
              keepAmountRef.current = false
              setSelected({ kind: "food", ...food })
            }}
            onPickCustom={(product) => void adoptCustomProduct(product)}
          />
        ) : (
          <div className="space-y-3">
            {/* Before anything is typed: the things this person actually eats
                at this time of day. Most diaries are twenty foods on repeat. */}
            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Zuletzt oft</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 max-w-full px-2 text-xs"
                      onClick={() => {
                        const entry = suggestion.entry
                        keepAmountRef.current = true
                        setAmount(String(entry.amount))
                        if (entry.sourceType === "recipe" && entry.recipeId) {
                          setSelected({
                            kind: "recipe",
                            id: entry.recipeId,
                            name: clientLogEntryLabel(entry, foods),
                          })
                        } else if (entry.foodId) {
                          setSelected({
                            kind: "food",
                            id: entry.foodId,
                            name: clientLogEntryLabel(entry, foods),
                          })
                        }
                      }}
                    >
                      <span className="truncate">
                        {clientLogEntryLabel(suggestion.entry, foods)}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <ClientFoodSearchList savedMeals={savedMeals} onPick={pick} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!selected || isSaving} onClick={() => void handleSave()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eintragen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Macros for the amount actually being logged, not for an abstract 100 g. */
function NutritionCard({ nutrients, grams }: { nutrients: NutrientValue[]; grams: number }) {
  const scaled = scaleNutrients(nutrients, 100, grams)
  const rows: [string, string, number][] = [
    ["kcal", "", getNutrientValue(scaled, "energie")],
    ["Eiweiß", "g", getNutrientValue(scaled, "eiweiss")],
    ["Fett", "g", getNutrientValue(scaled, "fett")],
    ["KH", "g", getNutrientValue(scaled, "kohlenhydrate")],
  ]

  return (
    <div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/30 p-3 text-center">
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
  )
}
