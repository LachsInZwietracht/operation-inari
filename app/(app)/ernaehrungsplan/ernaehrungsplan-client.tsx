"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  startOfWeek,
} from "date-fns"
import { de } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  AlertTriangle,
  ArrowUpRight,
  Download,
  FileText,
  LayoutTemplate,
  Loader2,
  UserPlus,
  UserRound,
  Users,
  Utensils,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMealPlan } from "@/hooks/use-meal-plan"
import { useAllergenGuard } from "@/hooks/use-allergen-guard"
import {
  usePlanAnalysis,
  type OptimizationSuggestion,
} from "@/hooks/use-plan-analysis"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import { PlanAdditiveSummary } from "@/components/plan-additive-summary"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type {
  MealSlotType,
  MealEntry,
  DailyMealPlan,
  Food,
  MealPlanTemplate,
  Patient,
  Recipe,
} from "@/lib/types"
import { useFoods, useFoodSearch } from "@/components/foods-provider"
import { createRecipeLookup } from "@/lib/recipes"
import type { FoodSearchItem } from "@/lib/types"
import { usePatientAllergens } from "@/hooks/use-patient-allergens"
import { PlanAllergenBanner } from "@/components/plan-allergen-banner"
import { PlanAddEntryCommand } from "@/components/plan-add-entry-command"
import { PlanAllergenWarningDialog } from "@/components/plan-allergen-warning-dialog"
import { PlanApplyTemplateDialog } from "@/components/plan-apply-template-dialog"
import { PlanDietLineDialog, type DietLineDraft } from "@/components/plan-diet-line-dialog"
import { PlanExchangeDialog } from "@/components/plan-exchange-dialog"
import { MealPlanLibrary } from "@/components/meal-plan-library"
import { PlanDayWorkspace } from "@/components/plan-day-workspace"
import { PlanFillSuggestions } from "@/components/plan-fill-suggestions"
import { PlanExchangeTool } from "@/components/plan-exchange-tool"
import { PlanNutrientGapTool } from "@/components/plan-nutrient-gap-tool"
import { PlanBalanceRail } from "@/components/plan-balance-rail"
import { toast } from "sonner"

// Secondary views load lazily so the (default) day view ships less code
// and the week computations only run when their tab opens.
const viewFallback = () => <div className="h-[420px] rounded-md bg-muted/40" />
const PlanWeekView = dynamic(
  () => import("@/components/plan-week-view").then((mod) => mod.PlanWeekView),
  { ssr: false, loading: viewFallback },
)
import { fetchFoodById, fetchFoodsByIds } from "@/lib/data/foods-client"
import { usePatients } from "@/hooks/use-patients"
import { useDietLinePresets } from "@/hooks/use-diet-line-presets"
import { useMealPlanTemplates } from "@/hooks/use-meal-plan-templates"
import {
  buildDefaultReportExportRequest,
  buildTeachingKitchenExportRequest,
  type MealPlanReportVariant,
} from "@/lib/exports/report-builder"
import { cn, downloadResponseFile } from "@/lib/utils"

const UNASSIGNED_PATIENT_VALUE = "__unassigned__"
const CREATE_PATIENT_VALUE = "__create_patient__"

type PatientWithLegacyIndication = Patient & {
  indication?: string
  indications?: string[]
}

function getPatientIndications(patient?: Patient): string[] {
  if (!patient) return []
  const record = patient as PatientWithLegacyIndication
  if (record.indications?.length) return record.indications
  return record.indication ? [record.indication] : []
}

interface ErnaehrungsplanPageClientProps {
  recipes: Recipe[]
  initialPlans: DailyMealPlan[]
  initialTemplates?: MealPlanTemplate[]
  patientId?: string
  initialDate?: string
  /**
   * Template id passed via `?template=…` (used by Planvorlagen to
   * deep-link "anwenden"). When present, the planner consumes it once on
   * mount: applies the template's slots to the active date and rewrites the
   * URL without the param so a refresh does not re-apply silently.
   */
  initialApplyTemplateId?: string
}

