"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/format"
import { typedZodResolver } from "@/lib/forms"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { AnthropometricEntry } from "@/lib/types"

const anthroSchema = z.object({
  date: z.string().min(1, "Datum ist erforderlich"),
  weight: z.coerce.number().min(20, "Gewicht muss mindestens 20 kg sein").max(400),
  height: z.coerce.number().min(50, "Größe muss mindestens 50 cm sein").max(250),
  waistCircumference: z.coerce.number().min(0).optional().or(z.literal("")),
  hipCircumference: z.coerce.number().min(0).optional().or(z.literal("")),
  bodyFatPercentage: z.coerce.number().min(0).max(80).optional().or(z.literal("")),
  fatFreeMassKg: z.coerce.number().min(0).optional().or(z.literal("")),
  subcutaneousFatPercentage: z.coerce.number().min(0).max(80).optional().or(z.literal("")),
  visceralFatRating: z.coerce.number().min(0).optional().or(z.literal("")),
  bodyWaterPercentage: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  muscleMassKg: z.coerce.number().min(0).optional().or(z.literal("")),
  skeletalMusclePercentage: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  boneMassKg: z.coerce.number().min(0).optional().or(z.literal("")),
  proteinPercentage: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  bmrKcal: z.coerce.number().min(0).optional().or(z.literal("")),
  metabolicAgeYears: z.coerce.number().min(0).optional().or(z.literal("")),
})

type AnthroFormValues = z.infer<typeof anthroSchema>

/**
 * A half-filled measurement, kept between visits.
 *
 * Sixteen fields is a lot to re-enter, and a consultation gets interrupted.
 * The draft lives in `localStorage` rather than the database on purpose: it is
 * unvalidated, possibly wrong input, and must never look like a recorded
 * measurement until the practitioner saves it.
 */
interface StoredDraft {
  savedAt: string
  values: Partial<AnthroFormValues>
}

function readDraft(key?: string): StoredDraft | null {
  if (!key || typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    return parsed && typeof parsed === "object" && parsed.values ? parsed : null
  } catch {
    // Corrupt or unavailable storage must never block recording a measurement.
    return null
  }
}

function clearDraft(key?: string) {
  if (!key || typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to do — the draft simply outlives this attempt to drop it.
  }
}

interface AnthropometricFormProps {
  patientId: string
  defaultHeight?: number
  /**
   * Storage key for keeping unsaved input. Omit to disable drafting entirely.
   * Callers pass a per-patient key so one patient's draft can never surface in
   * another's record.
   */
  draftKey?: string
  onSubmit: (entry: Omit<AnthropometricEntry, "id" | "createdAt" | "updatedAt">) => void
  onCancel: () => void
}

