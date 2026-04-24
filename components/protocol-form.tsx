"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { differenceInYears } from "date-fns"
import { Check, Info, ListChecks, Loader2, Plus, Search, Sparkles, Trash2, Zap } from "lucide-react"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  type ProtocolDraftPrefill,
  type NutritionProtocol,
  type ProtocolType,
} from "@/lib/types"
import { PROTOCOL_TEMPLATES } from "@/lib/protocol-templates"
import { usePatients } from "@/hooks/use-patients"
import { useFoods } from "@/components/foods-provider"
import { matchSmartInputMulti, type SmartMatchResultSet } from "@/lib/nlp-matching"

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
  entries: z.array(entrySchema),
})

const protocolSchema = z
  .object({
    title: z.string().min(1, "Titel ist erforderlich"),
    type: z.string().min(1, "Typ ist erforderlich"),
    notes: z.string(),
    days: z.array(daySchema).min(1, "Mindestens ein Tag erforderlich"),
    metadata: z.object({
      participantAge: z.coerce.number().min(0).optional(),
      participantGender: z.enum(["m", "w", "d"]).optional(),
      documentedDays: z.coerce.number().min(1).optional(),
      assessmentMethod: z.string().optional(),
      source: z.literal("digital_protocol_submission").optional(),
      sourceSubmissionId: z.string().optional(),
    }),
  })
  .superRefine((values, ctx) => {
    const totalEntries = values.days.reduce((sum, day) => sum + day.entries.length, 0)
    if (totalEntries === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mindestens ein Eintrag im gesamten Protokoll ist erforderlich",
        path: ["days"],
      })
    }
  })

type ProtocolFormValues = z.input<typeof protocolSchema>