export function ErnaehrungsplanPageClient({ recipes, initialPlans, initialTemplates, patientId, initialDate, initialApplyTemplateId }: ErnaehrungsplanPageClientProps) {
  const router = useRouter()
  const serverFoods = useFoods()
  const { index: foodSearchIndex, loadIndex: loadFoodSearchIndex } = useFoodSearch()
  const { patients, getPatient } = usePatients()
  const patient = patientId ? getPatient(patientId) : undefined
  const patientIndications = useMemo(() => getPatientIndications(patient), [patient])
  const defaultPlanMetadata = useMemo(
    () => ({
      patientId,
      title: patient ? `Ernährungsplan ${patient.firstName} ${patient.lastName}` : undefined,
    }),
    [patient, patientId],
  )
  const [hydratedFoods, setHydratedFoods] = useState<Food[]>(serverFoods)
  const { getForPatient: getAllergensForPatient } = usePatientAllergens()
  const patientAllergens = useMemo(
    () => (patientId ? getAllergensForPatient(patientId) : []),
    [patientId, getAllergensForPatient],
  )
  const {
    currentDate,
    currentPlan,
    getPlansInRange,
    addEntry,
    addEntryForDate,
    removeEntry,
    removeEntryForDate,
    updateEntryAmount,
    replaceEntry,
    moveEntry,
    copyPlanToDate,
    clearPlanForDate,
    updatePlanMetadata,
    applyTemplateToDate,
    setDate,
    goToNextDay,
    goToPreviousDay,
    allPlans,
  } = useMealPlan(initialPlans, serverFoods, defaultPlanMetadata, initialDate)
  const {
    presets: dietLines,
    isLoading: dietLinesLoading,
    savePreset: saveDietLinePreset,
    deletePreset: deleteDietLinePreset,
  } = useDietLinePresets()
  const {
    templates: mealPlanTemplates,
    isLoading: templatesLoading,
  } = useMealPlanTemplates({ initialTemplates })

  // Planvorlagen deep-link handler. Applies a template once when the
  // planner mounts with `?template=…`, then rewrites the URL to drop the param
  // so a refresh or share-link does not silently re-apply on top of edits.
  const appliedTemplateRef = useRef<string | null>(null)
  useEffect(() => {
    if (!initialApplyTemplateId) return
    if (appliedTemplateRef.current === initialApplyTemplateId) return
    if (mealPlanTemplates.length === 0) return
    const template = mealPlanTemplates.find(
      (item) => item.id === initialApplyTemplateId || item.legacyId === initialApplyTemplateId,
    )
    if (!template) return
    appliedTemplateRef.current = initialApplyTemplateId
    applyTemplateToDate(currentDate, template.slots, {
      title: template.name,
      dietLineId: template.dietLineId ?? undefined,
      targetProfileId: template.targetProfileId ?? undefined,
    })
    const params = new URLSearchParams()
    params.set("date", currentDate)
    if (patientId) params.set("patientId", patientId)
    router.replace(`/ernaehrungsplan?${params.toString()}`)
  }, [
    initialApplyTemplateId,
    mealPlanTemplates,
    applyTemplateToDate,
    currentDate,
    patientId,
    router,
  ])

  const [commandOpen, setCommandOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState<MealSlotType>("fruehstueck")
  // When adding from the week board a target day is set; null means the active day.
  const [activeAddDate, setActiveAddDate] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [view, setView] = useState("day")
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false)
  const [exchangeSlot, setExchangeSlot] = useState<MealSlotType | null>(null)
  const [exchangeEntryId, setExchangeEntryId] = useState<string | null>(null)
  const [dietLineDialogOpen, setDietLineDialogOpen] = useState(false)
  const [exportingVariant, setExportingVariant] = useState<MealPlanReportVariant | null>(null)
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => {
    setHydratedFoods((prev) => {
      const next = new Map(prev.map((food) => [food.id, food]))
      for (const food of serverFoods) {
        next.set(food.id, food)
      }
      return Array.from(next.values())
    })
  }, [serverFoods])

  useEffect(() => {
    // The shared library sits next to both planner views, so the food search
    // index is needed as soon as the page mounts.
    void loadFoodSearchIndex()
  }, [loadFoodSearchIndex])

  const hydrateFood = useCallback(
    async (foodId: string): Promise<Food | null> => {
      const existing = hydratedFoods.find((food) => food.id === foodId || food.legacyId === foodId)
      if (existing) return existing

      try {
        const food = await fetchFoodById(foodId)
        if (!food) {
          toast.error("Lebensmittel konnte nicht geladen werden.")
          return null
        }
        setHydratedFoods((prev) => {
          if (prev.some((item) => item.id === food.id)) return prev
          return [...prev, food]
        })
        return food
      } catch (error) {
        console.error("Failed to hydrate food for meal plan:", error)
        toast.error("Lebensmittel konnte nicht geladen werden.")
        return null
      }
    },
    [hydratedFoods],
  )

  const foods = hydratedFoods
  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods])
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes])

  // The server only ships foods for the active day's plan. Week/cycle views
  // and template application reference other plans, so batch-hydrate any
  // referenced foods (including recipe ingredients) that are still missing.
  const requestedFoodIdsRef = useRef(new Set<string>())
  useEffect(() => {
    const referenced = new Set<string>()
    for (const plan of Object.values(allPlans)) {
      for (const slot of plan.slots) {
        for (const entry of slot.entries) {
          if (entry.type === "food") {
            referenced.add(entry.referenceId)
          } else {
            const recipe = recipeMap.get(entry.referenceId)
            recipe?.ingredients.forEach((ingredient) => referenced.add(ingredient.foodId))
          }
        }
      }
    }

    const missing = Array.from(referenced).filter(
      (id) =>
        !requestedFoodIdsRef.current.has(id) &&
        !hydratedFoods.some((food) => food.id === id || food.legacyId === id),
    )
    if (missing.length === 0) return

    // Mark before the request so unknown IDs can't cause a refetch loop.
    missing.forEach((id) => requestedFoodIdsRef.current.add(id))

    let cancelled = false
    fetchFoodsByIds(missing)
      .then((fetched) => {
        if (cancelled || fetched.length === 0) return
        setHydratedFoods((prev) => {
          const known = new Set(prev.map((food) => food.id))
          const additions = fetched.filter((food) => !known.has(food.id))
          return additions.length > 0 ? [...prev, ...additions] : prev
        })
      })
      .catch((error) => {
        console.error("Failed to hydrate referenced meal plan foods:", error)
        // Allow a retry on the next change.
        missing.forEach((id) => requestedFoodIdsRef.current.delete(id))
      })
    return () => {
      cancelled = true
    }
  }, [allPlans, recipeMap, hydratedFoods])

  const {
    pendingIntent: pendingAllergenIntent,
    guardedAddEntry,
    confirmPendingIntent: confirmPendingAllergenIntent,
    dismissPendingIntent: dismissPendingAllergenIntent,
  } = useAllergenGuard({ patientAllergens, addEntry, addEntryForDate, replaceEntry })

  const parsedDate = parseISO(currentDate)
  const formattedDate = format(parsedDate, "EEEE, d. MMMM yyyy", { locale: de })

  const handleAddEntry = (slotType: MealSlotType) => {
    setActiveSlot(slotType)
    setActiveAddDate(null)
    setCommandOpen(true)
  }

  // Week board: open the same picker but remember which day the entry lands in.
  const handleAddEntryForDate = (date: string, slotType: MealSlotType) => {
    setActiveSlot(slotType)
    setActiveAddDate(date === currentDate ? null : date)
    setCommandOpen(true)
  }

  const handleSelectFood = async (foodId: string) => {
    const food = await hydrateFood(foodId)
    if (!food) return

    setCommandOpen(false)
    guardedAddEntry(
      activeSlot,
      { type: "food", referenceId: food.id, amount: 100 },
      {
        itemKind: "food",
        itemName: food.name,
        allergens: food.allergens,
        date: activeAddDate ?? undefined,
      },
    )
  }

  const handleSelectRecipe = (recipeId: string) => {
    const recipe = recipeMap.get(recipeId)
    setCommandOpen(false)
    guardedAddEntry(
      activeSlot,
      { type: "recipe", referenceId: recipeId, amount: 1 },
      {
        itemKind: "recipe",
        itemName: recipe?.name ?? "Rezept",
        allergens: recipe?.allergens,
        date: activeAddDate ?? undefined,
      },
    )
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setDate(format(date, "yyyy-MM-dd"))
      setCalendarOpen(false)
    }
  }

  const handleDropPayload = async (slotType: MealSlotType, payload: { type: MealEntry["type"]; referenceId: string }) => {
    if (payload.type === "recipe") {
      const recipe = recipeMap.get(payload.referenceId)
      guardedAddEntry(
        slotType,
        { type: "recipe", referenceId: payload.referenceId, amount: 1 },
        {
          itemKind: "recipe",
          itemName: recipe?.name ?? "Rezept",
          allergens: recipe?.allergens,
        },
      )
    } else {
      const food = await hydrateFood(payload.referenceId)
      if (!food) return
      guardedAddEntry(
        slotType,
        { type: "food", referenceId: food.id, amount: 120 },
        { itemKind: "food", itemName: food.name, allergens: food.allergens },
      )
    }
  }

  const handleWeekDropPayload = async (
    date: string,
    slotType: MealSlotType,
    payload: { type: MealEntry["type"]; referenceId: string },
  ) => {
    if (payload.type === "recipe") {
      const recipe = recipeMap.get(payload.referenceId)
      guardedAddEntry(
        slotType,
        { type: "recipe", referenceId: payload.referenceId, amount: 1 },
        {
          itemKind: "recipe",
          itemName: recipe?.name ?? "Rezept",
          allergens: recipe?.allergens,
          date,
        },
      )
    } else {
      const food = await hydrateFood(payload.referenceId)
      if (!food) return
      guardedAddEntry(
        slotType,
        { type: "food", referenceId: food.id, amount: 120 },
        { itemKind: "food", itemName: food.name, allergens: food.allergens, date },
      )
    }
  }

  const handleOpenExchange = (slotType: MealSlotType, entryId?: string) => {
    setExchangeSlot(slotType)
    setExchangeEntryId(entryId ?? null)
    setExchangeDialogOpen(true)
    loadFoodSearchIndex()
  }

  const handleSelectExchangeFood = async (foodId: string) => {
    if (!exchangeSlot) return
    const food = await hydrateFood(foodId)
    if (!food) return
    const slot = currentPlan.slots.find((item) => item.type === exchangeSlot)
    const existing = exchangeEntryId
      ? slot?.entries.find((entry) => entry.id === exchangeEntryId)
      : undefined
    const amount = existing?.amount ?? 100
    const targetSlot = exchangeSlot
    const replaceEntryId = exchangeEntryId ?? undefined
    setExchangeDialogOpen(false)
    setExchangeSlot(null)
    setExchangeEntryId(null)

    guardedAddEntry(
      targetSlot,
      { type: "food", referenceId: food.id, amount },
      {
        itemKind: "food",
        itemName: food.name,
        allergens: food.allergens,
        replaceEntryId,
      },
    )
  }

  const dietLineId = currentPlan.dietLineId ?? dietLines[0]?.id ?? ""

  const handleDietLineChange = (nextId: string) => {
    if (nextId === dietLineId) return
    updatePlanMetadata(currentDate, { dietLineId: nextId })
  }

  const dietLine = useMemo(() => {
    return dietLines.find((line) => line.id === dietLineId) ?? dietLines[0]
  }, [dietLineId, dietLines])

  const isCurrentDietLineEditable = Boolean(dietLine?.userId)

  const {
    planAllergenSummary,
    entryAllergenWarnings,
    refConfig,
    dietLineMacros,
    micronutrientCompliance,
    energyTargetValue,
    optimizationSuggestions,
  } = usePlanAnalysis({
    plan: currentPlan,
    foods,
    foodMap,
    recipes,
    recipeMap,
    dietLine,
    patientAllergens,
    patientId,
    patient,
  })

  const foodCommandSource: FoodSearchItem[] = foodSearchIndex.length > 0 ? foodSearchIndex : foods

  const baseWeekStart = startOfWeek(parsedDate, { weekStartsOn: 1 })
  const computedWeekStart = addWeeks(baseWeekStart, weekOffset)
  const computedWeekStartIso = format(computedWeekStart, "yyyy-MM-dd")
  const weekPlans = useMemo(() => getPlansInRange(computedWeekStartIso, 7), [computedWeekStartIso, getPlansInRange])
  // Day view weekday chips always show the week containing the active date,
  // independent of the week view's offset navigation.
  const baseWeekStartIso = format(baseWeekStart, "yyyy-MM-dd")
  const dayWeekPlans = useMemo(() => getPlansInRange(baseWeekStartIso, 7), [baseWeekStartIso, getPlansInRange])
  const weekRangeLabel = `${format(computedWeekStart, "d. MMM", { locale: de })} – ${format(
    addDays(computedWeekStart, 6),
    "d. MMM yyyy",
    { locale: de },
  )}`
  const assignedPatient = currentPlan.patientId ? getPatient(currentPlan.patientId) : undefined
  const visiblePatient = patient ?? assignedPatient
  const hasSelectedPatient = Boolean(patientId ?? currentPlan.patientId)

  const openPatientContext = useCallback(
    (nextPatientId?: string) => {
      const params = new URLSearchParams({ date: currentDate })
      if (nextPatientId) params.set("patientId", nextPatientId)
      router.push(`/ernaehrungsplan?${params.toString()}`)
    },
    [currentDate, router],
  )

  const handlePlanPatientChange = (value: string) => {
    if (value === CREATE_PATIENT_VALUE) {
      router.push("/patienten/neu")
      return
    }

    const nextPatientId = value === UNASSIGNED_PATIENT_VALUE ? undefined : value
    openPatientContext(nextPatientId)
  }

  const copyCurrentPlanToDate = (targetDate: string) => {
    copyPlanToDate(currentDate, targetDate)
    toast.success("Tagesplan wurde kopiert.")
  }

  const copyPlanToNextDay = (sourceDate: string) => {
    const targetDate = format(addDays(parseISO(sourceDate), 1), "yyyy-MM-dd")
    copyPlanToDate(sourceDate, targetDate)
    toast.success("Tagesplan wurde auf den Folgetag kopiert.")
  }

  const clearPlan = (date: string) => {
    clearPlanForDate(date)
    toast.success("Tagesplan wurde geleert.")
  }

  const applyOptimizationSuggestion = (suggestion: OptimizationSuggestion) => {
    if (currentPlan.status === "approved") {
      toast.error("Freigegebene Pläne vor der Optimierung als Entwurf öffnen.")
      return
    }

    guardedAddEntry(
      suggestion.slotType,
      {
        type: suggestion.type,
        referenceId: suggestion.referenceId,
        amount: suggestion.amount,
      },
      {
        itemKind: suggestion.type,
        itemName: suggestion.name,
        allergens: suggestion.allergens,
      },
    )
    toast.success(`${suggestion.name} für ${MEAL_SLOT_LABELS[suggestion.slotType]} vorgemerkt.`)
  }

  const handleSaveDietLine = useCallback(
    async (draft: DietLineDraft): Promise<boolean> => {
      try {
        const savedPreset = await saveDietLinePreset({
          id: draft.id,
          name: draft.name,
          description: draft.description,
          targets: draft.targets,
        })
        updatePlanMetadata(currentDate, { dietLineId: savedPreset.id })
        toast.success("Zielprofil gespeichert.")
        return true
      } catch (error) {
        console.error("Failed to save diet line preset:", error)
        toast.error("Zielprofil konnte nicht gespeichert werden.")
        return false
      }
    },
    [currentDate, saveDietLinePreset, updatePlanMetadata],
  )

  const deleteCurrentDietLine = async () => {
    if (!dietLine?.id || !isCurrentDietLineEditable) return

    try {
      await deleteDietLinePreset(dietLine.id)
      const fallbackPreset = dietLines.find((line) => line.id !== dietLine.id)
      updatePlanMetadata(currentDate, { dietLineId: fallbackPreset?.id })
      setDietLineDialogOpen(false)
      toast.success("Zielprofil gelöscht.")
    } catch (error) {
      console.error("Failed to delete diet line preset:", error)
      toast.error("Zielprofil konnte nicht gelöscht werden.")
    }
  }

  const foodCategoryLabels = useMemo(
    () => new Map(FOOD_CATEGORIES.map((category) => [category.id, category.name])),
    [],
  )

  const openApplyTemplateDialog = useCallback(() => {
    setApplyTemplateDialogOpen(true)
  }, [])

  const handleApplyTemplate = useCallback(
    (template: MealPlanTemplate) => {
      applyTemplateToDate(currentDate, template.slots, {
        dietLineId: template.dietLineId ?? currentPlan.dietLineId,
        targetProfileId: template.targetProfileId ?? currentPlan.targetProfileId,
        title:
          currentPlan.title ??
          (patient
            ? `${template.name} – ${patient.firstName} ${patient.lastName}`
            : template.name),
        notes: currentPlan.notes ?? template.notes ?? undefined,
      })
      setApplyTemplateDialogOpen(false)
      toast.success(`Vorlage "${template.name}" auf den Tagesplan angewendet.`)
    },
    [
      applyTemplateToDate,
      currentDate,
      currentPlan.dietLineId,
      currentPlan.notes,
      currentPlan.targetProfileId,
      currentPlan.title,
      patient,
    ],
  )

  const handleExportPlan = useCallback(
    async (variant: MealPlanReportVariant) => {
      if (exportingVariant) return

      const totalEntries = currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)
      if (totalEntries === 0) {
        toast.error("Export nicht möglich: Der aktuelle Plan enthält noch keine Einträge.")
        return
      }
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : undefined
      const planContext = {
        patientId: currentPlan.patientId ?? patientId,
        patientName,
        patientIndication: patientIndications.length ? patientIndications.join(", ") : undefined,
        planId: currentPlan.id,
        dietLineName: dietLine?.name,
      }
      const notes = currentPlan.notes ?? undefined

      const reportRequest =
        variant === "lehrkueche"
          ? buildTeachingKitchenExportRequest(weekPlans, recipes, foods, refConfig, {
              ...planContext,
              rangeLabel: weekRangeLabel,
            })
          : buildDefaultReportExportRequest(currentPlan, recipes, foods, refConfig, {
              ...planContext,
              variant,
              notes,
            })

      setExportingVariant(variant)
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
      } catch (error) {
        console.error("Failed to export meal plan:", error)
        toast.error((error as Error).message || "Export ist fehlgeschlagen.")
      } finally {
        setExportingVariant(null)
      }
    },
    [
      currentPlan,
      dietLine?.name,
      exportingVariant,
      foods,
      patient,
      patientIndications,
      patientId,
      recipes,
      refConfig,
      weekPlans,
      weekRangeLabel,
    ],
  )

  // Shared PDF-export menu — rendered in the day header and reused in the week
  // header (week-relevant "Lehrküchenplan" variant covers all seven days).
  const exportMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exportingVariant !== null}>
          {exportingVariant ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>PDF-Export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleExportPlan("clinical")}>
          <FileText className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Klinischer Bericht</span>
            <span className="text-muted-foreground text-xs">
              Soll-/Ist-Abgleich, Vitamine, Mineralstoffe
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleExportPlan("patient")}>
          <Users className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Patientenhandout</span>
            <span className="text-muted-foreground text-xs">
              Mahlzeiten & Hinweise, ohne klinische Tabellen
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleExportPlan("lehrkueche")}>
          <Utensils className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Lehrküchenplan (Woche)</span>
            <span className="text-muted-foreground text-xs">
              7-Tage-Aushang für Küche & Station
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ernährungsplan"
        helpText="Planen Sie Mahlzeiten für einzelne Tage, Wochen oder Zyklen und vergleichen Sie die Nährstoffzufuhr mit Zielprofilen und DGE-Referenzwerten."
      >
        <Select
          value={patientId ?? currentPlan.patientId ?? UNASSIGNED_PATIENT_VALUE}
          onValueChange={handlePlanPatientChange}
        >
          <SelectTrigger aria-label="Patient" className="w-full min-w-0 sm:w-[260px]">
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
              <SelectValue placeholder="Patient wählen" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_PATIENT_VALUE}>Kein Patient zugeordnet</SelectItem>
            {patients.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.lastName}, {item.firstName}
                {getPatientIndications(item).length ? ` · ${getPatientIndications(item).join(" · ")}` : ""}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={CREATE_PATIENT_VALUE}>
              <UserPlus className="h-4 w-4" />
              Neuen Patienten anlegen
            </SelectItem>
          </SelectContent>
        </Select>
        {visiblePatient && (
          <Button
            variant="outline"
            onClick={() => router.push(`/patienten/${visiblePatient.id}`)}
          >
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            Zum Patienten
          </Button>
        )}
      </PageHeader>

      {!hasSelectedPatient && (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <UserRound className="text-muted-foreground mx-auto h-8 w-8" />
          <p className="mt-3 text-sm font-medium">Kein Patient ausgewählt</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Wählen Sie oben einen Patienten, um seinen Ernährungsplan zu bearbeiten.
          </p>
        </div>
      )}

      {hasSelectedPatient && (
        <>
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="day">Tag</TabsTrigger>
          <TabsTrigger value="week">Woche</TabsTrigger>
        </TabsList>

        {/* The library is the shared build source for the day and week views:
            the same items can be dragged (or click-added) into either view. */}
        <div className="mt-2 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
          {/* Col 1: the shared library on the left. At xl it fills the planner
              column's height (absolute inside a relative track cell) so it ends
              level with the meal plan and scrolls internally rather than running
              past it. Shared build source for day and week views. */}
          <div className="relative min-w-0">
            <MealPlanLibrary
              className="min-h-0 xl:absolute xl:inset-0"
              foods={foodCommandSource}
              fullFoods={foods}
              recipes={recipes}
              templates={mealPlanTemplates}
              categoryLabels={foodCategoryLabels}
              isLocked={currentPlan.status === "approved"}
              onQuickAdd={(payload, slotType) => void handleDropPayload(slotType, payload)}
              onApplyTemplate={handleApplyTemplate}
            />
          </div>

          {/* Col 2: the planner. */}
          <div className="min-w-0">

        <TabsContent value="day" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b py-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Vorheriger Tag</span>
              </Button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden min-w-[180px] justify-start gap-2 capitalize sm:inline-flex"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {formattedDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parsedDate}
                    onSelect={handleDateSelect}
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="sm:hidden">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="sr-only">Datum wählen</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parsedDate}
                    onSelect={handleDateSelect}
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Nächster Tag</span>
              </Button>
            </div>

            {planAllergenSummary.totalConflicts > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 px-2 py-1 text-xs",
                  planAllergenSummary.highestSeverity === "severe"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : planAllergenSummary.highestSeverity === "moderate"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-yellow-300 bg-yellow-50 text-yellow-800",
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                {planAllergenSummary.affectedEntryIds.size} Allergenkonflikte
              </Badge>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={openApplyTemplateDialog}
              >
                <LayoutTemplate className="mr-1.5 h-4 w-4" />
                Aus Vorlage
              </Button>

              {exportMenu}
            </div>
          </div>
          <div className="text-muted-foreground -mt-2 text-xs capitalize sm:hidden">
            {formattedDate}
          </div>

          {planAllergenSummary.totalConflicts > 0 && (
            <PlanAllergenBanner summary={planAllergenSummary} />
          )}

          <PlanDayWorkspace
            plan={currentPlan}
            weekPlans={dayWeekPlans}
            activeDate={currentDate}
            onSelectDay={setDate}
            onDuplicateDay={() => copyPlanToNextDay(currentDate)}
            foods={foods}
            foodMap={foodMap}
            recipeMap={recipeMap}
            onAddEntry={handleAddEntry}
            onRemoveEntry={removeEntry}
            onUpdateAmount={updateEntryAmount}
            onMoveEntry={moveEntry}
            onOpenExchange={handleOpenExchange}
            onDropPayload={(slotType, payload) => void handleDropPayload(slotType, payload)}
            allergenWarnings={entryAllergenWarnings}
            isLocked={currentPlan.status === "approved"}
          />
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          <PlanWeekView
            weekPlans={weekPlans}
            weekRangeLabel={weekRangeLabel}
            onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
            onNextWeek={() => setWeekOffset((prev) => prev + 1)}
            headerActions={exportMenu}
            foods={foods}
            foodMap={foodMap}
            recipeMap={recipeMap}
            activeDate={currentDate}
            energyTarget={energyTargetValue}
            onSelectDay={setDate}
            onOpenDay={(date) => {
              setDate(date)
              setView("day")
            }}
            onCopyCurrentToDay={copyCurrentPlanToDate}
            onCopyToNextDay={copyPlanToNextDay}
            onClearDay={clearPlan}
            onDrop={(date, slotType, payload) => void handleWeekDropPayload(date, slotType, payload)}
            onAddEntry={handleAddEntryForDate}
            onRemoveEntry={removeEntryForDate}
          />
        </TabsContent>
          </div>

          {/* Shared tools section below the plan — identical in day and week
              views. A quiet divider separates it from the planner above. */}
          <div className="space-y-4 xl:col-span-2">
            <div className="flex items-center gap-3">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Tools
              </h2>
              <div className="bg-border h-px flex-1" />
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              <PlanFillSuggestions
                suggestions={optimizationSuggestions}
                onApplySuggestion={applyOptimizationSuggestion}
                isLocked={currentPlan.status === "approved"}
              />
              <PlanExchangeTool />
              <PlanNutrientGapTool />
              <PlanAdditiveSummary plan={currentPlan} foodMap={foodMap} recipeMap={recipeMap} />
            </div>
          </div>

          {/* Sticky bottom dock: a slim Tagesziele glance pinned to the screen
              edge. The toggle expands it upward into the full micronutrient view. */}
          {/* Pull the dock flush to the scroll bottom: cancel the trailing space
              below it (page padding + tab wrapper gap) so it no longer lifts off
              the bottom edge when scrolled all the way down. */}
          <div className="sticky bottom-0 z-40 -mb-10 md:-mb-12 xl:col-span-2">
            <PlanBalanceRail
              compliance={dietLineMacros}
              micronutrients={micronutrientCompliance}
              dietLineName={dietLinesLoading ? "Zielprofile laden …" : dietLine?.name}
              dietLines={dietLines}
              dietLineId={dietLineId}
              onDietLineChange={handleDietLineChange}
              dietLineDisabled={currentPlan.status === "approved"}
              onManageDietLine={() => setDietLineDialogOpen(true)}
            />
          </div>
        </div>
      </Tabs>
        </>
      )}

      <PlanDietLineDialog
        open={dietLineDialogOpen}
        onOpenChange={setDietLineDialogOpen}
        dietLine={dietLine}
        isEditable={isCurrentDietLineEditable}
        onSave={handleSaveDietLine}
        onDelete={deleteCurrentDietLine}
      />

      <PlanAddEntryCommand
        open={commandOpen}
        onOpenChange={setCommandOpen}
        foods={foodCommandSource}
        recipes={recipes}
        foodMap={foodMap}
        onSelectFood={(foodId) => void handleSelectFood(foodId)}
        onSelectRecipe={handleSelectRecipe}
      />

      {/* Mounted lazily: the exchange dialog's nutrient hooks fetch whole
          nutrient columns from Supabase and must not run on page load. */}
      {exchangeDialogOpen && (
        <PlanExchangeDialog
          open={exchangeDialogOpen}
          onOpenChange={(open) => {
            setExchangeDialogOpen(open)
            if (!open) {
              setExchangeSlot(null)
              setExchangeEntryId(null)
            }
          }}
          slotType={exchangeSlot}
          entryId={exchangeEntryId}
          plan={currentPlan}
          foods={foods}
          searchIndex={foodSearchIndex}
          foodMap={foodMap}
          recipeMap={recipeMap}
          onSelectFood={(foodId) => void handleSelectExchangeFood(foodId)}
        />
      )}

      <PlanApplyTemplateDialog
        open={applyTemplateDialogOpen}
        onOpenChange={setApplyTemplateDialogOpen}
        templates={mealPlanTemplates}
        templatesLoading={templatesLoading}
        dietLines={dietLines}
        dietLine={dietLine}
        dietLineId={dietLineId}
        patientIndications={patientIndications}
        onApply={handleApplyTemplate}
      />

      <PlanAllergenWarningDialog
        open={pendingAllergenIntent !== null}
        itemName={pendingAllergenIntent?.itemName}
        warnings={pendingAllergenIntent?.warnings ?? []}
        onConfirm={confirmPendingAllergenIntent}
        onDismiss={dismissPendingAllergenIntent}
      />
    </div>
  )
}
