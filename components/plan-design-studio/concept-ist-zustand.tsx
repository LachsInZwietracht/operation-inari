"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Lightbulb,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DEMO_DIET_LINES,
  DEMO_ITEMS,
  DEMO_ITEM_MAP,
  DEMO_PATIENT,
  DEMO_SLOT_LABELS,
  DEMO_SLOT_ORDER,
  DEMO_TEMPLATES,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  entryNutrients,
  fillSuggestions,
  type DayIndex,
  type DemoSlotType,
  type TargetReading,
} from "./demo-data"
import { DEMO_ADDITIVE_INFO, DEMO_PRINCIPLES } from "./demo-extras"
import { useDemoPlan } from "./use-demo-plan"

/**
 * Slide 4 — the planner as it is today.
 *
 * A faithful rebuild of the current Ernährungsplan screen on the same demo
 * catalogue the three Flow drafts use: same tabs, same three-column grid, same
 * table, same tool cards, same Tagesziele dock. It exists so the comparison is
 * a comparison — the drafts are not being judged against a memory of the old
 * screen but against the old screen itself, with identical data in it.
 *
 * Built from the app's own shadcn components on purpose; the system-font,
 * large-radius treatment of the other three slides is deliberately absent here.
 */

const NUTRIENT_COLUMNS = [
  { key: "kcal", label: "kcal" },
  { key: "protein", label: "Eiweiß" },
  { key: "carbs", label: "KH" },
  { key: "fat", label: "Fett" },
  { key: "fiber", label: "Ballast." },
] as const

const SLOT_ACCENTS: Record<DemoSlotType, string> = {
  fruehstueck: "border-l-emerald-500",
  snack_vormittag: "border-l-violet-500",
  mittagessen: "border-l-amber-500",
  snack_nachmittag: "border-l-sky-500",
  abendessen: "border-l-indigo-500",
}

