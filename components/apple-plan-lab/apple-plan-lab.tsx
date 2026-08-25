"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Copy,
  FileCheck2,
  HeartPulse,
  Info,
  Leaf,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Utensils,
} from "lucide-react"

import { useAppBreadcrumb } from "@/components/app-breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type ConceptId = "focus" | "workbench" | "handoff"
type MealId = "breakfast" | "lunch" | "snack" | "dinner"

interface FoodItem {
  id: string
  name: string
  detail: string
  source: "BLS 4.0" | "Eigene Rezeptur"
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  portion: number
}

interface Meal {
  id: MealId
  label: string
  time: string
  color: string
  items: FoodItem[]
}

interface NutrientTotal {
  key: "kcal" | "protein" | "carbs" | "fat" | "fiber"
  label: string
  value: number
  target: number
  unit: string
}

const CONCEPTS: Array<{
  id: ConceptId
  eyebrow: string
  name: string
  promise: string
}> = [
  {
    id: "focus",
    eyebrow: "Wenig Reibung",
    name: "Fokus",
    promise: "Eine Entscheidung nach der anderen",
  },
  {
    id: "workbench",
    eyebrow: "Hohe Taktzahl",
    name: "Werkbank",
    promise: "Alles Wichtige im direkten Zugriff",
  },
  {
    id: "handoff",
    eyebrow: "Gemeinsam planen",
    name: "Übergabe",
    promise: "Von der Beratung bis zur Freigabe",
  },
]

const LIBRARY_ITEMS: FoodItem[] = [
  {
    id: "skyr",
    name: "Skyr natur",
    detail: "1 Becher · 150 g",
    source: "BLS 4.0",
    kcal: 95,
    protein: 16,
    carbs: 6,
    fat: 0.4,
    fiber: 0,
    portion: 1,
  },
  {
    id: "walnuts",
    name: "Walnüsse",
    detail: "1 kleine Hand · 20 g",
    source: "BLS 4.0",
    kcal: 142,
    protein: 3,
    carbs: 2,
    fat: 14,
    fiber: 1.4,
    portion: 1,
  },
  {
    id: "bread",
    name: "Roggenvollkornbrot",
    detail: "1 Scheibe · 55 g",
    source: "BLS 4.0",
    kcal: 118,
    protein: 3.5,
    carbs: 22,
    fat: 1,
    fiber: 4.2,
    portion: 1,
  },
  {
    id: "berries",
    name: "Beerenmischung",
    detail: "1 Schale · 125 g",
    source: "BLS 4.0",
    kcal: 54,
    protein: 1,
    carbs: 9,
    fat: 0.5,
    fiber: 5,
    portion: 1,
  },
]

const INITIAL_MEALS: Meal[] = [
  {
    id: "breakfast",
    label: "Frühstück",
    time: "07:30",
    color: "bg-amber-400",
    items: [
      {
        id: "porridge",
        name: "Hafer-Porridge mit Apfel",
        detail: "1 Schale · 320 g",
        source: "Eigene Rezeptur",
        kcal: 412,
        protein: 14,
        carbs: 62,
        fat: 12,
        fiber: 9,
        portion: 1,
      },
    ],
  },
  {
    id: "lunch",
    label: "Mittagessen",
    time: "12:30",
    color: "bg-emerald-500",
    items: [
      {
        id: "curry",
        name: "Linsen-Gemüse-Curry",
        detail: "1 Teller · 460 g",
        source: "Eigene Rezeptur",
        kcal: 565,
        protein: 27,
        carbs: 72,
        fat: 17,
        fiber: 15,
        portion: 1,
      },
    ],
  },
  {
    id: "snack",
    label: "Zwischenmahlzeit",
    time: "16:00",
    color: "bg-violet-500",
    items: [
      {
        id: "pear",
        name: "Birne",
        detail: "1 mittelgroß · 160 g",
        source: "BLS 4.0",
        kcal: 83,
        protein: 1,
        carbs: 20,
        fat: 0.3,
        fiber: 4.5,
        portion: 1,
      },
    ],
  },
  {
    id: "dinner",
    label: "Abendessen",
    time: "19:00",
    color: "bg-sky-500",
    items: [
      {
        id: "salad",
        name: "Kartoffel-Gurken-Salat",
        detail: "1 Teller · 390 g",
        source: "Eigene Rezeptur",
        kcal: 386,
        protein: 11,
        carbs: 56,
        fat: 13,
        fiber: 7,
        portion: 1,
      },
    ],
  },
]

