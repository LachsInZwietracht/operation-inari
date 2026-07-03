"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Apple, Moon, SearchIcon, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { FoodSearchDialog } from "@/components/food-search-command"
import { useFoodSearch } from "@/components/foods-provider"
import { NAV_SECTIONS } from "@/lib/navigation"

interface AppCommandPaletteProps {
  canAccessInstitution?: boolean
}

export function AppCommandPalette({ canAccessInstitution = true }: AppCommandPaletteProps) {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const { loadIndex } = useFoodSearch()
  const [open, setOpen] = React.useState(false)
  const [foodSearchOpen, setFoodSearchOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setFoodSearchOpen(false)
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const sections = React.useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !item.requiresInstitutionAccess || canAccessInstitution,
        ),
      })).filter((section) => section.items.length > 0),
    [canAccessInstitution],
  )

  function runCommand(command: () => void) {
    setOpen(false)
    command()
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground relative w-full min-w-0 justify-start text-sm sm:w-64"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="mr-2 size-4 shrink-0" />
        <span className="min-w-0 truncate">Suchen oder springen...</span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Befehlspalette"
        description="Seiten aufrufen und Aktionen ausführen"
        showCloseButton={false}
      >
        <CommandInput placeholder="Wohin möchtest du springen?" />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Aktionen">
            <CommandItem
              value="Lebensmittel suchen Suche Food"
              onSelect={() =>
                runCommand(() => {
                  loadIndex()
                  setFoodSearchOpen(true)
                })
              }
            >
              <Apple />
              <span>Lebensmittel suchen...</span>
            </CommandItem>
            <CommandItem
              value="Design wechseln Theme Hell Dunkel Dark Light"
              onSelect={() =>
                runCommand(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
              }
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              <span>{resolvedTheme === "dark" ? "Helles Design" : "Dunkles Design"}</span>
            </CommandItem>
          </CommandGroup>
          {sections.map((section) => (
            <React.Fragment key={section.title}>
              <CommandSeparator />
              <CommandGroup heading={section.title}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.route}
                    value={`${section.title} ${item.label}`}
                    onSelect={() => runCommand(() => router.push(item.route))}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>

      <FoodSearchDialog open={foodSearchOpen} onOpenChange={setFoodSearchOpen} />
    </>
  )
}
