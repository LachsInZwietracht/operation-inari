"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Copy,
  Layers,
  PlayCircle,
  Stethoscope,
  Utensils,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { useFoods } from "@/components/foods-provider";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { DIET_LINES } from "@/lib/reference-data/diet-lines";
import { createRecipeLookup } from "@/lib/recipes";
import {
  calculateMealEntryNutrients,
  getBroteinheiten,
  getNutrientValue,
  sumNutrients,
} from "@/lib/nutrients";
import { formatNumber } from "@/lib/format";
import { useMealPlanTemplates } from "@/hooks/use-meal-plan-templates";
import { useReferenceProfiles } from "@/hooks/use-reference-profiles";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";
import type {
  MealEntry,
  MealPlanTemplate,
  MealSlot,
  NutrientDefinition,
  Recipe,
} from "@/lib/types";

interface TemplateDetailClientProps {
  template: MealPlanTemplate;
  recipes: Recipe[];
  nutrientIds: string[];
  patientId?: string;
}

function nutrientDecimals(value: number, unit: string): number {
  if (unit === "kcal" || unit === "kJ") return 0;
  if (value >= 100) return 0;
  if (value >= 10) return 1;
  return 2;
}

function formatAmount(value: number, definition: NutrientDefinition): string {
  return `${formatNumber(value, nutrientDecimals(value, definition.unit))} ${definition.unit}`;
}

function describeEntry(
  entry: MealEntry,
  foodName: string | undefined,
  recipeName: string | undefined,
): { name: string; amountLabel: string } {
  if (entry.type === "food") {
    return {
      name: foodName ?? "Unbekanntes Lebensmittel",
      amountLabel: `${entry.amount.toLocaleString("de-DE")} g`,
    };
  }
  const portionLabel =
    entry.amount === 1
      ? "1 Portion"
      : `${entry.amount.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Portionen`;
  return {
    name: recipeName ?? "Unbekanntes Rezept",
    amountLabel: portionLabel,
  };
}

