"use client"

import * as React from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui/command"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import type { Food, FoodSearchItem, FoodSourceId } from "@/lib/types"
import { useFoodSynonyms } from "@/hooks/use-food-synonyms"
import { createClient } from "@/lib/supabase/client"
import { fuzzySearchFoods } from "@/lib/search/fuzzy-search"
import { fetchFoodById } from "@/lib/data/foods-client"

type SearchResult = FoodSearchItem & {
  searchScore?: number
  matchType?: string
  matchedField?: "name" | "synonym"
  matchedValue?: string
}

type RpcSearchRow = {
  food_id: string
  food_name: string
  similarity_score: number | null
  data_source_id: string
  category_id: string | null
}

function getCategoryName(categoryId: string): string {
  return FOOD_CATEGORIES.find((c) => c.id === categoryId)?.name ?? categoryId
}

interface FoodSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (food: Food) => void
  searchIndex: FoodSearchItem[]
  title?: string
  description?: string
}

export function FoodSearchDialog({
  open,
  onOpenChange,
  onSelect,
  searchIndex,
  title = "Lebensmittel suchen",
  description = "Wählen Sie ein Lebensmittel aus der Datenbank"
}: FoodSearchDialogProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [userId, setUserId] = React.useState<string | null>(null)
  const [remoteResults, setRemoteResults] = React.useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isFetchingFull, setIsFetchingFull] = React.useState(false)
  const { getDisplayName, getSynonymsForFood } = useFoodSynonyms()

  React.useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setUserId(data.user?.id ?? null)
    })
    return () => {
      active = false
    }
  }, [supabase])

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 200)
    return () => window.clearTimeout(id)
  }, [query])

  React.useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([])
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()
    setIsLoading(true)
    supabase
      .rpc("search_foods", {
        search_query: trimmed,
        requesting_user_id: userId ?? undefined,
        result_limit: 20,
      })
      .abortSignal(abortController.signal)
      .then(({ data, error }) => {
        if (error) {
          setRemoteResults([])
          setIsLoading(false)
          return
        }
        const mapped: SearchResult[] = (data ?? []).map((row: unknown) => {
          const typedRow = row as RpcSearchRow
          return {
            id: typedRow.food_id,
            name: typedRow.food_name,
            categoryId: typedRow.category_id ?? "cat_unbekannt",
            sourceId: typedRow.data_source_id as FoodSourceId,
            searchScore: typedRow.similarity_score ?? 0,
            matchType: "server",
            matchedField: "name" as const,
          }
        })
        setRemoteResults(mapped)
        setIsLoading(false)
      })

    return () => abortController.abort()
  }, [debouncedQuery, supabase, userId])

  const localQueryResults = React.useMemo(() => {
    const trimmed = debouncedQuery.trim()
    if (!trimmed) return []

    return fuzzySearchFoods(trimmed, searchIndex, {
      getAliases: (item) => getSynonymsForFood(item.id).map((syn) => syn.name),
    })
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        sourceId: item.sourceId,
        isCustom: item.isCustom,
        matchType: item.matchType,
        searchScore: item.searchScore,
        matchedField: item.matchedField,
        matchedValue: item.matchedValue,
      }))
  }, [debouncedQuery, searchIndex, getSynonymsForFood])

  const results = debouncedQuery.trim()
    ? remoteResults.length > 0
      ? remoteResults
      : localQueryResults
    : searchIndex.slice(0, 10)

  async function handleSelection(foodItem: SearchResult) {
    setIsFetchingFull(true)
    try {
      const fullFood = await fetchFoodById(foodItem.id)
      if (fullFood) {
        onSelect(fullFood)
        onOpenChange(false)
        setQuery("")
      }
    } catch (err) {
      console.error("Failed to fetch full food details:", err)
    } finally {
      setIsFetchingFull(false)
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val)
        if (!val) setQuery("")
      }}
      title={title}
      description={description}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Lebensmittel suchen..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? "Suche läuft..." : "Keine Ergebnisse gefunden."}
          </CommandEmpty>
          <CommandGroup heading={query.trim() ? `${results.length} Treffer` : "Vorschläge"}>
            {results.map((food: SearchResult) => (
              <CommandItem
                key={food.id}
                value={food.id}
                onSelect={() => handleSelection(food)}
                disabled={isFetchingFull}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{getDisplayName(food.id, food.name) ?? food.name}</span>
                    {food.matchedField === "synonym" && food.matchedValue && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Alias &bdquo;{food.matchedValue}&ldquo;
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {getCategoryName(food.categoryId)}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