const TARGETS = {
  kcal: 1850,
  protein: 90,
  carbs: 220,
  fat: 65,
  fiber: 30,
}

const DAYS = [
  { short: "Mo", date: "18", label: "Montag, 18. August", state: "done" },
  { short: "Di", date: "19", label: "Dienstag, 19. August", state: "done" },
  { short: "Mi", date: "20", label: "Mittwoch, 20. August", state: "active" },
  { short: "Do", date: "21", label: "Donnerstag, 21. August", state: "empty" },
  { short: "Fr", date: "22", label: "Freitag, 22. August", state: "empty" },
  { short: "Sa", date: "23", label: "Samstag, 23. August", state: "empty" },
  { short: "So", date: "24", label: "Sonntag, 24. August", state: "empty" },
] as const

function calculateTotals(meals: Meal[]): NutrientTotal[] {
  const sum = (key: "kcal" | "protein" | "carbs" | "fat" | "fiber") =>
    meals.reduce(
      (mealTotal, meal) =>
        mealTotal + meal.items.reduce((itemTotal, item) => itemTotal + item[key] * item.portion, 0),
      0,
    )

  return [
    { key: "kcal", label: "Energie", value: sum("kcal"), target: TARGETS.kcal, unit: "kcal" },
    { key: "protein", label: "Eiweiß", value: sum("protein"), target: TARGETS.protein, unit: "g" },
    { key: "carbs", label: "Kohlenhydrate", value: sum("carbs"), target: TARGETS.carbs, unit: "g" },
    { key: "fat", label: "Fett", value: sum("fat"), target: TARGETS.fat, unit: "g" },
    { key: "fiber", label: "Ballaststoffe", value: sum("fiber"), target: TARGETS.fiber, unit: "g" },
  ]
}

function formatValue(value: number) {
  return value < 10 && !Number.isInteger(value) ? value.toFixed(1) : Math.round(value).toString()
}

function percent(value: number, target: number) {
  return Math.min(100, Math.round((value / target) * 100))
}

