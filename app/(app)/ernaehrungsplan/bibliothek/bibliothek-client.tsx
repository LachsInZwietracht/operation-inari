"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowLeft,
  Columns2,
  BookMarked,
  CalendarRange,
  ChefHat,
  Filter,
  Layers,
  Search,
  SortAsc,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { MealPlanTemplateComparison } from "@/components/meal-plan-template-comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useFoods } from "@/components/foods-provider";
import { useMealPlanTemplates } from "@/hooks/use-meal-plan-templates";
import { DIET_LINES } from "@/lib/reference-data/diet-lines";
import { createRecipeLookup } from "@/lib/recipes";
import {
  calculateMealEntryNutrients,
  getNutrientValue,
  sumNutrients,
} from "@/lib/nutrients";
import { cn } from "@/lib/utils";
import {
  getMealPlanTemplateBlocks,
  getMealPlanTemplateSpanDays,
  matchesMealPlanTemplateDuration,
  MEAL_PLAN_TEMPLATE_DURATION_LABELS,
  type MealPlanTemplateDuration,
} from "@/lib/meal-plan-template-utils";
import type { DailyMealPlan, MealPlanTemplate, Recipe } from "@/lib/types";

interface BibliothekClientProps {
  templates: MealPlanTemplate[];
  mealPlans: DailyMealPlan[];
  recipes: Recipe[];
  patients: Array<{ id: string; firstName: string; lastName: string }>;
  patientId?: string;
  initialScope: TemplateScope;
  initialIndication?: string;
  returnDate?: string;
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
type TemplateScope = "patient" | "general";
type CreationSpan = "1" | "3" | "7";

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

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("de-DE").format(new Date(`${date}T00:00:00`));
}

function countPlanEntries(plan: DailyMealPlan): number {
  return plan.slots.reduce((sum, slot) => sum + slot.entries.length, 0);
}

function defaultTemplateName(plan: DailyMealPlan | undefined): string {
  if (!plan) return "";
  return plan.title?.trim() || `Vorlage vom ${formatDateLabel(plan.date)}`;
}

function planPriority(plan: DailyMealPlan): number {
  const status = plan.status === "draft" ? 30 : plan.status === "active" ? 20 : 10;
  return status + (plan.revisionNumber ?? 0) / 1000;
}

function collectTemplatePeriodPlans(
  sourcePlan: DailyMealPlan,
  plans: DailyMealPlan[],
  spanDays: number,
): Array<{ offsetDays: number; plan: DailyMealPlan }> {
  const plansByOffset = new Map<number, DailyMealPlan>();
  for (const candidate of plans) {
    if (candidate.status === "archived") continue;
    if (candidate.patientId !== sourcePlan.patientId) continue;
    const offsetDays = differenceInCalendarDays(
      parseISO(candidate.date),
      parseISO(sourcePlan.date),
    );
    if (offsetDays < 0 || offsetDays >= spanDays) continue;
    const existing = plansByOffset.get(offsetDays);
    if (!existing || planPriority(candidate) > planPriority(existing)) {
      plansByOffset.set(offsetDays, candidate);
    }
  }
  plansByOffset.set(0, sourcePlan);
  return Array.from(plansByOffset.entries())
    .sort(([offsetA], [offsetB]) => offsetA - offsetB)
    .map(([offsetDays, plan]) => ({ offsetDays, plan }));
}

