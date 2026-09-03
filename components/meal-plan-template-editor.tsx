"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange, LayoutTemplate, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { MealPlanLibrary, readMealPlanDragPayload, type MealPlanDragPayload } from "@/components/meal-plan-library";
import { useFoods, useFoodSearch } from "@/components/foods-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMealPlanTemplates } from "@/hooks/use-meal-plan-templates";
import { FOOD_CATEGORIES } from "@/lib/data/food-categories";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { getMealPlanTemplateBlocks, getMealPlanTemplateSpanDays } from "@/lib/meal-plan-template-utils";
import { DIET_LINES } from "@/lib/reference-data/diet-lines";
import { createRecipeLookup } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import type { MealPlanTemplate, MealPlanTemplateDayBlock, MealSlotType, Recipe } from "@/lib/types";

const SLOT_ORDER = Object.keys(MEAL_SLOT_LABELS) as MealSlotType[];
function emptyDay(offsetDays: number): MealPlanTemplateDayBlock {
  return { offsetDays, slots: SLOT_ORDER.map((type) => ({ type, entries: [] })) };
}

export function MealPlanTemplateEditor({ template, recipes, patients, patientId, scope = "general", returnDate }: {
  template?: MealPlanTemplate;
  recipes: Recipe[];
  patients: Array<{ id: string; firstName: string; lastName: string }>;
  patientId?: string;
  scope?: "general" | "patient";
  returnDate?: string;
}) {
  const router = useRouter();
  const foods = useFoods();
  const { index, loadIndex, isLoading: loadingFoods } = useFoodSearch();
  const { saveTemplate } = useMealPlanTemplates({ initialTemplates: template ? [template] : [], patientId });
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [indication, setIndication] = useState(template?.indication ?? "");
  const [dietLineId, setDietLineId] = useState(template?.dietLineId ?? "none");
  const [templateScope, setTemplateScope] = useState(template ? (template.patientId ? "patient" : "general") : scope);
  const [selectedPatientId, setSelectedPatientId] = useState(template?.patientId ?? patientId ?? "");
  const [days, setDays] = useState<MealPlanTemplateDayBlock[]>(() => {
    if (!template) return [emptyDay(0)];
    const existing = getMealPlanTemplateBlocks(template);
    return Array.from({ length: getMealPlanTemplateSpanDays(template) }, (_, offset) => {
      const day = existing.find((item) => item.offsetDays === offset);
      return day ? structuredClone(day) : emptyDay(offset);
    });
  });
  const [activeDay, setActiveDay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const saveInFlight = useRef(false);
  const [savedId] = useState(() => template?.id ?? crypto.randomUUID());
  const categories = useMemo(() => new Map(FOOD_CATEGORIES.map((item) => [item.id, item.name])), []);
  const foodNames = useMemo(() => new Map([...foods, ...index].map((food) => [food.id, food.name])), [foods, index]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);
  const entryCount = days.reduce((total, day) => total + day.slots.reduce((sum, slot) => sum + slot.entries.length, 0), 0);

  useEffect(() => { void loadIndex(); }, [loadIndex]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    // App navigation outside the editor must not silently discard a draft.
    const interceptLink = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (link && !window.confirm("Ungespeicherte Änderungen verwerfen?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", interceptLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", interceptLink, true); };
  }, [dirty]);

  const query = new URLSearchParams({ scope: templateScope });
  const contextPatientId = templateScope === "patient" ? selectedPatientId : patientId;
  if (contextPatientId) query.set("patientId", contextPatientId);
  if (returnDate) query.set("returnDate", returnDate);
  const backHref = `/ernaehrungsplan/bibliothek?${query.toString()}`;

  const resize = (length: number) => {
    if (length < days.length && days.slice(length).some((day) => day.slots.some((slot) => slot.entries.length)) && !window.confirm("Die entfernten Vorlagentage enthalten Mahlzeiten. Trotzdem verkürzen?")) return;
    setDays((previous) => Array.from({ length }, (_, offset) => previous[offset] ?? emptyDay(offset)));
    setActiveDay((previous) => Math.min(previous, length - 1));
    setDirty(true);
  };

  const add = (payload: MealPlanDragPayload, slotType: MealSlotType, dayIndex = activeDay) => {
    if (saving || (payload.type !== "food" && payload.type !== "recipe")) return;
    if (!(payload.type === "food" ? foodNames.has(payload.referenceId) : recipeMap.has(payload.referenceId))) {
      toast.error("Dieser Eintrag ist nicht verfügbar."); return;
    }
    setDays((previous) => previous.map((day, offset) => offset !== dayIndex ? day : {
      ...day, slots: day.slots.map((slot) => slot.type !== slotType ? slot : { ...slot, entries: [...slot.entries, {
        id: crypto.randomUUID(), type: payload.type, referenceId: payload.referenceId, amount: payload.type === "food" ? 100 : 1,
      }] }),
    }));
    setDirty(true);
  };

  const save = async () => {
    if (saveInFlight.current) return;
    if (!name.trim()) { setSaveError("Bitte gib der Vorlage einen Namen."); return; }
    if (!entryCount) { setSaveError("Füge mindestens ein Lebensmittel oder Rezept hinzu."); return; }
    if (templateScope === "patient" && !patients.some((item) => item.id === selectedPatientId)) { setSaveError("Bitte wähle einen Patienten aus."); return; }
    saveInFlight.current = true; setSaving(true); setSaveError(undefined);
    try {
      const saved = await saveTemplate({
        id: savedId, name: name.trim(), description: description.trim(), indication: indication.trim() || undefined,
        dietLineId: dietLineId === "none" ? undefined : dietLineId,
        patientId: templateScope === "patient" ? selectedPatientId : undefined,
        slots: days[0].slots, dayBlocks: days.length > 1 ? days : undefined,
        targetProfileId: template?.targetProfileId, notes: template?.notes,
      });
      setDirty(false);
      toast.success("Vorlage gespeichert.");
      router.replace(`/ernaehrungsplan/bibliothek/${saved.id}?${query.toString()}`);
    } catch {
      setSaveError("Die Vorlage konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. Bitte versuche es erneut.");
    } finally { saveInFlight.current = false; setSaving(false); }
  };

  return <div className="space-y-6">
    <PageHeader title={template ? "Vorlage bearbeiten" : "Neue Vorlage"} description="Ein wiederverwendbarer Ernährungsplan – ohne Kalenderdatum. Tag 1 beginnt später dort, wo du die Vorlage einsetzt.">
      <Button variant="outline" disabled={saving} onClick={() => { if (!dirty || window.confirm("Ungespeicherte Änderungen verwerfen?")) router.push(backHref); }}><ArrowLeft className="mr-2 size-4" />Zur Übersicht</Button>
      <Button disabled={saving} onClick={() => void save()}><Save className="mr-2 size-4" />{saving ? "Speichert …" : "Vorlage speichern"}</Button>
    </PageHeader>
    {saveError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</p>}
    <fieldset disabled={saving} className="min-w-0 space-y-6">
      <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3" onChange={() => setDirty(true)}>
        <div className="space-y-2"><Label htmlFor="blueprint-name">Name</Label><Input id="blueprint-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Mediterrane Woche" /></div>
        <div className="space-y-2"><Label htmlFor="blueprint-scope">Geltungsbereich</Label><Select value={templateScope} onValueChange={(value) => { setTemplateScope(value as "general" | "patient"); setDirty(true); }}><SelectTrigger id="blueprint-scope"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">Allgemeine Vorlage</SelectItem><SelectItem value="patient">Patientenspezifische Vorlage</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="blueprint-length">Zeitraum</Label><Select value={String(days.length)} onValueChange={(value) => resize(Number(value))}><SelectTrigger id="blueprint-length"><CalendarRange className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: Math.max(28, days.length) }, (_, index) => index + 1).map((length) => <SelectItem key={length} value={String(length)}>{length === 1 ? "1 Tag" : length === 7 ? "1 Woche · 7 Tage" : `${length} Tage`}</SelectItem>)}</SelectContent></Select></div>
        {templateScope === "patient" && <div className="space-y-2"><Label htmlFor="blueprint-patient">Patient</Label><Select value={selectedPatientId} onValueChange={(value) => { setSelectedPatientId(value); setDirty(true); }}><SelectTrigger id="blueprint-patient"><SelectValue placeholder="Patient auswählen" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.lastName}, {patient.firstName}</SelectItem>)}</SelectContent></Select></div>}
        <div className="space-y-2"><Label htmlFor="blueprint-indication">Indikation</Label><Input id="blueprint-indication" value={indication} onChange={(event) => setIndication(event.target.value)} placeholder="z. B. Diabetes mellitus Typ 2" /></div>
        <div className="space-y-2"><Label htmlFor="blueprint-diet">Kostform</Label><Select value={dietLineId} onValueChange={(value) => { setDietLineId(value); setDirty(true); }}><SelectTrigger id="blueprint-diet"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Keine Zuordnung</SelectItem>{DIET_LINES.map((diet) => <SelectItem key={diet.id} value={diet.id}>{diet.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label htmlFor="blueprint-description">Beschreibung</Label><Textarea id="blueprint-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></div>
      </CardContent></Card>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="text-sm font-medium">Hinzufügen per + zu Tag {activeDay + 1}</p>
          {loadingFoods && <p role="status" className="text-xs text-muted-foreground">Lebensmittel werden geladen …</p>}
          <MealPlanLibrary foods={index} fullFoods={foods} recipes={recipes} categoryLabels={categories} hideTemplates isLocked={saving} onQuickAdd={add} className="max-h-[65vh] overflow-y-auto" />
        </aside>
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LayoutTemplate className="size-4 shrink-0" />Vorlagenraster · Lebensmittel und Rezepte hineinziehen oder über + hinzufügen. Freie Tage bleiben frei.</p>
          <div className="overflow-x-auto rounded-xl border">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${days.length === 1 ? 280 : 220}px, 1fr))` }}>
              {days.map((day, dayIndex) => <section key={day.offsetDays} className="min-w-0 border-r last:border-r-0" aria-label={`Vorlagentag ${dayIndex + 1}`}>
                <Button variant="ghost" aria-pressed={activeDay === dayIndex} className={cn("w-full rounded-none border-b py-6", activeDay === dayIndex && "bg-primary/10 text-primary")} onClick={() => setActiveDay(dayIndex)}>Tag {dayIndex + 1}</Button>
                {day.slots.map((slot) => <div key={slot.type} className="min-h-36 border-b p-3 last:border-b-0" data-template-day={dayIndex + 1} data-template-slot={slot.type} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const payload = readMealPlanDragPayload(event); if (payload) add(payload, slot.type, dayIndex); }}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{MEAL_SLOT_LABELS[slot.type]}</h3>
                  {slot.entries.map((entry) => <div key={entry.id} className="mb-2 space-y-2 rounded-lg border bg-background p-2 shadow-sm">
                    <p className="text-sm">{entry.type === "food" ? foodNames.get(entry.referenceId) ?? "Lebensmittel nicht verfügbar" : recipeMap.get(entry.referenceId)?.name ?? "Rezept nicht verfügbar"}</p>
                    <div className="flex items-center gap-2"><Input aria-label={`Menge ${entry.type === "food" ? foodNames.get(entry.referenceId) ?? "Lebensmittel" : recipeMap.get(entry.referenceId)?.name ?? "Rezept"}`} type="number" min="0.01" step="0.01" className="h-8 min-w-0" value={entry.amount} onChange={(event) => { const amount = Number(event.target.value); if (!Number.isFinite(amount) || amount <= 0) return; setDays((previous) => previous.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s, entries: s.entries.map((item) => item.id === entry.id ? { ...item, amount } : item) })) }))); setDirty(true); }} /><span className="text-xs text-muted-foreground">{entry.type === "food" ? "g" : "Port."}</span><Button size="icon" variant="ghost" aria-label="Eintrag entfernen" onClick={() => { setDays((previous) => previous.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s, entries: s.entries.filter((item) => item.id !== entry.id) })) }))); setDirty(true); }}><Trash2 className="size-4" /></Button></div>
                  </div>)}
                  {slot.entries.length === 0 && <Button variant="ghost" size="sm" className="h-12 w-full text-muted-foreground" onClick={() => { setActiveDay(dayIndex); toast.info(`Tag ${dayIndex + 1} ausgewählt. Füge ein Rezept oder Lebensmittel über die Bibliothek hinzu.`); }} aria-label={`${MEAL_SLOT_LABELS[slot.type]} an Tag ${dayIndex + 1} auswählen`}><Plus className="size-4" /></Button>}
                </div>)}
              </section>)}
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  </div>;
}