export function TemplateDetailClient({
  template,
  recipes,
  nutrientIds,
  patientId,
}: TemplateDetailClientProps) {
  const router = useRouter();
  const foods = useFoods();
  const { patients } = usePatients();
  const { getResolvedConfig } = useReferenceProfiles();
  const { saveTemplate, templates: personalTemplates } = useMealPlanTemplates();

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyDate, setApplyDate] = useState<Date>(() => new Date());
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState(
    `${template.name} (Kopie)`,
  );
  const [duplicateDescription, setDuplicateDescription] = useState(
    template.description ?? "",
  );
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicateSuccessId, setDuplicateSuccessId] = useState<string | null>(null);

  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);

  const patient = useMemo(
    () => (patientId ? patients.find((item) => item.id === patientId) : undefined),
    [patientId, patients],
  );

  const referenceConfig = useMemo(() => {
    if (!patient) return getResolvedConfig({});
    return getResolvedConfig({
      patientId: patient.id,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
    });
  }, [getResolvedConfig, patient]);

  const referenceAmounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const value of referenceConfig.values) {
      map.set(value.nutrientId, value.amount);
    }
    return map;
  }, [referenceConfig]);

  const slotNutrients = useMemo(
    () =>
      template.slots.map((slot) => ({
        slot,
        totals: sumNutrients(
          slot.entries.map((entry) =>
            calculateMealEntryNutrients(entry, foodMap, recipeMap, foods),
          ),
        ),
      })),
    [template.slots, foodMap, recipeMap, foods],
  );

  const dayTotals = useMemo(
    () => sumNutrients(slotNutrients.map((slot) => slot.totals)),
    [slotNutrients],
  );

  const entryCount = useMemo(
    () => template.slots.reduce((acc, slot) => acc + slot.entries.length, 0),
    [template.slots],
  );

  const filledSlots = useMemo(
    () => template.slots.filter((slot) => slot.entries.length > 0),
    [template.slots],
  );

  const dietLine = template.dietLineId
    ? DIET_LINES.find((line) => line.id === template.dietLineId)
    : undefined;

  const nutrientDefinitions = useMemo(() => {
    const lookup = new Map(NUTRIENT_DEFINITIONS.map((def) => [def.id, def]));
    return nutrientIds
      .map((id) => lookup.get(id))
      .filter((def): def is NutrientDefinition => Boolean(def));
  }, [nutrientIds]);

  const dayMacros = useMemo(() => {
    const energie = getNutrientValue(dayTotals, "energie");
    const eiweiss = getNutrientValue(dayTotals, "eiweiss");
    const fett = getNutrientValue(dayTotals, "fett");
    const kohlenhydrate = getNutrientValue(dayTotals, "kohlenhydrate");
    const ballaststoffe = getNutrientValue(dayTotals, "ballaststoffe");
    return {
      energie,
      eiweiss,
      fett,
      kohlenhydrate,
      ballaststoffe,
      broteinheiten: getBroteinheiten(kohlenhydrate),
    };
  }, [dayTotals]);

  const handleApply = () => {
    const dateString = format(applyDate, "yyyy-MM-dd");
    const params = new URLSearchParams();
    params.set("date", dateString);
    params.set("template", template.id);
    if (patientId) params.set("patientId", patientId);
    router.push(`/ernaehrungsplan?${params.toString()}`);
  };

  const handleDuplicate = async () => {
    const trimmedName = duplicateName.trim();
    if (!trimmedName) {
      setDuplicateError("Bitte gib einen Namen für die Vorlage an.");
      return;
    }
    setIsDuplicating(true);
    setDuplicateError(null);
    try {
      const saved = await saveTemplate({
        name: trimmedName,
        description: duplicateDescription.trim() || undefined,
        indication: template.indication,
        dietLineId: template.dietLineId,
        targetProfileId: template.targetProfileId,
        notes: template.notes,
        slots: cloneSlots(template.slots),
      });
      setDuplicateSuccessId(saved.id);
    } catch (error) {
      console.error("Failed to duplicate meal plan template:", error);
      setDuplicateError(
        error instanceof Error
          ? error.message
          : "Vorlage konnte nicht gespeichert werden.",
      );
    } finally {
      setIsDuplicating(false);
    }
  };

  const closeDuplicateDialog = () => {
    setDuplicateDialogOpen(false);
    setDuplicateError(null);
    setDuplicateSuccessId(null);
  };

  const backHref = patientId
    ? `/ernaehrungsplan/bibliothek?patientId=${patientId}`
    : "/ernaehrungsplan/bibliothek";
  const templateScopeLabel =
    template.sourceType === "system" ? "System-Vorlage" : "Eigene Vorlage";

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={template.description || templateScopeLabel}
        helpText="Diese Detailansicht zeigt alle Slots der Vorlage mit Tagessummen und – falls ein Patient gewählt ist – den Vergleich gegen das aktive Referenzprofil. Über 'Anwenden' lädt die Vorlage einen Tagesplan im Planer; 'Als eigene Vorlage speichern' erzeugt eine bearbeitbare Kopie unter deinen persönlichen Vorlagen."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zu Planvorlagen
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateDialogOpen(true)}
          >
            <BookmarkPlus className="mr-2 h-4 w-4" />
            Als eigene Vorlage speichern
          </Button>
          <Button size="sm" onClick={() => setApplyDialogOpen(true)}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Anwenden
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {template.indication && (
          <Badge variant="secondary" className="gap-1">
            <Stethoscope className="h-3 w-3" />
            {template.indication}
          </Badge>
        )}
        {dietLine && (
          <Badge variant="outline" className="gap-1">
            <ChefHat className="h-3 w-3" />
            {dietLine.name}
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Layers className="h-3 w-3" />
          {filledSlots.length} Slot{filledSlots.length === 1 ? "" : "s"} · {entryCount} Einträge
        </Badge>
        <Badge variant="outline">{templateScopeLabel}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DayMacroCard
          icon={Utensils}
          label="Energie"
          value={`${formatNumber(dayMacros.energie, 0)} kcal`}
          reference={referenceAmounts.get("energie")}
          referenceUnit="kcal"
          highlight
        />
        <DayMacroCard
          label="Eiweiß"
          value={`${formatNumber(dayMacros.eiweiss, 1)} g`}
          reference={referenceAmounts.get("eiweiss")}
          referenceUnit="g"
        />
        <DayMacroCard
          label="Fett"
          value={`${formatNumber(dayMacros.fett, 1)} g`}
          reference={referenceAmounts.get("fett")}
          referenceUnit="g"
        />
        <DayMacroCard
          label="Kohlenhydrate"
          value={`${formatNumber(dayMacros.kohlenhydrate, 1)} g`}
          reference={referenceAmounts.get("kohlenhydrate")}
          referenceUnit="g"
        />
        <DayMacroCard
          label="Ballaststoffe"
          value={`${formatNumber(dayMacros.ballaststoffe, 1)} g`}
          reference={referenceAmounts.get("ballaststoffe")}
          referenceUnit="g"
        />
        <DayMacroCard
          label="Broteinheiten"
          value={`${formatNumber(dayMacros.broteinheiten, 1)} BE`}
          reference={referenceAmounts.get("broteinheiten")}
          referenceUnit="BE"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Slot-Aufbau</CardTitle>
          <CardDescription>
            Einträge der Vorlage pro Mahlzeit mit Mengenangabe und Slot-Summe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {slotNutrients.map(({ slot, totals }) => (
            <SlotBlock
              key={slot.type}
              slot={slot}
              totals={totals}
              foodMap={foodMap}
              recipeMap={recipeMap}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nährstoff-Übersicht (Tagessumme)</CardTitle>
          <CardDescription>
            {patient
              ? `Vergleich gegen das Referenzprofil von ${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim()
              : `Vergleich gegen das aktive Referenzprofil (${referenceConfig.standardName})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nährstoff</TableHead>
                <TableHead className="text-right">Tagessumme</TableHead>
                <TableHead className="text-right">Referenz</TableHead>
                <TableHead className="text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nutrientDefinitions.map((definition) => {
                const value = getNutrientValue(dayTotals, definition.id);
                const reference = referenceAmounts.get(definition.id);
                const hasReference = typeof reference === "number" && reference > 0;
                const delta = hasReference ? value - reference : 0;
                return (
                  <TableRow key={definition.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{definition.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {definition.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(value, definition)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {hasReference
                        ? `${formatNumber(reference, 0)} ${definition.unit}`
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        !hasReference && "text-muted-foreground",
                        hasReference && delta < 0 && "text-amber-700 dark:text-amber-400",
                        hasReference && delta > 0 && "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {hasReference
                        ? `${delta > 0 ? "+" : ""}${formatAmount(delta, definition)}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vorlage anwenden</DialogTitle>
            <DialogDescription>
              Die Vorlage wird auf den gewählten Tag im Planer übernommen. Ein
              bestehender Tagesplan an diesem Datum wird durch die Vorlage ersetzt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Datum</Label>
              <div className="rounded-md border p-2">
                <Calendar
                  mode="single"
                  selected={applyDate}
                  onSelect={(date) => date && setApplyDate(date)}
                  locale={de}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Ausgewählt: {format(applyDate, "EEEE, dd.MM.yyyy", { locale: de })}
              </p>
            </div>
            {patient && (
              <div className="bg-muted/40 text-muted-foreground rounded-md border p-2 text-xs">
                Die Vorlage wird im Plan-Kontext von{" "}
                <span className="text-foreground font-medium">
                  {[patient.firstName, patient.lastName].filter(Boolean).join(" ") ||
                    patient.id}
                </span>{" "}
                übernommen.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApplyDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleApply}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Im Plan öffnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={duplicateDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDuplicateDialog();
          else setDuplicateDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Als eigene Vorlage speichern</DialogTitle>
            <DialogDescription>
              Erstellt eine bearbeitbare Kopie dieser Vorlage in deinen
              persönlichen Vorlagen.
            </DialogDescription>
          </DialogHeader>
          {duplicateSuccessId ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Vorlage erfolgreich gespeichert.</span>
              </div>
              <p className="text-muted-foreground">
                Du findest die Kopie ab sofort hier unter „Eigene“ und im Planer unter „Vorlagen“.
                {personalTemplates.length > 0 &&
                  ` Insgesamt sind ${personalTemplates.length} eigene Vorlage${personalTemplates.length === 1 ? "" : "n"} hinterlegt.`}
              </p>
              <DialogFooter>
                <Button onClick={closeDuplicateDialog}>Schließen</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="duplicate-name">Name</Label>
                  <Input
                    id="duplicate-name"
                    value={duplicateName}
                    onChange={(event) => setDuplicateName(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="duplicate-description">Beschreibung</Label>
                  <Textarea
                    id="duplicate-description"
                    value={duplicateDescription}
                    onChange={(event) => setDuplicateDescription(event.target.value)}
                    rows={3}
                  />
                </div>
                {duplicateError && (
                  <p className="text-destructive text-xs">{duplicateError}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeDuplicateDialog}>
                  Abbrechen
                </Button>
                <Button onClick={handleDuplicate} disabled={isDuplicating}>
                  <Copy className="mr-2 h-4 w-4" />
                  {isDuplicating ? "Speichert…" : "Speichern"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DayMacroCardProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  reference?: number;
  referenceUnit?: string;
  highlight?: boolean;
}

function DayMacroCard({
  icon: Icon,
  label,
  value,
  reference,
  referenceUnit,
  highlight = false,
}: DayMacroCardProps) {
  const hasReference = typeof reference === "number" && reference > 0;
  return (
    <Card className={cn(highlight && "border-primary/40")}>
      <CardContent className="space-y-1 pt-6">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs uppercase tracking-wide">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </div>
        <div
          className={cn(
            "text-xl font-semibold tabular-nums",
            highlight && "text-primary",
          )}
        >
          {value}
        </div>
        {hasReference && (
          <div className="text-muted-foreground text-xs tabular-nums">
            Referenz: {formatNumber(reference, 0)} {referenceUnit}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SlotBlockProps {
  slot: MealSlot;
  totals: ReturnType<typeof sumNutrients>;
  foodMap: Map<string, NonNullable<ReturnType<typeof useFoods>>[number]>;
  recipeMap: Map<string, Recipe>;
}

function SlotBlock({ slot, totals, foodMap, recipeMap }: SlotBlockProps) {
  const isEmpty = slot.entries.length === 0;
  const energie = getNutrientValue(totals, "energie");
  const eiweiss = getNutrientValue(totals, "eiweiss");
  const fett = getNutrientValue(totals, "fett");
  const kh = getNutrientValue(totals, "kohlenhydrate");

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1">
        <h3 className="text-sm font-semibold">{MEAL_SLOT_LABELS[slot.type]}</h3>
        {!isEmpty && (
          <div className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
            <span>{formatNumber(energie, 0)} kcal</span>
            <span>·</span>
            <span>EW {formatNumber(eiweiss, 1)} g</span>
            <span>·</span>
            <span>F {formatNumber(fett, 1)} g</span>
            <span>·</span>
            <span>KH {formatNumber(kh, 1)} g</span>
          </div>
        )}
      </div>
      {isEmpty ? (
        <p className="text-muted-foreground text-xs italic">
          Kein Eintrag in dieser Mahlzeit.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {slot.entries.map((entry) => {
            const food = entry.type === "food" ? foodMap.get(entry.referenceId) : undefined;
            const recipe =
              entry.type === "recipe" ? recipeMap.get(entry.referenceId) : undefined;
            const { name, amountLabel } = describeEntry(entry, food?.name, recipe?.name);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {entry.type === "recipe" ? (
                    <ChefHat className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Utensils className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{name}</span>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {amountLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function cloneSlots(slots: MealSlot[]): MealSlot[] {
  return slots.map((slot) => ({
    type: slot.type,
    entries: slot.entries.map((entry) => ({
      id: `tplentry_clone_${Math.random().toString(36).slice(2, 10)}`,
      type: entry.type,
      referenceId: entry.referenceId,
      amount: entry.amount,
    })),
  }));
}
