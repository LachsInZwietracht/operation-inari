"use client"

import { useMemo, useState } from "react"
import { Search, BookOpenCheck, ArrowUpRight, Leaf } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { KNOWLEDGE_LIBRARY_DEFAULTS } from "@/lib/content/knowledge-library"
import { evaluatePlanSustainability } from "@/lib/sustainability"
import { formatNumber } from "@/lib/format"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { DailyMealPlan, Recipe } from "@/lib/types"
import { useFoods } from "@/components/foods-provider"

const knowledgeCategories = Array.from(new Set(KNOWLEDGE_LIBRARY_DEFAULTS.map((card) => card.category)))

interface WissenPageClientProps {
  recipes: Recipe[]
  mealPlans: DailyMealPlan[]
}

export function WissenPageClient({ recipes, mealPlans }: WissenPageClientProps) {
  const foods = useFoods()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")

  const filteredCards = useMemo(() => {
    return KNOWLEDGE_LIBRARY_DEFAULTS.filter((card) => {
      const matchesCategory = category === "all" || card.category === category
      if (!matchesCategory) return false
      if (!query) return true
      const haystack = `${card.title} ${card.summary} ${card.tags.join(" ")}`.toLowerCase()
      return haystack.includes(query.toLowerCase())
    })
  }, [query, category])

  const samplePlan = mealPlans[0]
  const sustainability = useMemo(() => {
    if (!samplePlan) return null
    return evaluatePlanSustainability(samplePlan, foods, recipes)
  }, [foods, recipes, samplePlan])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wissensbibliothek"
        description="Bundled Fachkarten plus live berechnete Kennzahlen aus Ihren Daten"
        helpText="Die Fachkarten in dieser Ansicht sind aktuell gebuendelte Produktinhalte. Nachhaltigkeitskarten werden live aus Lebensmitteln, Rezepten und gespeicherten Plaenen berechnet."
      />

      <div className="grid gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Thema, Stichwort oder ICD suchen"
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full lg:w-[220px]">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {knowledgeCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenCheck className="h-5 w-5 text-muted-foreground" />
                Fachkarten & Ressourcen
              </CardTitle>
              <Badge variant="secondary">Bundled Defaults</Badge>
            </div>
            <CardDescription>
              Strukturierte Wissenskarten fuer Beratung, Therapie und interne SOPs. Diese Inhalte werden derzeit nicht
              ueber ein CMS oder eine Datenbank gepflegt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCards.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                Keine Einträge gefunden. Passen Sie Ihre Suche an.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCards.map((card) => (
                  <Card key={card.id} className="border-l-4 border-l-primary/80">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{card.title}</CardTitle>
                          <CardDescription>{card.category}</CardDescription>
                        </div>
                        <Badge variant="outline">{card.tags[0]}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <p className="text-muted-foreground line-clamp-3">{card.summary}</p>
                        <div className="flex flex-wrap gap-1">
                          {card.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[11px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Gebuendelte Referenzkarte
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Leaf className="text-emerald-500 h-5 w-5" /> Nachhaltigkeits-KPIs
              </CardTitle>
              <Badge>Live-Analyse</Badge>
            </div>
            <CardDescription>Aus dem letzten synchronisierten Tagesplan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sustainability ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs uppercase text-muted-foreground">Gesamt-Fußabdruck</p>
                  <p className="text-2xl font-semibold">
                    {formatNumber(sustainability.totalCo2, 2)} kg CO₂e
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {samplePlan ? samplePlan.date : "Aktuell"}
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pflanzlich</span>
                    <span>{formatNumber(sustainability.plantShare * 100, 0)}%</span>
                  </div>
                  <Progress value={sustainability.plantShare * 100} />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tierisch</span>
                    <span>{formatNumber(sustainability.animalShare * 100, 0)}%</span>
                  </div>
                  <Progress value={sustainability.animalShare * 100} className="bg-orange-100" />
                </div>
                <div className="space-y-2">
                  {sustainability.perSlot.map((slot) => (
                    <div key={slot.slot} className="flex items-center justify-between text-xs">
                      <span>{MEAL_SLOT_LABELS[slot.slot] ?? slot.slot}</span>
                      <span className="font-medium">
                        {formatNumber(slot.value, 2)} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Messwerte vorhanden.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live-Uebersicht</CardTitle>
          <CardDescription>Zusammenfassung der aktuell geladenen Lebensmittel-, Rezept- und Planbasis.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          {[
            {
              id: "foods",
              label: "Geladene Lebensmittel",
              value: formatNumber(foods.length),
              helper: "Aktuelle Runtime-Basis fuer Suche und Analysen",
            },
            {
              id: "recipes",
              label: "Rezepte",
              value: formatNumber(recipes.length),
              helper: "Supabase plus vorhandene Fallback-Daten",
            },
            {
              id: "plans",
              label: "Ernaehrungsplaene",
              value: formatNumber(mealPlans.length),
              helper: "Fuer Analyse und Berichtsauswahl verfuegbar",
            },
            {
              id: "co2",
              label: "Letzter CO2-Fussabdruck",
              value: sustainability ? `${formatNumber(sustainability.totalCo2, 2)} kg` : "–",
              helper: sustainability ? "Abgeleitet aus dem letzten geladenen Tagesplan" : "Kein analysierbarer Plan vorhanden",
            },
          ].map((metric) => (
            <div key={metric.id} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase">{metric.label}</p>
              <p className="text-2xl font-semibold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.helper}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
