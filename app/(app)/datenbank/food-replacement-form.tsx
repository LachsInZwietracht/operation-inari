"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, Search } from "lucide-react";

import {
  type FoodReplacementActionState,
  replaceFoodReferencesAction,
} from "@/app/(app)/datenbank/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Food, FoodBrowserResult } from "@/lib/types";

const INITIAL_STATE: FoodReplacementActionState = {
  status: "idle",
  message: null,
};

interface FoodSearchPickerProps {
  label: string;
  fieldName: string;
  value: Food | null;
  onChange: (food: Food) => void;
}

function formatFoodMeta(food: Food) {
  return [food.blsCode, food.sourceId?.toUpperCase(), food.sourceVersion ? `v${food.sourceVersion}` : null]
    .filter(Boolean)
    .join(" · ");
}

function FoodSearchPicker({ label, fieldName, value, onChange }: FoodSearchPickerProps) {
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
            console.warn("Food lookup failed:", error);
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
      <input type="hidden" name={fieldName} value={value?.id ?? ""} />
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

export function FoodReplacementForm() {
  const [state, formAction, pending] = useActionState(replaceFoodReferencesAction, INITIAL_STATE);
  const [sourceFood, setSourceFood] = useState<Food | null>(null);
  const [targetFood, setTargetFood] = useState<Food | null>(null);

  const canSubmit = useMemo(
    () => Boolean(sourceFood && targetFood && sourceFood.id !== targetFood.id),
    [sourceFood, targetFood],
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <FoodSearchPicker
          label="Ausgangs-Lebensmittel"
          fieldName="sourceFoodId"
          value={sourceFood}
          onChange={setSourceFood}
        />
        <div className="hidden items-center justify-center lg:flex">
          <div className="rounded-full bg-muted p-3">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <FoodSearchPicker
          label="Ziel-Lebensmittel"
          fieldName="targetFoodId"
          value={targetFood}
          onChange={setTargetFood}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="food-replacement-reason">Begruendung</Label>
        <Textarea
          id="food-replacement-reason"
          name="reason"
          placeholder="z.B. Datenbankupdate, Dublette, veralteter BLS-Code"
          rows={3}
        />
      </div>

      {state.message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={!canSubmit || pending}>
        {pending ? "Ersetze..." : "Referenzen ersetzen"}
      </Button>
    </form>
  );
}
