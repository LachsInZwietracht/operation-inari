"use client"

import { useEffect, useState } from "react"
import { Loader2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  availableFilters,
  KIND_LABELS,
  matchesFilter,
  SEARCH_FILTER_LABELS,
  type ClientSearchFilter,
  type ClientSearchItem,
} from "@/lib/client-food-search"
import { searchClientFoods } from "@/lib/data/client-food-search-client"
import type { ClientSavedMeal } from "@/lib/types"

const SEARCH_DEBOUNCE_MS = 250

/**
 * One search across foods, recipes and saved meals.
 *
 * The alternative — a tab per source — asks the person to know in advance which
 * drawer "Linsensuppe" lives in. They do not, so they would search three times.
 * The badge says what a hit is *after* it is found, and the chips narrow only
 * once there is something to narrow.
 *
 * The subtitle carries the line that actually tells six protein bars apart:
 * manufacturer and kcal per 100 g, in the list, before anything is tapped.
 */
export function ClientFoodSearchList({
  savedMeals,
  onPick,
}: {
  savedMeals: ClientSavedMeal[]
  onPick: (item: ClientSearchItem) => void
}) {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<ClientSearchItem[]>([])
  const [filter, setFilter] = useState<ClientSearchFilter>("alle")
  const [isSearching, setIsSearching] = useState(false)

  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setIsSearching(true)
      void searchClientFoods(trimmed, { savedMeals, signal: controller.signal })
        .then((found) => {
          if (!controller.signal.aborted) setItems(found)
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [trimmed, savedMeals])

  // Stale hits stay in state but are not rendered below the threshold, which
  // keeps this component free of a synchronous reset in the effect.
  const visible = trimmed.length >= 2 ? items : []
  const filters = availableFilters(visible)
  const shown = visible.filter((item) => matchesFilter(item, filter))

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="pl-9"
          placeholder="Lebensmittel, Rezept oder Mahlzeit"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.map((value) => (
            <Button
              key={value}
              type="button"
              variant={filter === value ? "secondary" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {SEARCH_FILTER_LABELS[value]}
            </Button>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto">
        {isSearching && (
          <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Suche läuft
          </p>
        )}
        {!isSearching && trimmed.length >= 2 && shown.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Nichts gefunden.</p>
        )}

        <ul className="divide-y">
          {shown.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted"
                onClick={() => onPick(item)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                    {item.kcalPerUnit !== undefined && (
                      <span className="tabular-nums">
                        {item.subtitle ? " · " : ""}
                        {item.kcalPerUnit} kcal
                        {item.unit === "g" ? "/100 g" : "/Portion"}
                      </span>
                    )}
                  </span>
                </span>
                {item.kind !== "food" && (
                  <Badge variant="outline" className="shrink-0 text-xs font-normal">
                    {KIND_LABELS[item.kind]}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
