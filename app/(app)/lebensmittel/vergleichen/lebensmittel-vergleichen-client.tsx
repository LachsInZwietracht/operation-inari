"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Food } from "@/lib/types";
import { scaleNutrients, getNutrientValue } from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import { searchFoodsInBrowser } from "@/lib/food-browser-search";

interface LebensmittelVergleichPageClientProps {
  brandedFoods: Food[];
}

const NUTRIENTS_TO_COMPARE = [
  { id: "energie", label: "Energie", unit: "kcal" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
  { id: "ballaststoffe", label: "Ballaststoffe", unit: "g" },
  { id: "natrium", label: "Natrium", unit: "mg" },
  { id: "kalium", label: "Kalium", unit: "mg" },
];

function scale(food: Food | null, amount: number) {
  if (!food) return [];
  return scaleNutrients(food.nutrients, food.baseAmount, amount);
}

function ComparisonFoodPicker({
  label,
  food,
  onSelect,
  brandedFoods,
}: {
  label: string;
  food: Food | null;
  onSelect: (food: Food) => void;
  brandedFoods: Food[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    // Check branded foods first for local matches
    const lowerQuery = query.toLowerCase();
    const localMatches = brandedFoods.filter((f) =>
      f.name.toLowerCase().includes(lowerQuery),
    ).slice(0, 3);

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      void (async () => {
        try {
          const result = await searchFoodsInBrowser(query, {
            signal: controller.signal,
            pageSize: 20,
          });

          // Merge server results with local branded matches (deduplicated)
          const merged = new Map<string, Food>();
          for (const f of [...localMatches, ...result.foods]) {
            merged.set(f.id, f);
          }
          setResults(Array.from(merged.values()));
        } catch {
          if (!controller.signal.aborted) {
            setResults(localMatches);
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, brandedFoods]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="sr-only">{label} suchen</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Lebensmittel suchen"
              className="pl-9"
            />
          </div>
        </div>

        {query.trim().length >= 2 ? (
          <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
            {isSearching ? (
              <div className="p-3 text-sm text-muted-foreground">Suche laeuft...</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Keine Treffer gefunden.</div>
            ) : (
              results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onSelect(f);
                    setQuery("");
                    setResults([]);
                  }}
                >
                  <span className="font-medium">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.sourceId?.toUpperCase()}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        {food ? (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{food.name}</p>
              <p className="text-xs text-muted-foreground">{food.source ?? food.sourceId?.toUpperCase() ?? "–"}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Energie</p>
              <p className="text-2xl font-semibold">
                {formatNumber(getNutrientValue(food.nutrients, "energie"), 0)} kcal
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Lebensmittel suchen und auswaehlen
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LebensmittelVergleichPageClient({ brandedFoods }: LebensmittelVergleichPageClientProps) {
  const [leftFood, setLeftFood] = useState<Food | null>(null);
  const [rightFood, setRightFood] = useState<Food | null>(null);
  const [portionLeft, setPortionLeft] = useState(100);
  const [portionRight, setPortionRight] = useState(100);

  const scaledLeft = useMemo(() => scale(leftFood, portionLeft), [leftFood, portionLeft]);
  const scaledRight = useMemo(() => scale(rightFood, portionRight), [rightFood, portionRight]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lebensmittel vergleichen"
        description="Zwei Produkte nebeneinander vergleichen und Portionen anpassen"
        helpText="Stellen Sie zwei Lebensmittel direkt gegenüber und vergleichen Sie deren Nährstoffprofile. Passen Sie die Portionsgrößen an, um realistische Mengen zu vergleichen."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ComparisonFoodPicker
          label="Vergleich 1"
          food={leftFood}
          onSelect={setLeftFood}
          brandedFoods={brandedFoods}
        />
        <ComparisonFoodPicker
          label="Vergleich 2"
          food={rightFood}
          onSelect={setRightFood}
          brandedFoods={brandedFoods}
        />
      </div>

      {leftFood || rightFood ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { food: leftFood, portion: portionLeft, setPortion: setPortionLeft, label: "Vergleich 1" },
            { food: rightFood, portion: portionRight, setPortion: setPortionRight, label: "Vergleich 2" },
          ].map((slot) =>
            slot.food ? (
              <Card key={slot.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Portion ({slot.portion} g)</span>
                    <span>{slot.food.name}</span>
                  </div>
                  <Slider
                    value={[slot.portion]}
                    min={20}
                    max={400}
                    step={5}
                    onValueChange={(value) => slot.setPortion(value[0] ?? 100)}
                  />
                </CardContent>
              </Card>
            ) : null,
          )}
        </div>
      ) : null}

      {leftFood && rightFood ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Naehrstoffvergleich</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naehrstoff</TableHead>
                  <TableHead className="text-right">{leftFood.name}</TableHead>
                  <TableHead className="text-right">{rightFood.name}</TableHead>
                  <TableHead className="text-right">Differenz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {NUTRIENTS_TO_COMPARE.map((nutrient) => {
                  const leftValue = getNutrientValue(scaledLeft, nutrient.id);
                  const rightValue = getNutrientValue(scaledRight, nutrient.id);
                  const diff = leftValue - rightValue;
                  return (
                    <TableRow key={nutrient.id}>
                      <TableCell className="font-medium">{nutrient.label}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(leftValue, nutrient.id === "energie" ? 0 : 1)} {nutrient.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(rightValue, nutrient.id === "energie" ? 0 : 1)} {nutrient.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={diff >= 0 ? "secondary" : "outline"}>
                          {diff >= 0 ? "+" : ""}
                          {formatNumber(diff, 1)} {nutrient.unit}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
