"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { differenceInYears } from "date-fns"
import { Info, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"

import {
  ASSESSMENT_METHOD_LABELS,
  HOUSEHOLD_MEASURES,
  HOUSEHOLD_PRESETS,
  MEAL_SLOT_LABELS,
  PROTOCOL_TYPE_LABELS,
} from "@/lib/constants"
import { getNutrientValue } from "@/lib/nutrients"
import {
  type AssessmentMethod,
  type MealSlotType,
  type NutritionProtocol,
  type ProtocolType,
} from "@/lib/types"
import { PROTOCOL_TEMPLATES } from "@/lib/protocol-templates"
import { usePatients } from "@/hooks/use-patients"
import { useFoods } from "@/components/foods-provider"

const entrySchema = z.object({
  foodId: z.string().min(1),
  amount: z.coerce.number().min(1, "Mindestens 1 g"),
  mealSlot: z.string().min(1),
  time: z.string(),
  measurementMode: z.enum(["grams", "household"]).default("grams"),
  householdUnit: z.string().optional(),
  householdQuantity: z.coerce.number().optional(),
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
  metadata: z.object({
    participantAge: z.coerce.number().min(0).optional(),
    participantGender: z.enum(["m", "w", "d"]).optional(),
    documentedDays: z.coerce.number().min(1).optional(),
    assessmentMethod: z.string().optional(),
  }),
})

type ProtocolFormValues = z.input<typeof protocolSchema>

interface ProtocolFormProps {
  patientId: string
  templateId?: string
  onSubmit: (protocol: Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt">) => void
}

const MEAL_SLOTS: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

const ASSESSMENT_METHOD_OPTIONS = Object.entries(
  ASSESSMENT_METHOD_LABELS,
) as [AssessmentMethod, string][]

export function ProtocolForm({ patientId, templateId, onSubmit }: ProtocolFormProps) {
  const router = useRouter()
  const foods = useFoods()
  const { getPatient } = usePatients()
  const patient = getPatient(patientId)
  const [foodDialogOpen, setFoodDialogOpen] = useState(false)
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [templateStepsState, setTemplateStepsState] = useState<Record<string, number[]>>({})

  const selectedTemplate = useMemo(
    () => PROTOCOL_TEMPLATES.find((tpl) => tpl.id === templateId),
    [templateId],
  )

  const patientAge = useMemo(() => {
    if (!patient?.dateOfBirth) return undefined
    return Math.max(0, differenceInYears(new Date(), new Date(patient.dateOfBirth)))
  }, [patient])

  const defaultValues = useMemo<ProtocolFormValues>(() => {
    const dayCount = Math.max(1, selectedTemplate?.recommendedDays ?? 1)
    return {
      title: selectedTemplate ? `${selectedTemplate.title}` : "",
      type: selectedTemplate?.defaultType ?? "ernaehrungsprotokoll",
      notes: selectedTemplate?.defaultNotes ?? "",
      days: Array.from({ length: dayCount }, () => ({ date: "", entries: [] })),
      metadata: {
        participantAge: patientAge,
        participantGender: patient?.gender,
        documentedDays: dayCount,
        assessmentMethod: selectedTemplate?.method ?? "diet_diary",
      },
    }
  }, [patient?.gender, patientAge, selectedTemplate])

  const form = useForm<ProtocolFormValues>({
    resolver: zodResolver(protocolSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const {
    fields: dayFields,
    append: appendDay,
    remove: removeDay,
  } = useFieldArray({ control: form.control, name: "days" })

  const foodMap = new Map(foods.map((f) => [f.id, f]))
  const householdMeasureMap = useMemo(
    () => new Map(HOUSEHOLD_MEASURES.map((measure) => [measure.id, measure])),
    [],
  )
  const quickAddPresets = useMemo(() => {
    if (!selectedTemplate?.quickAddPresetIds?.length) return []
    return HOUSEHOLD_PRESETS.filter((preset) =>
      selectedTemplate.quickAddPresetIds?.includes(preset.id),
    )
  }, [selectedTemplate])

  const selectedType = form.watch("type") as ProtocolType
  const householdModeEnabled =
    selectedType === "household" || selectedTemplate?.measurementPreset === "household"
  const templateCompletedSteps = selectedTemplate
    ? templateStepsState[selectedTemplate.id] ?? []
    : []

  function toggleTemplateStep(stepIndex: number) {
    if (!selectedTemplate) return
    setTemplateStepsState((prev) => {
      const existing = prev[selectedTemplate.id] ?? []
      const exists = existing.includes(stepIndex)
      const updated = exists
        ? existing.filter((idx) => idx !== stepIndex)
        : [...existing, stepIndex]
      return { ...prev, [selectedTemplate.id]: updated }
    })
  }

  function computeHouseholdAmount(unitId: string, quantity: number) {
    const measure = householdMeasureMap.get(unitId)
    if (!measure) return Math.max(1, quantity * 50)
    return Math.max(1, measure.grams * quantity)
  }

  function buildHouseholdMeasurement(unitId?: string, quantity?: number) {
    if (!unitId || !quantity) return undefined
    const measure = householdMeasureMap.get(unitId)
    if (!measure) return undefined
    const estimatedGrams = Math.max(1, measure.grams * quantity)
    return {
      unitId,
      unitLabel: measure.label,
      gramsPerUnit: measure.grams,
      quantity,
      estimatedGrams,
    }
  }

  function handleAddFood(foodId: string) {
    const currentEntries = form.getValues(`days.${activeDayIndex}.entries`) ?? []
    const defaultHouseholdUnit = HOUSEHOLD_MEASURES[0]?.id
    const defaultQuantity = 1
    const measurementMode = householdModeEnabled ? "household" : "grams"
    const householdMeasurement =
      measurementMode === "household"
        ? buildHouseholdMeasurement(defaultHouseholdUnit, defaultQuantity)
        : undefined
    const amount = householdMeasurement?.estimatedGrams ?? 100
    form.setValue(`days.${activeDayIndex}.entries`, [
      ...currentEntries,
      {
        foodId,
        amount,
        mealSlot: "mittagessen",
        time: "",
        measurementMode,
        householdUnit: householdMeasurement?.unitId,
        householdQuantity: householdMeasurement?.quantity,
      },
    ])
    setFoodDialogOpen(false)
  }

  function handleQuickAdd(dayIndex: number, presetId: string) {
    const preset = HOUSEHOLD_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    const quantity = preset.quantity
    const amount = computeHouseholdAmount(preset.measureId, quantity)
    const entries = form.getValues(`days.${dayIndex}.entries`) ?? []
    form.setValue(`days.${dayIndex}.entries`, [
      ...entries,
      {
        foodId: preset.foodId,
        amount,
        mealSlot: preset.mealSlot,
        time: preset.defaultTime ?? "",
        measurementMode: "household",
        householdUnit: preset.measureId,
        householdQuantity: quantity,
      },
    ])
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
        entries: day.entries.map((entry, i) => {
          const measurement =
            entry.measurementMode === "household"
              ? buildHouseholdMeasurement(entry.householdUnit, entry.householdQuantity)
              : undefined
          return {
            id: `pe_new_${i}_${Date.now()}`,
            foodId: entry.foodId,
            amount: entry.amount,
            mealSlot: entry.mealSlot as MealSlotType,
            time: entry.time || undefined,
            householdMeasurement: measurement,
          }
        }),
      })),
      metadata: {
        assessmentMethod: (values.metadata.assessmentMethod as AssessmentMethod) ?? undefined,
        documentedDays:
          values.metadata.documentedDays ?? values.days.filter((day) => day.entries.length).length,
        participantAge: values.metadata.participantAge || undefined,
        participantGender: values.metadata.participantGender || undefined,
        templateId: selectedTemplate?.id,
        householdModeEnabled,
      },
    })

    toast.success("Protokoll erstellt!")
    router.push(`/patienten/${patientId}`)
  }

  const watchedDays = form.watch("days")

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {selectedTemplate && (
            <Card>
              <CardHeader className="flex flex-col gap-3 border-b bg-muted/40 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Geführte Vorlage: {selectedTemplate.title}
                  </CardTitle>
                  <CardDescription>{selectedTemplate.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {ASSESSMENT_METHOD_LABELS[selectedTemplate.method]}
                  </Badge>
                  <Badge variant="outline">{selectedTemplate.recommendedDays} Tage</Badge>
                  {selectedTemplate.measurementPreset === "household" && (
                    <Badge variant="outline" className="border-dashed">
                      Haushaltsmaße aktiv
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => router.replace(`/patienten/${patientId}/protokolle/neu`)}
                  >
                    Vorlage zurücksetzen
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {selectedTemplate.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid gap-3">
                  {selectedTemplate.steps.map((step, index) => {
                    const checked = templateCompletedSteps.includes(index)
                    return (
                      <div
                        key={step.title}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTemplateStep(index)}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium text-sm">{step.title}</p>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                            {step.hints && step.hints.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {step.hints.map((hint) => (
                                  <li key={hint}>{hint}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedTemplate.sections && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedTemplate.sections.map((section) => (
                      <div key={section.title} className="rounded-lg border bg-muted/40 p-3">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <ListChecks className="h-4 w-4 text-muted-foreground" />
                          {section.title}
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          {section.checklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        {section.emphasis && (
                          <p className="mt-2 text-xs text-amber-600">
                            <Info className="mr-1 inline h-3.5 w-3.5" />
                            {section.emphasis}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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

          <Card>
            <CardHeader>
              <CardTitle>Erhebungsdetails</CardTitle>
              <CardDescription>
                Angaben steuern die Referenzwerte und die Auswertung der Methode.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="metadata.documentedDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dokumentierte Tage</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metadata.participantAge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alter im Erhebungszeitraum</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metadata.participantGender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geschlecht</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="w">Weiblich</SelectItem>
                        <SelectItem value="m">Männlich</SelectItem>
                        <SelectItem value="d">Divers</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metadata.assessmentMethod"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-1">
                    <FormLabel>Assessment-Methode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSESSMENT_METHOD_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="space-y-3">
                    {(watchedDays?.[dayIndex]?.entries ?? []).map((entry, entryIndex) => {
                      const entryMeasurement = entry.householdUnit
                        ? householdMeasureMap.get(entry.householdUnit)
                        : undefined
                      const measurementInfo =
                        entry.measurementMode === "household" && entryMeasurement
                          ? `${entry.householdQuantity ?? 0} × ${entryMeasurement.label}`
                          : undefined
                      const approx =
                        entry.measurementMode === "household" && entryMeasurement
                          ? entryMeasurement.grams * (entry.householdQuantity ?? 0)
                          : undefined
                      return (
                        <div key={entryIndex} className="space-y-3 rounded-md border p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {foodMap.get(entry.foodId)?.name ?? "Unbekannt"}
                              </p>
                              {measurementInfo && (
                                <p className="text-xs text-muted-foreground">
                                  {measurementInfo} (~{Math.round(approx ?? 0)} g)
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
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
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
                            <ToggleGroup
                              type="single"
                              value={entry.measurementMode ?? "grams"}
                              onValueChange={(val) => {
                                const mode = (val as "grams" | "household") || "grams"
                                form.setValue(
                                  `days.${dayIndex}.entries.${entryIndex}.measurementMode`,
                                  mode,
                                )
                                if (mode === "household") {
                                  const unit = entry.householdUnit || HOUSEHOLD_MEASURES[0]?.id
                                  const quantity = entry.householdQuantity || 1
                                  const grams = computeHouseholdAmount(unit ?? "tablespoon", quantity)
                                  form.setValue(
                                    `days.${dayIndex}.entries.${entryIndex}.householdUnit`,
                                    unit,
                                  )
                                  form.setValue(
                                    `days.${dayIndex}.entries.${entryIndex}.householdQuantity`,
                                    quantity,
                                  )
                                  form.setValue(
                                    `days.${dayIndex}.entries.${entryIndex}.amount`,
                                    grams,
                                  )
                                }
                              }}
                              className="justify-start"
                            >
                              <ToggleGroupItem value="grams" aria-label="Gramm">
                                Gramm
                              </ToggleGroupItem>
                              <ToggleGroupItem value="household" aria-label="Haushalt">
                                Haushaltsmaß
                              </ToggleGroupItem>
                            </ToggleGroup>
                            {entry.measurementMode === "household" ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <Select
                                  value={entry.householdUnit ?? HOUSEHOLD_MEASURES[0]?.id}
                                  onValueChange={(val) => {
                                    const quantity = entry.householdQuantity || 1
                                    form.setValue(
                                      `days.${dayIndex}.entries.${entryIndex}.householdUnit`,
                                      val,
                                    )
                                    const grams = computeHouseholdAmount(val, quantity)
                                    form.setValue(
                                      `days.${dayIndex}.entries.${entryIndex}.amount`,
                                      grams,
                                    )
                                  }}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {HOUSEHOLD_MEASURES.map((measure) => (
                                      <SelectItem key={measure.id} value={measure.id}>
                                        {measure.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={0.25}
                                  step="0.25"
                                  className="w-28"
                                  value={entry.householdQuantity ?? 1}
                                  onChange={(e) => {
                                    const quantity = Number(e.target.value)
                                    form.setValue(
                                      `days.${dayIndex}.entries.${entryIndex}.householdQuantity`,
                                      quantity,
                                    )
                                    const grams = computeHouseholdAmount(
                                      entry.householdUnit || HOUSEHOLD_MEASURES[0]?.id || "tablespoon",
                                      quantity,
                                    )
                                    form.setValue(
                                      `days.${dayIndex}.entries.${entryIndex}.amount`,
                                      grams,
                                    )
                                  }}
                                />
                                <div className="text-xs text-muted-foreground">
                                  ≈ {Math.round(entry.amount)} g
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={1}
                                  className="w-32"
                                  value={entry.amount}
                                  onChange={(e) =>
                                    form.setValue(
                                      `days.${dayIndex}.entries.${entryIndex}.amount`,
                                      Number(e.target.value),
                                    )
                                  }
                                />
                                <span className="text-xs text-muted-foreground">g</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
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
                  {householdModeEnabled && quickAddPresets.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="ghost">
                          Haushaltsmaß einsetzen
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {quickAddPresets.map((preset) => (
                          <DropdownMenuItem
                            key={preset.id}
                            onSelect={(event) => {
                              event.preventDefault()
                              handleQuickAdd(dayIndex, preset.id)
                            }}
                          >
                            {preset.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
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
            {foods.map((food) => (
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