interface ProtocolFormProps {
  patientId: string
  templateId?: string
  initialValues?: ProtocolDraftPrefill
  getSuccessRedirectPath?: (protocol: NutritionProtocol) => string
  onSubmit: (protocol: Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt">) => Promise<NutritionProtocol> | NutritionProtocol
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

export function ProtocolForm({
  patientId,
  templateId,
  initialValues,
  getSuccessRedirectPath,
  onSubmit,
}: ProtocolFormProps) {
  const router = useRouter()
  const foods = useFoods()
  const { getPatient } = usePatients()
  const patient = getPatient(patientId)
  const [foodDialogOpen, setFoodDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [smartInputs, setSmartInputs] = useState<Record<number, string>>({})
  const [smartCandidates, setSmartCandidates] = useState<{
    dayIndex: number
    resultSets: SmartMatchResultSet[]
    selections: Record<number, number> // fragmentIndex -> candidateIndex
  } | null>(null)
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
    if (initialValues) {
      return {
        title: initialValues.title,
        type: initialValues.type,
        notes: initialValues.notes,
        days: initialValues.days.map((day) => ({
          date: day.date,
          entries: day.entries.map((entry) => ({
            foodId: entry.foodId,
            amount: entry.amount,
            mealSlot: entry.mealSlot,
            time: entry.time,
            measurementMode: entry.measurementMode,
            householdUnit: entry.householdUnit,
            householdQuantity: entry.householdQuantity,
          })),
        })),
        metadata: {
          participantAge: initialValues.metadata.participantAge,
          participantGender: initialValues.metadata.participantGender,
          documentedDays: initialValues.metadata.documentedDays,
          assessmentMethod: initialValues.metadata.assessmentMethod,
          source: initialValues.metadata.source,
          sourceSubmissionId: initialValues.metadata.sourceSubmissionId,
        },
      }
    }

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
        source: undefined,
        sourceSubmissionId: undefined,
      },
    }
  }, [initialValues, patient?.gender, patientAge, selectedTemplate])

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

  function appendEntry(dayIndex: number, entry: {
    foodId: string;
    amount: number;
    mealSlot: string;
    time: string;
    measurementMode: "grams" | "household";
    householdUnit?: string;
    householdQuantity?: number;
  }) {
    const currentEntries = form.getValues(`days.${dayIndex}.entries`) ?? []
    form.setValue(`days.${dayIndex}.entries`, [...currentEntries, entry])
  }

  function handleAddFood(foodId: string) {
    const measurementMode = householdModeEnabled ? "household" : "grams"
    const unit = HOUSEHOLD_MEASURES[0]?.id
    const quantity = 1
    const amount = measurementMode === "household" ? computeHouseholdAmount(unit, quantity) : 100
    
    appendEntry(activeDayIndex, {
      foodId,
      amount,
      mealSlot: "mittagessen",
      time: "",
      measurementMode,
      householdUnit: measurementMode === "household" ? unit : undefined,
      householdQuantity: measurementMode === "household" ? quantity : undefined,
    })
    setFoodDialogOpen(false)
  }

  function handleQuickAdd(dayIndex: number, presetId: string) {
    const preset = HOUSEHOLD_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    const amount = computeHouseholdAmount(preset.measureId, preset.quantity)
    
    appendEntry(dayIndex, {
      foodId: preset.foodId,
      amount,
      mealSlot: preset.mealSlot,
      time: preset.defaultTime ?? "",
      measurementMode: "household",
      householdUnit: preset.measureId,
      householdQuantity: preset.quantity,
    })
  }

  function removeEntry(dayIndex: number, entryIndex: number) {
    const entries = form.getValues(`days.${dayIndex}.entries`)
    form.setValue(
      `days.${dayIndex}.entries`,
      entries.filter((_, i) => i !== entryIndex),
    )
  }

  async function handleSubmit(values: ProtocolFormValues) {
    setSaving(true)
    const dates = values.days.map((d) => d.date).sort()

    try {
      const createdProtocol = await onSubmit({
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
              measurementMode: entry.measurementMode,
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
          source: values.metadata.source,
          sourceSubmissionId: values.metadata.sourceSubmissionId,
        },
      })

      toast.success("Protokoll erstellt!")
      router.push(
        getSuccessRedirectPath?.(createdProtocol) ?? `/patienten/${patientId}`,
      )
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const MATCH_TYPE_LABELS: Record<string, string> = {
    exact: "exakt",
    prefix: "Prefix",
    contains: "enthält",
    fuzzy: "ähnlich",
    phonetic: "phonetisch",
  }

  function confidenceBadgeVariant(confidence: number): "default" | "secondary" | "destructive" {
    if (confidence >= 0.8) return "default"
    if (confidence >= 0.5) return "secondary"
    return "destructive"
  }

  const handleSmartAdd = (dayIndex: number) => {
    const input = smartInputs[dayIndex]
    if (!input) return

    const resultSets = matchSmartInputMulti(input, foods)
    if (resultSets.length === 0) {
      toast.error("Lebensmittel nicht erkannt", {
        description: "Versuchen Sie es mit einer anderen Beschreibung wie '1 Glas Apfelsaft'.",
      })
      return
    }

    // Single fragment with high confidence → auto-add
    const isSingleHighConfidence =
      resultSets.length === 1 && resultSets[0].best && resultSets[0].best.confidence >= 0.8

    if (isSingleHighConfidence) {
      const best = resultSets[0].best!
      appendEntry(dayIndex, {
        foodId: best.foodId,
        amount: best.amount,
        mealSlot: "mittagessen",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        measurementMode: best.unit ? "household" : "grams",
        householdUnit: best.unit,
        householdQuantity: best.quantity,
      })
      setSmartInputs((prev) => ({ ...prev, [dayIndex]: "" }))
      toast.success(`Hinzugefügt: ${best.foodName}`, {
        description: `${best.quantity ? `${best.quantity} ${best.unit}` : `${best.amount}g`}`,
      })
      return
    }

    // Otherwise open candidate selection popover
    const defaultSelections: Record<number, number> = {}
    resultSets.forEach((rs, i) => {
      if (rs.best) defaultSelections[i] = 0
    })
    setSmartCandidates({ dayIndex, resultSets, selections: defaultSelections })
  }

  const handleAcceptCandidates = () => {
    if (!smartCandidates) return
    const { dayIndex, resultSets, selections } = smartCandidates
    let addedCount = 0

    resultSets.forEach((rs, fragmentIndex) => {
      const selectedIdx = selections[fragmentIndex]
      if (selectedIdx === undefined || selectedIdx === -1) return
      const candidate = rs.candidates[selectedIdx]
      if (!candidate) return

      appendEntry(dayIndex, {
        foodId: candidate.foodId,
        amount: candidate.amount,
        mealSlot: "mittagessen",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        measurementMode: candidate.unit ? "household" : "grams",
        householdUnit: candidate.unit,
        householdQuantity: candidate.quantity,
      })
      addedCount++
    })

    if (addedCount > 0) {
      toast.success(`${addedCount} Lebensmittel hinzugefügt`)
      setSmartInputs((prev) => ({ ...prev, [dayIndex]: "" }))
    }
    setSmartCandidates(null)
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

          {form.formState.errors.days?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.days.message}
            </p>
          )}

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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <FormLabel className="text-xs text-muted-foreground">Smart-Eingabe (z.B. &quot;1 Glas Apfelsaft&quot; oder &quot;Brot mit Butter und Käse&quot;)</FormLabel>
                    <Popover
                      open={smartCandidates?.dayIndex === dayIndex}
                      onOpenChange={(open) => { if (!open) setSmartCandidates(null) }}
                    >
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Input
                            placeholder="z.B. 2 Scheiben Vollkornbrot"
                            value={smartInputs[dayIndex] || ""}
                            onChange={(e) => setSmartInputs(prev => ({ ...prev, [dayIndex]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                handleSmartAdd(dayIndex)
                              }
                            }}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 text-purple-500 hover:bg-purple-50 hover:text-purple-600"
                            onClick={() => handleSmartAdd(dayIndex)}
                            disabled={!smartInputs[dayIndex]}
                          >
                            <Zap className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                      </PopoverTrigger>
                      {smartCandidates?.dayIndex === dayIndex && (
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <div className="space-y-0 divide-y">
                            {smartCandidates.resultSets.map((rs, fragmentIndex) => (
                              <div key={fragmentIndex} className="p-3 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  &quot;{rs.inputFragment}&quot;
                                </p>
                                {rs.candidates.length === 0 ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Kein Treffer</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSmartCandidates(null)
                                        setActiveDayIndex(dayIndex)
                                        setFoodDialogOpen(true)
                                      }}
                                    >
                                      <Search className="mr-1 h-3 w-3" />
                                      Manuell suchen
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {rs.candidates.map((candidate, candidateIndex) => {
                                      const isSelected = smartCandidates.selections[fragmentIndex] === candidateIndex
                                      return (
                                        <button
                                          key={candidate.foodId}
                                          type="button"
                                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                                            isSelected ? "bg-accent ring-1 ring-ring" : ""
                                          }`}
                                          onClick={() =>
                                            setSmartCandidates((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    selections: {
                                                      ...prev.selections,
                                                      [fragmentIndex]: isSelected ? -1 : candidateIndex,
                                                    },
                                                  }
                                                : null,
                                            )
                                          }
                                        >
                                          <span className="flex items-center gap-2">
                                            {isSelected && <Check className="h-3 w-3 text-primary" />}
                                            <span>{candidate.foodName}</span>
                                          </span>
                                          <span className="flex items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground">
                                              {MATCH_TYPE_LABELS[candidate.matchType] ?? candidate.matchType}
                                            </span>
                                            <Badge variant={confidenceBadgeVariant(candidate.confidence)} className="text-[10px] px-1.5 py-0">
                                              {Math.round(candidate.confidence * 100)}%
                                            </Badge>
                                          </span>
                                        </button>
                                      )
                                    })}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-xs text-muted-foreground"
                                      onClick={() => {
                                        setSmartCandidates(null)
                                        setActiveDayIndex(dayIndex)
                                        setFoodDialogOpen(true)
                                      }}
                                    >
                                      <Search className="mr-1 h-3 w-3" />
                                      Manuell suchen
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="border-t p-2">
                            <Button
                              type="button"
                              size="sm"
                              className="w-full"
                              onClick={handleAcceptCandidates}
                              disabled={Object.values(smartCandidates.selections).every((v) => v === -1)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Übernehmen
                            </Button>
                          </div>
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Protokoll erstellen
            </Button>
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
