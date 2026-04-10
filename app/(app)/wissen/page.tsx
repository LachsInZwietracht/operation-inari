"use client"

import { useMemo, useState } from "react"
import { Search, BookOpenCheck, Award, ArrowUpRight, Leaf } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  KNOWLEDGE_CARDS,
  SUSTAINABILITY_METRICS,
  RECIPES,
  MEAL_PLANS,
  FOODS,
  FOOD_CATEGORIES,
} from "@/lib/mock-data"
import { calculateRecipeNutrients, calculatePerServing, scaleNutrients, sumNutrients } from "@/lib/nutrients"
import { calculateProdScore } from "@/lib/prodi-score"
import { evaluatePlanSustainability } from "@/lib/sustainability"
import { formatNumber } from "@/lib/format"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { DailyMealPlan, MealEntry, NutrientValue } from "@/lib/types"

const knowledgeCategories = Array.from(new Set(KNOWLEDGE_CARDS.map((card) => card.category)))
const categoryMap = new Map(FOOD_CATEGORIES.map((category) => [category.id, category.name]))

function nutrientsForEntry(entry: MealEntry): NutrientValue[] {
  if (entry.type === "food") {
    const food = FOODS.find((f) => f.id === entry.referenceId)
    if (!food) return []
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
  }
  const recipe = RECIPES.find((r) => r.id === entry.referenceId)
  if (!recipe) return []
  const total = calculateRecipeNutrients(recipe, FOODS)
  const perServing = calculatePerServing(total, recipe.servings)
  return scaleNutrients(perServing, 1, entry.amount)
}

function aggregatePlanNutrients(plan: DailyMealPlan): NutrientValue[] {
  return sumNutrients(plan.slots.flatMap((slot) => slot.entries.map(nutrientsForEntry)))
}

export default function WissenPage() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")

  const filteredCards = useMemo(() => {
    return KNOWLEDGE_CARDS.filter((card) => {
      const matchesCategory = category === "all" || card.category === category
      if (!matchesCategory) return false
      if (!query) return true
      const haystack = `${card.title} ${card.summary} ${card.tags.join(" ")}`.toLowerCase()
      return haystack.includes(query.toLowerCase())
    })
  }, [query, category])

  const referenceRecipe = RECIPES[0]
  const recipeScore = useMemo(() => {
    if (!referenceRecipe) return null
    const nutrients = calculatePerServing(
      calculateRecipeNutrients(referenceRecipe, FOODS),
      referenceRecipe.servings,
    )
    return calculateProdScore(nutrients)
  }, [referenceRecipe])

  const samplePlan = MEAL_PLANS[0]
  const planScore = useMemo(() => {
    if (!samplePlan) return null
    const nutrients = aggregatePlanNutrients(samplePlan)
    return calculateProdScore(nutrients)
  }, [samplePlan])

  const sustainability = useMemo(() => {
    if (!samplePlan) return null
    return evaluatePlanSustainability(samplePlan, FOODS, RECIPES)
  }, [samplePlan])

  const topFoods = useMemo(() => {
    return FOODS.slice(0, 4).map((food) => ({
      id: food.id,
      name: food.name,
      categoryId: food.categoryId,
      score: calculateProdScore(food.nutrients).score,
    }))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wissensbibliothek"
        description="Lexikon, Qualitätskennzahlen und Nachhaltigkeit an einem Ort"
      >
        <Button variant="outline" size="sm">
          <BookOpenCheck className="mr-2 h-4 w-4" />
          Neue Notiz
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
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
            <CardTitle className="text-base">Lexikon & Ressourcen</CardTitle>
            <CardDescription>
              Strukturierte Wissenskarten für Beratung, Therapie und interne SOPs.
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
                      <Button size="sm" variant="ghost" className="px-0 text-primary">
                        Karte öffnen <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="text-primary h-5 w-5" /> PRODIscore Monitor
            </CardTitle>
            <CardDescription>Lebensmittel- und Rezeptqualität im Überblick.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipeScore && (
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">Referenzrezept</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold">{formatNumber(recipeScore.score, 0)}</span>
                  <Badge className={`${recipeScore.badge.color} border-none px-2 py-0.5 text-xs font-bold`}>
                    {recipeScore.badge.label}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{recipeScore.summary}</p>
              </div>
            )}
            {planScore && (
              <div className="rounded-md bg-muted/60 p-3 text-sm">
                <p className="text-xs uppercase text-muted-foreground">Aktueller Tagesplan</p>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold">{formatNumber(planScore.score, 0)}</span>
                  <span className="text-muted-foreground text-xs">Ø Score</span>
                </div>
                <Progress value={planScore.score} className="mt-2" />
              </div>
            )}
            <div className="space-y-2">
              {topFoods.map((food) => (
                <div key={food.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{food.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {categoryMap.get(food.categoryId) ?? food.categoryId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20">
                      <Progress value={food.score} />
                    </div>
                    <span className="text-sm font-semibold">{formatNumber(food.score, 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Treiber des PRODIscore</CardTitle>
            <CardDescription>Positive und kritische Faktoren für das Referenzrezept.</CardDescription>
          </CardHeader>
          <CardContent>
            {recipeScore ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs uppercase text-muted-foreground">Stärken</p>
                  {recipeScore.drivers
                    .filter((driver) => driver.impact > 0)
                    .sort((a, b) => b.impact - a.impact)
                    .slice(0, 3)
                    .map((driver) => (
                      <div key={driver.id} className="rounded-md bg-emerald-50/70 p-3">
                        <p className="text-sm font-medium">{driver.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {driver.description}
                        </p>
                        <Progress value={Math.min(100, (driver.impact / 22) * 100)} className="mt-2" />
                      </div>
                    ))}
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase text-muted-foreground">Risiken</p>
                  {recipeScore.drivers
                    .filter((driver) => driver.impact < 0)
                    .sort((a, b) => a.impact - b.impact)
                    .slice(0, 3)
                    .map((driver) => (
                      <div key={driver.id} className="rounded-md bg-red-50 p-3">
                        <p className="text-sm font-medium">{driver.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {driver.description}
                        </p>
                        <Progress value={Math.min(100, Math.abs((driver.impact / 22) * 100))} className="mt-2" />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Auswertung vorhanden.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="text-emerald-500 h-5 w-5" /> Nachhaltigkeits-KPIs
            </CardTitle>
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
          <CardTitle>CO₂-Dashboard</CardTitle>
          <CardDescription>Aggregierte Kennzahlen aus Wissenskarten & Speiseplänen.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          {SUSTAINABILITY_METRICS.map((metric) => (
            <div key={metric.id} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase">{metric.label}</p>
              <p className="text-2xl font-semibold">
                {formatNumber(metric.value, metric.unit === "%" ? 0 : 2)} {metric.unit}
              </p>
              <p className="text-xs text-emerald-600">
                {metric.change >= 0 ? "+" : ""}
                {metric.change}% vs. Vormonat
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
