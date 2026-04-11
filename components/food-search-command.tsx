"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon, Sparkles } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { FOODS, FOOD_CATEGORIES } from "@/lib/mock-data"
import { fuzzySearchFoods, type FuzzySearchResultMeta } from "@/lib/search"
import type { Food } from "@/lib/types"
import { useFoodSynonyms } from "@/hooks/use-food-synonyms"

type SearchResult = Food & FuzzySearchResultMeta

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
  const [query, setQuery] = React.useState("")
  const { getSynonymsForFood, getDisplayName } = useFoodSynonyms()

  const results = React.useMemo((): SearchResult[] => {
    if (!query.trim()) return FOODS.slice(0, 20).map((f) => ({ ...f, searchScore: 1, matchType: "none" }))
    return fuzzySearchFoods(query, FOODS, {
      getAliases: (food) => getSynonymsForFood(food.id).map((syn) => syn.name),
    }).slice(0, 20)
  }, [query, getSynonymsForFood])

  function handleSelect(foodId: string) {
    onOpenChange(false)
    setQuery("")
    router.push(`/lebensmittel/${foodId}`)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val)
        if (!val) setQuery("")
      }}
      title="Lebensmittelsuche"
      description="Fuzzy-Suche mit Tippfehler- und Phonetik-Erkennung"
    >
      <CommandInput
        placeholder="Lebensmittel suchen (Tippfehler werden erkannt)..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
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
                      Alias „{food.matchedValue}“
                    </span>
                  )}
                  {food.matchType && food.matchType !== "none" && (
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
    </CommandDialog>
  )
}

export function FoodSearchCommand() {
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

  return <SearchDialog open={open} onOpenChange={setOpen} />
}

export function FoodSearchTrigger() {
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
        className="text-muted-foreground relative w-full justify-start text-sm sm:w-64"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="mr-2 size-4" />
        <span>Lebensmittel suchen...</span>
        <Sparkles className="mr-1 ml-auto size-3 text-purple-400" />
        <kbd className="bg-muted text-muted-foreground pointer-events-none hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