function Surface({ className, children }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border/70 bg-card/90 rounded-[24px] border shadow-[0_18px_60px_-46px_rgba(15,23,42,0.5)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

function PatientContext({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center", compact ? "gap-2.5" : "gap-3") }>
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 text-sm font-semibold text-sky-900 ring-1 ring-black/5 dark:from-sky-950 dark:to-indigo-950 dark:text-sky-100">
        MK
        <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">Mara König</p>
        <p className="text-muted-foreground truncate text-xs">42 Jahre · Adipositas Grad I · vegetarisch</p>
      </div>
    </div>
  )
}

function DayPicker({ activeDay, onChange }: { activeDay: number; onChange: (index: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-black/5 bg-black/[0.035] p-1 dark:border-white/5 dark:bg-white/[0.045]">
      {DAYS.map((day, index) => (
        <button
          key={`${day.short}-${day.date}`}
          type="button"
          onClick={() => onChange(index)}
          className={cn(
            "relative flex h-11 min-w-10 flex-col items-center justify-center rounded-full px-2 text-xs transition-all",
            activeDay === index
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={`${day.short}, ${day.date}. August`}
        >
          <span className="text-[10px] font-medium">{day.short}</span>
          <span className="font-semibold">{day.date}</span>
          {day.state === "done" && activeDay !== index ? (
            <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-500" />
          ) : null}
        </button>
      ))}
    </div>
  )
}

function NutrientBars({ totals, compact = false }: { totals: NutrientTotal[]; compact?: boolean }) {
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-5") }>
      {totals.map((total) => {
        const progress = percent(total.value, total.target)
        const isHigh = total.value > total.target * 1.08
        return (
          <div key={total.key} className="min-w-0">
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <span className="text-muted-foreground truncate text-[11px] font-medium">{total.label}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {formatValue(total.value)}
                <span className="text-muted-foreground font-normal">/{total.target}</span>
              </span>
            </div>
            <Progress
              value={progress}
              className={cn("h-1.5", isHigh && "[&_[data-slot=progress-indicator]]:bg-amber-500")}
            />
          </div>
        )
      })}
    </div>
  )
}

function PortionControl({
  portion,
  onDecrease,
  onIncrease,
}: {
  portion: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center rounded-full border bg-background/80 p-0.5 shadow-sm">
      <button
        type="button"
        onClick={onDecrease}
        className="text-muted-foreground hover:text-foreground grid h-7 w-7 place-items-center rounded-full hover:bg-muted"
        aria-label="Portion verkleinern"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-9 text-center text-xs font-semibold tabular-nums">{portion.toLocaleString("de-DE")}</span>
      <button
        type="button"
        onClick={onIncrease}
        className="text-muted-foreground hover:text-foreground grid h-7 w-7 place-items-center rounded-full hover:bg-muted"
        aria-label="Portion vergrößern"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function FocusConcept({
  meals,
  totals,
  selectedMeal,
  onSelectMeal,
  onChangePortion,
  onRemove,
  onOpenAdd,
  released,
  onRelease,
}: ConceptProps) {
  const meal = meals.find((item) => item.id === selectedMeal) ?? meals[0]
  const energy = totals[0]
  const remaining = Math.max(0, energy.target - energy.value)

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <Surface className="overflow-hidden border-0 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/60 dark:from-zinc-950 dark:via-sky-950/30 dark:to-indigo-950/30">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_420px] lg:p-10">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <Badge variant="outline" className="rounded-full bg-background/60 px-2.5 py-1 backdrop-blur-xl">
                <Sparkles className="mr-1 h-3 w-3 text-sky-500" />
                Schritt 3 von 4 · Feinschliff
              </Badge>
              <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Der Tag steht. Jetzt die Eiweißlücke schließen.
              </h2>
              <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base">
                Noch {Math.max(0, Math.round(TARGETS.protein - totals[1].value))} g Eiweiß. Eine Portion Skyr am Nachmittag passt zum Zielprofil, ohne den Plan unnötig umzubauen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => onOpenAdd("snack")}>
                <Plus className="mr-1.5 h-4 w-4" />
                Vorschlag übernehmen
              </Button>
              <Button variant="outline" className="rounded-full bg-background/60" onClick={() => onSelectMeal("snack")}>
                Erst prüfen
              </Button>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_-38px_rgba(30,64,175,0.5)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/25">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">Tagesenergie</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">DGE-Profil aktiv</span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-[-0.04em] tabular-nums">{Math.round(energy.value)}</p>
                <p className="text-muted-foreground mt-1 text-sm">von {energy.target} kcal</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{remaining}</p>
                <p className="text-muted-foreground text-xs">kcal verfügbar</p>
              </div>
            </div>
            <Progress value={percent(energy.value, energy.target)} className="mt-5 h-2" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              {totals.slice(1).map((total) => (
                <div key={total.key} className="rounded-2xl bg-black/[0.035] p-3 dark:bg-white/[0.055]">
                  <p className="text-muted-foreground text-[11px]">{total.label}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatValue(total.value)} <span className="text-muted-foreground font-normal">/ {total.target} {total.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Surface className="p-3">
          <div className="px-3 pt-2 pb-3">
            <p className="text-xs font-semibold tracking-wide uppercase">Tagesablauf</p>
            <p className="text-muted-foreground mt-1 text-xs">Mahlzeit wählen und im Kontext bearbeiten</p>
          </div>
          <div className="space-y-1">
            {meals.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMeal(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all",
                  item.id === selectedMeal ? "bg-foreground text-background shadow-sm" : "hover:bg-muted",
                )}
              >
                <span className={cn("h-8 w-1 rounded-full", item.color)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={cn("block truncate text-xs", item.id === selectedMeal ? "text-background/65" : "text-muted-foreground") }>
                    {item.items.length} {item.items.length === 1 ? "Baustein" : "Bausteine"} · {item.time}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 opacity-45" />
              </button>
            ))}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5 sm:p-6">
            <div>
              <p className="text-muted-foreground text-xs">{meal.time} Uhr</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">{meal.label}</h3>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => onOpenAdd(meal.id)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Hinzufügen
            </Button>
          </div>
          <div className="divide-y">
            {meal.items.map((item) => (
              <div key={item.id} className="group flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted">
                  {item.source === "BLS 4.0" ? <Leaf className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                </div>
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{item.detail} · {item.source}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{Math.round(item.kcal * item.portion)} kcal</p>
                  <p className="text-muted-foreground text-xs">{formatValue(item.protein * item.portion)} g Eiweiß</p>
                </div>
                <PortionControl
                  portion={item.portion}
                  onDecrease={() => onChangePortion(meal.id, item.id, -0.5)}
                  onIncrease={() => onChangePortion(meal.id, item.id, 0.5)}
                />
                <button
                  type="button"
                  onClick={() => onRemove(meal.id, item.id)}
                  className="text-muted-foreground hover:text-destructive grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                  aria-label={`${item.name} entfernen`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/35 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Änderungen werden im Entwurf automatisch gesichert
            </div>
            <Button className="rounded-full" onClick={onRelease}>
              {released ? <Check className="mr-1.5 h-4 w-4" /> : <ArrowRight className="mr-1.5 h-4 w-4" />}
              {released ? "Freigegeben" : "Zur Freigabe"}
            </Button>
          </div>
        </Surface>
      </div>
    </div>
  )
}

interface ConceptProps {
  meals: Meal[]
  totals: NutrientTotal[]
  dayLabel: string
  selectedMeal: MealId
  onSelectMeal: (meal: MealId) => void
  onChangePortion: (meal: MealId, itemId: string, delta: number) => void
  onRemove: (meal: MealId, itemId: string) => void
  onOpenAdd: (meal: MealId) => void
  released: boolean
  onRelease: () => void
}

function WorkbenchConcept({
  meals,
  totals,
  dayLabel,
  selectedMeal,
  onSelectMeal,
  onChangePortion,
  onRemove,
  onOpenAdd,
  released,
  onRelease,
}: ConceptProps) {
  const [query, setQuery] = useState("")
  const filteredLibrary = LIBRARY_ITEMS.filter((item) =>
    item.name.toLocaleLowerCase("de-DE").includes(query.toLocaleLowerCase("de-DE")),
  )

  return (
    <div className="min-h-[720px] p-3 sm:p-4">
      <Surface className="grid min-h-[690px] overflow-hidden rounded-[26px] xl:grid-cols-[260px_minmax(440px,1fr)_300px]">
        <aside className="border-b bg-muted/25 p-4 xl:border-r xl:border-b-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Bausteine</p>
              <p className="text-muted-foreground text-xs">Favoriten & letzte Suche</p>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Lebensmittel suchen"
              className="rounded-full bg-background pl-9"
            />
          </div>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 xl:flex-wrap">
            {['Favoriten', 'Eiweißreich', 'Ballaststoffreich'].map((filter, index) => (
              <button
                key={filter}
                type="button"
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                  index === 0 ? "bg-foreground text-background" : "border bg-background",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {filteredLibrary.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenAdd(selectedMeal)}
                className="group rounded-2xl border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Leaf className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{item.name}</span>
                    <span className="text-muted-foreground mt-0.5 block text-[10px]">{item.detail}</span>
                  </span>
                  <Plus className="text-muted-foreground group-hover:text-foreground mt-1 h-3.5 w-3.5" />
                </div>
                <div className="text-muted-foreground mt-2 flex items-center justify-between text-[10px]">
                  <span>{item.source}</span>
                  <span>{item.kcal} kcal</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-sm font-semibold">{dayLabel}</p>
                <p className="text-muted-foreground text-xs">Entwurf · zuletzt gerade eben</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Tag duplizieren">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Weitere Aktionen">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[625px]">
            <div className="space-y-3 p-4 sm:p-5">
              {meals.map((meal) => {
                const mealKcal = meal.items.reduce((sum, item) => sum + item.kcal * item.portion, 0)
                const active = meal.id === selectedMeal
                return (
                  <div
                    key={meal.id}
                    className={cn(
                      "overflow-hidden rounded-[20px] border transition-all",
                      active ? "border-foreground/25 shadow-md" : "border-border/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectMeal(meal.id)}
                      className="flex w-full items-center gap-3 bg-muted/25 px-4 py-3 text-left"
                    >
                      <span className={cn("h-8 w-1 rounded-full", meal.color)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {meal.label}
                          {active ? <Badge variant="outline" className="rounded-full text-[9px]">aktiv</Badge> : null}
                        </span>
                        <span className="text-muted-foreground text-[11px]">{meal.time} Uhr · {Math.round(mealKcal)} kcal</span>
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", active && "rotate-180")} />
                    </button>
                    <div className="divide-y">
                      {meal.items.map((item) => (
                        <div key={item.id} className="group grid grid-cols-[minmax(140px,1fr)_80px_88px_32px] items-center gap-2 px-4 py-3 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.name}</p>
                            <p className="text-muted-foreground mt-0.5 truncate text-[10px]">{item.source} · {item.detail}</p>
                          </div>
                          <span className="text-right font-medium tabular-nums">{Math.round(item.kcal * item.portion)} kcal</span>
                          <PortionControl
                            portion={item.portion}
                            onDecrease={() => onChangePortion(meal.id, item.id, -0.5)}
                            onIncrease={() => onChangePortion(meal.id, item.id, 0.5)}
                          />
                          <button
                            type="button"
                            onClick={() => onRemove(meal.id, item.id)}
                            className="text-muted-foreground hover:text-destructive grid h-7 w-7 place-items-center rounded-full opacity-60 hover:bg-muted group-hover:opacity-100"
                            aria-label={`${item.name} entfernen`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => onOpenAdd(meal.id)}
                        className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1.5 border-t border-dashed py-2.5 text-xs font-medium hover:bg-muted/40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Baustein hinzufügen
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </main>

        <aside className="border-t bg-muted/20 p-4 xl:border-t-0 xl:border-l">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Live-Analyse</p>
              <p className="text-muted-foreground text-xs">DGE · Gewichtsreduktion</p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {totals.map((total) => (
              <div key={total.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{total.label}</span>
                  <span className="font-semibold tabular-nums">{formatValue(total.value)} / {total.target} {total.unit}</span>
                </div>
                <Progress value={percent(total.value, total.target)} className="h-1.5" />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold">Eiweiß unter Zielkorridor</p>
                <p className="text-muted-foreground mt-1 text-[11px] leading-4">Skyr oder Hülsenfrüchte ergänzen. Keine Allergenkonflikte erkannt.</p>
                <button type="button" onClick={() => onOpenAdd("snack")} className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Lücke schließen
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-background p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold">Sicherheitscheck</p>
            </div>
            <div className="text-muted-foreground mt-3 space-y-2 text-[11px]">
              <p className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-600" /> Vegetarische Kost eingehalten</p>
              <p className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-600" /> Keine Allergene hinterlegt</p>
              <p className="flex items-center gap-2"><Info className="h-3 w-3 text-sky-600" /> Metformin: Essensrhythmus prüfen</p>
            </div>
          </div>

          <Button className="mt-5 w-full rounded-full" onClick={onRelease}>
            {released ? <Check className="mr-1.5 h-4 w-4" /> : <FileCheck2 className="mr-1.5 h-4 w-4" />}
            {released ? "Plan freigegeben" : "Prüfen & freigeben"}
          </Button>
        </aside>
      </Surface>
    </div>
  )
}

function HandoffConcept({
  meals,
  totals,
  dayLabel,
  selectedMeal,
  onSelectMeal,
  onOpenAdd,
  released,
  onRelease,
}: ConceptProps) {
  const [clientPreview, setClientPreview] = useState(false)
  const [notesVisible, setNotesVisible] = useState(true)

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            ["1", "Ziele klären", true],
            ["2", "Tag gestalten", true],
            ["3", "Gemeinsam prüfen", !released],
            ["4", "Übergeben", released],
          ].map(([number, label, active]) => (
            <div key={String(number)} className={cn("flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs", active ? "bg-foreground text-background" : "bg-muted text-muted-foreground") }>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold", active ? "bg-background/15" : "bg-background")}>{number}</span>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setClientPreview(false)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium", !clientPreview && "bg-foreground text-background")}
          >
            Beratung
          </button>
          <button
            type="button"
            onClick={() => setClientPreview(true)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium", clientPreview && "bg-foreground text-background")}
          >
            Patientenansicht
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Surface className="p-5">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Gesprächsleitfaden</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">Was muss heute funktionieren?</h3>
            <p className="text-muted-foreground mt-2 text-xs leading-5">
              Mara braucht einen Plan, der an Arbeitstagen ohne Kochen am Mittag auskommt und abends gemeinsam mit der Familie funktioniert.
            </p>
            <div className="mt-4 space-y-2">
              {[
                "Mittagessen vorbereitbar",
                "Vegetarisch für die Familie",
                "Maximal 20 Minuten abends",
              ].map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs",
                    index < 2 ? "border-emerald-500/30 bg-emerald-500/8" : "hover:bg-muted",
                  )}
                >
                  <span className={cn("grid h-4 w-4 place-items-center rounded-full border", index < 2 && "border-emerald-500 bg-emerald-500 text-white") }>
                    {index < 2 ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                  {item}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Interne Notiz</p>
              <Switch checked={notesVisible} onCheckedChange={setNotesVisible} aria-label="Interne Notiz anzeigen" />
            </div>
            {notesVisible ? (
              <p className="text-muted-foreground mt-3 rounded-xl bg-muted/50 p-3 text-xs leading-5">
                HbA1c beim nächsten Termin erneut besprechen. Abends Portionsgröße gemeinsam festgelegt.
              </p>
            ) : null}
            <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[10px]">
              <ShieldCheck className="h-3 w-3" /> Nur für das Behandlungsteam sichtbar
            </p>
          </Surface>

          <Surface className="p-5">
            <p className="text-sm font-semibold">Freigabe-Check</p>
            <div className="mt-3 space-y-2.5 text-xs">
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Alltagstauglichkeit besprochen</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Zielwerte geprüft</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Quellen vollständig</p>
            </div>
          </Surface>
        </div>

        <Surface className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-7">
            <div>
              <p className="text-muted-foreground text-xs">{dayLabel}</p>
              <h2 className="mt-0.5 text-xl font-semibold tracking-tight">
                {clientPreview ? "Mein Tag mit mehr Energie" : "Tagesplan im Beratungsgespräch"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {clientPreview ? (
                <Badge variant="outline" className="rounded-full"><CircleUserRound className="mr-1 h-3 w-3" /> Vorschau für Mara</Badge>
              ) : (
                <Badge variant="outline" className="rounded-full"><HeartPulse className="mr-1 h-3 w-3" /> DGE-Profil</Badge>
              )}
            </div>
          </div>

          <div className={cn("p-5 sm:p-7", clientPreview && "bg-gradient-to-b from-sky-50/70 to-background dark:from-sky-950/25") }>
            {clientPreview ? (
              <div className="mx-auto max-w-2xl">
                <div className="mb-6 rounded-[24px] bg-foreground p-6 text-background shadow-xl">
                  <p className="text-background/60 text-xs">Dein Tagesziel</p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight">Einfach, sättigend, vorbereitet.</p>
                      <p className="text-background/65 mt-2 text-sm">Vier Mahlzeiten, die in deinen Arbeitstag passen.</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400" />
                  </div>
                </div>
                <div className="relative space-y-3 before:absolute before:top-7 before:bottom-7 before:left-[19px] before:w-px before:bg-border">
                  {meals.map((meal) => (
                    <div key={meal.id} className="relative flex gap-4">
                      <span className={cn("relative z-10 mt-4 h-10 w-10 shrink-0 rounded-full border-4 border-background", meal.color)} />
                      <div className="flex-1 rounded-[20px] border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{meal.label}</p>
                            <p className="text-muted-foreground text-xs">{meal.time} Uhr</p>
                          </div>
                          <span className="text-muted-foreground text-xs">{meal.items.length} {meal.items.length === 1 ? "Baustein" : "Bausteine"}</span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {meal.items.map((item) => (
                            <p key={item.id} className="flex items-center gap-2 text-sm">
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              {item.name} <span className="text-muted-foreground text-xs">· {item.detail.split("·")[0]}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {meals.map((meal) => {
                  const active = meal.id === selectedMeal
                  return (
                    <div
                      key={meal.id}
                      className={cn(
                        "rounded-[22px] border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                        active ? "border-foreground/30 bg-muted/25 shadow-md" : "bg-card",
                      )}
                    >
                      <button type="button" onClick={() => onSelectMeal(meal.id)} className="w-full text-left">
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <span className={cn("h-3 w-3 rounded-full", meal.color)} />
                            <span>
                              <span className="block text-sm font-semibold">{meal.label}</span>
                              <span className="text-muted-foreground text-xs">{meal.time} Uhr</span>
                            </span>
                          </span>
                          <span className="text-xs font-semibold tabular-nums">{Math.round(meal.items.reduce((sum, item) => sum + item.kcal * item.portion, 0))} kcal</span>
                        </span>
                        <span className="mt-4 block space-y-2">
                          {meal.items.map((item) => (
                            <span key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium">{item.name}</span>
                                <span className="text-muted-foreground text-[10px]">{item.detail}</span>
                              </span>
                              <span className="text-muted-foreground shrink-0 text-[10px]">{item.source}</span>
                            </span>
                          ))}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAdd(meal.id)}
                        className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs font-medium hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" /> Gemeinsam ergänzen
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t bg-muted/25 px-5 py-4 sm:px-7">
            <NutrientBars totals={totals} />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Clock3 className="h-3.5 w-3.5" /> Nach Freigabe erhält Mara den Plan in der Klienten-App.
              </p>
              <Button className="rounded-full" onClick={onRelease}>
                {released ? <Check className="mr-1.5 h-4 w-4" /> : <Send className="mr-1.5 h-4 w-4" />}
                {released ? "An Mara übergeben" : "Plan freigeben"}
              </Button>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  )
}

function AddFoodDialog({
  open,
  meal,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  meal: Meal
  onOpenChange: (open: boolean) => void
  onAdd: (food: FoodItem) => void
}) {
  const [query, setQuery] = useState("")
  const items = LIBRARY_ITEMS.filter((item) =>
    item.name.toLocaleLowerCase("de-DE").includes(query.toLocaleLowerCase("de-DE")),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-[24px] p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Zu {meal.label} hinzufügen</DialogTitle>
          <DialogDescription>Portionen und Nährwerte stammen aus dem gemeinsamen Demo-Katalog.</DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Lebensmittel oder Rezept suchen"
              className="rounded-full pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[380px] overflow-y-auto px-3 pb-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAdd(item)}
              className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <Leaf className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">{item.detail} · {item.source}</span>
              </span>
              <span className="text-right">
                <span className="block text-xs font-semibold">{item.kcal} kcal</span>
                <span className="text-muted-foreground text-[10px]">{item.protein} g EW</span>
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border bg-background shadow-sm group-hover:bg-foreground group-hover:text-background">
                <Plus className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ApplePlanLab() {
  const [concept, setConcept] = useState<ConceptId>("focus")
  const [meals, setMeals] = useState<Meal[]>(INITIAL_MEALS)
  const [selectedMeal, setSelectedMeal] = useState<MealId>("lunch")
  const [activeDay, setActiveDay] = useState(2)
  const [addOpen, setAddOpen] = useState(false)
  const [released, setReleased] = useState(false)

  useAppBreadcrumb([
    { label: "Ernährungsplan", href: "/ernaehrungsplan" },
    { label: "Apple-Konzeptlabor" },
  ])

  const totals = useMemo(() => calculateTotals(meals), [meals])
  const activeConcept = CONCEPTS.find((item) => item.id === concept) ?? CONCEPTS[0]
  const activeMeal = meals.find((meal) => meal.id === selectedMeal) ?? meals[0]

  const changePortion = (mealId: MealId, itemId: string, delta: number) => {
    setReleased(false)
    setMeals((current) =>
      current.map((meal) =>
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              items: meal.items.map((item) =>
                item.id === itemId
                  ? { ...item, portion: Math.max(0.5, Math.min(3, item.portion + delta)) }
                  : item,
              ),
            },
      ),
    )
  }

  const removeFood = (mealId: MealId, itemId: string) => {
    setReleased(false)
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) } : meal,
      ),
    )
  }

  const openAdd = (mealId: MealId) => {
    setSelectedMeal(mealId)
    setAddOpen(true)
  }

  const addFood = (food: FoodItem) => {
    setReleased(false)
    setMeals((current) =>
      current.map((meal) =>
        meal.id === selectedMeal
          ? { ...meal, items: [...meal.items, { ...food, id: `${food.id}-${Date.now()}` }] }
          : meal,
      ),
    )
    setAddOpen(false)
  }

  const conceptProps: ConceptProps = {
    meals,
    totals,
    dayLabel: DAYS[activeDay].label,
    selectedMeal,
    onSelectMeal: setSelectedMeal,
    onChangePortion: changePortion,
    onRemove: removeFood,
    onOpenAdd: openAdd,
    released,
    onRelease: () => setReleased((current) => !current),
  }

  return (
    <div className="-m-4 min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#f5f5f7] text-zinc-950 md:-m-6 dark:bg-[#09090b] dark:text-zinc-50">
      <div className="border-b border-black/[0.06] bg-white/75 px-4 py-3 backdrop-blur-2xl sm:px-6 dark:border-white/[0.08] dark:bg-zinc-950/75">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-[-0.025em]">Ernährungsplan · Konzeptlabor</h1>
                <Badge variant="outline" className="rounded-full text-[9px] tracking-wide uppercase">Demo</Badge>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">Drei eigenständige Arbeitsmodelle · Änderungen bleiben nur in dieser Vorschau</p>
            </div>
            <div className="hidden h-8 w-px bg-border xl:block" />
            <PatientContext compact />
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <DayPicker activeDay={activeDay} onChange={setActiveDay} />
            <div className="flex min-w-0 rounded-full border border-black/5 bg-black/[0.04] p-1 dark:border-white/5 dark:bg-white/[0.055]" role="tablist" aria-label="Designvariante wählen">
              {CONCEPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={concept === item.id}
                  onClick={() => setConcept(item.id)}
                  className={cn(
                    "min-w-0 flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:flex-none sm:px-4",
                    concept === item.id
                      ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-black/[0.05] bg-white/45 px-4 py-2.5 sm:px-6 dark:border-white/[0.06] dark:bg-white/[0.025]">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-sky-600 uppercase dark:text-sky-400">{activeConcept.eyebrow}</span>
          <span className="h-3 w-px bg-border" />
          <p className="text-muted-foreground text-xs">{activeConcept.promise}</p>
          <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">Fiktiver Beispielsfall · {DAYS[activeDay].date}. August</span>
        </div>
      </div>

      {concept === "focus" ? <FocusConcept {...conceptProps} /> : null}
      {concept === "workbench" ? <WorkbenchConcept {...conceptProps} /> : null}
      {concept === "handoff" ? <HandoffConcept {...conceptProps} /> : null}

      <AddFoodDialog
        open={addOpen}
        meal={activeMeal}
        onOpenChange={setAddOpen}
        onAdd={addFood}
      />
    </div>
  )
}
