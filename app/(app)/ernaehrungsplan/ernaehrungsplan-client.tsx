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
  BookmarkPlus,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  FolderOpen,
  History,
  LayoutTemplate,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Settings2,
  UserPlus,
  Users,
  Utensils,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { getNutrientValue } from "@/lib/nutrients"
import { PlanAdditiveSummary } from "@/components/plan-additive-summary"
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
import { MealPlanLibrary } from "@/components/meal-plan-library"
import { PlanDayWorkspace } from "@/components/plan-day-workspace"
import { PlanSaveTemplateDialog, type SaveTemplateDraft } from "@/components/plan-save-template-dialog"
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
import { useMealPlanVersions } from "@/hooks/use-meal-plan-versions"
import {
  buildDefaultReportExportRequest,
  buildTeachingKitchenExportRequest,
  type MealPlanReportVariant,
} from "@/lib/exports/report-builder"
import { cn, downloadResponseFile } from "@/lib/utils"

const PLAN_STATUS_LABELS: Record<NonNullable<DailyMealPlan["status"]>, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  approved: "Freigegeben",
  archived: "Archiviert",
}

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
    savePlanForDate,
    createPlanCheckpoint,
    approvePlan,
    reopenPlan,
    restorePlanVersion,
    setDate,
    goToNextDay,
    goToPreviousDay,
    allPlans,
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
    // The shared library sits next to both planner views, so the food search
    // index is needed as soon as the page mounts.
    void loadFoodSearchIndex()
  }, [loadFoodSearchIndex])

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
    planSustainability,
    refConfig,
    dietLineCompliance,
    energyTargetValue,
    weekBoardTargets,
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
    if (value === CREATE_PATIENT_VALUE) {
      router.push("/patienten/neu")
      return
    }

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
          <div className="grid gap-3 sm:grid-cols-[minmax(200px,1fr)_minmax(220px,280px)]">
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
                  <SelectSeparator />
                  <SelectItem value={CREATE_PATIENT_VALUE}>
                    <UserPlus className="h-4 w-4" />
                    Neuen Patienten anlegen
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                    disabled={isSavingPlan || isApprovingPlan}
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
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="day">Tag</TabsTrigger>
          <TabsTrigger value="week">Woche</TabsTrigger>
        </TabsList>

        {/* The library is the shared build source for the day and week views:
            the same items can be dragged (or click-added) into either view. */}
        <div
          className={cn(
            "mt-2 grid items-start gap-4",
            (view === "day" || view === "week") && "xl:grid-cols-[290px_minmax(0,1fr)]",
          )}
        >
          {(view === "day" || view === "week") && (
            <MealPlanLibrary
              foods={foodCommandSource}
              fullFoods={foods}
              recipes={recipes}
              templates={mealPlanTemplates}
              categoryLabels={foodCategoryLabels}
              isLocked={currentPlan.status === "approved"}
              onQuickAdd={(payload, slotType) => void handleDropPayload(slotType, payload)}
              onApplyTemplate={handleApplyTemplate}
            />
          )}
          <div className="min-w-0">

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
            compliance={dietLineCompliance}
            dietLineName={dietLinesLoading ? "Zielprofile laden …" : dietLine?.name}
            suggestions={optimizationSuggestions}
            onApplySuggestion={applyOptimizationSuggestion}
            onAddEntry={handleAddEntry}
            onRemoveEntry={removeEntry}
            onUpdateAmount={updateEntryAmount}
            onMoveEntry={moveEntry}
            onOpenExchange={handleOpenExchange}
            onDropPayload={(slotType, payload) => void handleDropPayload(slotType, payload)}
            allergenWarnings={entryAllergenWarnings}
            isLocked={currentPlan.status === "approved"}
          >
            <PlanAdditiveSummary
              plan={currentPlan}
              foodMap={foodMap}
              recipeMap={recipeMap}
            />
          </PlanDayWorkspace>
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
            recipeMap={recipeMap}
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
    </div>
  )
}
