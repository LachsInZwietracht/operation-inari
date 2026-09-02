"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  differenceInCalendarDays,
  startOfWeek,
} from "date-fns"
import { de } from "date-fns/locale"
import {
  Copy,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Download,
  History,
  Library,
  Save,
  Send,
  UserPlus,
  UserRound,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useMealPlan } from "@/hooks/use-meal-plan"
import { useAllergenGuard } from "@/hooks/use-allergen-guard"
import {
  usePlanAnalysis,
  type OptimizationSuggestion,
} from "@/hooks/use-plan-analysis"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import { PlanAdditiveSummary } from "@/components/plan-additive-summary"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatNumber } from "@/lib/format"
import { todayIsoDate } from "@/lib/client-mode"
import {
  calculateEntryNutrients,
  complianceBadge,
  getEnergyTargetStatus,
  getEntryLabel,
  isMealEntryNutrientEvaluable,
} from "@/lib/meal-plan-calc"
import { getNutrientValue, sumNutrients } from "@/lib/nutrients"
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
import { PlanDietLineDialog, type DietLineDraft } from "@/components/plan-diet-line-dialog"
import { PlanExchangeDialog } from "@/components/plan-exchange-dialog"
import { MealPlanLibrary } from "@/components/meal-plan-library"
import { PlanDayWorkspace } from "@/components/plan-day-workspace"
import { PlanFillSuggestions } from "@/components/plan-fill-suggestions"
import { PlanExchangeTool } from "@/components/plan-exchange-tool"
import { PlanNutrientGapTool } from "@/components/plan-nutrient-gap-tool"
import type { NutrientGapAddPayload } from "@/components/plan-nutrient-gap-dialog"
import { PlanBalanceRail } from "@/components/plan-balance-rail"
import { PlanDayAnalysis } from "@/components/plan-day-analysis"
import { PlanWeekReleaseDialog, type WeekReleaseReview } from "@/components/plan-week-release-dialog"
import { PlanWeekCopyDialog } from "@/components/plan-week-copy-dialog"
import { PlanWeekTemplateDialog, type WeekTemplateDraft } from "@/components/plan-week-template-dialog"
import { PlanMultiDayTemplateApplyDialog, type TemplateApplyTarget } from "@/components/plan-multi-day-template-apply-dialog"
import {
  PlanStrategyView,
  type PatientEnergyContext,
} from "@/components/plan-strategy-view"
import { toast } from "sonner"

// Secondary views load lazily so the (default) day view ships less code
// and the week computations only run when their tab opens.
const viewFallback = () => <div className="h-[420px] rounded-md bg-muted/40" />
const PlanWeekView = dynamic(
  () => import("@/components/plan-week-view").then((mod) => mod.PlanWeekView),
  { ssr: false, loading: viewFallback },
)
import { fetchFoodById, fetchFoodsByIds } from "@/lib/data/foods-client"
import { fetchClientLinkForPatient } from "@/lib/data/client-links"
import {
  beginMealPlanWeekRevisionClient,
  fetchMealPlansClient,
  releaseMealPlanWeekRevisionClient,
} from "@/lib/data/meal-plans-client"
import { isUuid } from "@/lib/data/local-records"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { summarizePlanAllergenConflicts } from "@/lib/allergen-warnings"
import { usePatients } from "@/hooks/use-patients"
import { useDietLinePresets } from "@/hooks/use-diet-line-presets"
import { useMealPlanTemplates } from "@/hooks/use-meal-plan-templates"
import { PlanExportDialog } from "@/components/plan-export-dialog"
import { PlanDataExchangeDialog } from "@/components/plan-data-exchange-dialog"
import { cn } from "@/lib/utils"

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

function getTemplateBlocks(template: MealPlanTemplate) {
  return template.dayBlocks?.length
    ? template.dayBlocks
    : [{ offsetDays: 0, slots: template.slots }]
}

interface MealPlanPlannerProps {
  recipes: Recipe[]
  initialPlans: DailyMealPlan[]
  initialTemplates?: MealPlanTemplate[]
  patientId?: string
  initialDate?: string
  /** Initial inner workspace when a surrounding flow already made the choice. */
  initialView?: "strategy" | "day" | "week" | "analysis" | "plans"
  /** Mirrors embedded workspace transitions into the surrounding route. */
  onViewChange?: (view: string, date: string) => void
  /**
   * Template id passed via `?template=…` (used by Planvorlagen to
   * deep-link "anwenden"). When present, the planner consumes it once on
   * mount: applies the template's slots to the active date and rewrites the
   * URL without the param so a refresh does not re-apply silently.
   */
  initialApplyTemplateId?: string
  /** Lets an embedded route remove a consumed template deep-link safely. */
  onApplyTemplateConsumed?: () => void
  /**
   * Renders inside a patient record rather than on its own route: the page
   * header, the patient picker and the "no patient chosen" state all belong to
   * the standalone page and are dropped here, because the record around it
   * already answers whose plan this is.
   */
  embedded?: boolean
  /**
   * One more view alongside the planning views — the patient's plan list.
   * Rendered with a handle back into the planner so opening a plan selects its
   * date here instead of navigating out of the record.
   */
  extraTab?: {
    value: string
    label: string
    render: (api: {
      openDay: (date: string) => void
      openPlan: (plan: DailyMealPlan) => void
      openWeek: (plan: DailyMealPlan) => void
      workspacePlans: DailyMealPlan[]
    }) => React.ReactNode
  }
  /**
   * The patient's current energy figures, when the surrounding record already
   * holds them. Lets the strategy say what a calorie target *means* — a deficit
   * or a surplus — instead of quoting a bare number.
   */
  energyContext?: PatientEnergyContext
}

