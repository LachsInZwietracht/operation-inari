"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CalendarDays, Columns2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFoods } from "@/components/foods-provider";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { getMealPlanTemplateSpanDays } from "@/lib/meal-plan-template-utils";
import { summarizeTemplateForComparison, templateComparisonValue, TEMPLATE_COMPARISON_NUTRIENTS } from "@/lib/meal-plan-template-comparison";
import { createRecipeLookup } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import type { MealPlanTemplate, Recipe } from "@/lib/types";

function amountLabel(value: number | null, unit: string): string {
  return value == null ? "Keine vollständigen Daten" : `${value.toLocaleString("de-DE", { maximumFractionDigits: unit === "kcal" ? 0 : 1 })} ${unit}`;
}

export function MealPlanTemplateComparison({
  templates, recipes, open, onOpenChange, initialTemplateId, patientName,
}: {
  templates: MealPlanTemplate[];
  recipes: Recipe[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string;
  patientName?: string;
}) {
  const foods = useFoods();
  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes]);
  const [leftId, setLeftId] = useState(initialTemplateId ?? "");
  const [rightId, setRightId] = useState("");
  const [requestedBasis, setRequestedBasis] = useState<"average" | "total">("average");
  const [requestedDay, setRequestedDay] = useState(0);
  const summaries = useMemo(() => [leftId, rightId].map((id) => {
    const template = templates.find((item) => item.id === id);
    return template ? summarizeTemplateForComparison(template, foods, foodMap, recipeMap) : undefined;
  }), [leftId, rightId, templates, foods, foodMap, recipeMap]);
  const [left, right] = summaries;
  const ready = Boolean(left && right && leftId !== rightId);
  const sameSpan = Boolean(ready && left?.spanDays === right?.spanDays);
  const basis = requestedBasis === "total" && sameSpan ? "total" : "average";
  const offsets = [...new Set(summaries.flatMap((summary) => summary?.days.map((day) => day.offsetDays) ?? []))].sort((a, b) => a - b);
  const selectedDay = offsets.includes(requestedDay) ? requestedDay : (offsets[0] ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-5xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-6 py-7 text-left sm:px-8">
          <span className="text-primary mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"><Columns2 className="size-4" /> Vorlagen im Vergleich</span>
          <DialogTitle className="text-2xl tracking-tight">Zwei Pläne. Direkt nebeneinander.</DialogTitle>
          <DialogDescription>Vergleiche Inhalt und Nährwerte deiner Vorlagen, ohne einen Plan zu verändern.{patientName ? ` Verfügbar: allgemeine Vorlagen und Vorlagen für ${patientName}.` : " Verfügbar: allgemeine Vorlagen."}</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-6 p-5 sm:p-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            {[0, 1].map((index) => (
              <div key={index} className={cn("min-w-0 rounded-xl border p-4", index === 0 ? "border-primary/25 bg-primary/5" : "border-violet-500/25 bg-violet-500/5", index === 1 && "sm:col-start-3 sm:row-start-1")}>
                <Label htmlFor={`comparison-${index}`} className="mb-3 block text-xs uppercase tracking-wider">Vorlage {index === 0 ? "A" : "B"}</Label>
                <Select value={index === 0 ? leftId : rightId} onValueChange={index === 0 ? setLeftId : setRightId}>
                  <SelectTrigger id={`comparison-${index}`} className="bg-background w-full"><SelectValue placeholder="Vorlage auswählen" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id} disabled={template.id === (index === 0 ? rightId : leftId)}>
                        {template.name} · {getMealPlanTemplateSpanDays(template)} {getMealPlanTemplateSpanDays(template) === 1 ? "Tag" : "Tage"} · {template.patientId ? "Patient" : "Allgemein"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {summaries[index] ? <p className="text-muted-foreground mt-3 text-xs">{summaries[index]!.spanDays} Tage Zeitraum · {summaries[index]!.filledDays} gefüllt · {summaries[index]!.entryCount} Einträge</p> : <p className="text-muted-foreground mt-3 text-xs">Tag, Woche oder eigener Zeitraum</p>}
              </div>
            ))}
            <Button variant="ghost" size="icon" className="hidden sm:col-start-2 sm:row-start-1 sm:flex" aria-label="Vorlagen tauschen" disabled={!ready} onClick={() => { setLeftId(rightId); setRightId(leftId); }}><ArrowLeftRight className="size-4" /></Button>
          </div>

          {!ready ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <Columns2 className="text-primary mx-auto mb-3 size-8" />
              <h3 className="font-semibold">Wähle zwei unterschiedliche Vorlagen</h3>
              <p className="text-muted-foreground mt-2 text-sm">Danach siehst du Nährwerte, Unterschiede und den Aufbau der einzelnen Tage.</p>
              {templates.length < 2 && <p className="text-muted-foreground mt-2 text-sm">In diesem Bereich ist noch keine zweite Vorlage verfügbar.</p>}
            </div>
          ) : left && right ? (
            <>
              <div className="flex gap-3 rounded-xl bg-muted/50 p-4 text-sm">
                <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">{sameSpan ? "Gleiche Zeitspanne – gemeinsame Vergleichsbasis." : `Unterschiedliche Zeitspannen: ${left.spanDays} und ${right.spanDays} Tage.`}</p>
                  <p className="text-muted-foreground">Der Durchschnitt bezieht sich auf gefüllte Planungstage, nicht automatisch auf vollständige Ernährungstage. Freie Tage zählen nicht als Null-Tage.</p>
                  {(left.emptyDays > 0 || right.emptyDays > 0) && <p className="text-muted-foreground">Freie Tage: A {left.emptyDays} · B {right.emptyDays}. Auch Gesamtsummen enthalten nur die vorhandenen Einträge.</p>}
                </div>
              </div>

              <section aria-label="Nährwertvergleich" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">Nährwerte</h3>
                  <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
                    <Button size="sm" variant={basis === "average" ? "secondary" : "ghost"} aria-pressed={basis === "average"} onClick={() => setRequestedBasis("average")}>Ø pro Planungstag</Button>
                    <Button size="sm" variant={basis === "total" ? "secondary" : "ghost"} aria-pressed={basis === "total"} disabled={!sameSpan} onClick={() => setRequestedBasis("total")}>Gesamter Zeitraum</Button>
                  </div>
                </div>
                {!sameSpan && <p className="text-muted-foreground text-xs">Gesamtsummen sind nur bei gleicher Zeitspanne vergleichbar.</p>}
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[540px] text-sm">
                    <caption className="sr-only">{basis === "average" ? "Nährwerte pro gefülltem Planungstag" : "Nährwerte im gesamten Zeitraum"}</caption>
                    <thead className="bg-muted/40 text-left text-xs"><tr><th scope="col" className="p-4">Nährstoff</th><th scope="col" className="p-4 text-primary">Vorlage A</th><th scope="col" className="p-4 text-violet-600 dark:text-violet-400">Vorlage B</th><th scope="col" className="p-4 text-right">Unterschied B − A</th></tr></thead>
                    <tbody>{TEMPLATE_COMPARISON_NUTRIENTS.map(({ id, label, unit }) => {
                      const a = templateComparisonValue(left, id, basis);
                      const b = templateComparisonValue(right, id, basis);
                      const max = Math.max(a ?? 0, b ?? 0);
                      const delta = a == null || b == null ? null : b - a;
                      return <tr key={id} className="border-t" data-nutrient={id}>
                        <th scope="row" className="p-4 text-left font-medium">{label}</th>
                        {[a, b].map((value, index) => <td key={index} className="p-4 align-top"><span className={cn("tabular-nums", value == null && "text-muted-foreground text-xs")}>{amountLabel(value, unit)}</span>{value != null && <div className="mt-2 h-1 rounded-full bg-muted" aria-hidden="true"><div className={cn("h-1 rounded-full", index === 0 ? "bg-primary" : "bg-violet-500")} style={{ width: `${max > 0 ? value / max * 100 : 0}%` }} /></div>}</td>)}
                        <td className="p-4 text-right tabular-nums">{delta == null ? "—" : `${delta > 0 ? "+" : ""}${amountLabel(delta, unit)}`}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
                <p className="text-muted-foreground text-xs">Fehlende Quellenwerte werden nicht als 0 gerechnet. Unterschiede beschreiben Mengen, nicht „besser“ oder „schlechter“.</p>
              </section>

              <section aria-label="Tagesaufbau" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4" /> Tagesaufbau</h3>
                  <Select value={String(selectedDay)} onValueChange={(value) => setRequestedDay(Number(value))}>
                    <SelectTrigger aria-label="Vergleichstag" className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{offsets.map((offset) => <SelectItem key={offset} value={String(offset)}>Tag {offset + 1}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-xs">Relative Tage ab Vorlagenbeginn; auswählbar sind die in mindestens einer Vorlage gespeicherten Tage.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[left, right].map((summary, index) => {
                    const day = summary.days.find((item) => item.offsetDays === selectedDay);
                    const filledSlots = day?.slots.filter((slot) => slot.entries.length > 0) ?? [];
                    return <div key={summary.template.id} className={cn("min-w-0 rounded-xl border p-5", index === 0 ? "border-primary/25" : "border-violet-500/25")}>
                      <h4 className="mb-4 break-words font-semibold">{index === 0 ? "A" : "B"} · {summary.template.name}</h4>
                      {filledSlots.length === 0 ? <p className="text-muted-foreground text-sm">{selectedDay >= summary.spanDays ? "Dieser Tag liegt außerhalb der Vorlage." : "Dieser Tag ist nicht gefüllt."}</p> : filledSlots.map((slot) => <div key={slot.type} className="border-t py-3 first:border-0">
                        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">{MEAL_SLOT_LABELS[slot.type]}</p>
                        <ul className="space-y-2 text-sm">{slot.entries.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-3">
                          <span className="break-words">{entry.type === "food" ? foodMap.get(entry.referenceId)?.name ?? "Lebensmittel nicht verfügbar" : recipeMap.get(entry.referenceId)?.name ?? "Rezept nicht verfügbar"}</span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">{entry.amount.toLocaleString("de-DE", { maximumFractionDigits: 2 })} {entry.type === "food" ? "g" : "Port."}</span>
                        </li>)}</ul>
                      </div>)}
                    </div>;
                  })}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
