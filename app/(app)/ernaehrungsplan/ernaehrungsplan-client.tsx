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
  Activity,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ClipboardCheck,
  ChefHat,
  Download,
  FileText,
  FolderOpen,
  History,
  LayoutTemplate,
  Leaf,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Target,
  Users,
  Utensils,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { MealSlotCard } from "@/components/meal-slot"
import { NutrientBar } from "@/components/nutrient-bar"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import { getNutrientValue } from "@/lib/nutrients"
import { PlanAdditiveSummary } from "@/components/plan-additive-summary"
import { useAnthropometric } from "@/hooks/use-anthropometric"
import { formatNumber, formatNutrient } from "@/lib/format"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type {
  MealSlotType,
  MealEntry,
  DailyMealPlan,
  Food,
  MealPlanTemplate,
  MealPlanVersion,
  Patient,
  Recipe,
} from "@/lib/types"
import { useFoods, useFoodSearch } from "@/components/foods-provider"
import { createRecipeLookup } from "@/lib/recipes"
import type { FoodSearchItem } from "@/lib/types"
import { usePatientAllergens } from "@/hooks/use-patient-allergens"
import { PlanAllergenBanner } from "@/components/plan-allergen-banner"
import { PlanAddEntryCommand } from "@/components/plan-add-entry-command"
import { PlanAkteSheet } from "@/components/plan-akte-sheet"
import { PlanAllergenWarningDialog } from "@/components/plan-allergen-warning-dialog"
import { PlanApplyTemplateDialog } from "@/components/plan-apply-template-dialog"
import { PlanAssignPatientDialog } from "@/components/plan-assign-patient-dialog"
import { PlanDietLineDialog, type DietLineDraft } from "@/components/plan-diet-line-dialog"
import { PlanExchangeDialog } from "@/components/plan-exchange-dialog"
import { PlanRecipePalette } from "@/components/plan-recipe-palette"
import { PlanSaveTemplateDialog, type SaveTemplateDraft } from "@/components/plan-save-template-dialog"
import { toast } from "sonner"

// Secondary views load lazily so the (default) day view ships less code
// and the week/cycle/analysis computations only run when their tab opens.
const viewFallback = () => <div className="h-[420px] rounded-md bg-muted/40" />
const PlanWeekView = dynamic(
  () => import("@/components/plan-week-view").then((mod) => mod.PlanWeekView),
  { ssr: false, loading: viewFallback },
)
const PlanCycleView = dynamic(
  () => import("@/components/plan-cycle-view").then((mod) => mod.PlanCycleView),
  { ssr: false, loading: viewFallback },
)
const PlanEinzelanalyseView = dynamic(
  () => import("@/components/plan-einzelanalyse-view").then((mod) => mod.PlanEinzelanalyseView),
  { ssr: false, loading: viewFallback },
)
import { fetchFoodById } from "@/lib/data/foods-client"
import { usePatients } from "@/hooks/use-patients"
import { useDietLinePresets } from "@/hooks/use-diet-line-presets"
import { useMealPlanTemplates } from "@/hooks/use-meal-plan-templates"
import { useMealPlanVersions } from "@/hooks/use-meal-plan-versions"
import {
  buildDefaultReportExportRequest,
  buildTeachingKitchenExportRequest,
  type MealPlanReportVariant,
} from "@/lib/exports/report-builder"
import { cn, downloadResponseFile } from "@/lib/utils"

const KEY_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "vitamin_c",
  "vitamin_d",
  "calcium",
  "eisen",
  "magnesium",
]

const PLAN_STATUS_LABELS: Record<NonNullable<DailyMealPlan["status"]>, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  approved: "Freigegeben",
  archived: "Archiviert",
}

