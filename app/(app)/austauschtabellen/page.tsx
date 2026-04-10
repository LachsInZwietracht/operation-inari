"use client"

import { useState, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FOODS, FOOD_CATEGORIES, NUTRIENT_DEFINITIONS } from "@/lib/mock-data"
import { getNutrientValue } from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"
import { Search, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

type SortDir = "asc" | "desc"

export default function AustauschtabellenPage() {
  const [selectedNutrient, setSelectedNutrient] = useState("energie")
  const [categoryFilter, setCategoryFilter] = useState<string>("alle")
  const [search, setSearch] = useState("")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const nutrientDef = NUTRIENT_DEFINITIONS.find((d) => d.id === selectedNutrient)

  const filtered = useMemo(() => {
    return FOODS.filter((food) => {
      const matchesSearch = !search || food.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === "alle" || food.categoryId === categoryFilter
      return matchesSearch && matchesCategory
    }).sort((a, b) => {
      const aVal = getNutrientValue(a.nutrients, selectedNutrient)
      const bVal = getNutrientValue(b.nutrients, selectedNutrient)
      return sortDir === "desc" ? bVal - aVal : aVal - bVal
    })
  }, [search, categoryFilter, selectedNutrient, sortDir])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Austauschtabellen"
        description="Lebensmittel nach Nährstoffgehalt vergleichen und austauschen"
        helpText="Finden Sie Lebensmittel mit ähnlichem Nährstoffprofil als Austauschoptionen. Ideal für die Beratung bei Allergien, Unverträglichkeiten oder persönlichen Vorlieben Ihrer Patienten."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Lebensmittel suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Nährstoff wählen" />
          </SelectTrigger>
          <SelectContent>
            {NUTRIENT_DEFINITIONS.map((def) => (
              <SelectItem key={def.id} value={def.id}>
                {def.name} ({def.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kategorien</SelectItem>
            {FOOD_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} Lebensmittel – sortiert nach {nutrientDef?.name ?? selectedNutrient}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lebensmittel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mr-3 h-auto p-1"
                    onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  >
                    {nutrientDef?.name ?? "Nährstoff"} ({nutrientDef?.unit ?? ""})
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Energie (kcal)</TableHead>
                <TableHead className="text-right">Eiweiß (g)</TableHead>
                <TableHead className="text-right">Fett (g)</TableHead>
                <TableHead className="text-right">KH (g)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((food) => {
                const category = FOOD_CATEGORIES.find((c) => c.id === food.categoryId)
                const nutrientVal = getNutrientValue(food.nutrients, selectedNutrient)
                return (
                  <TableRow key={food.id}>
                    <TableCell className="font-medium">{food.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {category?.name ?? "–"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(nutrientVal, 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientValue(food.nutrients, "energie"), 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientValue(food.nutrients, "eiweiss"), 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientValue(food.nutrients, "fett"), 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getNutrientValue(food.nutrients, "kohlenhydrate"), 1)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
