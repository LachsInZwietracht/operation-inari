"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const MEAL_SLOTS = [
  { key: "fruehstueck", label: "Frühstück" },
  { key: "snack_vormittag", label: "Snack Vormittag" },
  { key: "mittagessen", label: "Mittagessen" },
  { key: "snack_nachmittag", label: "Snack Nachmittag" },
  { key: "abendessen", label: "Abendessen" },
] as const;

const entrySchema = z.object({
  mealSlot: z.string(),
  freeText: z.string(),
  time: z.string().optional(),
});

const daySchema = z.object({
  date: z.string().min(1, "Datum ist erforderlich"),
  entries: z.array(entrySchema),
});

const formSchema = z.object({
  days: z.array(daySchema).min(1),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultDay(date?: string) {
  return {
    date: date ?? getTodayISO(),
    entries: MEAL_SLOTS.map((slot) => ({
      mealSlot: slot.key,
      freeText: "",
      time: "",
    })),
  };
}

interface PatientProtocolFormProps {
  linkId: string;
  method: string;
}

export function PatientProtocolForm({
  linkId,
  method,
}: PatientProtocolFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      days: [buildDefaultDay()],
      notes: "",
    },
  });

  const { fields: dayFields, append: appendDay, remove: removeDay } = useFieldArray({
    control: form.control,
    name: "days",
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setSubmitError(null);

    // Filter out empty entries
    const filteredDays = values.days.map((day) => ({
      ...day,
      entries: day.entries
        .filter((entry) => entry.freeText.trim().length > 0)
        .map((entry) => ({
          mealSlot: entry.mealSlot,
          freeText: entry.freeText.trim(),
          ...(entry.time ? { time: entry.time } : {}),
        })),
    }));

    const hasAnyEntry = filteredDays.some((day) => day.entries.length > 0);
    if (!hasAnyEntry) {
      setSubmitError(
        "Bitte füllen Sie mindestens eine Mahlzeit aus."
      );
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/protokoll/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId,
          days: filteredDays,
          notes: values.notes?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ?? `Fehler beim Absenden (${response.status})`
        );
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ein unbekannter Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold">Vielen Dank!</h1>
        <p className="mt-2 text-muted-foreground">
          Ihr Ernährungsprotokoll wurde erfolgreich eingereicht. Ihre
          Ernährungsberatung wird die Daten prüfen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ernährungsprotokoll</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bitte tragen Sie ein, was Sie gegessen und getrunken haben. Methode:{" "}
          <span className="font-medium">{method}</span>
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {dayFields.map((dayField, dayIndex) => (
          <Card key={dayField.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                Tag {dayIndex + 1}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-auto"
                  {...form.register(`days.${dayIndex}.date`)}
                />
                {dayFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDay(dayIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Tag entfernen</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {MEAL_SLOTS.map((slot, slotIndex) => (
                <Collapsible
                  key={slot.key}
                  defaultOpen={slotIndex === 0 && dayIndex === 0}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
                    {slot.label}
                    <span className="text-xs text-muted-foreground">
                      {form.watch(
                        `days.${dayIndex}.entries.${slotIndex}.freeText`
                      )
                        ? "✓"
                        : ""}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 px-1 pt-2">
                    <div>
                      <Label
                        htmlFor={`days.${dayIndex}.entries.${slotIndex}.time`}
                        className="text-xs text-muted-foreground"
                      >
                        Uhrzeit (optional)
                      </Label>
                      <Input
                        id={`days.${dayIndex}.entries.${slotIndex}.time`}
                        type="time"
                        className="w-32"
                        {...form.register(
                          `days.${dayIndex}.entries.${slotIndex}.time`
                        )}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor={`days.${dayIndex}.entries.${slotIndex}.freeText`}
                        className="text-xs text-muted-foreground"
                      >
                        Was haben Sie gegessen und getrunken?
                      </Label>
                      <Textarea
                        id={`days.${dayIndex}.entries.${slotIndex}.freeText`}
                        placeholder="z.B. 2 Scheiben Vollkornbrot mit Butter und Käse, 1 Tasse Kaffee mit Milch"
                        rows={3}
                        {...form.register(
                          `days.${dayIndex}.entries.${slotIndex}.freeText`
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => appendDay(buildDefaultDay())}
        >
          <Plus className="mr-2 h-4 w-4" />
          Tag hinzufügen
        </Button>

        <div>
          <Label htmlFor="notes" className="text-sm">
            Allgemeine Anmerkungen (optional)
          </Label>
          <Textarea
            id="notes"
            placeholder="z.B. Besonderheiten, Unverträglichkeiten, sonstige Hinweise"
            rows={3}
            {...form.register("notes")}
          />
        </div>

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Wird gesendet…" : "Absenden"}
        </Button>
      </form>
    </div>
  );
}
