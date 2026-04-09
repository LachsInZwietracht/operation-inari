"use client"

import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
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
import { Badge } from "@/components/ui/badge"
import { useFoodSearch } from "@/hooks/use-food-search"
import { FOODS, FOOD_CATEGORIES } from "@/lib/mock-data"
import { getNutrientValue } from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"

const categoryMap = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.name]))

export default function LebensmittelPage() {
  const router = useRouter()
  const {
    filteredFoods,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
  } = useFoodSearch(FOODS)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lebensmittel"
        description="Durchsuchen Sie die Lebensmitteldatenbank"
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Lebensmittel suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={selectedCategoryId ?? "all"}
          onValueChange={(value) =>
            setSelectedCategoryId(value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {FOOD_CATEGORIES.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-muted-foreground text-sm">
        {filteredFoods.length} Lebensmittel gefunden
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Energie (kcal)</TableHead>
              <TableHead className="text-right">Eiweiß (g)</TableHead>
              <TableHead className="text-right">Fett (g)</TableHead>
              <TableHead className="text-right">KH (g)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFoods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Keine Lebensmittel gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filteredFoods.map((food) => (
                <TableRow
                  key={food.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/lebensmittel/${food.id}`)}
                >
                  <TableCell className="font-medium">{food.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {categoryMap.get(food.categoryId) ?? food.categoryId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(getNutrientValue(food.nutrients, "energie"))}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
