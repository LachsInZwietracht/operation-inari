"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

import { FOODS } from "@/lib/mock-data"
import { MEAL_SLOT_LABELS, PROTOCOL_TYPE_LABELS } from "@/lib/constants"
import { getNutrientValue } from "@/lib/nutrients"
import type { ProtocolType, MealSlotType, NutritionProtocol } from "@/lib/types"

const entrySchema = z.object({
  foodId: z.string().min(1),
  amount: z.coerce.number().min(1, "Mindestens 1 g"),
  mealSlot: z.string().min(1),
  time: z.string(),
})

const daySchema = z.object({
  date: z.string().min(1, "Datum ist erforderlich"),
  entries: z.array(entrySchema).min(1, "Mindestens ein Eintrag pro Tag"),
})

const protocolSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  type: z.string().min(1, "Typ ist erforderlich"),
  notes: z.string(),
  days: z.array(daySchema).min(1, "Mindestens ein Tag erforderlich"),
})

type ProtocolFormValues = z.infer<typeof protocolSchema>

interface ProtocolFormProps {
  patientId: string
  onSubmit: (protocol: Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt">) => void
}

const MEAL_SLOTS: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

export function ProtocolForm({ patientId, onSubmit }: ProtocolFormProps) {
  const router = useRouter()
  const [foodDialogOpen, setFoodDialogOpen] = useState(false)
  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const form = useForm<ProtocolFormValues>({
    resolver: zodResolver(protocolSchema),
    defaultValues: {
      title: "",
      type: "ernaehrungsprotokoll",
      notes: "",
      days: [{ date: "", entries: [] }],
    },
  })

  const {
    fields: dayFields,
    append: appendDay,
    remove: removeDay,
  } = useFieldArray({ control: form.control, name: "days" })

  const foodMap = new Map(FOODS.map((f) => [f.id, f]))

  function handleAddFood(foodId: string) {
    const currentEntries = form.getValues(`days.${activeDayIndex}.entries`) ?? []
    form.setValue(`days.${activeDayIndex}.entries`, [
      ...currentEntries,
      { foodId, amount: 100, mealSlot: "mittagessen", time: "" },
    ])
    setFoodDialogOpen(false)
  }

  function removeEntry(dayIndex: number, entryIndex: number) {
    const entries = form.getValues(`days.${dayIndex}.entries`)
    form.setValue(
      `days.${dayIndex}.entries`,
      entries.filter((_, i) => i !== entryIndex),
    )
  }

  function handleSubmit(values: ProtocolFormValues) {
    const dates = values.days.map((d) => d.date).sort()

    onSubmit({
      patientId,
      title: values.title,
      type: values.type as ProtocolType,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      notes: values.notes || undefined,
      days: values.days.map((day) => ({
        date: day.date,
        entries: day.entries.map((entry, i) => ({
          id: `pe_new_${i}_${Date.now()}`,
          foodId: entry.foodId,
          amount: entry.amount,
          mealSlot: entry.mealSlot as MealSlotType,
          time: entry.time || undefined,
        })),
      })),
    })

    toast.success("Protokoll erstellt!")
    router.push(`/patienten/${patientId}`)
  }

  const watchedDays = form.watch("days")

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Grunddaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. 3-Tage-Ernährungsprotokoll" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protokolltyp</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.entries(PROTOCOL_TYPE_LABELS) as [ProtocolType, string][]).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notizen</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optionale Anmerkungen" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {dayFields.map((dayField, dayIndex) => (
            <Card key={dayField.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Tag {dayIndex + 1}</CardTitle>
                {dayFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDay(dayIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name={`days.${dayIndex}.date`}
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

                {(watchedDays?.[dayIndex]?.entries ?? []).length > 0 && (
                  <div className="space-y-2">
                    {(watchedDays?.[dayIndex]?.entries ?? []).map((entry, entryIndex) => (
                      <div key={entryIndex} className="flex items-center gap-2 rounded-md border p-2">
                        <span className="flex-1 text-sm font-medium">
                          {foodMap.get(entry.foodId)?.name ?? "Unbekannt"}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          value={entry.amount}
                          onChange={(e) =>
                            form.setValue(
                              `days.${dayIndex}.entries.${entryIndex}.amount`,
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">g</span>
                        <Select
                          value={entry.mealSlot}
                          onValueChange={(val) =>
                            form.setValue(
                              `days.${dayIndex}.entries.${entryIndex}.mealSlot`,
                              val,
                            )
                          }
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEAL_SLOTS.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {MEAL_SLOT_LABELS[slot]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="time"
                          className="w-24"
                          value={entry.time ?? ""}
                          onChange={(e) =>
                            form.setValue(
                              `days.${dayIndex}.entries.${entryIndex}.time`,
                              e.target.value,
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEntry(dayIndex, entryIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveDayIndex(dayIndex)
                    setFoodDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Lebensmittel hinzufügen
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => appendDay({ date: "", entries: [] })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tag hinzufügen
          </Button>

          <div className="flex gap-3">
            <Button type="submit">Protokoll erstellen</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Abbrechen
            </Button>
          </div>
        </form>
      </Form>

      <CommandDialog
        open={foodDialogOpen}
        onOpenChange={setFoodDialogOpen}
        title="Lebensmittel suchen"
        description="Wählen Sie ein Lebensmittel aus der Datenbank"
      >
        <CommandInput placeholder="Lebensmittel suchen..." />
        <CommandList>
          <CommandEmpty>Kein Lebensmittel gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {FOODS.map((food) => (
              <CommandItem
                key={food.id}
                value={food.name}
                onSelect={() => handleAddFood(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {getNutrientValue(food.nutrients, "energie")} kcal/100g
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