export function MealPlanPlanner({
  recipes,
  initialPlans,
  initialTemplates,
  patientId,
  initialDate,
  initialView,
  onViewChange,
  initialApplyTemplateId,
  onApplyTemplateConsumed,
  embedded = false,
  extraTab,
  energyContext,
}: MealPlanPlannerProps) {
  const router = useRouter()
  const [today] = useState(todayIsoDate)
  const serverFoods = useFoods()
  const { index: foodSearchIndex, loadIndex: loadFoodSearchIndex } = useFoodSearch()
  const { patients, getPatient, savePatient } = usePatients()
  const patient = patientId ? getPatient(patientId) : undefined
  const defaultPlanMetadata = useMemo(
    () => ({
      patientId,
      title: patient ? `Ernährungsplan ${patient.firstName} ${patient.lastName}` : undefined,
    }),
    [patient, patientId],
  )
  const [hydratedFoods, setHydratedFoods] = useState<Food[]>(serverFoods)
  const [pendingHydrationIds, setPendingHydrationIds] = useState<string[]>([])
  const [failedHydrationIds, setFailedHydrationIds] = useState<string[]>([])
  const [completedAnalysisHydrationKeys, setCompletedAnalysisHydrationKeys] = useState<string[]>([])
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
    copyWeekToDates,
    clearPlanForDate,
    updatePlanMetadata,
    applyTemplateToDate,
    setWorkspacePlan,
    flushPlansForDates,
    setDate,
    allPlans,
  } = useMealPlan(initialPlans, serverFoods, defaultPlanMetadata, initialDate)
  const {
    presets: dietLines,
    isLoading: dietLinesLoading,
    savePreset: saveDietLinePreset,
    deletePreset: deleteDietLinePreset,
  } = useDietLinePresets()
  const { templates: mealPlanTemplates, saveTemplate } = useMealPlanTemplates({ initialTemplates, patientId })
  const [pendingMultiDayTemplate, setPendingMultiDayTemplate] = useState<{
    template: MealPlanTemplate
    startDate: string
  } | null>(null)
  const [isApplyingMultiDayTemplate, setIsApplyingMultiDayTemplate] = useState(false)

  // Planvorlagen deep-links deliberately open the same preview as the library.
  // Removing the parameter makes a refresh harmless without bypassing the
  // target-date and overwrite review.
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
    if (template.patientId && template.patientId !== patientId) {
      toast.error("Diese Vorlage gehört zu einem anderen Patienten.")
      return
    }
    startTransition(() => {
      setPendingMultiDayTemplate({ template, startDate: currentDate })
    })
    if (embedded) {
      onApplyTemplateConsumed?.()
      return
    }
    const params = new URLSearchParams()
    params.set("date", currentDate)
    if (patientId) params.set("patientId", patientId)
    router.replace(`/ernaehrungsplan?${params.toString()}`)
  }, [
    embedded,
    initialApplyTemplateId,
    mealPlanTemplates,
    currentDate,
    patientId,
    router,
    onApplyTemplateConsumed,
  ])

  const [commandOpen, setCommandOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState<MealSlotType>("fruehstueck")
  // When adding from the week board a target day is set; null means the active day.
  const [activeAddDate, setActiveAddDate] = useState<string | null>(null)
  // The patient record opens on the week as its actual planning surface.
  // Standalone callers can still choose strategy or day explicitly.
  const [internalView, setInternalView] = useState<string>(
    initialView ?? (embedded ? "strategy" : "day"),
  )
  // Embedded callers control the visible depth from the URL. Standalone use
  // keeps the original local tab state.
  const view = onViewChange && initialView ? initialView : internalView
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false)
  const [exchangeSlot, setExchangeSlot] = useState<MealSlotType | null>(null)
  const [exchangeEntryId, setExchangeEntryId] = useState<string | null>(null)
  const [dietLineDialogOpen, setDietLineDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [planDataExchangeOpen, setPlanDataExchangeOpen] = useState(false)
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekReleaseReviewOpen, setWeekReleaseReviewOpen] = useState(false)
  const [isReleasingWeek, setIsReleasingWeek] = useState(false)
  const [isBeginningWeekRevision, setIsBeginningWeekRevision] = useState(false)
  const [weekCopyOpen, setWeekCopyOpen] = useState(false)
  const [isCopyingWeek, setIsCopyingWeek] = useState(false)
  const [selectedWeekDates, setSelectedWeekDates] = useState<string[]>([])
  const [weekTemplateDialogOpen, setWeekTemplateDialogOpen] = useState(false)
  const [isSavingWeekTemplate, setIsSavingWeekTemplate] = useState(false)
  const [clientLinkState, setClientLinkState] = useState<"linked" | "not-linked" | "unknown">("unknown")

  const changeView = useCallback((nextView: string, date = currentDate) => {
    setInternalView(nextView)
    onViewChange?.(nextView, date)
  }, [currentDate, onViewChange])

  const selectDate = useCallback((date: string, extendSelection = false) => {
    setDate(date)
    setSelectedWeekDates((previous) => {
      if (!extendSelection) return [date]
      return previous.includes(date)
        ? previous.filter((selectedDate) => selectedDate !== date)
        : [...previous, date].sort()
    })
  }, [setDate])

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

  // The analysis is intentionally tied to the in-memory plan: edits that are
  // still in the autosave queue must be visible. It nevertheless waits for
  // full food/ingredient records before issuing definitive nutrient statuses.
  const analysisReferencedFoodIds = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of currentPlan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") ids.add(entry.referenceId)
        else recipeMap.get(entry.referenceId)?.ingredients.forEach((ingredient) => ids.add(ingredient.foodId))
      }
    }
    return Array.from(ids)
  }, [currentPlan.slots, recipeMap])
  const analysisMissingFoodIds = useMemo(
    () => analysisReferencedFoodIds.filter((id) => !hydratedFoods.some((food) => food.id === id || food.legacyId === id)),
    [analysisReferencedFoodIds, hydratedFoods],
  )
  const analysisFoodRequestKey = [...analysisReferencedFoodIds].sort().join("|")
  const analysisForceHydrationComplete = completedAnalysisHydrationKeys.includes(analysisFoodRequestKey)
  const analysisHydration = analysisReferencedFoodIds.some((id) => failedHydrationIds.includes(id))
    ? "error" as const
    : analysisReferencedFoodIds.some((id) => pendingHydrationIds.includes(id))
      ? "loading" as const
      : (view === "analysis" && analysisReferencedFoodIds.length > 0 && !analysisForceHydrationComplete) || analysisMissingFoodIds.length > 0
        ? "loading" as const
        : "ready" as const

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
    setPendingHydrationIds((previous) => Array.from(new Set([...previous, ...missing])))
    setFailedHydrationIds((previous) => previous.filter((id) => !missing.includes(id)))

    let cancelled = false
    fetchFoodsByIds(missing)
      .then((fetched) => {
        if (cancelled) return
        const fetchedIds = new Set(fetched.map((food) => food.id))
        const unresolved = missing.filter((id) => !fetchedIds.has(id))
        setFailedHydrationIds((previous) => Array.from(new Set([...previous, ...unresolved])))
        setHydratedFoods((prev) => {
          const known = new Set(prev.map((food) => food.id))
          const additions = fetched.filter((food) => !known.has(food.id))
          return additions.length > 0 ? [...prev, ...additions] : prev
        })
        setPendingHydrationIds((previous) => previous.filter((id) => !missing.includes(id)))
      })
      .catch((error) => {
        console.error("Failed to hydrate referenced meal plan foods:", error)
        // Allow a retry on the next change.
        missing.forEach((id) => requestedFoodIdsRef.current.delete(id))
        setPendingHydrationIds((previous) => previous.filter((id) => !missing.includes(id)))
        setFailedHydrationIds((previous) => Array.from(new Set([...previous, ...missing])))
      })
    return () => {
      cancelled = true
      missing.forEach((id) => requestedFoodIdsRef.current.delete(id))
      setPendingHydrationIds((previous) => previous.filter((id) => !missing.includes(id)))
    }
  }, [allPlans, recipeMap, hydratedFoods])

  // Initial planner payloads intentionally contain only the compact nutrient
  // list needed for the week. Opening the detailed analysis force-refreshes
  // every direct food and recipe ingredient with the complete nutrient set;
  // fetched rows replace the compact copies instead of being discarded.
  const analysedFoodRequestKeysRef = useRef(new Set<string>())
  useEffect(() => {
    if (view !== "analysis" || analysisReferencedFoodIds.length === 0) return
    const key = analysisFoodRequestKey
    if (analysedFoodRequestKeysRef.current.has(key)) return
    analysedFoodRequestKeysRef.current.add(key)
    let cancelled = false
    let completed = false
    setPendingHydrationIds((previous) => Array.from(new Set([...previous, ...analysisReferencedFoodIds])))
    setFailedHydrationIds((previous) => previous.filter((id) => !analysisReferencedFoodIds.includes(id)))
    fetchFoodsByIds(analysisReferencedFoodIds)
      .then((fetched) => {
        if (cancelled) return
        const resolved = new Set<string>()
        for (const food of fetched) {
          resolved.add(food.id)
          if (food.legacyId) resolved.add(food.legacyId)
        }
        const unavailable = analysisReferencedFoodIds.filter((id) => !resolved.has(id))
        setFailedHydrationIds((previous) => Array.from(new Set([...previous, ...unavailable])))
        setHydratedFoods((previous) => {
          const next = new Map(previous.map((food) => [food.id, food]))
          // Replacement is deliberate: the server's 16-field preview cannot
          // answer the detailed vitamin, fatty-acid, or amino-acid rows.
          for (const food of fetched) next.set(food.id, food)
          return Array.from(next.values())
        })
        setCompletedAnalysisHydrationKeys((previous) => previous.includes(key) ? previous : [...previous, key])
        completed = true
      })
      .catch((error) => {
        if (cancelled) return
        console.error("Failed to fully hydrate foods for day analysis:", error)
        setFailedHydrationIds((previous) => Array.from(new Set([...previous, ...analysisReferencedFoodIds])))
        analysedFoodRequestKeysRef.current.delete(key)
      })
      .finally(() => {
        if (!cancelled) {
          setPendingHydrationIds((previous) => previous.filter((id) => !analysisReferencedFoodIds.includes(id)))
        }
      })
    return () => {
      cancelled = true
      if (!completed) {
        analysedFoodRequestKeysRef.current.delete(key)
        setPendingHydrationIds((previous) => previous.filter((id) => !analysisReferencedFoodIds.includes(id)))
      }
    }
  }, [analysisFoodRequestKey, analysisReferencedFoodIds, view])

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
    refConfig,
    dietLineMacros,
    dietLineCompliance,
    micronutrientCompliance,
    microReferenceValues,
    energyTargetValue,
    optimizationSuggestions,
    planFillState,
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
  // kcal per day of that week, for the weekday chips in the day header.
  const weekDayKcal = useMemo(() => {
    const map = new Map<string, number>()
    for (const dayPlan of dayWeekPlans) {
      const totals = sumNutrients(
        dayPlan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      )
      map.set(dayPlan.date, getNutrientValue(totals, "energie"))
    }
    return map
  }, [dayWeekPlans, foodMap, foods, recipeMap])
  const weekRangeLabel = `${format(computedWeekStart, "d. MMM", { locale: de })} – ${format(
    addDays(computedWeekStart, 6),
    "d. MMM yyyy",
    { locale: de },
  )}`
  const assignedPatient = currentPlan.patientId ? getPatient(currentPlan.patientId) : undefined
  const visiblePatient = patient ?? assignedPatient
  const hasSelectedPatient = Boolean(patientId ?? currentPlan.patientId)
  const visiblePatientAllergens = useMemo(
    () => (visiblePatient ? getAllergensForPatient(visiblePatient.id) : []),
    [visiblePatient, getAllergensForPatient],
  )

  // Only the active link state is needed for the handoff copy. This stays in
  // the counselor's existing RLS scope and does not load any client diary data.
  useEffect(() => {
    if (!patientId) {
      setClientLinkState("not-linked")
      return
    }
    let cancelled = false
    fetchClientLinkForPatient(createSupabaseClient(), patientId)
      .then((link) => {
        if (!cancelled) setClientLinkState(link?.status === "active" ? "linked" : "not-linked")
      })
      .catch(() => {
        if (!cancelled) setClientLinkState("unknown")
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  // The day's totals, keyed by nutrient id, so the strategy view can mark each
  // principle as reached or still open on the day currently in the Tag view.
  const dayTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const nutrient of dailyNutrients) {
      totals[nutrient.nutrientId] = nutrient.amount
    }
    return totals
  }, [dailyNutrients])

  /** The strategy's energy target, shown in the tactical views as a reminder. */
  const strategyKcalTarget = visiblePatient?.dailyCalorieGoal

  const weekReleaseReview = useMemo<WeekReleaseReview>(() => {
    const blockers: string[] = []
    const warnings: string[] = []
    const persistedDraftDays = weekPlans.filter(
      (plan) =>
        isUuid(plan.id) &&
        plan.status === "draft" &&
        plan.slots.some((slot) => slot.entries.length > 0),
    )
    const preparedDays = weekPlans.filter((plan) => plan.slots.some((slot) => slot.entries.length > 0))
    const targetEnergy = energyTargetValue ?? strategyKcalTarget

    if (preparedDays.length !== 7) {
      blockers.push(`${7 - preparedDays.length} von 7 Tagen sind noch nicht belegt.`)
    }
    if (persistedDraftDays.length !== 7) {
      const unpersisted = preparedDays.filter((plan) => !isUuid(plan.id)).length
      const nonDraft = preparedDays.filter((plan) => isUuid(plan.id) && plan.status !== "draft").length
      if (unpersisted > 0) blockers.push(`${unpersisted} befüllte Tage werden noch gespeichert.`)
      if (nonDraft > 0) blockers.push(`${nonDraft} befüllte Tage sind nicht mehr als Entwurf bearbeitbar.`)
      if (unpersisted === 0 && nonDraft === 0 && preparedDays.length === 7) {
        blockers.push("Nicht alle sieben Tagesentwürfe konnten als gespeicherte Pläne geprüft werden.")
      }
    }

    const severeDays = weekPlans.filter((plan) =>
      summarizePlanAllergenConflicts(plan, visiblePatientAllergens, foodMap, recipeMap).highestSeverity === "severe",
    )
    if (severeDays.length > 0) {
      blockers.push(`Schwere Allergenkonflikte an ${severeDays.map((plan) => format(parseISO(plan.date), "EEE d.", { locale: de })).join(", ")}.`)
    }

    const allEntries = weekPlans.flatMap((plan) => plan.slots.flatMap((slot) => slot.entries))
    if (allEntries.length > 0) {
      if (targetEnergy) {
        const evaluableEnergy = allEntries.every((entry) =>
          isMealEntryNutrientEvaluable(entry, "energie", foodMap, recipeMap),
        )
        if (!evaluableEnergy) {
          warnings.push("Die Wochenenergie ist wegen fehlender Quelldaten nicht vollständig beurteilbar.")
        } else {
          const totalEnergy = getNutrientValue(
            sumNutrients(allEntries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap))),
            "energie",
          )
          const status = getEnergyTargetStatus(totalEnergy / 7, targetEnergy)
          if (status === "low" || status === "high") {
            warnings.push(`Die durchschnittliche Energie liegt ${status === "low" ? "unter" : "über"} dem Zielkorridor.`)
          }
        }
      }

      const unavailableTargets = micronutrientCompliance.filter((target) =>
        !allEntries.every((entry) =>
          isMealEntryNutrientEvaluable(entry, target.nutrientId, foodMap, recipeMap),
        ),
      )
      if (unavailableTargets.length > 0) {
        warnings.push(`Für ${unavailableTargets.slice(0, 3).map((target) => target.label).join(", ")} fehlen bei einzelnen Einträgen Quelldaten.`)
      }

      const nutrientGaps = micronutrientCompliance.filter((target) => {
        if (!allEntries.every((entry) => isMealEntryNutrientEvaluable(entry, target.nutrientId, foodMap, recipeMap))) return false
        const average = getNutrientValue(
          sumNutrients(allEntries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap))),
          target.nutrientId,
        ) / 7
        return complianceBadge(average, target.min, target.max) !== "ok"
      })
      if (nutrientGaps.length > 0) {
        warnings.push(`Die Wochenbilanz markiert ${nutrientGaps.slice(0, 3).map((target) => target.label).join(", ")} zur fachlichen Prüfung.`)
      }
    }

    return {
      blockers,
      warnings,
      plannedDays: preparedDays.length,
      clientVisibility: clientLinkState,
    }
  }, [clientLinkState, energyTargetValue, foodMap, foods, micronutrientCompliance, recipeMap, strategyKcalTarget, visiblePatientAllergens, weekPlans])

  const weekIsReleased = weekPlans.length === 7 && weekPlans.every(
    (plan) => plan.status === "approved" || plan.status === "active",
  )

  // Selection deliberately lives only in the currently visible week. It is a
  // separate concern from `currentDate`: the latter keeps the library and
  // contextual day view pointed at one concrete day.
  const selectedWeekPlans = useMemo(
    () => weekPlans.filter((plan) => selectedWeekDates.includes(plan.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [selectedWeekDates, weekPlans],
  )
  const selectedWeekHasEmptyDay = selectedWeekPlans.some(
    (plan) => !plan.slots.some((slot) => slot.entries.length > 0),
  )

  const handleSaveWeekTemplate = useCallback(async ({ name, description, indication, dietLineId, scope }: WeekTemplateDraft) => {
    if (selectedWeekPlans.length === 0) return
    if (selectedWeekPlans.some((plan) => !plan.slots.some((slot) => slot.entries.length > 0))) {
      toast.error("Leere Tage können nicht als Vorlage gespeichert werden.", {
        description: "Wähle nur Tage mit mindestens einem geplanten Eintrag aus.",
      })
      return
    }
    setIsSavingWeekTemplate(true)
    try {
      const firstDate = selectedWeekPlans[0].date
      const isMultiDay = selectedWeekPlans.length > 1
      await saveTemplate({
        name,
        description: description || (isMultiDay
          ? `Persönlicher Vorlagenblock aus ${selectedWeekPlans.length} Planungstagen.`
          : "Persönliche Tagesvorlage aus dem Planer."),
        indication: indication || undefined,
        // Keep `slots` populated for all existing day-template consumers.
        slots: selectedWeekPlans[0].slots,
        dayBlocks: isMultiDay
          ? selectedWeekPlans.map((plan) => ({
              offsetDays: differenceInCalendarDays(parseISO(plan.date), parseISO(firstDate)),
              slots: plan.slots,
            }))
          : undefined,
        dietLineId,
        targetProfileId: selectedWeekPlans[0].targetProfileId,
        patientId: scope === "patient" ? patientId : undefined,
      })
      setWeekTemplateDialogOpen(false)
      toast.success(isMultiDay ? "Mehrtägige Vorlage gespeichert." : "Tagesvorlage gespeichert.", {
        description: "Sie steht ab sofort in der Bibliothek unter Vorlagen bereit.",
      })
    } catch (error) {
      console.error("Failed to save selected meal plan days as template:", error)
      toast.error("Vorlage konnte nicht gespeichert werden.")
    } finally {
      setIsSavingWeekTemplate(false)
    }
  }, [patientId, saveTemplate, selectedWeekPlans])

  const handleReleaseWeek = useCallback(async () => {
    if (!patientId || weekReleaseReview.blockers.length > 0) return
    setIsReleasingWeek(true)
    try {
      const persisted = await flushPlansForDates(weekPlans.map((plan) => plan.date))
      if (persisted.length !== 7 || persisted.some((plan) => !isUuid(plan.id) || plan.status !== "draft")) {
        throw new Error("WEEK_PLANS_NOT_PERSISTED")
      }
      const released = await releaseMealPlanWeekRevisionClient(
        patientId,
        computedWeekStartIso,
        persisted.map((plan) => plan.id),
      )
      for (const plan of released) setWorkspacePlan(plan)
      setWeekReleaseReviewOpen(false)
      toast.success("Wochenplan verbindlich freigegeben.", {
        description: clientLinkState === "linked" ? "Im Klienten-Account sichtbar." : "Kein aktiver Klienten-Account verknüpft.",
      })
    } catch (error) {
      console.error("Failed to release meal plan week:", error)
      toast.error("Wochenplan konnte nicht freigegeben werden.", {
        description: error instanceof Error && error.message === "WEEK_PLANS_NOT_PERSISTED"
          ? "Bitte warten Sie, bis alle sieben Tagesentwürfe gespeichert sind."
          : "Die Woche wurde nicht teilweise freigegeben.",
      })
    } finally {
      setIsReleasingWeek(false)
    }
  }, [clientLinkState, computedWeekStartIso, flushPlansForDates, patientId, setWorkspacePlan, weekPlans, weekReleaseReview.blockers.length])

  const handleBeginWeekRevision = useCallback(async () => {
    if (!patientId || !weekIsReleased) return
    setIsBeginningWeekRevision(true)
    try {
      const drafts = await beginMealPlanWeekRevisionClient(patientId, computedWeekStartIso)
      if (drafts.length !== 7) throw new Error("WEEK_REVISION_RETURN_INCOMPLETE")
      for (const draft of drafts) setWorkspacePlan(draft)
      toast.success("Arbeitsfassung für die Woche vorbereitet.", {
        description: "Die bisher freigegebene Woche bleibt für den Klienten sichtbar, bis diese Änderungen veröffentlicht werden.",
      })
    } catch (error) {
      console.error("Failed to begin meal plan week revision:", error)
      const code = error instanceof Error ? error.message : ""
      toast.error("Arbeitsfassung konnte nicht vorbereitet werden.", {
        description: code.includes("WEEK_REVISION_DRAFT_INCOMPLETE") || code.includes("WEEK_REVISION_DRAFT_CONFLICT")
          ? "Für diese Woche liegt bereits eine unvollständige oder nicht zuordenbare Arbeitsfassung vor. Es wurde nichts verändert."
          : "Die bisherige Freigabe bleibt unverändert.",
      })
    } finally {
      setIsBeginningWeekRevision(false)
    }
  }, [computedWeekStartIso, patientId, setWorkspacePlan, weekIsReleased])

  const handleCopyWeek = useCallback(
    async (targetWeekStart: string, repetitions: number, strategy: "fill-empty" | "replace-drafts") => {
      setIsCopyingWeek(true)
      try {
        const result = await copyWeekToDates(computedWeekStartIso, targetWeekStart, repetitions, strategy)
        setWeekCopyOpen(false)

        if (result.copied === 0) {
          toast.message("Keine Tage fortgeschrieben.", {
            description: result.skippedLocked > 0
              ? `${result.skippedLocked} freigegebene oder gesperrte Tage wurden geschützt.`
              : "Die Zielwoche enthält bereits Planung.",
          })
          return
        }

        if (result.failed === result.copied) {
          toast.error("Die fortgeschriebenen Entwürfe konnten nicht gespeichert werden.", {
            description: "Bitte Verbindung prüfen und den Vorgang erneut ausführen.",
          })
          return
        }

        const skipped = result.skippedOccupied + result.skippedLocked + result.skippedSource
        toast.success(`${result.copied} ${result.copied === 1 ? "Tagesentwurf" : "Tagesentwürfe"} fortgeschrieben.`, {
          description: [
            skipped > 0 ? `${skipped} Tage übersprungen` : null,
            result.failed > 0 ? `${result.failed} Kopien konnten nicht gespeichert werden` : null,
          ].filter(Boolean).join(" · ") || "Die neue Planung ist noch nicht freigegeben.",
        })
      } catch (error) {
        console.error("Failed to copy meal plan week:", error)
        toast.error("Woche konnte nicht fortgeschrieben werden.")
      } finally {
        setIsCopyingWeek(false)
      }
    },
    [computedWeekStartIso, copyWeekToDates],
  )

  // Strategy values (calorie target, macro split) live on the patient record,
  // so editing them here writes to the same fields the Kalorienrechner and the
  // patient overview read.
  const handleSaveStrategy = useCallback(
    async (updates: Partial<Patient>) => {
      if (!visiblePatient) return
      await savePatient(visiblePatient.id, updates)
    },
    [visiblePatient, savePatient],
  )

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

  const handleAddGapSuggestion = useCallback(
    ({ type, referenceId, name, amount, allergens, slotType }: NutrientGapAddPayload) => {
      if (currentPlan.status === "approved") {
        toast.error("Freigegebene Pläne vor der Bearbeitung als Entwurf öffnen.")
        return
      }

      guardedAddEntry(
        slotType,
        { type, referenceId, amount },
        { itemKind: type, itemName: name, allergens },
      )
      const amountLabel =
        type === "food"
          ? `${formatNumber(amount, 0)} g`
          : `${formatNumber(amount, Number.isInteger(amount) ? 0 : 1)} ${amount === 1 ? "Portion" : "Portionen"}`
      toast.success(`${name} (${amountLabel}) für ${MEAL_SLOT_LABELS[slotType]} vorgemerkt.`)
    },
    [currentPlan.status, guardedAddEntry],
  )

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

  const applyTemplateBlocks = useCallback(
    (template: MealPlanTemplate, startDate: string) => {
      const blocks = getTemplateBlocks(template)
      const basePlan = getPlansInRange(startDate, 1)[0]
      for (const block of blocks) {
        const targetDate = format(addDays(parseISO(startDate), block.offsetDays), "yyyy-MM-dd")
        applyTemplateToDate(targetDate, block.slots, {
          dietLineId: template.dietLineId ?? basePlan.dietLineId,
          targetProfileId: template.targetProfileId ?? basePlan.targetProfileId,
          title: basePlan.title ?? (patient ? `${template.name} – ${patient.firstName} ${patient.lastName}` : template.name),
          notes: basePlan.notes ?? template.notes ?? undefined,
        })
      }
      setDate(startDate)
      setWeekOffset(0)
      setSelectedWeekDates(blocks.map((block) =>
        format(addDays(parseISO(startDate), block.offsetDays), "yyyy-MM-dd"),
      ))
      setPendingMultiDayTemplate(null)
      toast.success(
        blocks.length > 1
          ? `Vorlagenblock "${template.name}" ab ${format(parseISO(startDate), "d. MMM", { locale: de })} angewendet.`
          : `Vorlage "${template.name}" auf den Tagesplan angewendet.`,
      )
    },
    [applyTemplateToDate, getPlansInRange, patient, setDate],
  )

  const getTemplateApplyTargets = useCallback(
    (template: MealPlanTemplate, startDate: string): TemplateApplyTarget[] => {
      const blocks = getTemplateBlocks(template)
      const range = getPlansInRange(startDate, Math.max(...blocks.map((block) => block.offsetDays)) + 1)
      return blocks.map((block) => {
        const date = format(addDays(parseISO(startDate), block.offsetDays), "yyyy-MM-dd")
        const plan = range.find((candidate) => candidate.date === date)
        const protectedPlan = plan?.status === "approved" || plan?.status === "active" || plan?.status === "archived"
        const hasDraft = !protectedPlan && Boolean(plan?.slots.some((slot) => slot.entries.length > 0))
        return { date, state: protectedPlan ? "protected" : hasDraft ? "draft" : "free" }
      })
    },
    [getPlansInRange],
  )

  const confirmMultiDayTemplateApply = useCallback(async () => {
    if (!pendingMultiDayTemplate) return
    if (pendingMultiDayTemplate.template.patientId && pendingMultiDayTemplate.template.patientId !== patientId) {
      setPendingMultiDayTemplate(null)
      toast.error("Diese Vorlage gehört zu einem anderen Patienten.")
      return
    }
    const targetDates = getTemplateApplyTargets(
      pendingMultiDayTemplate.template,
      pendingMultiDayTemplate.startDate,
    ).map((target) => target.date)
    if (!patientId) {
      applyTemplateBlocks(pendingMultiDayTemplate.template, pendingMultiDayTemplate.startDate)
      return
    }
    setIsApplyingMultiDayTemplate(true)
    try {
      // The in-memory week can be stale while another counselor is working.
      // Only an immediate database read decides whether this whole block may
      // replace drafts; any read failure is intentionally a safe no-op.
      const persistedPlans = await fetchMealPlansClient({ patientId })
      const protectedDates = targetDates.filter((date) => {
        const rows = persistedPlans.filter((plan) => plan.date === date)
        // A released row may intentionally coexist with its editable change
        // draft. In that case the workspace targets the draft and leaves the
        // currently client-visible release untouched.
        if (rows.some((plan) => plan.status === "draft")) return false
        return rows.some(
          (plan) => plan.status === "approved" || plan.status === "active" || plan.status === "archived",
        )
      })
      if (protectedDates.length > 0) {
        setPendingMultiDayTemplate(null)
        toast.error("Vorlagenblock nicht angewendet.", {
          description: `Geschützte Tage: ${protectedDates.map((date) => format(parseISO(date), "d. MMM", { locale: de })).join(", ")}. Es wurde nichts verändert.`,
        })
        return
      }
      // A persisted draft is deliberately replaceable: the prior dialog made
      // that replacement explicit. There are no protected targets, so all
      // local mutations begin together; their established autosaves still run
      // per daily plan and can report individual persistence failures later.
      applyTemplateBlocks(pendingMultiDayTemplate.template, pendingMultiDayTemplate.startDate)
    } catch (error) {
      console.error("Failed to verify meal plan block targets:", error)
      setPendingMultiDayTemplate(null)
      toast.error("Vorlagenblock nicht angewendet.", {
        description: "Die aktuellen Planstände konnten nicht geprüft werden. Es wurde nichts verändert.",
      })
    } finally {
      setIsApplyingMultiDayTemplate(false)
    }
  }, [applyTemplateBlocks, getTemplateApplyTargets, patientId, pendingMultiDayTemplate])

  const handleApplyTemplate = useCallback(
    (template: MealPlanTemplate) => {
      if (template.patientId && template.patientId !== patientId) {
        toast.error("Diese Vorlage gehört zu einem anderen Patienten.")
        return
      }
      setPendingMultiDayTemplate({
        template,
        startDate: currentDate,
      })
    },
    [currentDate, patientId],
  )

  // Shared export trigger — rendered in the day header and reused in the week
  // header. Opens the configurable export dialog (document type, days, contents).
  const exportMenu = (
    <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
      <Download className="mr-1.5 h-4 w-4" />
      Export
    </Button>
  )
  const weekHeaderActions = embedded ? (
    <>
      {selectedWeekPlans.length > 0 ? (
        <>
          <span className="text-muted-foreground hidden text-xs 2xl:inline">
            {selectedWeekPlans.length} {selectedWeekPlans.length === 1 ? "Tag" : "Tage"} ausgewählt · weitere über ⋯ hinzufügen
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWeekTemplateDialogOpen(true)}
            disabled={selectedWeekHasEmptyDay}
            title={selectedWeekHasEmptyDay ? "Jeder ausgewählte Tag braucht mindestens einen Eintrag." : undefined}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Als Vorlage speichern
          </Button>
        </>
      ) : null}
      <Button size="sm" variant="outline" onClick={() => setWeekCopyOpen(true)} disabled={isCopyingWeek}>
        <Copy className="mr-1.5 h-4 w-4" />
        Woche fortschreiben
      </Button>
      {weekIsReleased ? (
        <>
          <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800" variant="outline">
            Plan freigegeben
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleBeginWeekRevision()}
            disabled={isBeginningWeekRevision}
          >
            {isBeginningWeekRevision ? "Arbeitsfassung wird vorbereitet …" : "Änderungen vorbereiten"}
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => setWeekReleaseReviewOpen(true)}>
          <Send className="mr-1.5 h-4 w-4" />
          Plan prüfen &amp; freigeben
        </Button>
      )}
      {exportMenu}
    </>
  ) : exportMenu
  // The dialog exports the week the user is looking at: the week view follows
  // its offset navigation, the day view the week around the active date.
  const exportWeekPlans = view === "week" ? weekPlans : dayWeekPlans
  const exportDefaultDates = useMemo(
    () =>
      view === "week"
        ? weekPlans
            .filter((plan) => plan.slots.some((slot) => slot.entries.length > 0))
            .map((plan) => plan.date)
        : [currentDate],
    [view, weekPlans, currentDate],
  )

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
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
      )}

      {!embedded && !hasSelectedPatient && (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <UserRound className="text-muted-foreground mx-auto h-8 w-8" />
          <p className="mt-3 text-sm font-medium">Kein Patient ausgewählt</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Wählen Sie oben einen Patienten, um seinen Ernährungsplan zu bearbeiten.
          </p>
        </div>
      )}

      {(embedded || hasSelectedPatient) && (
        <>
      <Tabs value={view} onValueChange={(nextView) => changeView(nextView)}>
        {/* Embedded, the sub-navigation shares its row with the one action the
            page header used to carry, so the planner opens no taller than the
            tab strip it replaces. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            {!embedded ? <TabsTrigger value="strategy">Strategie</TabsTrigger> : null}
            {!embedded ? <TabsTrigger value="day">Tag</TabsTrigger> : null}
            <TabsTrigger value="week">Planer</TabsTrigger>
            {extraTab ? (
              <TabsTrigger value={extraTab.value}>{extraTab.label}</TabsTrigger>
            ) : null}
            <TabsTrigger value="templates" asChild>
              <Link
                href={
                  patientId ?? currentPlan.patientId
                    ? `/ernaehrungsplan/bibliothek?patientId=${patientId ?? currentPlan.patientId}&returnDate=${currentDate}`
                    : "/ernaehrungsplan/bibliothek"
                }
              >
                Vorlagen
              </Link>
            </TabsTrigger>
          </TabsList>
        </div>

        {extraTab ? (
          <TabsContent value={extraTab.value} className="mt-2">
            {extraTab.render({
              openDay: (date) => {
                setDate(date)
                setWeekOffset(0)
                changeView("day", date)
              },
              openPlan: (plan) => {
                setWorkspacePlan(plan)
                setDate(plan.date)
                setWeekOffset(0)
                changeView("day", plan.date)
              },
              openWeek: (plan) => {
                setWorkspacePlan(plan)
                setDate(plan.date)
                setWeekOffset(0)
                changeView("week", plan.date)
              },
              workspacePlans: Object.values(allPlans),
            })}
          </TabsContent>
        ) : null}

        {/* The strategy sits outside the library grid below: it plans the
            patient, not a single day, so the food library would only be noise
            next to it. */}
        <TabsContent value="strategy" className="mt-2">
          <PlanStrategyView
            patient={visiblePatient}
            patientAllergens={visiblePatientAllergens}
            energyContext={energyContext}
            dietLine={dietLine}
            dayTotals={dayTotals}
            dayLabel={formattedDate}
            onOpenDay={() => changeView("day")}
            onSavePatient={handleSaveStrategy}
          />
        </TabsContent>

        <TabsContent value="analysis" className="mt-2">
          <PlanDayAnalysis
            plan={currentPlan}
            foods={foods}
            foodMap={foodMap}
            recipeMap={recipeMap}
            dietLine={dietLine}
            refConfig={refConfig}
            referenceValues={microReferenceValues}
            patientEnergyTarget={strategyKcalTarget}
            hydration={analysisHydration}
            onBack={() => {
              setWeekOffset(0)
              changeView("week", currentDate)
            }}
            onEdit={() => changeView("day", currentDate)}
          />
        </TabsContent>

        {/* The library is the shared build source for the day and week views:
            the same items can be dragged (or click-added) into either view.
            Hidden rather than unmounted on the strategy tab so its search and
            scroll position survive a look at the targets. */}
        <div
          className={cn(
            "mt-2 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]",
            (view === "strategy" || view === "analysis" || view === extraTab?.value) && "hidden",
          )}
        >
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={mobileLibraryOpen} onOpenChange={setMobileLibraryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Library className="mr-1.5 h-4 w-4" />
                  Bibliothek
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[82dvh] gap-0 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Bibliothek</SheetTitle>
                  <SheetDescription>
                    Rezepte, Lebensmittel und Vorlagen für den aktiven Planungstag.
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto pt-2">
                  <MealPlanLibrary
                    className="min-h-full rounded-none border-0 shadow-none"
                    foods={foodCommandSource}
                    fullFoods={foods}
                    recipes={recipes}
                    templates={mealPlanTemplates}
                    patientId={patientId}
                    categoryLabels={foodCategoryLabels}
                    isLocked={currentPlan.status === "approved"}
                    onQuickAdd={(payload, slotType) => {
                      void handleDropPayload(slotType, payload)
                      setMobileLibraryOpen(false)
                    }}
                    onApplyTemplate={(template) => {
                      handleApplyTemplate(template)
                      setMobileLibraryOpen(false)
                    }}
                    onImportPlanFile={() => {
                      setMobileLibraryOpen(false)
                      setPlanDataExchangeOpen(true)
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
            {view === "day" ? (
              <PlanBalanceRail
                layout="mobile"
                compliance={dietLineMacros}
                dietLineName={dietLinesLoading ? "Zielprofile laden …" : dietLine?.name}
                dietLines={dietLines}
                dietLineId={dietLineId}
                onDietLineChange={handleDietLineChange}
                dietLineDisabled={currentPlan.status === "approved"}
                onManageDietLine={() => setDietLineDialogOpen(true)}
              />
            ) : null}
          </div>

          {/* Col 1: the shared library on the left. At xl it fills the planner
              column's height (absolute inside a relative track cell) so it ends
              level with the meal plan and scrolls internally rather than running
              past it. Shared build source for day and week views. */}
          <div className="relative hidden min-w-0 md:block">
            <MealPlanLibrary
              className="min-h-0 xl:absolute xl:inset-0"
              foods={foodCommandSource}
              fullFoods={foods}
              recipes={recipes}
              templates={mealPlanTemplates}
              patientId={patientId}
              categoryLabels={foodCategoryLabels}
              isLocked={currentPlan.status === "approved"}
              onQuickAdd={(payload, slotType) => void handleDropPayload(slotType, payload)}
              onApplyTemplate={handleApplyTemplate}
              onImportPlanFile={() => setPlanDataExchangeOpen(true)}
            />
          </div>

          {/* Col 2: the planner. */}
          <div className="min-w-0">

        <TabsContent value="day" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b py-2">
            {embedded ? (
              <Button
                variant="ghost"
                size="sm"
                className="mr-1"
                onClick={() => {
                  setWeekOffset(0)
                  changeView("week")
                }}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Zur Wochenansicht
              </Button>
            ) : null}
            {/* The week's days are the day picker: one click per day, with each
                day's kcal on the chip so the week reads at a glance. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {dayWeekPlans.map((dayPlan) => {
                const isActive = dayPlan.date === currentDate
                const isPast = dayPlan.date < today
                const kcal = weekDayKcal.get(dayPlan.date) ?? 0
                return (
                  <button
                    key={dayPlan.date}
                    type="button"
                    onClick={() => selectDate(dayPlan.date)}
                    className={cn(
                      "flex min-w-[52px] flex-col items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors",
                      isPast
                        ? isActive
                          ? "border-foreground/15 bg-foreground/[0.09] text-foreground"
                          : "border-foreground/[0.06] bg-foreground/[0.05] text-muted-foreground/60 hover:bg-foreground/[0.08] hover:text-muted-foreground"
                        : isActive
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "bg-card hover:bg-accent",
                    )}
                  >
                    {format(parseISO(dayPlan.date), "EEEEEE", { locale: de })}
                    <span
                      className={cn(
                        "mt-0.5 font-mono text-[10px] font-normal",
                        kcal > 0 ? "text-muted-foreground" : "text-muted-foreground/50",
                      )}
                    >
                      {kcal > 0 ? formatNumber(Math.round(kcal)) : "–"}
                    </span>
                  </button>
                )
              })}
            </div>
            <span className="text-muted-foreground text-xs capitalize">{formattedDate}</span>
            {currentDate < today ? (
              <Badge
                variant="outline"
                className="border-foreground/10 bg-foreground/[0.06] text-muted-foreground gap-1.5 rounded-full px-2 py-1 text-[10px]"
              >
                <History className="h-3 w-3" />
                Vergangener Tag
              </Badge>
            ) : null}

            {strategyKcalTarget && !embedded ? (
              <button
                type="button"
                onClick={() => changeView("strategy")}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
              >
                Strategie: Ziel {formatNumber(strategyKcalTarget)} kcal · Tag {formatNumber(Math.round(dayTotals.energie ?? 0))} kcal
              </button>
            ) : null}

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
                disabled={currentPlan.status === "approved"}
                onClick={() => copyPlanToNextDay(currentDate)}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Tag duplizieren
              </Button>
              {exportMenu}
            </div>
          </div>
          {planAllergenSummary.totalConflicts > 0 && (
            <PlanAllergenBanner summary={planAllergenSummary} />
          )}

          <PlanDayWorkspace
            plan={currentPlan}
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
            onPrevWeek={() => {
              setWeekOffset((prev) => prev - 1)
              setSelectedWeekDates([])
            }}
            onNextWeek={() => {
              setWeekOffset((prev) => prev + 1)
              setSelectedWeekDates([])
            }}
            headerActions={weekHeaderActions}
            foods={foods}
            foodMap={foodMap}
            recipeMap={recipeMap}
            activeDate={currentDate}
            energyTarget={energyTargetValue ?? strategyKcalTarget}
            dietLine={dietLine}
            refConfig={refConfig}
            nutrientTargets={micronutrientCompliance}
            onSelectDay={selectDate}
            selectedDates={selectedWeekDates}
            onOpenDay={(date) => {
              setDate(date)
              setWeekOffset(0)
              changeView("day", date)
            }}
            onAnalyzeDay={(date) => {
              setDate(date)
              setWeekOffset(0)
              changeView("analysis", date)
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

          {/* Optimizers and the gap filler deliberately operate on the active
              day. The week gets its own aggregate balance above, so no tool
              silently analyses the wrong scope. */}
          {view === "day" ? <div className="space-y-4 xl:col-span-2">
            <div className="flex items-center gap-3">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Tools
              </h2>
              <div className="bg-border h-px flex-1" />
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              <PlanFillSuggestions
                suggestions={optimizationSuggestions}
                state={planFillState}
                onApplySuggestion={applyOptimizationSuggestion}
                isLocked={currentPlan.status === "approved"}
              />
              <PlanExchangeTool />
              <PlanNutrientGapTool
                dietLineCompliance={dietLineCompliance}
                micronutrientCompliance={micronutrientCompliance}
                patientAllergens={patientAllergens}
                plan={currentPlan}
                recipes={recipes}
                foods={foods}
                isLocked={currentPlan.status === "approved"}
                onAdd={handleAddGapSuggestion}
              />
              <PlanAdditiveSummary plan={currentPlan} foodMap={foodMap} recipeMap={recipeMap} />
            </div>
          </div>
          : null}

          {/* The daily dock stays a compact macro comparison. Week-level
              micronutrients live in the non-sticky Wochenbilanz instead. */}
          {/* Pull the dock flush to the scroll bottom: cancel the trailing space
              below it (page padding + tab wrapper gap) so it no longer lifts off
              the bottom edge when scrolled all the way down. */}
          {view === "day" ? <div className="sticky bottom-0 z-40 -mb-12 hidden md:block xl:col-span-2">
            <PlanBalanceRail
              compliance={dietLineMacros}
              dietLineName={dietLinesLoading ? "Zielprofile laden …" : dietLine?.name}
              dietLines={dietLines}
              dietLineId={dietLineId}
              onDietLineChange={handleDietLineChange}
              dietLineDisabled={currentPlan.status === "approved"}
              onManageDietLine={() => setDietLineDialogOpen(true)}
            />
          </div>
          : null}
        </div>
      </Tabs>
        </>
      )}

      <PlanExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        plans={exportWeekPlans}
        defaultSelectedDates={exportDefaultDates}
        recipes={recipes}
        foods={foods}
        refConfig={refConfig}
        patient={visiblePatient}
        patientAllergens={visiblePatientAllergens}
        patientIndications={getPatientIndications(visiblePatient)}
        dietLineName={dietLine?.name}
        planId={currentPlan.id}
      />

      {embedded && patientId && weekCopyOpen ? (
        <PlanWeekCopyDialog
          open={weekCopyOpen}
          onOpenChange={setWeekCopyOpen}
          sourceWeekStart={computedWeekStartIso}
          sourceWeekLabel={weekRangeLabel}
          isCopying={isCopyingWeek}
          onCopy={(targetWeekStart, repetitions, strategy) => void handleCopyWeek(targetWeekStart, repetitions, strategy)}
        />
      ) : null}

      {embedded && weekTemplateDialogOpen ? (
        <PlanWeekTemplateDialog
          open={weekTemplateDialogOpen}
          onOpenChange={setWeekTemplateDialogOpen}
          dates={selectedWeekPlans.map((plan) => plan.date)}
          dietLines={dietLines}
          initialDietLineId={selectedWeekPlans[0]?.dietLineId}
          patient={patientId && patient ? { id: patientId, name: `${patient.firstName} ${patient.lastName}` } : undefined}
          isSaving={isSavingWeekTemplate}
          onSave={(name) => void handleSaveWeekTemplate(name)}
        />
      ) : null}

      {pendingMultiDayTemplate ? (
        <PlanMultiDayTemplateApplyDialog
          open={Boolean(pendingMultiDayTemplate)}
          onOpenChange={(open) => {
            if (!open) setPendingMultiDayTemplate(null)
          }}
          template={pendingMultiDayTemplate.template}
          startDate={pendingMultiDayTemplate.startDate}
          onStartDateChange={(startDate) => {
            if (!startDate) return
            setPendingMultiDayTemplate((pending) => pending ? { ...pending, startDate } : null)
          }}
          targets={getTemplateApplyTargets(
            pendingMultiDayTemplate.template,
            pendingMultiDayTemplate.startDate,
          )}
          getEntryLabel={(entry) => getEntryLabel(entry, foodMap, recipeMap)}
          isApplying={isApplyingMultiDayTemplate}
          onConfirm={confirmMultiDayTemplateApply}
        />
      ) : null}

      {embedded && patientId ? (
        <PlanWeekReleaseDialog
          open={weekReleaseReviewOpen}
          onOpenChange={setWeekReleaseReviewOpen}
          patientName={visiblePatient ? `${visiblePatient.firstName} ${visiblePatient.lastName}` : "Patient"}
          weekRangeLabel={weekRangeLabel}
          review={weekReleaseReview}
          isReleasing={isReleasingWeek}
          onRelease={() => void handleReleaseWeek()}
        />
      ) : null}

      <PlanDataExchangeDialog
        open={planDataExchangeOpen}
        onOpenChange={setPlanDataExchangeOpen}
        onApply={(slots, importedPlan) => {
          applyTemplateToDate(currentDate, slots, {
            title: importedPlan.title ?? currentPlan.title,
            notes: importedPlan.notes ?? currentPlan.notes,
            targetProfileId: importedPlan.targetProfileId ?? currentPlan.targetProfileId,
            dietLineId: importedPlan.dietLineId ?? currentPlan.dietLineId,
          })
        }}
      />

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
