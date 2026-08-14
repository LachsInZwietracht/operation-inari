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
import { ClientBarcodePanel } from "@/components/client/client-barcode-panel"
import type { BarcodeCustomPick } from "@/components/client/client-barcode-panel"
import { ClientFoodSearchList } from "@/components/client/client-food-search-list"
import {
  ClientEntryDetail,
  parseEntryAmount,
} from "@/components/client/client-entry-detail"
import { ClientRecentEntryList } from "@/components/client/client-recent-entry-list"
import { isClientCapabilityEnabled } from "@/lib/client-modules"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { clientLogEntryLabel, type ClientRecentEntry } from "@/lib/client-food-log"
import { KIND_LABELS, type ClientSearchItem } from "@/lib/client-food-search"
import {
  addClientFoodLogEntry,
  ensureClientFoodLogDay,
  fetchFoodPortions,
} from "@/lib/data/client-food-log-client"
import { ensureClientCustomFood } from "@/lib/data/client-custom-foods-client"
import { scaleNutrients } from "@/lib/nutrients"
import type { ClientSavedMeal, Food, MealSlotType, NutrientValue } from "@/lib/types"

/** Where the person is looking: their history, the catalog, or a barcode. */
type Mode = "recent" | "search" | "barcode"

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  recent: "Was du zuletzt gegessen hast — tippen und die Menge steht schon da.",
  search: "Suche ein Lebensmittel, ein Rezept oder eine gespeicherte Mahlzeit.",
  barcode: "Tipp den Barcode ein — wir suchen im Katalog und bei Open Food Facts.",
}

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

/** Mounted per open by the caller, so it always starts from a clean state. */
export function ClientAddEntryDialog({
  slot,
  replaces,
  date,
  dayId,
  recent,
  foods,
  recipeFacts,
  recipeNames,
  references,
  savedMeals,
  onClose,
  onSaved,
}: {
  slot: MealSlotType
  /** Set when this is answering a planned row with "anders gegessen". */
  replaces?: { id: string; label: string }
  date: string
  dayId: string | null
  /** What this person has been eating, this slot's habits first. */
  recent: ClientRecentEntry[]
  foods: Map<string, Food>
  /** Per-portion nutrients by recipe id, for pricing recent recipe rows. */
  recipeFacts?: Map<string, NutrientValue[]>
  recipeNames?: Map<string, string>
  /** Daily reference intake, for saying what a portion is good for. */
  references: Map<string, number>
  savedMeals: ClientSavedMeal[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<EntryDraft | null>(null)
  // Opens on what this person already eats. Searching is the fallback, not the
  // first move — with a history, the answer is usually already on screen.
  const [mode, setMode] = useState<Mode>(recent.length > 0 ? "recent" : "search")
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

    const parsed = parseEntryAmount(amount)
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
            replacesMealEntryId: replaces?.id,
          })
        }
      } else if (selected.kind === "recipe") {
        await addClientFoodLogEntry({
          dayId: resolvedDayId,
          slotType: slot,
          sourceType: "recipe",
          recipeId: selected.id,
          amount: parsed,
          replacesMealEntryId: replaces?.id,
        })
      } else {
        await addClientFoodLogEntry({
          dayId: resolvedDayId,
          slotType: slot,
          sourceType: "food",
          foodId: selected.id,
          amount: parsed,
          replacesMealEntryId: replaces?.id,
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
  async function adoptCustomProduct(product: BarcodeCustomPick, grams = "100") {
    try {
      const foodId = await ensureClientCustomFood({
        name: product.name,
        nutrients: product.nutrients,
        barcode: product.barcode,
      })
      keepAmountRef.current = true
      setAmount(grams)
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

  /** Re-logging something from the history, with the amount it had last time. */
  function pickRecent(item: ClientRecentEntry) {
    const entry = item.entry
    keepAmountRef.current = true
    setAmount(String(entry.amount))

    if (entry.sourceType === "recipe" && entry.recipeId) {
      setSelected({
        kind: "recipe",
        id: entry.recipeId,
        name: clientLogEntryLabel(entry, foods, recipeNames),
      })
      return
    }

    if (entry.sourceType === "custom" && entry.customNutrients?.length) {
      // Entries from before own products became real food rows. Re-logging one
      // promotes it, so it stops being a copy the next time around.
      void adoptCustomProduct(
        { name: entry.customName ?? "Eigenes Produkt", nutrients: entry.customNutrients },
        String(entry.amount),
      )
      return
    }

    if (entry.foodId) {
      const food = foods.get(entry.foodId)
      setSelected({
        kind: "food",
        id: entry.foodId,
        name: clientLogEntryLabel(entry, foods, recipeNames),
        subtitle: food?.manufacturer,
        nutrientsPer100g: food
          ? scaleNutrients(food.nutrients, food.baseAmount, 100)
          : undefined,
      })
    }
  }

  const modes: [Mode, string][] = [
    ...(recent.length > 0 ? ([["recent", "Zuletzt"]] as [Mode, string][]) : []),
    ["search", "Suche"],
    ...(barcodeEnabled ? ([["barcode", "Barcode"]] as [Mode, string][]) : []),
  ]

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {replaces ? `Statt ${replaces.label}` : MEAL_SLOT_LABELS[slot]}
          </DialogTitle>
          <DialogDescription>
            {selected ? "Menge prüfen und eintragen." : MODE_DESCRIPTIONS[mode]}
          </DialogDescription>
        </DialogHeader>

        {modes.length > 1 && !selected && (
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {modes.map(([value, label]) => (
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
          <ClientEntryDetail
            name={selected.kind === "meal" ? selected.meal.name : selected.name}
            subtitle={
              selected.kind === "meal"
                ? `${selected.meal.items.length} Zutaten`
                : (selected.kind === "food" && selected.subtitle) || KIND_LABELS[selected.kind]
            }
            nutrientsPerUnit={
              selected.kind === "food"
                ? selected.nutrientsPer100g
                : selected.kind === "recipe" && selected.kcalPerPortion !== undefined
                  ? [{ nutrientId: "energie", amount: selected.kcalPerPortion }]
                  : undefined
            }
            unit={selected.kind === "food" ? "g" : "portion"}
            amount={amount}
            onAmountChange={setAmount}
            portions={portions}
            references={references}
            onReselect={() => setSelected(null)}
          />
        ) : mode === "barcode" ? (
          <ClientBarcodePanel
            onPickCatalogFood={(food) => {
              keepAmountRef.current = false
              setSelected({ kind: "food", ...food })
            }}
            onPickCustom={(product) => void adoptCustomProduct(product)}
          />
        ) : mode === "recent" ? (
          <ClientRecentEntryList
            entries={recent}
            slot={slot}
            foods={foods}
            recipeFacts={recipeFacts}
            recipeNames={recipeNames}
            onPick={pickRecent}
          />
        ) : (
          <ClientFoodSearchList savedMeals={savedMeals} onPick={pick} />
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
