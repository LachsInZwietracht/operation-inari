"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
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

function getCategoryName(categoryId: string): string {
  return FOOD_CATEGORIES.find((c) => c.id === categoryId)?.name ?? categoryId
}

export function FoodSearchCommand() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

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

  function handleSelect(foodId: string) {
    setOpen(false)
    router.push(`/lebensmittel/${foodId}`)
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Lebensmittelsuche"
        description="Suche nach Lebensmitteln in der Datenbank"
      >
        <CommandInput placeholder="Lebensmittel suchen..." />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {FOODS.map((food) => (
              <CommandItem
                key={food.id}
                value={food.name}
                onSelect={() => handleSelect(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {getCategoryName(food.categoryId)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

export function FoodSearchTrigger() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

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

  function handleSelect(foodId: string) {
    setOpen(false)
    router.push(`/lebensmittel/${foodId}`)
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground relative w-full justify-start text-sm sm:w-64"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="mr-2 size-4" />
        <span>Lebensmittel suchen...</span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Lebensmittelsuche"
        description="Suche nach Lebensmitteln in der Datenbank"
      >
        <CommandInput placeholder="Lebensmittel suchen..." />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {FOODS.map((food) => (
              <CommandItem
                key={food.id}
                value={food.name}
                onSelect={() => handleSelect(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {getCategoryName(food.categoryId)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
