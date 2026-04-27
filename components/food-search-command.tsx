"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, SearchIcon, Sparkles } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import type { FoodSearchItem, FoodSourceId } from "@/lib/types"
import { useFoodSynonyms } from "@/hooks/use-food-synonyms"
import { useFoodSearch } from "@/components/foods-provider"
import { createClient } from "@/lib/supabase/client"
import { fuzzySearchFoods } from "@/lib/search/fuzzy-search"

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

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { index: foods, isLoading: isIndexLoading, loadIndex } = useFoodSearch()
  
  React.useEffect(() => {
    if (open) loadIndex()
  }, [open, loadIndex])

  const supabase = React.useMemo(() => createClient(), [])
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [userId, setUserId] = React.useState<string | null>(null)
  const [remoteResults, setRemoteResults] = React.useState<SearchResult[]>([])
  const [isSearchingRemote, setIsSearchingRemote] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
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
    if (!trimmed) {
      setRemoteResults([])
      setServerError(null)
      setIsSearchingRemote(false)
      return
    }

    const abortController = new AbortController()
    setIsSearchingRemote(true)
    supabase
      .rpc("search_foods", {
        search_query: trimmed,
        requesting_user_id: userId ?? undefined,
        result_limit: 20,
      })
      .abortSignal(abortController.signal)
      .then(({ data, error }) => {
        if (error) {
          setServerError(error.message)
          setRemoteResults([])
          setIsSearchingRemote(false)
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
        setServerError(null)
        setIsSearchingRemote(false)
      })

    return () => abortController.abort()
  }, [debouncedQuery, supabase, userId])

  const fallbackResults = React.useMemo(
    () => foods.slice(0, 20).map((food): SearchResult => ({ ...food, matchType: "none" })),
    [foods],
  )

  const localQueryResults = React.useMemo(() => {
    const trimmed = debouncedQuery.trim()
    if (!trimmed) return fallbackResults

    return fuzzySearchFoods(trimmed, foods, {
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
  }, [debouncedQuery, fallbackResults, foods, getSynonymsForFood])

  // Show local results immediately; replace with remote when available
  const results = debouncedQuery.trim()
    ? remoteResults.length > 0
      ? remoteResults
      : localQueryResults
    : fallbackResults

  function handleSelect(foodId: string) {
    onOpenChange(false)
    setQuery("")
    router.push(`/lebensmittel/${foodId}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val)
        if (!val) setQuery("")
      }}
    >
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Lebensmittelsuche</DialogTitle>
          <DialogDescription>Fuzzy-Suche mit Tippfehler- und Phonetik-Erkennung</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder="Lebensmittel suchen (Tippfehler werden erkannt)..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {(isIndexLoading || isSearchingRemote) && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <CommandEmpty>
              {isSearchingRemote || isIndexLoading ? "Suche läuft..." : serverError ?? "Keine Ergebnisse gefunden."}
            </CommandEmpty>
            <CommandGroup heading={query.trim() ? `${results.length} Treffer` : "Lebensmittel"}>
              {results.map((food) => (
                <CommandItem
                  key={food.id}
                  value={food.id}
                  onSelect={() => handleSelect(food.id)}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{getDisplayName(food.id, food.name) ?? food.name}</span>
                      {food.matchedField === "synonym" && food.matchedValue && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Alias &bdquo;{food.matchedValue}&ldquo;
                        </span>
                      )}
                      {food.matchType && food.matchType !== "none" && food.matchType !== "server" && (
                        <span className="text-[10px] text-purple-500">
                          {food.matchType === "phonetic" && "klingt wie"}
                          {food.matchType === "fuzzy" && "ähnlich"}
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
      </DialogContent>
    </Dialog>
  )
}

export function FoodSearchTrigger() {
  const { loadIndex } = useFoodSearch()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground relative min-w-0 justify-start text-sm sm:w-64"
        onClick={() => setOpen(true)}
        onMouseEnter={() => loadIndex()}
        onFocus={() => loadIndex()}
      >
        <SearchIcon className="mr-2 size-4 shrink-0" />
        <span className="min-w-0 truncate">Lebensmittel suchen...</span>
        <Sparkles className="mr-1 ml-auto size-3 text-purple-400" />
        <kbd className="bg-muted text-muted-foreground pointer-events-none hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