export function BibliothekClient({
  templates,
  mealPlans,
  recipes,
  patients,
  patientId,
  initialScope,
  initialIndication,
  returnDate,
}: BibliothekClientProps) {
  const router = useRouter();
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonStartId, setComparisonStartId] = useState<string>();
  const comparisonPatient = patients.find((patient) => patient.id === patientId);
  const foods = useFoods();
  const { templates: managedTemplates, saveTemplate } = useMealPlanTemplates({
    initialTemplates: templates,
    patientId,
  });
  const [search, setSearch] = useState("");
  const [indicationFilter, setIndicationFilter] = useState<string>(
    initialIndication ?? "alle",
  );
  const [dietLineFilter, setDietLineFilter] = useState<string>("alle");
  const [durationFilter, setDurationFilter] =
    useState<MealPlanTemplateDuration>("all");
  const scopeFilter = initialScope;
  const [sort, setSort] = useState<SortKey>("name");
  const plansWithEntries = useMemo(() => {
    const plansByPatientAndDate = new Map<string, DailyMealPlan>();
    for (const plan of mealPlans) {
      if (plan.status === "archived" || countPlanEntries(plan) === 0) continue;
      if (scopeFilter === "patient" && (!patientId || plan.patientId !== patientId)) continue;
      const key = `${plan.patientId ?? "unassigned"}:${plan.date}`;
      const existing = plansByPatientAndDate.get(key);
      if (!existing || planPriority(plan) > planPriority(existing)) {
        plansByPatientAndDate.set(key, plan);
      }
    }
    return Array.from(plansByPatientAndDate.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [mealPlans, patientId, scopeFilter]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sourcePlanId, setSourcePlanId] = useState<string>(
    plansWithEntries[0]?.id ?? "",
  );
  const selectedSourcePlan = useMemo(
    () => plansWithEntries.find((plan) => plan.id === sourcePlanId),
    [plansWithEntries, sourcePlanId],
  );
  const [templateName, setTemplateName] = useState(
    defaultTemplateName(selectedSourcePlan),
  );
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIndication, setTemplateIndication] = useState(initialIndication ?? "");
  const [templateDietLineId, setTemplateDietLineId] = useState(
    selectedSourcePlan?.dietLineId ?? "",
  );
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [creationScope, setCreationScope] = useState<TemplateScope>(initialScope);
  const [creationSpan, setCreationSpan] = useState<CreationSpan>("1");
  const selectedPeriodPlans = useMemo(
    () =>
      selectedSourcePlan
        ? collectTemplatePeriodPlans(
            selectedSourcePlan,
            plansWithEntries,
            Number(creationSpan),
          )
        : [],
    [creationSpan, plansWithEntries, selectedSourcePlan],
  );
  const hasPeriodEnd =
    creationSpan === "1" ||
    selectedPeriodPlans.some(
      ({ offsetDays }) => offsetDays === Number(creationSpan) - 1,
    );

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);

  const statsByTemplate = useMemo(() => {
    const map = new Map<string, TemplateStats>();
    for (const template of managedTemplates) {
      const blocks = getMealPlanTemplateBlocks(template);
      const allSlots = blocks.flatMap((block) => block.slots);
      const perEntry = allSlots.flatMap((slot) =>
        slot.entries.map((entry) =>
          calculateMealEntryNutrients(entry, foodMap, recipeMap, foods),
        ),
      );
      const totals = sumNutrients(perEntry);
      const entryCount = allSlots.reduce(
        (acc, slot) => acc + slot.entries.length,
        0,
      );
      const filledSlotCount = allSlots.filter(
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
  }, [managedTemplates, foodMap, recipeMap, foods]);

  const availableIndications = useMemo(() => {
    const set = new Set<string>();
    for (const template of managedTemplates) {
      if (template.indication) set.add(template.indication);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [managedTemplates]);

  const availableDietLines = useMemo(() => {
    const set = new Set<string>();
    for (const template of managedTemplates) {
      if (template.dietLineId) set.add(template.dietLineId);
    }
    return DIET_LINES.filter((line) => set.has(line.id));
  }, [managedTemplates]);

  const filteredTemplates = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const filtered = managedTemplates.filter((template) => {
      if (template.sourceType !== "personal") {
        return false;
      }
      if (scopeFilter === "patient" && (!patientId || template.patientId !== patientId)) {
        return false;
      }
      if (scopeFilter === "general" && template.patientId) {
        return false;
      }
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
      if (
        !matchesMealPlanTemplateDuration(
          getMealPlanTemplateSpanDays(template),
          durationFilter,
        )
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
  }, [managedTemplates, patientId, search, scopeFilter, indicationFilter, dietLineFilter, durationFilter, sort, statsByTemplate]);

  const overviewHref = (nextScope: TemplateScope, nextPatientId = patientId): string => {
    const params = new URLSearchParams({ scope: nextScope });
    if (nextPatientId) params.set("patientId", nextPatientId);
    if (initialIndication) params.set("indication", initialIndication);
    if (returnDate) params.set("returnDate", returnDate);
    return `/ernaehrungsplan/bibliothek?${params.toString()}`;
  };

  const changeScope = (nextScope: TemplateScope) => {
    router.push(overviewHref(nextScope));
  };

  const changePatient = (nextPatientId: string) => {
    router.push(overviewHref("patient", nextPatientId));
  };

  const detailHrefFor = (templateId: string): string => {
    const params = new URLSearchParams();
    if (patientId) params.set("patientId", patientId);
    if (returnDate) params.set("returnDate", returnDate);
    params.set("scope", scopeFilter);
    const query = params.toString();
    return `/ernaehrungsplan/bibliothek/${templateId}${query ? `?${query}` : ""}`;
  };

  const totalAvailable = managedTemplates.filter((template) =>
    scopeFilter === "patient" ? Boolean(patientId && template.patientId === patientId) : !template.patientId,
  ).length;
  const plannerHref = patientId
    ? `/patienten/${patientId}?tab=ernaehrungsplan&planView=week${returnDate ? `&planDate=${returnDate}` : ""}`
    : "/ernaehrungsplan";
  const visibleCount = filteredTemplates.length;
  const patientCount = patientId
    ? managedTemplates.filter((template) => template.patientId === patientId).length
    : 0;
  const generalCount = managedTemplates.filter((template) => !template.patientId).length;
  const hasActiveFilters =
    search.trim().length > 0 ||
    indicationFilter !== "alle" ||
    dietLineFilter !== "alle" ||
    durationFilter !== "all";

  const openCreateDialog = () => {
    const fallbackPlan = selectedSourcePlan ?? plansWithEntries[0];
    setSourcePlanId(fallbackPlan?.id ?? "");
    setTemplateName(defaultTemplateName(fallbackPlan));
    setTemplateDescription("");
    setTemplateIndication(initialIndication ?? "");
    setTemplateDietLineId(fallbackPlan?.dietLineId ?? "");
    setCreationScope(scopeFilter);
    setCreationSpan("1");
    setCreateDialogOpen(true);
  };

  const handleSourcePlanChange = (planId: string) => {
    const nextPlan = plansWithEntries.find((plan) => plan.id === planId);
    setSourcePlanId(planId);
    if (nextPlan) {
      setTemplateName((current) => current.trim() || defaultTemplateName(nextPlan));
      setTemplateDietLineId(nextPlan.dietLineId ?? "");
    }
  };

  const createTemplateFromPlan = async () => {
    const sourcePlan = plansWithEntries.find((plan) => plan.id === sourcePlanId);
    if (!sourcePlan) {
      toast.error("Bitte wähle einen gespeicherten Ernährungsplan aus.");
      return;
    }
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast.error("Bitte gib einen Namen für die Vorlage ein.");
      return;
    }
    if (!hasPeriodEnd) {
      toast.error(
        `Für einen Zeitraum von ${creationSpan} Tagen muss auch der letzte Tag im Planer gefüllt sein.`,
      );
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const spanDays = Number(creationSpan);
      const dayBlocks = collectTemplatePeriodPlans(
        sourcePlan,
        plansWithEntries,
        spanDays,
      ).map(({ offsetDays, plan }) => ({ offsetDays, slots: plan.slots }));

      await saveTemplate({
        name: trimmedName,
        description: templateDescription.trim() || undefined,
        indication: templateIndication.trim() || undefined,
        dietLineId: templateDietLineId || undefined,
        targetProfileId: sourcePlan.targetProfileId,
        slots: sourcePlan.slots,
        dayBlocks: spanDays > 1 ? dayBlocks : undefined,
        notes: sourcePlan.notes,
        patientId: creationScope === "patient" ? patientId : undefined,
      });
      setCreateDialogOpen(false);
      router.push(overviewHref(creationScope));
      toast.success(
        spanDays > 1
          ? `Vorlage für ${spanDays} Tage mit ${dayBlocks.length} Planungstagen erstellt.`
          : "Tagesvorlage erstellt.",
      );
    } catch (error) {
      console.error("Failed to create meal plan template:", error);
      toast.error("Vorlage konnte nicht erstellt werden.");
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planvorlagen"
        description="Tages- und Mehrtagesvorlagen erstellen, ordnen und sicher anwenden."
        helpText="Der datumsgebundene Planer bleibt die Baufläche. Hier verwaltest du daraus gespeicherte Zeiträume, prüfst ihren Inhalt und wählst beim Anwenden bewusst Startdatum und Zieltermine."
      >
        <Button variant="outline" size="sm" onClick={() => { setComparisonStartId(undefined); setComparisonOpen(true); }}>
          <Columns2 className="mr-2 h-4 w-4" />
          Vorlagen vergleichen
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={plannerHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zum Planer
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={openCreateDialog}
          disabled={scopeFilter === "patient" && !patientId}
          title={scopeFilter === "patient" && !patientId ? "Wähle zuerst einen Patienten aus." : undefined}
        >
          <BookMarked className="mr-2 h-4 w-4" />
          Vorlage erstellen
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
              ? `${totalAvailable} Vorlage${totalAvailable === 1 ? "" : "n"} verfügbar`
              : `${visibleCount} von ${totalAvailable} Vorlagen sichtbar`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookMarked className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Sammlung
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={scopeFilter === "general"}
                onClick={() => changeScope("general")}
              >
                Allgemeine Vorlagen ({generalCount})
              </FilterChip>
              <FilterChip
                active={scopeFilter === "patient"}
                onClick={() => changeScope("patient")}
              >
                Patientenspezifische Vorlagen{patientId ? ` (${patientCount})` : ""}
              </FilterChip>
            </div>
          </div>

          {scopeFilter === "patient" ? (
            <div className="space-y-1.5">
              <Label htmlFor="template-patient-selector">Patient</Label>
              <Select value={patientId} onValueChange={changePatient}>
                <SelectTrigger id="template-patient-selector">
                  <SelectValue placeholder="Patient auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.lastName}, {patient.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {patientId ? (
                <p className="text-muted-foreground text-xs">
                  Patientenspezifische Vorlagen für {patients.find((patient) => patient.id === patientId)?.firstName ?? "diesen Patienten"} {patients.find((patient) => patient.id === patientId)?.lastName ?? ""}.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Wähle einen Patienten aus, um dessen gebundene Vorlagen zu sehen oder eine neue anzulegen.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Allgemeine Vorlagen sind deine wiederverwendbaren Vorlagen ohne Patientenzuordnung.
            </p>
          )}

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

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Zeitraum
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(MEAL_PLAN_TEMPLATE_DURATION_LABELS) as Array<
                [MealPlanTemplateDuration, string]
              >).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={durationFilter === value}
                  onClick={() => setDurationFilter(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <BookMarked className="text-muted-foreground/60 h-6 w-6" />
            <p>
              {scopeFilter === "patient" && !patientId
                ? "Wähle zuerst einen Patienten aus."
                : hasActiveFilters
                ? "Keine Vorlagen treffen auf die aktuelle Filterkombination zu."
                : "Es sind aktuell keine Planvorlagen verfügbar."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setIndicationFilter("alle");
                  setDietLineFilter("alle");
                  setDurationFilter("all");
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
            const blocks = getMealPlanTemplateBlocks(template);
            const spanDays = getMealPlanTemplateSpanDays(template);
            const dietLine = template.dietLineId
              ? DIET_LINES.find((line) => line.id === template.dietLineId)
              : undefined;
            return (
              <div key={template.id} className="flex flex-col rounded-xl border bg-card shadow-sm">
              <Link
                href={detailHrefFor(template.id)}
                className="group flex-1 rounded-xl focus-visible:outline-none"
              >
                <Card className="hover:bg-muted/20 group-focus-visible:ring-ring h-full border-0 shadow-none transition-colors group-focus-visible:ring-2">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {template.patientId ? "Patientenspezifisch" : "Allgemeine Vorlage"}
                      </Badge>
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
                      <Badge variant="outline" className="text-xs">
                        {spanDays === 1
                          ? "1 Tag"
                          : `${blocks.length} Planungstage · ${spanDays} Tage Zeitraum`}
                      </Badge>
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
                        <MacroBlock label={spanDays > 1 ? "Energie gesamt" : "Energie"} value={`${formatKcal(stats.energie)} kcal`} accent />
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
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="text-muted-foreground w-full" aria-label={`Vorlage ${template.name} vergleichen`} onClick={() => { setComparisonStartId(template.id); setComparisonOpen(true); }}>
                  <Columns2 className="mr-2 size-4" /> Vergleichen
                </Button>
              </div>
              </div>
            );
          })}
        </div>
      )}

      <MealPlanTemplateComparison
        key={comparisonStartId ?? "all"}
        templates={managedTemplates}
        recipes={recipes}
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        initialTemplateId={comparisonStartId}
        patientName={comparisonPatient ? `${comparisonPatient.firstName} ${comparisonPatient.lastName}` : undefined}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Vorlage erstellen</DialogTitle>
            <DialogDescription>
              Übernimm einen vorbereiteten Tag oder Zeitraum aus dem Planer. Ungefüllte Tage bleiben als bewusste Lücken erhalten.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {plansWithEntries.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm">
                <p className="font-medium">Noch kein vorbereiteter Plan verfügbar</p>
                <p className="text-muted-foreground mt-1">
                  Fülle zuerst mindestens einen Tag im Planer. Danach kannst du ihn hier als Vorlage sichern.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href={plannerHref}>
                    Zum Planer
                  </Link>
                </Button>
              </div>
            ) : (
              <>
            {patientId ? <div className="space-y-1.5">
              <Label htmlFor="template-creation-scope">Geltungsbereich</Label>
              <Select value={creationScope} onValueChange={(value) => setCreationScope(value as TemplateScope)}>
                <SelectTrigger id="template-creation-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Nur für diesen Patienten</SelectItem>
                  <SelectItem value="general">Für alle meine Patienten</SelectItem>
                </SelectContent>
              </Select>
            </div> : null}
            <div className="space-y-1.5">
              <Label htmlFor="template-source-plan">Erster Planungstag</Label>
              <Select value={sourcePlanId} onValueChange={handleSourcePlanChange}>
                <SelectTrigger id="template-source-plan">
                  <SelectValue placeholder="Plan auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {plansWithEntries.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {defaultTemplateName(plan)} · {formatDateLabel(plan.date)}{plan.patientId ? ` · ${patients.find((patient) => patient.id === plan.patientId)?.lastName ?? "Patient"}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Zeitraum</Label>
              <Select
                value={creationSpan}
                onValueChange={(value) => setCreationSpan(value as CreationSpan)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Tag</SelectItem>
                  <SelectItem value="3">3 Tage</SelectItem>
                  <SelectItem value="7">1 Woche</SelectItem>
                </SelectContent>
              </Select>
              {selectedSourcePlan ? (
                <p className="text-muted-foreground text-xs">
                  {selectedPeriodPlans.length} von {creationSpan} Tagen sind gefüllt.
                  {!hasPeriodEnd
                    ? " Plane noch den letzten Tag, damit die gewählte Länge eindeutig gespeichert wird."
                    : selectedPeriodPlans.length < Number(creationSpan)
                      ? " Freie Tage dazwischen bleiben als bewusste Lücken erhalten."
                      : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="z. B. Reduktion 1500 kcal Tag 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-description">Beschreibung</Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="template-indication">Indikation</Label>
                <Input
                  id="template-indication"
                  value={templateIndication}
                  onChange={(event) => setTemplateIndication(event.target.value)}
                  placeholder="z. B. Diabetes mellitus Typ 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kostform</Label>
                <Select
                  value={templateDietLineId || "none"}
                  onValueChange={(value) =>
                    setTemplateDietLineId(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kostform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Zuordnung</SelectItem>
                    {DIET_LINES.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => void createTemplateFromPlan()}
              disabled={
                isCreatingTemplate ||
                plansWithEntries.length === 0 ||
                (creationScope === "patient" && !patientId) ||
                !hasPeriodEnd
              }
            >
              {isCreatingTemplate ? "Speichert..." : "Vorlage speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      aria-pressed={active}
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
