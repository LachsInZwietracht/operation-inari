"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Download, FileText, Loader2, Users, Utensils } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  buildMealPlanDaysExportRequest,
  buildTeachingKitchenExportRequest,
  type MealPlanDaysVariant,
} from "@/lib/exports/report-builder"
import type {
  DailyMealPlan,
  Food,
  Patient,
  PatientAllergenEntry,
  Recipe,
  ResolvedReferenceConfig,
} from "@/lib/types"
import { cn, downloadResponseFile } from "@/lib/utils"

type ExportVariant = MealPlanDaysVariant | "lehrkueche"

interface VariantOption {
  value: ExportVariant
  label: string
  description: string
  icon: typeof FileText
}

const VARIANT_OPTIONS: VariantOption[] = [
  {
    value: "patient",
    label: "Patientenhandout",
    description: "Eine Seite pro Tag, optional mit Rezepten und persönlichem Profil",
    icon: Users,
  },
  {
    value: "clinical",
    label: "Klinischer Bericht",
    description: "Soll-/Ist-Abgleich mit Nährstofftabellen pro Tag",
    icon: FileText,
  },
  {
    value: "lehrkueche",
    label: "Lehrküchenplan",
    description: "7-Tage-Aushang für Küche & Station (ganze Woche)",
    icon: Utensils,
  },
]

interface PlanExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The seven plans of the week the export dialog was opened from. */
  plans: DailyMealPlan[]
  defaultSelectedDates: string[]
  recipes: Recipe[]
  foods: Food[]
  refConfig?: ResolvedReferenceConfig
  patient?: Patient
  patientAllergens: PatientAllergenEntry[]
  patientIndications: string[]
  dietLineName?: string
  planId?: string
}

function planHasEntries(plan: DailyMealPlan) {
  return plan.slots.some((slot) => slot.entries.length > 0)
}

