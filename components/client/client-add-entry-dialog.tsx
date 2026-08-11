"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
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
import { isClientCapabilityEnabled } from "@/lib/client-modules"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { clientLogEntryLabel, type ClientLogSuggestion } from "@/lib/client-food-log"
import {
  addClientFoodLogEntry,
  ensureClientFoodLogDay,
  fetchFoodPortions,
} from "@/lib/data/client-food-log-client"
import { createClient } from "@/lib/supabase/client"
import type { Food, MealSlotType } from "@/lib/types"

interface FoodResult {
  id: string
  name: string
}

/**
 * What is about to be logged, from either input path. Catalog foods keep their
 * id so the counselor sees a traceable product; scanned or hand-entered ones
 * carry their own per-100 g values.
 */
type EntryDraft =
  | { kind: "food"; id: string; name: string }
  | { kind: "custom"; name: string; nutrients: BarcodeCustomPick["nutrients"] }

interface SearchRow {
  food_id: string
  food_name: string
}

const SEARCH_DEBOUNCE_MS = 250

/** Mounted per open by the caller, so it always starts from a clean state. */
export function ClientAddEntryDialog({
  slot,
  date,
  dayId,
  suggestions,
  foods,
  onClose,
  onSaved,
}: {
  slot: MealSlotType
  date: string
  dayId: string | null
  /** What this person usually eats in this slot, most frequent first. */
  suggestions: ClientLogSuggestion[]
  foods: Map<string, Food>
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FoodResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<EntryDraft | null>(null)
  const [mode, setMode] = useState<"search" | "barcode">("search")
  const [amount, setAmount] = useState("100")
  // Keyed by food rather than reset per selection: clearing it synchronously in
  // the effect would fire on every render that starts without a food picked.
  const [portionsByFood, setPortionsByFood] = useState<
    Map<string, { label: string; amountGrams: number }[]>
  >(new Map())
  // A suggestion brings its own amount; the portion default must not overwrite it.
  const keepAmountRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)

  const barcodeEnabled = isClientCapabilityEnabled("barcode")

  // Stale results stay in state but are not rendered below the query
  // threshold, which keeps this effect free of a synchronous reset.
  const trimmedQuery = query.trim()
  const visibleResults = trimmedQuery.length >= 2 ? results : []

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setIsSearching(true)
      void supabase
        .rpc("search_foods", { search_query: trimmed, result_limit: 15 })
        .abortSignal(controller.signal)
        .then(({ data, error }) => {
          if (error) {
            setResults([])
            return
          }
          setResults(
            ((data ?? []) as SearchRow[]).map((row) => ({ id: row.food_id, name: row.food_name })),
          )
        })
        .then(() => setIsSearching(false))
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
      setIsSearching(false)
    }
  }, [query, supabase])

  // Household measures for the picked food, and the default that follows from
  // them: a typical portion is a better opening bid than a flat 100 g.
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

  const portions =
    selected?.kind === "food" ? (portionsByFood.get(selected.id) ?? []) : []

  async function handleSave() {
    if (!selected) return

    const grams = Number(amount.replace(",", "."))
    if (!Number.isFinite(grams) || grams <= 0) {
      toast.error("Bitte gib eine Menge in Gramm ein.")
      return
    }

    setIsSaving(true)
    try {
      // The day row is created lazily on the first entry of that date.
      const resolvedDayId = dayId ?? (await ensureClientFoodLogDay(date)).id

      await addClientFoodLogEntry({
        dayId: resolvedDayId,
        slotType: slot,
        ...(selected.kind === "food"
          ? { sourceType: "food" as const, foodId: selected.id }
          : {
              sourceType: "custom" as const,
              customName: selected.name,
              customNutrients: selected.nutrients,
            }),
        amount: grams,
      })

      onSaved()
    } catch (error) {
      console.error("Failed to add food log entry:", error)
      toast.error("Der Eintrag konnte nicht gespeichert werden.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{MEAL_SLOT_LABELS[slot]}</DialogTitle>
          <DialogDescription>
            {mode === "barcode" && !selected
              ? "Tipp den Barcode ein — wir suchen im Katalog und bei Open Food Facts."
              : "Suche ein Lebensmittel und trage die Menge ein."}
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
              <p className="text-sm font-medium">{selected.name}</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setSelected(null)}
              >
                Anderes Lebensmittel wählen
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-entry-amount">Menge in Gramm</Label>
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
                      variant={
                        Number(amount.replace(",", ".")) === portion.amountGrams
                          ? "secondary"
                          : "outline"
                      }
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
            onPickCatalogFood={(food) => setSelected({ kind: "food", ...food })}
            onPickCustom={(product) => setSelected({ kind: "custom", ...product })}
          />
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="z. B. Haferflocken"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            {/* Before anything is typed: the things this person actually eats
                at this time of day. Most diaries are twenty foods on repeat. */}
            {trimmedQuery.length < 2 && suggestions.length > 0 && (
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
                        if (entry.sourceType === "custom") {
                          setSelected({
                            kind: "custom",
                            name: entry.customName ?? "Eigener Eintrag",
                            nutrients: entry.customNutrients ?? [],
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
                      <span className="truncate">{clientLogEntryLabel(suggestion.entry, foods)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {isSearching && (
                <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Suche läuft
                </p>
              )}
              {!isSearching && trimmedQuery.length >= 2 && visibleResults.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">Nichts gefunden.</p>
              )}
              <ul className="divide-y">
                {visibleResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => setSelected({ kind: "food", ...result })}
                    >
                      {result.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
