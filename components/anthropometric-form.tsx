"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface AnthropometricFormProps {
  patientId: string
  defaultHeight?: number
  onSubmit: (entry: Omit<AnthropometricEntry, "id" | "createdAt" | "updatedAt">) => void
  onCancel: () => void
}

export function AnthropometricForm({
  patientId,
  defaultHeight,
  onSubmit,
  onCancel,
}: AnthropometricFormProps) {
  const form = useForm<AnthroFormValues>({
    resolver: zodResolver(anthroSchema),
    defaultValues: {
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
    },
  })

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
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
