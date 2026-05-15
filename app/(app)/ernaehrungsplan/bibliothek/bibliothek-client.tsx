"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  ChefHat,
  Filter,
  Layers,
  Search,
  SortAsc,
  Stethoscope,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useFoods } from "@/components/foods-provider";
import { DIET_LINES } from "@/lib/reference-data/diet-lines";
import { createRecipeLookup } from "@/lib/recipes";
import {
  calculateMealEntryNutrients,
  getNutrientValue,
  sumNutrients,
} from "@/lib/nutrients";
import { cn } from "@/lib/utils";
import type { MealPlanTemplate, Recipe } from "@/lib/types";

interface BibliothekClientProps {
  templates: MealPlanTemplate[];
  recipes: Recipe[];
  patientId?: string;
  initialIndication?: string;
}

interface TemplateStats {
  entryCount: number;
  filledSlotCount: number;
  energie: number;
  eiweiss: number;
  fett: number;
  kohlenhydrate: number;
  ballaststoffe: number;
}

type SortKey = "name" | "kcalAsc" | "kcalDesc";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  kcalAsc: "Kcal aufsteigend",
  kcalDesc: "Kcal absteigend",
};

function formatKcal(value: number): string {
  return Math.round(value).toLocaleString("de-DE");
}

function formatGrams(value: number, decimals = 0): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function BibliothekClient({
  templates,
  recipes,
  patientId,
  initialIndication,
}: BibliothekClientProps) {
  const foods = useFoods();
  const [search, setSearch] = useState("");
  const [indicationFilter, setIndicationFilter] = useState<string>(
    initialIndication ?? "alle",
  );
  const [dietLineFilter, setDietLineFilter] = useState<string>("alle");
  const [sort, setSort] = useState<SortKey>("name");

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);

  const statsByTemplate = useMemo(() => {
    const map = new Map<string, TemplateStats>();
    for (const template of templates) {
      const perEntry = template.slots.flatMap((slot) =>
        slot.entries.map((entry) =>
          calculateMealEntryNutrients(entry, foodMap, recipeMap, foods),
        ),
      );
      const totals = sumNutrients(perEntry);
      const entryCount = template.slots.reduce(
        (acc, slot) => acc + slot.entries.length,
        0,
      );
      const filledSlotCount = template.slots.filter(
        (slot) => slot.entries.length > 0,
      ).length;
      map.set(template.id, {
        entryCount,
        filledSlotCount,
        energie: getNutrientValue(totals, "energie"),
        eiweiss: getNutrientValue(totals, "eiweiss"),
        fett: getNutrientValue(totals, "fett"),
        kohlenhydrate: getNutrientValue(totals, "kohlenhydrate"),
        ballaststoffe: getNutrientValue(totals, "ballaststoffe"),
      });
    }
    return map;
  }, [templates, foodMap, recipeMap, foods]);

  const availableIndications = useMemo(() => {
    const set = new Set<string>();
    for (const template of templates) {
      if (template.indication) set.add(template.indication);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [templates]);

  const availableDietLines = useMemo(() => {
    const set = new Set<string>();
    for (const template of templates) {
      if (template.dietLineId) set.add(template.dietLineId);
    }
    return DIET_LINES.filter((line) => set.has(line.id));
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const filtered = templates.filter((template) => {
      if (
        indicationFilter !== "alle" &&
        template.indication !== indicationFilter
      ) {
        return false;
      }
      if (
        dietLineFilter !== "alle" &&
        template.dietLineId !== dietLineFilter
      ) {
        return false;
      }
      if (!trimmed) return true;
      const haystack = [
        template.name,
        template.description ?? "",
        template.indication ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "de");
      const energieA = statsByTemplate.get(a.id)?.energie ?? 0;
      const energieB = statsByTemplate.get(b.id)?.energie ?? 0;
      return sort === "kcalAsc" ? energieA - energieB : energieB - energieA;
    });
  }, [templates, search, indicationFilter, dietLineFilter, sort, statsByTemplate]);

  const detailHrefFor = (templateId: string): string => {
    const params = new URLSearchParams();
    if (patientId) params.set("patientId", patientId);
    const query = params.toString();
    return `/ernaehrungsplan/bibliothek/${templateId}${query ? `?${query}` : ""}`;
  };

  const totalAvailable = templates.length;
  const visibleCount = filteredTemplates.length;
  const hasActiveFilters =
    search.trim().length > 0 ||
    indicationFilter !== "alle" ||
    dietLineFilter !== "alle";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan-Bibliothek"
        description="Kuratierte System-Vorlagen für Tagespläne nach Indikation und Kostform. Auswählen, vorab prüfen und auf ein Datum übernehmen."
        helpText="Die Bibliothek bündelt alle als System-Vorlagen hinterlegten Tagespläne. Klicke auf eine Karte, um die Slots, Tagessummen und Referenzvergleiche im Detail zu sehen. Über 'Anwenden' wird die Vorlage auf einen Wunschtermin im Planer geladen."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/ernaehrungsplan">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zum Plan
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="text-muted-foreground h-4 w-4" />
            Filter
          </CardTitle>
          <CardDescription>
            {visibleCount === totalAvailable
              ? `${totalAvailable} System-Vorlage${totalAvailable === 1 ? "" : "n"} verfügbar`
              : `${visibleCount} von ${totalAvailable} Vorlagen sichtbar`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <label
                htmlFor="bibliothek-search"
                className="text-muted-foreground text-xs font-medium"
              >
                Suche
              </label>
              <div className="relative">
                <Search className="text-muted-foreground absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="bibliothek-search"
                  placeholder="Name, Indikation oder Beschreibung…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="bibliothek-sort"
                className="text-muted-foreground text-xs font-medium"
              >
                Sortierung
              </label>
              <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                <SelectTrigger id="bibliothek-sort" className="min-w-[200px]">
                  <SortAsc className="text-muted-foreground mr-1 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Indikation
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={indicationFilter === "alle"}
                onClick={() => setIndicationFilter("alle")}
              >
                Alle
              </FilterChip>
              {availableIndications.map((indication) => (
                <FilterChip
                  key={indication}
                  active={indicationFilter === indication}
                  onClick={() => setIndicationFilter(indication)}
                >
                  {indication}
                </FilterChip>
              ))}
            </div>
          </div>

          {availableDietLines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ChefHat className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Kostform
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={dietLineFilter === "alle"}
                  onClick={() => setDietLineFilter("alle")}
                >
                  Alle
                </FilterChip>
                {availableDietLines.map((line) => (
                  <FilterChip
                    key={line.id}
                    active={dietLineFilter === line.id}
                    onClick={() => setDietLineFilter(line.id)}
                  >
                    {line.name}
                  </FilterChip>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <BookMarked className="text-muted-foreground/60 h-6 w-6" />
            <p>
              {hasActiveFilters
                ? "Keine Vorlagen treffen auf die aktuelle Filterkombination zu."
                : "Es sind aktuell keine System-Vorlagen verfügbar."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setIndicationFilter("alle");
                  setDietLineFilter("alle");
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => {
            const stats = statsByTemplate.get(template.id);
            const dietLine = template.dietLineId
              ? DIET_LINES.find((line) => line.id === template.dietLineId)
              : undefined;
            return (
              <Link
                key={template.id}
                href={detailHrefFor(template.id)}
                className="group focus-visible:outline-none"
              >
                <Card className="hover:border-primary/50 group-focus-visible:ring-ring h-full transition-colors group-focus-visible:ring-2">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {template.indication && (
                        <Badge variant="secondary" className="text-xs">
                          {template.indication}
                        </Badge>
                      )}
                      {dietLine && (
                        <Badge variant="outline" className="text-xs">
                          {dietLine.name}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base leading-snug">
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-muted-foreground flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {stats?.filledSlotCount ?? 0} Slots
                      </span>
                      <span>·</span>
                      <span>
                        {stats?.entryCount ?? 0} Einträge
                      </span>
                    </div>
                    {stats && stats.entryCount > 0 ? (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <MacroBlock label="Energie" value={`${formatKcal(stats.energie)} kcal`} accent />
                        <MacroBlock label="Eiweiß" value={`${formatGrams(stats.eiweiss)} g`} />
                        <MacroBlock label="Fett" value={`${formatGrams(stats.fett)} g`} />
                        <MacroBlock label="KH" value={`${formatGrams(stats.kohlenhydrate)} g`} />
                        <MacroBlock label="Bst" value={`${formatGrams(stats.ballaststoffe)} g`} />
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">
                        Keine Einträge — Vorlage ist leer.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted text-muted-foreground border-border",
      )}
    >
      {children}
    </button>
  );
}

interface MacroBlockProps {
  label: string;
  value: string;
  accent?: boolean;
}

function MacroBlock({ label, value, accent = false }: MacroBlockProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          accent ? "text-foreground font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}
