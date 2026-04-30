"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { GitCompareArrows, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NUTRIENT_GROUP_LABELS } from "@/lib/constants";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import type { Food, FoodBrowserResult, NutrientGroup, NutrientValue } from "@/lib/types";

function formatFoodMeta(food: Food) {
  return [food.blsCode, food.sourceId?.toUpperCase(), food.sourceVersion ? `v${food.sourceVersion}` : null]
    .filter(Boolean)
    .join(" · ");
}

function DiffFoodPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Food | null;
  onChange: (food: Food) => void;
}) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) {
      setFoods([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const params = new URLSearchParams({
          q: query,
          mode: "name",
          page: "1",
          pageSize: "6",
        });

        try {
          const response = await fetch(`/api/foods/browser?${params.toString()}`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error("Suche fehlgeschlagen");
          const result = (await response.json()) as FoodBrowserResult;
          setFoods(result.foods);
        } catch (error) {
          if (!controller.signal.aborted) {
            console.warn("Diff food lookup failed:", error);
            setFoods([]);
          }
        }
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Lebensmittel suchen"
          className="pl-9"
        />
      </div>
      {value ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="font-medium">{value.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{formatFoodMeta(value) || value.id}</div>
        </div>
      ) : null}
      <div className="min-h-[132px] rounded-md border">
        {query.trim().length < 2 ? (
          <div className="p-3 text-sm text-muted-foreground">Mindestens zwei Zeichen eingeben.</div>
        ) : isPending ? (
          <div className="p-3 text-sm text-muted-foreground">Suche laeuft...</div>
        ) : foods.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">Keine Treffer gefunden.</div>
        ) : (
          <div className="divide-y">
            {foods.map((food) => (
              <button
                key={food.id}
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onChange(food)}
              >
                <span>
                  <span className="block font-medium">{food.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatFoodMeta(food) || food.id}</span>
                </span>
                {value?.id === food.id ? <Badge variant="secondary">Ausgewaehlt</Badge> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getNutrientAmount(nutrients: NutrientValue[], nutrientId: string): number | null {
  const match = nutrients.find((n) => n.nutrientId === nutrientId);
  return match ? match.amount : null;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "k.A.";
  if (value === 0) return `0 ${unit}`;
  if (value < 0.01) return `< 0,01 ${unit}`;
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${unit}`;
}

function deltaPercent(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  if (a === 0 && b === 0) return 0;
  if (a === 0) return 100;
  return ((b - a) / Math.abs(a)) * 100;
}

interface DiffRow {
  nutrientId: string;
  name: string;
  unit: string;
  group: NutrientGroup;
  sortOrder: number;
  valueA: number | null;
  valueB: number | null;
  delta: number | null;
  deltaPercent: number | null;
}

export function NutrientDiffCard() {
  const [foodA, setFoodA] = useState<Food | null>(null);
  const [foodB, setFoodB] = useState<Food | null>(null);

  const diffRows = useMemo<DiffRow[]>(() => {
    if (!foodA || !foodB) return [];

    return NUTRIENT_DEFINITIONS.map((def) => {
      const valA = getNutrientAmount(foodA.nutrients, def.id);
      const valB = getNutrientAmount(foodB.nutrients, def.id);
      return {
        nutrientId: def.id,
        name: def.name,
        unit: def.unit,
        group: def.group,
        sortOrder: def.sortOrder,
        valueA: valA,
        valueB: valB,
        delta: valA !== null && valB !== null ? valB - valA : null,
        deltaPercent: deltaPercent(valA, valB),
      };
    })
      .filter((row) => row.valueA !== null || row.valueB !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [foodA, foodB]);

  const groupedRows = useMemo(() => {
    const groups = new Map<NutrientGroup, DiffRow[]>();
    for (const row of diffRows) {
      const existing = groups.get(row.group) ?? [];
      existing.push(row);
      groups.set(row.group, existing);
    }
    return groups;
  }, [diffRows]);

  const hasBothFoods = foodA && foodB;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <DiffFoodPicker label="Lebensmittel A" value={foodA} onChange={setFoodA} />
        <div className="hidden items-center justify-center lg:flex">
          <div className="rounded-full bg-muted p-3">
            <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <DiffFoodPicker label="Lebensmittel B" value={foodB} onChange={setFoodB} />
      </div>

      {hasBothFoods && diffRows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Keine vergleichbaren Naehrstoffwerte vorhanden.
        </div>
      ) : null}

      {hasBothFoods && diffRows.length > 0 ? (
        <div className="space-y-4">
          {Array.from(groupedRows.entries()).map(([group, rows]) => (
            <div key={group}>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                {NUTRIENT_GROUP_LABELS[group] ?? group}
              </h4>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Naehrstoff</th>
                      <th className="px-3 py-2 text-right font-medium">A</th>
                      <th className="px-3 py-2 text-right font-medium">B</th>
                      <th className="px-3 py-2 text-right font-medium">Delta</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const significant = row.deltaPercent !== null && Math.abs(row.deltaPercent) > 10;
                      return (
                        <tr key={row.nutrientId} className="border-b last:border-0">
                          <td className="px-3 py-1.5">{row.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {formatValue(row.valueA, row.unit)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {formatValue(row.valueB, row.unit)}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right tabular-nums ${
                              significant
                                ? row.delta! > 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {row.delta !== null
                              ? `${row.delta > 0 ? "+" : ""}${row.delta.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${row.unit}`
                              : "–"}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right tabular-nums ${
                              significant
                                ? row.deltaPercent! > 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {row.deltaPercent !== null
                              ? `${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent.toFixed(1)}%`
                              : "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