export function AnthropometricForm({
  patientId,
  defaultHeight,
  draftKey,
  onSubmit,
  onCancel,
}: AnthropometricFormProps) {
  const emptyValues = useMemo<AnthroFormValues>(
    () => ({
      date: format(new Date(), "yyyy-MM-dd"),
      weight: 0,
      height: defaultHeight ?? 0,
      waistCircumference: "",
      hipCircumference: "",
      bodyFatPercentage: "",
      fatFreeMassKg: "",
      subcutaneousFatPercentage: "",
      visceralFatRating: "",
      bodyWaterPercentage: "",
      muscleMassKg: "",
      skeletalMusclePercentage: "",
      boneMassKg: "",
      proteinPercentage: "",
      bmrKcal: "",
      metabolicAgeYears: "",
    }),
    [defaultHeight],
  )

  // Read once, during the first render: the restored values have to be in place
  // before the form initialises, and a later effect would overwrite typing.
  const [restoredDraft, setRestoredDraft] = useState(() => readDraft(draftKey))

  const form = useForm<AnthroFormValues>({
    resolver: typedZodResolver(anthroSchema),
    defaultValues: { ...emptyValues, ...restoredDraft?.values },
  })

  // `useWatch` rather than `form.watch(callback)`: the callback form hands back
  // a subscription the React Compiler cannot reason about, and it opts the
  // whole component out of memoisation.
  const watchedValues = useWatch({ control: form.control })
  const isDirty = form.formState.isDirty

  useEffect(() => {
    // An untouched form must not leave a draft behind, or reopening a record
    // would always claim there was unsaved work.
    if (!draftKey || !isDirty) return
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          values: watchedValues,
        } satisfies StoredDraft),
      )
    } catch {
      // Full or blocked storage costs the draft, not the measurement.
    }
  }, [draftKey, isDirty, watchedValues])

  function handleDiscardDraft() {
    clearDraft(draftKey)
    setRestoredDraft(null)
    form.reset(emptyValues)
  }

  function handleSubmit(values: AnthroFormValues) {
    const heightM = values.height / 100
    const bmi = Math.round((values.weight / (heightM * heightM)) * 10) / 10

    onSubmit({
      patientId,
      date: values.date,
      weight: values.weight,
      height: values.height,
      bmi,
      waistCircumference: typeof values.waistCircumference === "number" ? values.waistCircumference : undefined,
      hipCircumference: typeof values.hipCircumference === "number" ? values.hipCircumference : undefined,
      bodyFatPercentage: typeof values.bodyFatPercentage === "number" ? values.bodyFatPercentage : undefined,
      fatFreeMassKg: typeof values.fatFreeMassKg === "number" ? values.fatFreeMassKg : undefined,
      subcutaneousFatPercentage:
        typeof values.subcutaneousFatPercentage === "number" ? values.subcutaneousFatPercentage : undefined,
      visceralFatRating: typeof values.visceralFatRating === "number" ? values.visceralFatRating : undefined,
      bodyWaterPercentage: typeof values.bodyWaterPercentage === "number" ? values.bodyWaterPercentage : undefined,
      muscleMassKg: typeof values.muscleMassKg === "number" ? values.muscleMassKg : undefined,
      skeletalMusclePercentage:
        typeof values.skeletalMusclePercentage === "number" ? values.skeletalMusclePercentage : undefined,
      boneMassKg: typeof values.boneMassKg === "number" ? values.boneMassKg : undefined,
      proteinPercentage: typeof values.proteinPercentage === "number" ? values.proteinPercentage : undefined,
      bmrKcal: typeof values.bmrKcal === "number" ? values.bmrKcal : undefined,
      metabolicAgeYears: typeof values.metabolicAgeYears === "number" ? values.metabolicAgeYears : undefined,
    })

    // The values are recorded now, so the draft has served its purpose.
    clearDraft(draftKey)
    setRestoredDraft(null)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {restoredDraft ? (
          // Restored values must announce themselves. Numbers appearing in a
          // clinical form without explanation is how a stale draft becomes a
          // recorded measurement.
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Nicht gespeicherter Entwurf vom {formatDate(restoredDraft.savedAt)} wiederhergestellt.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={handleDiscardDraft}
            >
              Entwurf verwerfen
            </Button>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Datum</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gewicht (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min="20" placeholder="kg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="height"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Größe (cm)</FormLabel>
                <FormControl>
                  <Input type="number" min="50" placeholder="cm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="waistCircumference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bauchumfang (cm)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hipCircumference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hüftumfang (cm)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bodyFatPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Körperfett (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="fatFreeMassKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fettfreie Masse (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subcutaneousFatPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unterhautfettgewebe (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="visceralFatRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Viszerales Fett</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="bodyWaterPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Körperwasser (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="muscleMassKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Muskelmasse (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="skeletalMusclePercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Skelettmuskeln (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField
            control={form.control}
            name="boneMassKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Knochenmasse (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="proteinPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Protein (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bmrKcal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BMR (kcal)</FormLabel>
                <FormControl>
                  <Input type="number" step="1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metabolicAgeYears"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Metabolisches Alter</FormLabel>
                <FormControl>
                  <Input type="number" step="1" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit">Messung speichern</Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
