"use client"

import { useEffect, useMemo, useState } from "react"
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
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import {
  addClientFoodLogEntry,
  ensureClientFoodLogDay,
} from "@/lib/data/client-food-log-client"
import { createClient } from "@/lib/supabase/client"
import type { MealSlotType } from "@/lib/types"

interface FoodResult {
  id: string
  name: string
}

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
  onClose,
  onSaved,
}: {
  slot: MealSlotType
  date: string
  dayId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FoodResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [amount, setAmount] = useState("100")
  const [isSaving, setIsSaving] = useState(false)

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
        sourceType: "food",
        foodId: selected.id,
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
          <DialogDescription>Suche ein Lebensmittel und trage die Menge ein.</DialogDescription>
        </DialogHeader>

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
            </div>
          </div>
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
                      onClick={() => setSelected(result)}
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
