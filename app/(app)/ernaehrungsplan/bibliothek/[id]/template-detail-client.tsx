"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Copy,
  Pencil,
  Layers,
  PlayCircle,
  Stethoscope,
  Trash2,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
import {
  getMealPlanTemplateBlocks,
  getMealPlanTemplateSpanDays,
} from "@/lib/meal-plan-template-utils";
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
  returnDate?: string;
  scope?: "patient" | "general";
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
  template: initialTemplate,
  recipes,
  nutrientIds,
  patientId,
  returnDate,
  scope = "general",
}: TemplateDetailClientProps) {
  const router = useRouter();
  const foods = useFoods();
  const { patients } = usePatients();
  const { getResolvedConfig } = useReferenceProfiles();
  const { saveTemplate, removeTemplate, templates: personalTemplates } =
    useMealPlanTemplates({ initialTemplates: [initialTemplate], patientId });
  const [template, setTemplate] = useState(initialTemplate);

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyDate, setApplyDate] = useState<Date>(() => new Date());
  const templateBlocks = useMemo(
    () => getMealPlanTemplateBlocks(template),
    [template],
  );
  const [activeBlockOffset, setActiveBlockOffset] = useState(
    () => templateBlocks[0]?.offsetDays ?? 0,
  );
  const activeBlock =
    templateBlocks.find((block) => block.offsetDays === activeBlockOffset) ??
    templateBlocks[0];
  const isMultiDay = templateBlocks.length > 1;
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
  const [duplicateScope, setDuplicateScope] = useState<"patient" | "advisor">(patientId ? "patient" : "advisor");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description ?? "");
  const [editIndication, setEditIndication] = useState(template.indication ?? "");
  const [editDietLineId, setEditDietLineId] = useState(template.dietLineId ?? "");
  const [editScope, setEditScope] = useState<"patient" | "advisor">(
    template.patientId ? "patient" : "advisor",
  );
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      activeBlock.slots.map((slot) => ({
        slot,
        totals: sumNutrients(
          slot.entries.map((entry) =>
            calculateMealEntryNutrients(entry, foodMap, recipeMap, foods),
          ),
        ),
      })),
    [activeBlock.slots, foodMap, recipeMap, foods],
  );

  const dayTotals = useMemo(
    () => sumNutrients(slotNutrients.map((slot) => slot.totals)),
    [slotNutrients],
  );

  const entryCount = useMemo(
    () => activeBlock.slots.reduce((acc, slot) => acc + slot.entries.length, 0),
    [activeBlock.slots],
  );

  const totalEntryCount = useMemo(
    () =>
      templateBlocks.reduce(
        (total, block) =>
          total + block.slots.reduce((sum, slot) => sum + slot.entries.length, 0),
        0,
      ),
    [templateBlocks],
  );

  const filledSlots = useMemo(
    () => activeBlock.slots.filter((slot) => slot.entries.length > 0),
    [activeBlock.slots],
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
    params.set("template", template.id);
    if (patientId) {
      params.set("tab", "ernaehrungsplan");
      params.set("planView", "week");
      params.set("planDate", dateString);
      router.push(`/patienten/${patientId}?${params.toString()}`);
      return;
    }
    params.set("date", dateString);
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
        dayBlocks: template.dayBlocks?.map((block) => ({
          offsetDays: block.offsetDays,
          slots: cloneSlots(block.slots),
        })),
        patientId: duplicateScope === "patient" ? patientId : undefined,
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

  const openEditDialog = () => {
    setEditName(template.name);
    setEditDescription(template.description ?? "");
    setEditIndication(template.indication ?? "");
    setEditDietLineId(template.dietLineId ?? "");
    setEditScope(template.patientId ? "patient" : "advisor");
    setEditDialogOpen(true);
  };

  const handleSaveMetadata = async () => {
    const name = editName.trim();
    if (!name) return;
    setIsSavingEdit(true);
    try {
      const saved = await saveTemplate({
        id: template.id,
        name,
        description: editDescription.trim() || undefined,
        indication: editIndication.trim() || undefined,
        dietLineId: editDietLineId || undefined,
        targetProfileId: template.targetProfileId,
        notes: template.notes,
        slots: cloneSlots(template.slots),
        dayBlocks: template.dayBlocks?.map((block) => ({
          offsetDays: block.offsetDays,
          slots: cloneSlots(block.slots),
        })),
        patientId: editScope === "patient" ? patientId : undefined,
      });
      setTemplate(saved);
      setEditDialogOpen(false);
      toast.success("Vorlage aktualisiert.");
    } catch (error) {
      console.error("Failed to update meal plan template:", error);
      toast.error("Vorlage konnte nicht aktualisiert werden.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeTemplate(template.id);
      toast.success("Vorlage gelöscht.");
      router.replace(backHref);
    } catch (error) {
      console.error("Failed to delete meal plan template:", error);
      toast.error("Vorlage konnte nicht gelöscht werden.");
      setIsDeleting(false);
    }
  };

  const closeDuplicateDialog = () => {
    setDuplicateDialogOpen(false);
    setDuplicateError(null);
    setDuplicateSuccessId(null);
  };

  const backParams = new URLSearchParams({ scope });
  if (patientId) backParams.set("patientId", patientId);
  if (returnDate) backParams.set("returnDate", returnDate);
  const backHref = `/ernaehrungsplan/bibliothek?${backParams.toString()}`;
  const templateScopeLabel = template.patientId ? "Vorlage dieses Patienten" : "Meine Vorlage";
  const spanDays = getMealPlanTemplateSpanDays(template);

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={template.description || templateScopeLabel}
        helpText={isMultiDay ? "Dieser mehrtägige Vorlagenblock behält beim Anwenden seine relativen Abstände. Wähle unten jeden Vorlagentag einzeln aus, um Inhalt und Tageswerte zu prüfen." : "Diese Detailansicht zeigt alle Slots der Vorlage mit Tagessummen und – falls ein Patient gewählt ist – den Vergleich gegen das aktive Referenzprofil. Über 'Anwenden' lädt die Vorlage einen Tagesplan im Planer; beim Speichern einer Kopie wählst du ihren Geltungsbereich bewusst."}
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
            onClick={openEditDialog}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Metadaten
          </Button>
          <Button size="sm" asChild>
            <Link href={`/ernaehrungsplan/bibliothek/${template.id}?${backParams.toString()}&edit=true`}>
              Inhalt bearbeiten
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateDialogOpen(true)}
          >
            <BookmarkPlus className="mr-2 h-4 w-4" />
            Kopie speichern
          </Button>
          <Button size="sm" onClick={() => setApplyDialogOpen(true)}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Anwenden
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  „{template.name}“ wird dauerhaft entfernt. Bereits erstellte Ernährungspläne bleiben unverändert.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDelete();
                  }}
                >
                  {isDeleting ? "Löscht…" : "Vorlage löschen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
          {spanDays > 1
            ? `${templateBlocks.length} Planungstage · Zeitraum ${spanDays} Tage · ${totalEntryCount} Einträge`
            : `${filledSlots.length} Slot${filledSlots.length === 1 ? "" : "s"} · ${entryCount} Einträge`}
        </Badge>
        <Badge variant="outline">{templateScopeLabel}</Badge>
      </div>

      {isMultiDay && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vorlagentage prüfen</CardTitle>
            <CardDescription>
              Jeder Tag wird separat ausgewertet; fehlende Positionen bleiben beim Anwenden als bewusste Lücken erhalten.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {templateBlocks.map((block) => {
              const blockEntryCount = block.slots.reduce(
                (sum, slot) => sum + slot.entries.length,
                0,
              );
              return (
                <Button
                  key={block.offsetDays}
                  type="button"
                  variant={activeBlock.offsetDays === block.offsetDays ? "default" : "outline"}
                  onClick={() => setActiveBlockOffset(block.offsetDays)}
                >
                  Tag {block.offsetDays + 1} · {blockEntryCount} {blockEntryCount === 1 ? "Eintrag" : "Einträge"}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}

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
          <CardTitle className="text-base">{isMultiDay ? `Vorlagentag ${activeBlock.offsetDays + 1}: Slot-Aufbau` : "Slot-Aufbau"}</CardTitle>
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
          <CardTitle className="text-base">Nährstoff-Übersicht ({isMultiDay ? `Vorlagentag ${activeBlock.offsetDays + 1}` : "Tagessumme"})</CardTitle>
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
              {template.dayBlocks && template.dayBlocks.length > 1
                ? "Der Block wird im Planer geöffnet. Dort prüfst du alle Zieltage gemeinsam, bevor bestehende Entwürfe ersetzt werden."
                : "Die Vorlage wird auf den gewählten Tag im Planer übernommen. Ein bestehender Tagesplan an diesem Datum wird durch die Vorlage ersetzt."}
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
              {template.dayBlocks && template.dayBlocks.length > 1 ? "Im Planer öffnen" : "Im Plan öffnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vorlage bearbeiten</DialogTitle>
            <DialogDescription>
              Ändere die Einordnung der Vorlage. Planungstage, Abstände und Inhalte bleiben unverändert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {patientId ? (
              <div className="space-y-1.5">
                <Label>Geltungsbereich</Label>
                <Select
                  value={editScope}
                  onValueChange={(value) => setEditScope(value as "patient" | "advisor")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">Nur für diesen Patienten</SelectItem>
                    <SelectItem value="advisor">Für alle meine Patienten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="edit-template-name">Name</Label>
              <Input
                id="edit-template-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-template-description">Beschreibung</Label>
              <Textarea
                id="edit-template-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-template-indication">Indikation</Label>
              <Input
                id="edit-template-indication"
                value={editIndication}
                onChange={(event) => setEditIndication(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kostform</Label>
              <Select
                value={editDietLineId || "none"}
                onValueChange={(value) => setEditDietLineId(value === "none" ? "" : value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Zuordnung</SelectItem>
                  {DIET_LINES.map((line) => (
                    <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => void handleSaveMetadata()}
              disabled={isSavingEdit || !editName.trim()}
            >
              {isSavingEdit ? "Speichert…" : "Änderungen speichern"}
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
            <DialogTitle>Kopie speichern</DialogTitle>
            <DialogDescription>
              Erstellt eine bearbeitbare Kopie. Im Patientenkontext legst du
              ihren Geltungsbereich fest.
            </DialogDescription>
          </DialogHeader>
          {duplicateSuccessId ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Vorlage erfolgreich gespeichert.</span>
              </div>
              <p className="text-muted-foreground">
                Du findest die Kopie ab sofort hier und im Planer unter „Vorlagen“.
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
                {patientId ? <div className="space-y-1">
                  <Label>Geltungsbereich</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={duplicateScope === "patient" ? "secondary" : "outline"} onClick={() => setDuplicateScope("patient")}>Nur für diesen Patienten</Button>
                    <Button type="button" size="sm" variant={duplicateScope === "advisor" ? "secondary" : "outline"} onClick={() => setDuplicateScope("advisor")}>Für alle meine Patienten</Button>
                  </div>
                </div> : null}
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