const UNASSIGNED_PATIENT_VALUE = "__unassigned__"

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
  const { getForPatient: getAnthropometricsForPatient } = useAnthropometric()
  // Einzelanalyse needs the most recent weight measurement; if no patient is
  // linked or no entries exist the per-kg toggle stays disabled.
  const latestPatientWeightKg = useMemo(() => {
    if (!patientId) return undefined
    const entries = getAnthropometricsForPatient(patientId)
    return entries.length > 0 ? entries[entries.length - 1].weight : undefined
  }, [patientId, getAnthropometricsForPatient])
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
    savePlanForDate,
    createPlanCheckpoint,
    approvePlan,
    reopenPlan,
    restorePlanVersion,
    setDate,
    goToNextDay,
    goToPreviousDay,
  } = useMealPlan(initialPlans, serverFoods, defaultPlanMetadata, initialDate)
  const {
    versions: mealPlanVersions,
    isLoading: mealPlanVersionsLoading,
    refresh: refreshMealPlanVersions,
    recordVersion: recordMealPlanVersion,
  } = useMealPlanVersions(currentPlan.id)
  const {
    presets: dietLines,
    isLoading: dietLinesLoading,
    savePreset: saveDietLinePreset,
    deletePreset: deleteDietLinePreset,
  } = useDietLinePresets()
  const {
    templates: mealPlanTemplates,
    isLoading: templatesLoading,
    saveTemplate: saveMealPlanTemplateFromHook,
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
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [view, setView] = useState("day")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false)
  const [exchangeSlot, setExchangeSlot] = useState<MealSlotType | null>(null)
  const [exchangeEntryId, setExchangeEntryId] = useState<string | null>(null)
  const [dietLineDialogOpen, setDietLineDialogOpen] = useState(false)
  const [exportingVariant, setExportingVariant] = useState<MealPlanReportVariant | null>(null)
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false)
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [isCheckpointing, setIsCheckpointing] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isApprovingPlan, setIsApprovingPlan] = useState(false)
  const [pendingPatientAssignmentId, setPendingPatientAssignmentId] = useState<string | null>(null)
  const [planAkteOpen, setPlanAkteOpen] = useState(false)
  const planTitleInputRef = useRef<HTMLInputElement | null>(null)
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
    // The week board's library needs the search index too, so load it lazily
    // for both the command palette and the week view.
    if (commandOpen || view === "week") {
      void loadFoodSearchIndex()
    }
  }, [commandOpen, loadFoodSearchIndex, view])

  useEffect(() => {
    if (currentPlan.status !== "approved") return
    const timer = window.setTimeout(() => {
      void refreshMealPlanVersions()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [currentPlan.approvedAt, currentPlan.status, refreshMealPlanVersions])

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
    setCommandOpen(true)
  }

  const handleSelectFood = async (foodId: string) => {
    const food = await hydrateFood(foodId)
    if (!food) return

    setCommandOpen(false)
    guardedAddEntry(
      activeSlot,
      { type: "food", referenceId: food.id, amount: 100 },
      { itemKind: "food", itemName: food.name, allergens: food.allergens },
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

  const handleQuickAddRecipe = (recipeId: string, slotType: MealSlotType) => {
    const recipe = recipeMap.get(recipeId)
    guardedAddEntry(
      slotType,
      { type: "recipe", referenceId: recipeId, amount: 1 },
      {
        itemKind: "recipe",
        itemName: recipe?.name ?? "Rezept",
        allergens: recipe?.allergens,
      },
    )
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
    dailyNutrients,
    totalKcal,
    totalProtein,
    totalFat,
    totalCarbs,
    totalBE,
    planSustainability,
    refConfig,
    referenceMap,
    nutrientDefMap,
    slotCompliance,
    dietLineCompliance,
    energyTargetValue,
    weekBoardTargets,
    optimizationSuggestions,
    clinicalReview,
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
  const weekRangeLabel = `${format(computedWeekStart, "d. MMM", { locale: de })} – ${format(
    addDays(computedWeekStart, 6),
    "d. MMM yyyy",
    { locale: de },
  )}`
  const assignedPatient = currentPlan.patientId ? getPatient(currentPlan.patientId) : undefined
  const visiblePatient = patient ?? assignedPatient
  const hasSelectedPatient = Boolean(patientId ?? currentPlan.patientId)
  const pendingAssignmentPatient = pendingPatientAssignmentId
    ? getPatient(pendingPatientAssignmentId)
    : undefined
  const visiblePatientIndications = useMemo(() => getPatientIndications(visiblePatient), [visiblePatient])
  const pendingAssignmentPatientIndications = useMemo(
    () => getPatientIndications(pendingAssignmentPatient),
    [pendingAssignmentPatient],
  )
  const hasCurrentPlanEntries = currentPlan.slots.some((slot) => slot.entries.length > 0)

  const openPatientContext = useCallback(
    (nextPatientId?: string) => {
      const params = new URLSearchParams({ date: currentDate })
      if (nextPatientId) params.set("patientId", nextPatientId)
      router.push(`/ernaehrungsplan?${params.toString()}`)
    },
    [currentDate, router],
  )

  const handlePlanPatientChange = (value: string) => {
    const nextPatientId = value === UNASSIGNED_PATIENT_VALUE ? undefined : value

    if (!nextPatientId) {
      openPatientContext()
      return
    }

    if (!currentPlan.patientId && hasCurrentPlanEntries) {
      setPendingPatientAssignmentId(nextPatientId)
      return
    }

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

  const saveCurrentPlanTitle = (title: string) => {
    const trimmed = title.trim()
    updatePlanMetadata(currentDate, { title: trimmed || undefined })
    toast.success("Plantitel gespeichert.")
  }

  const saveCurrentPlanNotes = (notes: string) => {
    const trimmed = notes.trim()
    updatePlanMetadata(currentDate, { notes: trimmed || undefined })
    toast.success("Planhinweise gespeichert.")
  }

  const saveCurrentPlan = async () => {
    setIsSavingPlan(true)
    try {
      const title = planTitleInputRef.current?.value.trim()
      const savedPlan = await savePlanForDate(currentDate, {
        title: title || undefined,
      })
      if (!savedPlan) {
        toast.error("Ernährungsplan konnte nicht gespeichert werden.")
        return
      }

      toast.success("Ernährungsplan gespeichert.", {
        action: {
          label: "Als Vorlage speichern",
          onClick: openSaveTemplateDialog,
        },
      })
    } finally {
      setIsSavingPlan(false)
    }
  }

  const approveCurrentPlan = async () => {
    if (currentPlan.status === "approved") return

    if (clinicalReview.blockingItems.length > 0) {
      toast.error("Freigabe blockiert: Bitte kritische Prüfpunkte klären.")
      return
    }

    setIsApprovingPlan(true)
    try {
      const version = await approvePlan(currentDate, {
        approvedAt: currentPlan.approvedAt ?? new Date().toISOString(),
        approvedBy: currentPlan.approvedBy,
      })
      if (version) {
        recordMealPlanVersion(version)
      }
      toast.success("Ernährungsplan freigegeben.")
    } finally {
      setIsApprovingPlan(false)
    }
  }

  const cancelCurrentPlan = () => {
    if (patientId) {
      router.push(`/patienten/${patientId}`)
      return
    }

    router.back()
  }

  const attachCurrentPatient = () => {
    if (!patientId) return
    updatePlanMetadata(currentDate, {
      patientId,
      title: currentPlan.title ?? (patient ? `Ernährungsplan ${patient.firstName} ${patient.lastName}` : undefined),
    })
    toast.success("Patientenkontext am Plan gespeichert.")
  }

  const assignCurrentPlanToPatient = (nextPatientId: string) => {
    if (currentPlan.status === "approved") {
      toast.error("Freigegebene Pläne können nicht neu zugeordnet werden.")
      return
    }

    const nextPatient = getPatient(nextPatientId)
    updatePlanMetadata(currentDate, {
      patientId: nextPatientId,
      title: currentPlan.title ?? (nextPatient ? `Ernährungsplan ${nextPatient.firstName} ${nextPatient.lastName}` : undefined),
    })
    setPendingPatientAssignmentId(null)
    toast.success("Plan wurde dem Patienten zugeordnet.")
    openPatientContext(nextPatientId)
  }

  const reopenCurrentPlan = () => {
    reopenPlan(currentDate)
    toast.success("Plan wurde als Entwurf wieder geöffnet.")
    window.setTimeout(() => {
      void refreshMealPlanVersions()
    }, 800)
  }

  const saveManualCheckpoint = async () => {
    if (currentPlan.status === "approved") {
      toast.error("Freigegebene Pläne sind bereits versioniert.")
      return
    }

    const hasEntries = currentPlan.slots.some((slot) => slot.entries.length > 0)
    if (!hasEntries) {
      toast.error("Leere Pläne können nicht als Version gespeichert werden.")
      return
    }

    setIsCheckpointing(true)
    try {
      const version = await createPlanCheckpoint(currentDate, "manual")
      if (!version) {
        toast.error("Checkpoint konnte nicht gespeichert werden.")
        return
      }

      recordMealPlanVersion(version)
      toast.success("Checkpoint wurde in der Versionshistorie gespeichert.")
    } finally {
      setIsCheckpointing(false)
    }
  }

  const restoreVersion = (version: MealPlanVersion) => {
    if (currentPlan.status === "approved") {
      toast.error("Freigegebene Pläne vor dem Wiederherstellen als Entwurf öffnen.")
      return
    }

    restorePlanVersion(currentDate, version.snapshot)
    toast.success(`Version ${version.versionNumber} wurde als Entwurf übernommen.`)
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

  // Prefill values the save-template dialog seeds from each time it opens.
  const saveTemplateDefaults = useMemo<SaveTemplateDraft>(
    () => ({
      name: currentPlan.title ?? "",
      description: "",
      indication: patientIndications[0] ?? "",
      dietLineId: dietLineId || "",
    }),
    [currentPlan.title, dietLineId, patientIndications],
  )

  const openSaveTemplateDialog = useCallback(() => {
    const totalEntries = currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)
    if (totalEntries === 0) {
      toast.error("Speichern nicht möglich: Der aktuelle Plan enthält keine Einträge.")
      return
    }
    setSaveTemplateDialogOpen(true)
  }, [currentPlan.slots])

  const handleSaveTemplate = useCallback(
    async (draft: SaveTemplateDraft): Promise<boolean> => {
      try {
        await saveMealPlanTemplateFromHook({
          name: draft.name,
          description: draft.description || undefined,
          indication: draft.indication || undefined,
          dietLineId: draft.dietLineId || undefined,
          slots: currentPlan.slots,
          notes: currentPlan.notes,
        })
        toast.success("Vorlage gespeichert.")
        return true
      } catch (error) {
        console.error("Failed to save meal plan template:", error)
        toast.error("Vorlage konnte nicht gespeichert werden.")
        return false
      }
    },
    [currentPlan.notes, currentPlan.slots, saveMealPlanTemplateFromHook],
  )

  const handleExportPlan = useCallback(
    async (variant: MealPlanReportVariant) => {
      if (exportingVariant) return

      const totalEntries = currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)
      if (totalEntries === 0) {
        toast.error("Export nicht möglich: Der aktuelle Plan enthält noch keine Einträge.")
        return
      }
      if (variant === "patient" && !clinicalReview.canApprove) {
        toast.error("Patientenhandout erst nach geklärter Freigabeprüfung exportieren.")
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
      const reviewNote = clinicalReview.canApprove
        ? clinicalReview.warningItems.length > 0
          ? `Freigabeprüfung: ${clinicalReview.warningItems.length} Hinweise ohne kritische Blocker.`
          : "Freigabeprüfung: keine kritischen Blocker oder Hinweise."
        : `Freigabeprüfung: ${clinicalReview.blockingItems.length} kritische Blocker.`
      const notes = [currentPlan.notes, reviewNote].filter(Boolean).join("\n\n")

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
      clinicalReview.blockingItems.length,
      clinicalReview.canApprove,
      clinicalReview.warningItems.length,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ernährungsplan"
        description={formattedDate}
        helpText="Planen Sie Mahlzeiten für einzelne Tage, Wochen oder Zyklen und vergleichen Sie die Nährstoffzufuhr mit Zielprofilen und DGE-Referenzwerten."
      />

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <ClipboardCheck className="text-muted-foreground h-4 w-4 shrink-0" />
                Planakte
                {visiblePatient && (
                  <span className="text-muted-foreground text-sm font-normal">
                    · {visiblePatient.firstName} {visiblePatient.lastName}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="line-clamp-1">
                {currentPlan.title || "Ohne Titel"}
                {visiblePatientIndications.length
                  ? ` · ${visiblePatientIndications.join(" · ")}`
                  : ""}
                {currentPlan.approvedAt &&
                  ` · Freigabe ${format(parseISO(currentPlan.approvedAt), "dd.MM.yyyy HH:mm")}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {patientId && (
                <Badge variant="secondary" className="font-normal">
                  {refConfig.standardId.toUpperCase()}
                </Badge>
              )}
              {patientAllergens.length > 0 && (
                <Badge variant="outline" className="gap-1 font-normal">
                  <AlertTriangle className="h-3 w-3" />
                  {patientAllergens.length} Allergene
                </Badge>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 gap-1.5 px-2 text-xs",
                      clinicalReview.canApprove
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                    )}
                  >
                    {clinicalReview.canApprove ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {clinicalReview.canApprove
                      ? clinicalReview.warningItems.length > 0
                        ? `${clinicalReview.warningItems.length} Hinweise`
                        : "freigabereif"
                      : `${clinicalReview.blockingItems.length} Blocker`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[28rem] p-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Klinische Freigabeprüfung</p>
                    <div className="grid gap-2">
                      {clinicalReview.items.map((item) => (
                        <div key={item.id} className="rounded-md border p-2 text-xs">
                          <div className="flex items-center gap-2">
                            {item.severity === "ok" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle
                                className={
                                  item.severity === "critical"
                                    ? "h-3.5 w-3.5 text-red-600"
                                    : "h-3.5 w-3.5 text-amber-600"
                                }
                              />
                            )}
                            <span className="font-medium">{item.label}</span>
                          </div>
                          <p className="text-muted-foreground mt-1">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Badge
                variant={currentPlan.status === "approved" ? "secondary" : "outline"}
                className={cn(
                  "gap-1 font-normal",
                  currentPlan.status === "approved" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-800",
                )}
              >
                {currentPlan.status === "approved" && <Lock className="h-3 w-3" />}
                {PLAN_STATUS_LABELS[currentPlan.status ?? "draft"]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto]">
            <div className="space-y-1.5">
              <Label
                htmlFor="planakte-title"
                className="text-muted-foreground text-xs uppercase tracking-wide"
              >
                Titel
              </Label>
              <Input
                id="planakte-title"
                ref={planTitleInputRef}
                key={`title-${currentPlan.id}-${currentPlan.date}`}
                defaultValue={currentPlan.title ?? ""}
                placeholder="z. B. Reduktionskost Woche 1"
                readOnly={currentPlan.status === "approved"}
                onBlur={(event) => {
                  if (event.currentTarget.value.trim() !== (currentPlan.title ?? "")) {
                    saveCurrentPlanTitle(event.currentTarget.value)
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Patient
              </Label>
              <Select
                value={patientId ?? currentPlan.patientId ?? UNASSIGNED_PATIENT_VALUE}
                onValueChange={handlePlanPatientChange}
              >
                <SelectTrigger aria-label="Patient">
                  <SelectValue placeholder="Patient wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_PATIENT_VALUE}>
                    Kein Patient zugeordnet
                  </SelectItem>
                  {patients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.lastName}, {item.firstName}
                      {getPatientIndications(item).length ? ` · ${getPatientIndications(item).join(" · ")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-1.5">
              {patientId && currentPlan.patientId !== patientId && (
                <Button size="sm" variant="outline" onClick={attachCurrentPatient}>
                  Patient zuordnen
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={cancelCurrentPlan}>
                Abbrechen
              </Button>
              {currentPlan.status === "approved" && (
                <Button size="sm" variant="outline" onClick={reopenCurrentPlan}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Entwurf öffnen
                </Button>
              )}
              {currentPlan.status !== "approved" && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void saveCurrentPlan()}
                    disabled={isSavingPlan || isApprovingPlan}
                  >
                    {isSavingPlan ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Ernährungsplan speichern
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openSaveTemplateDialog}
                    disabled={isSavingPlan || isApprovingPlan}
                  >
                    <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                    Als Vorlage speichern
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void approveCurrentPlan()}
                    disabled={!clinicalReview.canApprove || isSavingPlan || isApprovingPlan}
                  >
                    {isApprovingPlan ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Freigeben
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setPlanAkteOpen(true)}>
                <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                Akte öffnen
              </Button>
            </div>
          </div>
          <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <History className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              {mealPlanVersionsLoading ? (
                <span className="text-muted-foreground">Versionen werden geladen …</span>
              ) : mealPlanVersions.length === 0 ? (
                <span className="text-muted-foreground">Noch keine Versionen.</span>
              ) : (
                <span className="truncate font-medium">
                  Version {mealPlanVersions[0].versionNumber} ·{" "}
                  {format(parseISO(mealPlanVersions[0].createdAt), "dd.MM.yyyy HH:mm")} ·{" "}
                  {mealPlanVersions[0].snapshot.slots.reduce(
                    (sum, slot) => sum + slot.entries.length,
                    0,
                  )}{" "}
                  Einträge ·{" "}
                  {mealPlanVersions[0].reason === "approved"
                    ? "Freigabe"
                    : mealPlanVersions[0].reason === "manual"
                      ? "Checkpoint"
                      : "Wiederöffnung"}
                </span>
              )}
              {mealPlanVersions.length > 1 && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  +{mealPlanVersions.length - 1} weitere
                </Badge>
              )}
              {currentPlan.status === "approved" && (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Bearbeitung gesperrt
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {mealPlanVersions[0] && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={currentPlan.status === "approved"}
                  onClick={() => restoreVersion(mealPlanVersions[0])}
                >
                  Wiederherstellen
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={saveManualCheckpoint}
                disabled={
                  isCheckpointing ||
                  currentPlan.status === "approved" ||
                  !currentPlan.slots.some((slot) => slot.entries.length > 0)
                }
              >
                {isCheckpointing ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3 w-3" />
                )}
                Checkpoint speichern
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasSelectedPatient && (
        <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">CO₂-Bilanz</p>
                <p className="mt-1 text-3xl font-semibold leading-none">
                  {formatNumber(planSustainability.totalCo2, 2)}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">kg</span>
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  <span className="font-medium text-emerald-700">
                    {formatNumber(planSustainability.plantShare * 100, 0)}%
                  </span>{" "}
                  pflanzlich · {formatNumber(planSustainability.animalShare * 100, 0)}% tierisch
                </p>
              </div>
              <Leaf className="h-5 w-5 shrink-0 text-emerald-500" />
            </div>
            <div className="bg-muted mt-3 flex h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-emerald-500"
                style={{ width: `${planSustainability.plantShare * 100}%` }}
              />
              <div
                className="bg-orange-300"
                style={{ width: `${planSustainability.animalShare * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Tagessumme</p>
                <p className="mt-1 text-3xl font-semibold leading-none">
                  {formatNumber(Math.round(totalKcal))}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">kcal</span>
                </p>
                <p className="text-muted-foreground mt-1.5 line-clamp-1 text-xs">
                  Energie · Eiweiß · Fett · KH · BE
                </p>
              </div>
              <Activity className="text-muted-foreground h-5 w-5 shrink-0" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <div>
                <p className="font-semibold">{formatNumber(totalProtein, 0)} g</p>
                <p className="text-muted-foreground text-[11px]">Eiweiß</p>
              </div>
              <div>
                <p className="font-semibold">{formatNumber(totalFat, 0)} g</p>
                <p className="text-muted-foreground text-[11px]">Fett</p>
              </div>
              <div>
                <p className="font-semibold">{formatNumber(totalCarbs, 0)} g</p>
                <p className="text-muted-foreground text-[11px]">KH</p>
              </div>
              <div>
                <p className="font-semibold">{formatNumber(totalBE, 1)}</p>
                <p className="text-muted-foreground text-[11px]">BE</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="day">Tag</TabsTrigger>
          <TabsTrigger value="week">Woche</TabsTrigger>
          <TabsTrigger value="cycle">4-Wochen-Zyklus</TabsTrigger>
          <TabsTrigger value="einzelanalyse">Einzelanalyse</TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="space-y-4">
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-30 -mt-1 flex flex-wrap items-center gap-2 border-b py-2 backdrop-blur">
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
              <div className="bg-muted/40 hidden items-center rounded-md border p-0.5 md:flex">
                <Select
                  value={dietLineId}
                  onValueChange={handleDietLineChange}
                  disabled={currentPlan.status === "approved"}
                >
                  <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent shadow-none focus:ring-0">
                    <SelectValue placeholder="Kostform/Zielprofil" />
                  </SelectTrigger>
                  <SelectContent>
                    {dietLines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name}
                        {line.userId ? " (eigene)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDietLineDialogOpen(true)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Zielprofil verwalten</span>
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                disabled={currentPlan.status === "approved"}
              >
                <ChefHat className="mr-1.5 h-4 w-4" />
                Rezepte
                <span className="text-muted-foreground ml-1 text-xs">
                  ({recipes.length})
                </span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LayoutTemplate className="mr-1.5 h-4 w-4" />
                    Vorlagen
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Planvorlagen</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={currentPlan.status === "approved"}
                    onSelect={openApplyTemplateDialog}
                  >
                    <LayoutTemplate className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Plan aus Vorlage erzeugen</span>
                      <span className="text-muted-foreground text-xs">
                        {patientIndications.length
                          ? `${mealPlanTemplates.length} Vorlagen, gefiltert nach Indikation`
                          : `${mealPlanTemplates.length} Vorlagen verfügbar`}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={openSaveTemplateDialog}>
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Aktuellen Plan als Vorlage speichern</span>
                      <span className="text-muted-foreground text-xs">
                        Persönliche Vorlage für Wiederverwendung
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                  <DropdownMenuItem
                    disabled={!clinicalReview.canApprove}
                    onSelect={() => void handleExportPlan("patient")}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Patientenhandout</span>
                      <span className="text-muted-foreground text-xs">
                        {clinicalReview.canApprove
                          ? "Mahlzeiten & Hinweise, ohne klinische Tabellen"
                          : "erst nach geklärter Freigabeprüfung"}
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
            </div>
          </div>
          <div className="text-muted-foreground -mt-2 text-xs capitalize sm:hidden">
            {formattedDate}
          </div>

          {planAllergenSummary.totalConflicts > 0 && (
            <PlanAllergenBanner summary={planAllergenSummary} />
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              {currentPlan.slots.map((slot) => (
                <MealSlotCard
                  key={slot.type}
                  slot={slot}
                  onAddEntry={handleAddEntry}
                  onRemoveEntry={removeEntry}
                  onUpdateAmount={updateEntryAmount}
                  onDropPayload={handleDropPayload}
                  onMoveEntry={moveEntry}
                  complianceIndicators={slotCompliance[slot.type]}
                  onOpenExchange={handleOpenExchange}
                  foods={foods}
                  recipes={recipes}
                  allergenWarnings={entryAllergenWarnings}
                  isLocked={currentPlan.status === "approved"}
                />
              ))}
            </div>

            <div className="space-y-4">
              <Card>
                <Tabs defaultValue="ziele">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Nährstoffanalyse</CardTitle>
                      <Badge variant="outline" className="font-normal">
                        {dietLine?.name ?? "Kein Profil"}
                      </Badge>
                    </div>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="ziele" className="gap-1.5 text-xs">
                        <Target className="h-3.5 w-3.5" />
                        Zielprofil
                      </TabsTrigger>
                      <TabsTrigger value="dge" className="gap-1.5 text-xs">
                        <Activity className="h-3.5 w-3.5" />
                        DGE-Referenz
                      </TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <CardContent>
                    <TabsContent value="ziele" className="mt-0 space-y-2.5">
                      {dietLineCompliance.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                          {dietLinesLoading
                            ? "Zielprofile werden geladen …"
                            : "Noch keine Zielwerte gepflegt."}
                        </p>
                      )}
                      {dietLineCompliance.map((target) => {
                        const ratio =
                          typeof target.max === "number" && target.max > 0
                            ? Math.min((target.value / target.max) * 100, 120)
                            : typeof target.min === "number" && target.min > 0
                              ? Math.min((target.value / target.min) * 100, 120)
                              : 0
                        return (
                          <div key={target.label} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{target.label}</span>
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  target.status === "ok"
                                    ? "text-emerald-700"
                                    : target.status === "low"
                                      ? "text-amber-700"
                                      : "text-rose-700",
                                )}
                              >
                                {formatNumber(target.value, 0)} {target.unit}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(ratio, 100)}
                                className={cn(
                                  "h-1.5 flex-1",
                                  target.status === "ok"
                                    ? "[&>div]:bg-emerald-500"
                                    : target.status === "low"
                                      ? "[&>div]:bg-amber-500"
                                      : "[&>div]:bg-rose-500",
                                )}
                              />
                              <span className="text-muted-foreground w-20 text-right text-[11px]">
                                {target.min != null ? formatNumber(target.min, 0) : "–"}–
                                {target.max != null ? formatNumber(target.max, 0) : "–"}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </TabsContent>
                    <TabsContent value="dge" className="mt-0 space-y-3">
                      {KEY_NUTRIENT_IDS.map((nutrientId) => {
                        const def = nutrientDefMap.get(nutrientId)
                        if (!def) return null
                        const value = getNutrientValue(dailyNutrients, nutrientId)
                        const refValue = referenceMap.get(nutrientId) ?? 0

                        return (
                          <NutrientBar
                            key={nutrientId}
                            label={def.shortName}
                            value={value}
                            unit={def.unit}
                            referenceValue={refValue}
                          />
                        )
                      })}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="text-primary h-4 w-4" />
                    Optimierungsassistent
                  </CardTitle>
                  <CardDescription>
                    {optimizationSuggestions.length > 0
                      ? "Vorschläge für unterversorgte Zielwerte"
                      : "Profil-Konformität wird laufend geprüft"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {optimizationSuggestions.length > 0 ? (
                    optimizationSuggestions.slice(0, 3).map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="hover:bg-muted/40 flex items-start justify-between gap-3 rounded-md border p-2.5 transition"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{suggestion.name}</p>
                          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                            {MEAL_SLOT_LABELS[suggestion.slotType]} · {suggestion.targetLabel} +
                            {formatNutrient(suggestion.contribution, suggestion.unit)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0"
                          disabled={currentPlan.status === "approved"}
                          onClick={() => applyOptimizationSuggestion(suggestion)}
                        >
                          Einfügen
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                      {dietLineCompliance.some((target) => target.status === "low")
                        ? "Keine geeigneten Vorschläge aus den geladenen Daten."
                        : "Alle Zielwerte sind im Bereich – keine Vorschläge nötig."}
                    </p>
                  )}
                </CardContent>
              </Card>

              <PlanAdditiveSummary
                plan={currentPlan}
                foodMap={foodMap}
                recipeMap={recipeMap}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          <PlanWeekView
            weekPlans={weekPlans}
            weekRangeLabel={weekRangeLabel}
            onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
            onNextWeek={() => setWeekOffset((prev) => prev + 1)}
            dietLine={dietLine}
            dietLineCompliance={dietLineCompliance}
            foods={foods}
            foodMap={foodMap}
            recipes={recipes}
            recipeMap={recipeMap}
            libraryFoods={foodCommandSource}
            categoryLabels={foodCategoryLabels}
            activeDate={currentDate}
            activeDayLabel={formattedDate}
            energyValue={getNutrientValue(dailyNutrients, "energie")}
            energyTarget={energyTargetValue}
            barTargets={weekBoardTargets}
            onSelectDay={setDate}
            onOpenDay={(date) => {
              setDate(date)
              setView("day")
            }}
            onCopyCurrentToDay={copyCurrentPlanToDate}
            onCopyToNextDay={copyPlanToNextDay}
            onClearDay={clearPlan}
            onDrop={(date, slotType, payload) => void handleWeekDropPayload(date, slotType, payload)}
            onRemoveEntry={removeEntryForDate}
            isExporting={exportingVariant !== null}
            onExportLehrkueche={() => void handleExportPlan("lehrkueche")}
          />
        </TabsContent>

        <TabsContent value="cycle" className="space-y-4">
          <PlanCycleView
            baseWeekStart={baseWeekStart}
            getPlansInRange={getPlansInRange}
            dietLine={dietLine}
            foods={foods}
            foodMap={foodMap}
            recipeMap={recipeMap}
          />
        </TabsContent>

        <TabsContent value="einzelanalyse" className="space-y-4">
          <PlanEinzelanalyseView
            plan={currentPlan}
            foods={foods}
            foodMap={foodMap}
            recipeMap={recipeMap}
            bodyWeightKg={latestPatientWeightKg}
          />
        </TabsContent>
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

      <PlanSaveTemplateDialog
        open={saveTemplateDialogOpen}
        onOpenChange={setSaveTemplateDialogOpen}
        dietLines={dietLines}
        defaults={saveTemplateDefaults}
        onSave={handleSaveTemplate}
      />

      <PlanAssignPatientDialog
        open={pendingPatientAssignmentId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPatientAssignmentId(null)
        }}
        patientName={
          pendingAssignmentPatient
            ? `${pendingAssignmentPatient.firstName} ${pendingAssignmentPatient.lastName}`
            : undefined
        }
        patientIndications={pendingAssignmentPatientIndications}
        entryCount={currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)}
        dateLabel={format(parseISO(currentDate), "dd.MM.yyyy")}
        isApproved={currentPlan.status === "approved"}
        onOpenPlanOnly={() => {
          const nextPatientId = pendingPatientAssignmentId
          setPendingPatientAssignmentId(null)
          if (nextPatientId) openPatientContext(nextPatientId)
        }}
        onAssign={() => {
          if (pendingPatientAssignmentId) {
            assignCurrentPlanToPatient(pendingPatientAssignmentId)
          }
        }}
        onCancel={() => setPendingPatientAssignmentId(null)}
      />

      <PlanAllergenWarningDialog
        open={pendingAllergenIntent !== null}
        itemName={pendingAllergenIntent?.itemName}
        warnings={pendingAllergenIntent?.warnings ?? []}
        onConfirm={confirmPendingAllergenIntent}
        onDismiss={dismissPendingAllergenIntent}
      />

      <PlanAkteSheet
        open={planAkteOpen}
        onOpenChange={setPlanAkteOpen}
        plan={currentPlan}
        sustainability={planSustainability}
        versions={mealPlanVersions}
        versionsLoading={mealPlanVersionsLoading}
        onSaveNotes={saveCurrentPlanNotes}
        onRestoreVersion={restoreVersion}
      />

      <PlanRecipePalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        recipes={recipes}
        foods={foods}
        patientIndications={patientIndications}
        patientAllergens={patientAllergens}
        isLocked={currentPlan.status === "approved"}
        onQuickAdd={handleQuickAddRecipe}
      />
    </div>
  )
}
