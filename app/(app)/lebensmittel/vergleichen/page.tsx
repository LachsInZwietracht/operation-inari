"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCustomFoods } from "@/hooks/use-custom-foods";
import { FOODS, BRANDED_FOODS } from "@/lib/mock-data";
import { scaleNutrients, getNutrientValue } from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import type { Food } from "@/lib/types";

const NUTRIENTS_TO_COMPARE = [
  { id: "energie", label: "Energie", unit: "kcal" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
  { id: "ballaststoffe", label: "Ballaststoffe", unit: "g" },
  { id: "natrium", label: "Natrium", unit: "mg" },
  { id: "kalium", label: "Kalium", unit: "mg" },
];

function scale(food: Food | undefined, amount: number) {
  if (!food) return [];
  return scaleNutrients(food.nutrients, food.baseAmount, amount);
}

export default function LebensmittelVergleichPage() {
  const { customFoods } = useCustomFoods();
  const foods = useMemo<Food[]>(() => [...FOODS, ...BRANDED_FOODS, ...customFoods], [customFoods]);
  const [leftId, setLeftId] = useState(() => foods[0]?.id ?? "");
  const [rightId, setRightId] = useState(() => foods[1]?.id ?? foods[0]?.id ?? "");
  const [portionLeft, setPortionLeft] = useState(100);
  const [portionRight, setPortionRight] = useState(100);

  const leftFood = foods.find((food) => food.id === leftId);
  const rightFood = foods.find((food) => food.id === rightId);

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
        {[{ side: "left", food: leftFood, setId: setLeftId, portion: portionLeft, setPortion: setPortionLeft }, { side: "right", food: rightFood, setId: setRightId, portion: portionRight, setPortion: setPortionRight }].map((slot) => (
          <Card key={slot.side}>
            <CardHeader>
              <CardTitle className="text-base">{slot.side === "left" ? "Vergleich 1" : "Vergleich 2"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={slot.food?.id ?? slot.side} onValueChange={slot.setId}>
                <SelectTrigger>
                  <SelectValue placeholder="Lebensmittel wählen" />
                </SelectTrigger>
                <SelectContent>
                  {foods.map((food) => (
                    <SelectItem key={food.id} value={food.id}>
                      {food.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Portion ({slot.portion} g)</span>
                  <span>{slot.food?.source ?? "–"}</span>
                </div>
                <Slider
                  value={[slot.portion]}
                  min={20}
                  max={400}
                  step={5}
                  onValueChange={(value) => slot.setPortion(value[0] ?? 100)}
                />
              </div>
              {slot.food && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Energie</p>
                  <p className="text-2xl font-semibold">
                    {formatNumber(getNutrientValue(scale(slot.food, slot.portion), "energie"), 0)} kcal
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nährstoffvergleich</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nährstoff</TableHead>
                <TableHead className="text-right">{leftFood?.name ?? "Lebensmittel 1"}</TableHead>
                <TableHead className="text-right">{rightFood?.name ?? "Lebensmittel 2"}</TableHead>
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
    </div>
  );
}