export function PlanExportDialog({
  open,
  onOpenChange,
  plans,
  defaultSelectedDates,
  recipes,
  foods,
  refConfig,
  patient,
  patientAllergens,
  patientIndications,
  dietLineName,
  planId,
}: PlanExportDialogProps) {
  const [variant, setVariant] = useState<ExportVariant>("patient")
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [includeRecipes, setIncludeRecipes] = useState(true)
  const [includePersonalization, setIncludePersonalization] = useState(true)
  const [note, setNote] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.date.localeCompare(b.date)),
    [plans],
  )

  // Re-seed the selection each time the dialog opens: the defaults follow the
  // active view (day view → active day, week view → all filled days).
  useEffect(() => {
    if (!open) return
    const exportable = new Set(
      sortedPlans.filter(planHasEntries).map((plan) => plan.date),
    )
    setSelectedDates(new Set(defaultSelectedDates.filter((date) => exportable.has(date))))
    setIncludeRecipes(true)
    setIncludePersonalization(Boolean(patient))
    setNote("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggleDate = useCallback((date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }, [])

  const selectedPlans = useMemo(
    () => sortedPlans.filter((plan) => selectedDates.has(plan.date) && planHasEntries(plan)),
    [selectedDates, sortedPlans],
  )
  const weekHasEntries = sortedPlans.some(planHasEntries)
  const canExport = variant === "lehrkueche" ? weekHasEntries : selectedPlans.length > 0

  const handleExport = useCallback(async () => {
    if (isExporting || !canExport) return

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : undefined
    const baseContext = {
      patientId: patient?.id,
      patientName,
      patientIndication: patientIndications.length ? patientIndications.join(", ") : undefined,
      planId,
      dietLineName,
    }

    const reportRequest = (() => {
      if (variant === "lehrkueche") {
        const firstPlan = sortedPlans[0]
        const lastPlan = sortedPlans[sortedPlans.length - 1]
        const rangeLabel =
          firstPlan && lastPlan
            ? `${format(parseISO(firstPlan.date), "d. MMM", { locale: de })} – ${format(
                parseISO(lastPlan.date),
                "d. MMM yyyy",
                { locale: de },
              )}`
            : ""
        return buildTeachingKitchenExportRequest(sortedPlans, recipes, foods, refConfig, {
          ...baseContext,
          rangeLabel,
        })
      }
      return buildMealPlanDaysExportRequest(selectedPlans, recipes, foods, refConfig, {
        ...baseContext,
        variant,
        notes: note.trim() || undefined,
        includeRecipes: variant === "patient" && includeRecipes,
        personalization:
          variant === "patient" && includePersonalization && patient
            ? {
                calorieGoalKcal: patient.dailyCalorieGoal,
                macroPreset: patient.macroPreset,
                preferences: patient.nutritionPreferences,
                allergens: patientAllergens,
                goals: patient.patientGoals,
              }
            : undefined,
      })
    })()

    setIsExporting(true)
    try {
      const response = await fetch("/api/exports/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reportRequest),
      })
      await downloadResponseFile(response, `${reportRequest.fileBaseName}.pdf`)
      toast.success(
        variant === "patient"
          ? "Patientenhandout exportiert."
          : variant === "lehrkueche"
            ? "Lehrküchenplan exportiert."
            : "Klinischer Bericht exportiert.",
      )
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to export meal plan:", error)
      toast.error((error as Error).message || "Export ist fehlgeschlagen.")
    } finally {
      setIsExporting(false)
    }
  }, [
    canExport,
    dietLineName,
    foods,
    includePersonalization,
    includeRecipes,
    isExporting,
    note,
    onOpenChange,
    patient,
    patientAllergens,
    patientIndications,
    planId,
    recipes,
    refConfig,
    selectedPlans,
    sortedPlans,
    variant,
  ])

  return (
    <Dialog open={open} onOpenChange={(next) => !isExporting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ernährungsplan exportieren</DialogTitle>
          <DialogDescription>
            Dokument, Tage und Inhalte für den PDF-Export wählen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <RadioGroup
            value={variant}
            onValueChange={(value) => setVariant(value as ExportVariant)}
            className="gap-2"
          >
            {VARIANT_OPTIONS.map((option) => (
              <Label
                key={option.value}
                htmlFor={`export-variant-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal",
                  variant === option.value && "border-primary bg-muted/40",
                )}
              >
                <RadioGroupItem
                  id={`export-variant-${option.value}`}
                  value={option.value}
                  className="mt-0.5"
                />
                <option.icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs">{option.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>

          {variant !== "lehrkueche" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Tage</p>
              <div className="flex flex-wrap gap-1.5">
                {sortedPlans.map((plan) => {
                  const hasEntries = planHasEntries(plan)
                  const selected = selectedDates.has(plan.date)
                  return (
                    <Button
                      key={plan.date}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      disabled={!hasEntries}
                      onClick={() => toggleDate(plan.date)}
                      className="min-w-[64px]"
                    >
                      {format(parseISO(plan.date), "EEE d.M.", { locale: de })}
                    </Button>
                  )
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                Pro gewähltem Tag wird eine Seite exportiert. Leere Tage sind deaktiviert.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Der Lehrküchenplan umfasst immer die angezeigte Woche.
            </p>
          )}

          {variant === "patient" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Inhalte</p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="export-include-recipes"
                  checked={includeRecipes}
                  onCheckedChange={(checked) => setIncludeRecipes(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="export-include-recipes" className="flex flex-col gap-0.5 font-normal">
                  <span className="text-sm">Rezepte im Anhang</span>
                  <span className="text-muted-foreground text-xs">
                    Zutaten pro Portion und Zubereitung, jedes Rezept nur einmal
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="export-include-personalization"
                  checked={includePersonalization}
                  disabled={!patient}
                  onCheckedChange={(checked) => setIncludePersonalization(checked === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="export-include-personalization"
                  className="flex flex-col gap-0.5 font-normal"
                >
                  <span className="text-sm">Kalorienziel & Ernährungsweise</span>
                  <span className="text-muted-foreground text-xs">
                    {patient
                      ? "Persönliches Profil, Tagesbilanz und Allergiehinweise. Ohne Häkchen erscheinen keine kcal-Angaben."
                      : "Erst verfügbar, wenn dem Plan ein Patient zugeordnet ist."}
                  </span>
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-note" className="text-sm font-normal">
                  Notiz an Patient:in (optional)
                </Label>
                <Textarea
                  id="export-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="z. B. Hinweise zur Umsetzung im Alltag"
                  rows={2}
                  maxLength={2000}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleExport()} disabled={!canExport || isExporting}>
            {isExporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            PDF exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