export function ConceptIstZustand() {
  const plan = useDemoPlan(3)
  const [view, setView] = useState("day")
  const [libraryTab, setLibraryTab] = useState<"rezepte" | "lebensmittel" | "vorlagen">("rezepte")
  const [query, setQuery] = useState("")
  const [dietLineId, setDietLineId] = useState(DEMO_DIET_LINES[0].id)
  const [railOpen, setRailOpen] = useState(false)

  const kcalReading = plan.macroReadings[0]
  const suggestions = useMemo(() => fillSuggestions(plan.day), [plan.day])

  const libraryItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const pool =
      libraryTab === "rezepte"
        ? DEMO_ITEMS.filter((item) => item.kind === "recipe")
        : DEMO_ITEMS.filter((item) => item.kind === "food")
    if (!needle) return pool
    return pool.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle),
    )
  }, [libraryTab, query])

  return (
    <div className="space-y-6">
      {/* Page header with the patient select — unchanged from today. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Ernährungsplan</h2>
          <p className="text-muted-foreground text-sm">
            Planen Sie Mahlzeiten für einzelne Tage, Wochen oder Zyklen und vergleichen Sie die
            Nährstoffzufuhr mit Zielprofilen und DGE-Referenzwerten.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value="anna">
            <SelectTrigger aria-label="Patient" className="w-full min-w-0 sm:w-[260px]">
              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anna">Berger, Anna · Typ-2-Diabetes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            Zum Patienten
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="strategy">Strategie</TabsTrigger>
            <TabsTrigger value="day">Tag</TabsTrigger>
            <TabsTrigger value="week">Woche</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="strategy" className="mt-2">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ziel</CardTitle>
                <CardDescription>Wohin die Beratung führen soll.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium">{DEMO_PATIENT.goal}</p>
                <p>
                  Zielgewicht{" "}
                  <span className="font-medium">
                    {formatNumber(DEMO_PATIENT.targetWeight)} kg
                  </span>{" "}
                  · aktuell {formatNumber(DEMO_PATIENT.weight)} kg
                </p>
                <Badge variant="secondary">{DEMO_PATIENT.indication}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Zielwerte</CardTitle>
                <CardDescription>
                  Jeder Tag wird an diesen Zahlen gemessen. Sie hängen am Patienten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={kcalReading.goal}
                    className="w-28"
                    aria-label="Energie pro Tag"
                  />
                  <span className="text-muted-foreground text-sm">kcal</span>
                </div>
                <div className="text-muted-foreground text-sm">
                  −{formatNumber(DEMO_PATIENT.energyRequirement - kcalReading.goal)} kcal gegenüber
                  dem Erhaltungsbedarf von {formatNumber(DEMO_PATIENT.energyRequirement)} kcal
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {plan.macroReadings.slice(1).map((reading) => (
                    <div key={reading.target.key} className="rounded-md border p-2">
                      <p className="text-muted-foreground text-xs">{reading.target.label}</p>
                      <p className="font-mono text-sm font-semibold">
                        {formatNumber(reading.goal)} {reading.target.unit}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rahmen</CardTitle>
                <CardDescription>Was die Auswahl einschränkt.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Kostform <span className="font-medium">{DEMO_PATIENT.dietStyle}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_PATIENT.exclusions.map((entry) => (
                    <Badge key={entry} variant="secondary">
                      {entry}
                    </Badge>
                  ))}
                  {DEMO_PATIENT.allergens.map((entry) => (
                    <Badge
                      key={entry}
                      variant="outline"
                      className="border-red-300 bg-red-50 text-red-800"
                    >
                      {entry}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prinzipien</CardTitle>
                <CardDescription>Regeln, die ohne Plan im Kopf bleiben.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {DEMO_PRINCIPLES.map((principle) => (
                    <li key={principle.id} className="flex gap-2">
                      <span className="text-muted-foreground">·</span>
                      <span>
                        {principle.text}
                        <span className="text-muted-foreground block text-xs">
                          {principle.source}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Umsetzung</CardTitle>
                <CardDescription>
                  Der Tagesplan setzt die Zielwerte oben in Mahlzeiten um.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="font-medium">{WEEKDAY_LONG[plan.activeDay]}</p>
                  <p className="text-muted-foreground">
                    {formatNumber(Math.round(plan.totals.kcal))} kcal geplant · Ziel{" "}
                    {formatNumber(kcalReading.goal)} kcal
                  </p>
                </div>
                <Button variant="outline" onClick={() => setView("day")}>
                  Zum Tagesplan
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* The shared library grid — hidden on the strategy tab, as today. */}
        <div
          className={cn(
            "mt-2 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]",
            view === "strategy" && "hidden",
          )}
        >
          {/* Col 1: Bibliothek */}
          <Card className="hidden min-w-0 gap-0 py-0 md:flex md:flex-col">
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suchen …"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <Tabs
                value={libraryTab}
                onValueChange={(value) => setLibraryTab(value as typeof libraryTab)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="rezepte" className="text-xs">
                    Rezepte
                  </TabsTrigger>
                  <TabsTrigger value="lebensmittel" className="text-xs">
                    Zutaten
                  </TabsTrigger>
                  <TabsTrigger value="vorlagen" className="text-xs">
                    Vorlagen
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 md:max-h-[720px]">
              {libraryTab === "vorlagen"
                ? DEMO_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => plan.applyTemplate(template.id)}
                      className="hover:bg-accent/50 w-full rounded-md px-2 py-2 text-left text-sm"
                    >
                      <span className="block truncate font-medium">{template.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {template.indication}
                      </span>
                    </button>
                  ))
                : libraryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => plan.addItem("snack_nachmittag", item.id)}
                      className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.category}
                        </span>
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {formatNumber(Math.round((item.nutrients.kcal * item.step) / item.base))}
                      </span>
                    </button>
                  ))}
            </div>
          </Card>

          {/* Col 2: der Planer */}
          <div className="min-w-0">
            <TabsContent value="day" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b py-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => plan.setActiveDay(((plan.activeDay + 6) % 7) as DayIndex)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="min-w-[180px] justify-start gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {WEEKDAY_LONG[plan.activeDay]}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => plan.setActiveDay(((plan.activeDay + 1) % 7) as DayIndex)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setView("strategy")}
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                >
                  Strategie: {formatNumber(kcalReading.goal)} kcal · heute{" "}
                  {formatNumber(Math.round(plan.totals.kcal))} kcal
                </button>

                {plan.conflicts.length > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {plan.conflicts.length} Allergenkonflikte
                  </Badge>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm">
                    <Download className="mr-1.5 h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm">Freigeben</Button>
                </div>
              </div>

              {plan.conflicts.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Allergenkonflikte im Plan
                  </p>
                  <p className="mt-1">
                    {plan.conflicts
                      .map((conflict) => `${conflict.item.name} (${conflict.allergens.join(", ")})`)
                      .join(" · ")}
                  </p>
                </div>
              )}

              {/* Day strip + table */}
              <div className="flex flex-wrap items-center gap-1.5">
                {plan.weekKcal.map((entry) => (
                  <button
                    key={entry.index}
                    type="button"
                    onClick={() => plan.setActiveDay(entry.index)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-center text-xs",
                      entry.index === plan.activeDay ? "border-primary bg-primary/5" : "bg-card",
                    )}
                  >
                    <span className="block font-medium">{WEEKDAY_SHORT[entry.index]}</span>
                    <span className="text-muted-foreground block font-mono">
                      {entry.entries === 0 ? "–" : formatNumber(Math.round(entry.kcal))}
                    </span>
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    plan.duplicateDay(plan.activeDay, ((plan.activeDay + 1) % 7) as DayIndex)
                  }
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Tag duplizieren
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-[11px] tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Mahlzeit / Lebensmittel</th>
                      <th className="px-3 py-2 text-right font-semibold">Menge</th>
                      {NUTRIENT_COLUMNS.map((column) => (
                        <th key={column.key} className="px-3 py-2 text-right font-semibold">
                          {column.label}
                        </th>
                      ))}
                      <th className="w-16 px-2 py-2" />
                    </tr>
                  </thead>
                  {DEMO_SLOT_ORDER.map((slot) => {
                    const totals = plan.slotTotals.get(slot)
                    return (
                      <tbody key={slot} className="border-b last:border-b-0">
                        <tr className={cn("bg-muted/40 border-l-2", SLOT_ACCENTS[slot])}>
                          <td className="px-3 py-3 font-semibold">{DEMO_SLOT_LABELS[slot]}</td>
                          <td />
                          {NUTRIENT_COLUMNS.map((column) => (
                            <td
                              key={column.key}
                              className="px-3 py-3 text-right font-mono text-xs font-semibold"
                            >
                              {formatNumber(Math.round(totals?.[column.key] ?? 0))}
                            </td>
                          ))}
                          <td />
                        </tr>
                        {plan.day[slot].map((entry) => {
                          const item = DEMO_ITEM_MAP.get(entry.itemId)
                          if (!item) return null
                          const values = entryNutrients(entry)
                          const conflict = item.allergens?.some((allergen) =>
                            DEMO_PATIENT.allergens.includes(allergen),
                          )
                          return (
                            <tr key={entry.id} className="hover:bg-accent/40 border-t border-dashed">
                              <td className="px-3 py-2.5">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate">{item.name}</span>
                                  {conflict && (
                                    <AlertTriangle className="h-3.5 w-3.5 flex-none text-amber-600" />
                                  )}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="inline-flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    value={entry.amount}
                                    onChange={(event) =>
                                      plan.setAmount(slot, entry.id, Number(event.target.value) || 1)
                                    }
                                    className="h-7 w-20 text-right"
                                  />
                                  <span className="text-muted-foreground text-xs">
                                    {item.unit === "g" ? "g" : "Prt."}
                                  </span>
                                </span>
                              </td>
                              {NUTRIENT_COLUMNS.map((column) => (
                                <td
                                  key={column.key}
                                  className="px-3 py-2.5 text-right font-mono text-xs"
                                >
                                  {formatNumber(Math.round(values[column.key]))}
                                </td>
                              ))}
                              <td className="px-2 py-2.5">
                                <div className="flex justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <ArrowLeftRight className="h-3.5 w-3.5" />
                                    <span className="sr-only">Austauschen</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => plan.removeEntry(slot, entry.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">Entfernen</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    )
                  })}
                </table>
              </div>
            </TabsContent>

            <TabsContent value="week" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {plan.weekKcal.map((entry) => (
                  <Card key={entry.index} className="gap-2 py-4">
                    <CardHeader className="px-4">
                      <CardTitle className="flex items-center justify-between text-sm">
                        {WEEKDAY_LONG[entry.index]}
                        <span className="text-muted-foreground font-mono text-xs">
                          {formatNumber(Math.round(entry.kcal))} kcal
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-4 text-xs">
                      {DEMO_SLOT_ORDER.map((slot) => (
                        <div key={slot} className="flex justify-between gap-2">
                          <span className="text-muted-foreground truncate">
                            {DEMO_SLOT_LABELS[slot]}
                          </span>
                          <span className="font-mono">{plan.week[entry.index][slot].length}</span>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => {
                          plan.setActiveDay(entry.index)
                          setView("day")
                        }}
                      >
                        Öffnen
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </div>

          {/* Tools row — identical in day and week view, as today. */}
          <div className="space-y-4 xl:col-span-2">
            <div className="flex items-center gap-3">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Tools
              </h3>
              <div className="bg-border h-px flex-1" />
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    Lücken schließen
                  </CardTitle>
                  <CardDescription>
                    Vorschläge, die offene Zielwerte ohne Energieüberschuss schließen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {suggestions.length === 0 && (
                    <p className="text-muted-foreground text-sm">Alle Zielwerte sind gedeckt.</p>
                  )}
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.item.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{suggestion.item.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          + {formatNumber(suggestion.gain, 1)} {suggestion.unit}{" "}
                          {suggestion.closes} · {formatNumber(suggestion.kcal)} kcal
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          plan.addItem(suggestion.slot, suggestion.item.id, suggestion.amount)
                        }
                      >
                        Einsetzen
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ArrowLeftRight className="h-4 w-4" />
                    Austauschtabelle
                  </CardTitle>
                  <CardDescription>
                    Vergleichbare Lebensmittel mit gleichem Nährwertprofil finden.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">
                    Austausch öffnen
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4" />
                    Nährstofflücke
                  </CardTitle>
                  <CardDescription>
                    Nährstoff und Fehlmenge eingeben, passende Portionen erhalten.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {plan.microReadings
                    .filter((reading) => reading.status === "low")
                    .slice(0, 3)
                    .map((reading) => (
                      <div
                        key={reading.target.key}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>{reading.target.label}</span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {formatNumber(Math.round(reading.remaining))} {reading.target.unit} offen
                        </span>
                      </div>
                    ))}
                  <Button variant="outline" size="sm" className="mt-1">
                    Lücke schließen
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Zusatzstoffe
                  </CardTitle>
                  <CardDescription>
                    {plan.additives.length > 0
                      ? plan.additives.join(" · ")
                      : "Keine deklarationspflichtigen Zusatzstoffe"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {plan.additives.map((code) => (
                    <p key={code} className="text-muted-foreground text-xs">
                      {code} · {DEMO_ADDITIVE_INFO[code]?.note ?? "keine Bewertung"}
                    </p>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sticky Tagesziele dock. */}
          <div className="sticky bottom-0 z-40 hidden md:block xl:col-span-2">
            <div className="bg-background/95 rounded-t-lg border shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="text-sm font-semibold">Tagesziele</span>
                <Select value={dietLineId} onValueChange={setDietLineId}>
                  <SelectTrigger size="sm" className="bg-muted/40 h-7 w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_DIET_LINES.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Zielprofil verwalten</span>
                </Button>

                <div className="ml-auto flex flex-wrap items-center gap-3">
                  {plan.macroReadings.map((reading) => (
                    <NutrientCell key={reading.target.key} reading={reading} />
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setRailOpen((open) => !open)}>
                    <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                    {railOpen ? "Weniger" : "Mikronährstoffe"}
                  </Button>
                </div>
              </div>

              {railOpen && (
                <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
                  {plan.microReadings.map((reading) => (
                    <NutrientCell key={reading.target.key} reading={reading} stacked />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

function NutrientCell({ reading, stacked }: { reading: TargetReading; stacked?: boolean }) {
  const tone =
    reading.status === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : reading.status === "high"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground"

  return (
    <div className={cn("min-w-0", stacked ? "space-y-1" : "flex items-baseline gap-1.5")}>
      <span className="text-muted-foreground text-xs">{reading.target.short}</span>
      <span className={cn("font-mono text-xs font-semibold", tone)}>
        {formatNumber(Math.round(reading.value))}
        <span className="text-muted-foreground font-normal">
          {" / "}
          {formatNumber(reading.goal)}
        </span>
      </span>
      {stacked && (
        <div className="bg-muted h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full",
              reading.status === "ok"
                ? "bg-emerald-500"
                : reading.status === "high"
                  ? "bg-amber-500"
                  : "bg-muted-foreground/40",
            )}
            style={{ width: `${Math.min(100, reading.ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
