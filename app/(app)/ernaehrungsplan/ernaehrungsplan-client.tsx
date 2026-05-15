"use client"

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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ClipboardCheck,
  ChefHat,
  Copy,
  Download,
  FileText,
  FolderOpen,
  History,
  LayoutTemplate,
  Leaf,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
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
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Toggle } from "@/components/ui/toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMealPlan } from "@/hooks/use-meal-plan"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import {
  scaleNutrients,
  sumNutrients,
  getNutrientValue,
  calculateRecipeNutrients,
  calculatePerServing,
  getBroteinheiten,
} from "@/lib/nutrients"
import { buildEinzelanalyseTable } from "@/lib/einzelanalyse"
import { EinzelanalyseTableView } from "@/components/einzelanalyse-table"
import { PlanAdditiveSummary } from "@/components/plan-additive-summary"
import { useAnthropometric } from "@/hooks/use-anthropometric"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { formatNumber, formatNutrient } from "@/lib/format"
import { MEAL_SLOT_LABELS, MEAL_SLOT_TARGET_FRACTIONS } from "@/lib/constants"
import type {
  MealSlotType,
  MealEntry,
  NutrientValue,
  DailyMealPlan,
  Food,
  MealPlanTemplate,
  MealPlanVersion,
  Patient,
  Recipe,
  DietLinePreset,
} from "@/lib/types"
import { calculateInariScore } from "@/lib/inari-score"
import { evaluatePlanSustainability } from "@/lib/sustainability"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import { useFoods, useFoodSearch } from "@/components/foods-provider"
import { createRecipeLookup } from "@/lib/recipes"
import { useNutrientValues, useNutrientValueMaps } from "@/hooks/use-nutrient-values"
import type { FoodSearchItem } from "@/lib/types"
import { usePatientAllergens } from "@/hooks/use-patient-allergens"
import {
  checkAllergenConflicts,
  summarizePlanAllergenConflicts,
  type AllergenWarning,
} from "@/lib/allergen-warnings"
import {
  ALLERGEN_SEVERITY_LABELS,
  ALLERGEN_TYPE_LABELS,
} from "@/lib/allergen-constants"
import { PlanAllergenBanner } from "@/components/plan-allergen-banner"
import { toast } from "sonner"
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

const EXCHANGE_DELTA_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
] as const

const PLAN_STATUS_LABELS: Record<NonNullable<DailyMealPlan["status"]>, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  approved: "Freigegeben",
  archived: "Archiviert",
}

const UNASSIGNED_PATIENT_VALUE = "__unassigned__"

type DietLineTargetDraft = DietLinePreset["targets"][number]
type PlanReviewSeverity = "critical" | "warning" | "ok"

interface PlanReviewItem {
  id: string
  label: string
  description: string
  severity: PlanReviewSeverity
}

interface PendingAllergenIntent {
  itemKind: "food" | "recipe"
  itemName: string
  slotType: MealSlotType
  payload: { type: MealEntry["type"]; referenceId: string; amount: number }
  warnings: AllergenWarning[]
  replaceEntryId?: string
  followUp?: () => void
}

interface OptimizationSuggestion {
  id: string
  type: "food" | "recipe"
  referenceId: string
  name: string
  slotType: MealSlotType
  amount: number
  nutrientId: string
  targetLabel: string
  unit: string
  deficit: number
  contribution: number
  allergens?: string[]
}

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

function createTargetDraft(nutrientId = "energie"): DietLineTargetDraft {
  const definition = NUTRIENT_DEFINITIONS.find((item) => item.id === nutrientId)
  return {
    nutrientId,
    label: definition?.shortName ?? definition?.name ?? nutrientId,
    unit: definition?.unit ?? "",
    min: undefined,
    max: undefined,
  }
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function calculateEntryNutrients(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  foods: Food[],
  recipeMap: Map<string, Recipe>,
): NutrientValue[] {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId)
    if (!food) return []
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
  }

  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return []
  const totalNutrients = calculateRecipeNutrients(recipe, foods)
  const perServing = calculatePerServing(totalNutrients, recipe.servings)
  return scaleNutrients(perServing, 1, entry.amount)
}

function getEntryLabel(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId)
    if (!food) return "Lebensmittel"
    return `${food.name} (${formatNumber(entry.amount, 0)} g)`
  }
  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return "Rezept"
  const portions = entry.amount === 1 ? "Portion" : "Portionen"
  return `${recipe.name} (${formatNumber(entry.amount, 0)} ${portions})`
}

function complianceBadge(value: number, min?: number, max?: number): "ok" | "low" | "high" {
  if (typeof min === "number" && value < min) return "low"
  if (typeof max === "number" && value > max) return "high"
  return "ok"
}

function chooseOptimizationSlot(nutrientId: string, plan: DailyMealPlan): MealSlotType {
  const openCoreSlot = plan.slots.find(
    (slot) =>
      ["mittagessen", "abendessen", "fruehstueck"].includes(slot.type) &&
      slot.entries.length === 0,
  )?.type

  if (openCoreSlot) return openCoreSlot
  if (["energie", "eiweiss", "fett", "kohlenhydrate"].includes(nutrientId)) return "mittagessen"
  if (["ballaststoffe", "vitamin_c", "calcium", "magnesium"].includes(nutrientId)) return "snack_nachmittag"
  return "abendessen"
}

interface ErnaehrungsplanPageClientProps {
  recipes: Recipe[]
  initialPlans: DailyMealPlan[]
  initialTemplates?: MealPlanTemplate[]
  patientId?: string
  initialDate?: string
  /**
   * Template id passed via `?template=…` (used by the Plan-Bibliothek to
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
    removeEntry,
    updateEntryAmount,
    replaceEntry,
    moveEntry,
    copyPlanToDate,
    clearPlanForDate,
    updatePlanMetadata,
    applyTemplateToDate,
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

  // Plan-Bibliothek deep-link handler. Applies a system template once when the
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
  const [foodCommandQuery, setFoodCommandQuery] = useState("")
  const [activeSlot, setActiveSlot] = useState<MealSlotType>("fruehstueck")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [view, setView] = useState("day")
  const [paletteSlot, setPaletteSlot] = useState<MealSlotType>("mittagessen")
  const [recipeSearch, setRecipeSearch] = useState("")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteCategory, setPaletteCategory] = useState<string>("alle")
  const [paletteSort, setPaletteSort] = useState<"name" | "kcalAsc" | "kcalDesc" | "prep">("name")
  const [paletteIndicationOnly, setPaletteIndicationOnly] = useState(false)
  const [paletteAllergenSafeOnly, setPaletteAllergenSafeOnly] = useState(false)
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false)
  const [exchangeSlot, setExchangeSlot] = useState<MealSlotType | null>(null)
  const [exchangeEntryId, setExchangeEntryId] = useState<string | null>(null)
  const [exchangeSearch, setExchangeSearch] = useState("")
  const [exchangeCategory, setExchangeCategory] = useState<string>("alle")
  const [exchangeNutrient, setExchangeNutrient] = useState("energie")
  const [dietLineDialogOpen, setDietLineDialogOpen] = useState(false)
  const [dietLineDraftName, setDietLineDraftName] = useState("")
  const [dietLineDraftDescription, setDietLineDraftDescription] = useState("")
  const [dietLineDraftTargets, setDietLineDraftTargets] = useState<DietLineTargetDraft[]>([])
  const [isSavingDietLine, setIsSavingDietLine] = useState(false)
  const [exportingVariant, setExportingVariant] = useState<MealPlanReportVariant | null>(null)
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false)
  const [applyTemplateSearch, setApplyTemplateSearch] = useState("")
  const [applyTemplateScope, setApplyTemplateScope] = useState<"alle" | "indikation" | "kostform">("alle")
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [templateDraftName, setTemplateDraftName] = useState("")
  const [templateDraftDescription, setTemplateDraftDescription] = useState("")
  const [templateDraftIndication, setTemplateDraftIndication] = useState("")
  const [templateDraftDietLineId, setTemplateDraftDietLineId] = useState<string>("")
  const [isCheckpointing, setIsCheckpointing] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [pendingAllergenIntent, setPendingAllergenIntent] = useState<PendingAllergenIntent | null>(null)
  const [pendingPatientAssignmentId, setPendingPatientAssignmentId] = useState<string | null>(null)
  const [planAkteOpen, setPlanAkteOpen] = useState(false)
  // Default Einzelanalyse columns mirror the macros surfaced in the daily-total
  // card (Energie/Eiweiß/Fett/KH/BE) plus Ballaststoffe — the same nutrients
  // clinicians scan when reviewing whether a single food carries the plan.
  const [einzelNutrientIds, setEinzelNutrientIds] = useState<string[]>([
    "energie",
    "eiweiss",
    "fett",
    "kohlenhydrate",
    "broteinheiten",
    "ballaststoffe",
  ])
  const [einzelPerKgEnabled, setEinzelPerKgEnabled] = useState(false)
  const [einzelPickerOpen, setEinzelPickerOpen] = useState(false)
  const {
    values: exchangeNutrientValues,
    isLoading: exchangeNutrientLoading,
    error: exchangeNutrientError,
  } = useNutrientValues(exchangeNutrient, hydratedFoods, {
    forceRemote: foodSearchIndex.length > hydratedFoods.length,
  })
  const exchangeDeltaNutrientIds = useMemo(() => {
    const ids = new Set<string>(EXCHANGE_DELTA_NUTRIENT_IDS)
    if (exchangeNutrient) ids.add(exchangeNutrient)
    return Array.from(ids)
  }, [exchangeNutrient])
  const { valuesByNutrient: exchangeDeltaValues } = useNutrientValueMaps(exchangeDeltaNutrientIds)
  const [weekOffset, setWeekOffset] = useState(0)
  const [cycleOffset, setCycleOffset] = useState(0)

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
    if (commandOpen) {
      void loadFoodSearchIndex()
    }
  }, [commandOpen, loadFoodSearchIndex])

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

  const planAllergenSummary = useMemo(
    () => summarizePlanAllergenConflicts(currentPlan, patientAllergens, foodMap, recipeMap),
    [currentPlan, foodMap, recipeMap, patientAllergens],
  )

  const entryAllergenWarnings = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [entryId, warnings] of planAllergenSummary.byEntry) {
      map.set(entryId, warnings.map((warning) => warning.allergenLabel))
    }
    return map
  }, [planAllergenSummary])

  const aggregatePlanNutrients = useCallback(
    (plan: DailyMealPlan): NutrientValue[] =>
      sumNutrients(
        plan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      ),
    [foodMap, foods, recipeMap],
  )

  const notifyAllergenWarnings = useCallback(
    (itemName: string, warnings: AllergenWarning[]) => {
      for (const warning of warnings) {
        const headline =
          warning.severity === "moderate"
            ? `Mittlerer Allergenkonflikt: ${itemName}`
            : `Allergenhinweis: ${itemName}`
        toast.warning(headline, {
          description: `${warning.allergenLabel} · ${ALLERGEN_TYPE_LABELS[warning.type]} · ${ALLERGEN_SEVERITY_LABELS[warning.severity]}`,
        })
      }
    },
    [],
  )

  const commitAllergenIntent = useCallback(
    (intent: PendingAllergenIntent) => {
      if (intent.replaceEntryId) {
        replaceEntry(intent.slotType, intent.replaceEntryId, intent.payload)
      } else {
        addEntry(intent.slotType, intent.payload)
      }
      intent.followUp?.()
    },
    [addEntry, replaceEntry],
  )

  const guardedAddEntry = useCallback(
    (
      slotType: MealSlotType,
      payload: { type: MealEntry["type"]; referenceId: string; amount: number },
      context: {
        itemKind: "food" | "recipe"
        itemName: string
        allergens: string[] | undefined
        replaceEntryId?: string
        followUp?: () => void
      },
    ) => {
      const warnings =
        patientAllergens.length > 0 && context.allergens?.length
          ? checkAllergenConflicts(context.allergens, patientAllergens)
          : []
      const hasSevere = warnings.some((warning) => warning.severity === "severe")

      if (hasSevere) {
        setPendingAllergenIntent({
          itemKind: context.itemKind,
          itemName: context.itemName,
          slotType,
          payload,
          warnings,
          replaceEntryId: context.replaceEntryId,
          followUp: context.followUp,
        })
        return
      }

      commitAllergenIntent({
        itemKind: context.itemKind,
        itemName: context.itemName,
        slotType,
        payload,
        warnings,
        replaceEntryId: context.replaceEntryId,
        followUp: context.followUp,
      })

      if (warnings.length > 0) {
        notifyAllergenWarnings(context.itemName, warnings)
      }
    },
    [commitAllergenIntent, notifyAllergenWarnings, patientAllergens],
  )

  const confirmPendingAllergenIntent = useCallback(() => {
    if (!pendingAllergenIntent) return
    commitAllergenIntent(pendingAllergenIntent)
    notifyAllergenWarnings(pendingAllergenIntent.itemName, pendingAllergenIntent.warnings)
    toast.warning(
      `${pendingAllergenIntent.itemName} wurde trotz schwerer Allergenwarnung übernommen.`,
    )
    setPendingAllergenIntent(null)
  }, [commitAllergenIntent, notifyAllergenWarnings, pendingAllergenIntent])

  const dismissPendingAllergenIntent = useCallback(() => {
    setPendingAllergenIntent(null)
  }, [])

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
    setFoodCommandQuery("")
    guardedAddEntry(
      activeSlot,
      { type: "food", referenceId: food.id, amount: 100 },
      { itemKind: "food", itemName: food.name, allergens: food.allergens },
    )
  }

  const handleSelectRecipe = (recipeId: string) => {
    const recipe = recipeMap.get(recipeId)
    setCommandOpen(false)
    setFoodCommandQuery("")
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

  const handleQuickAddRecipe = (recipeId: string) => {
    const recipe = recipeMap.get(recipeId)
    guardedAddEntry(
      paletteSlot,
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

  const dailyNutrients = useMemo(() => {
    const allEntryNutrients: NutrientValue[][] = []
    for (const slot of currentPlan.slots) {
      for (const entry of slot.entries) {
        allEntryNutrients.push(calculateEntryNutrients(entry, foodMap, foods, recipeMap))
      }
    }
    return sumNutrients(allEntryNutrients)
  }, [currentPlan, foodMap, foods, recipeMap])

  const totalKcal = getNutrientValue(dailyNutrients, "energie")
  const totalProtein = getNutrientValue(dailyNutrients, "eiweiss")
  const totalFat = getNutrientValue(dailyNutrients, "fett")
  const totalCarbs = getNutrientValue(dailyNutrients, "kohlenhydrate")
  const totalBE = getBroteinheiten(totalCarbs)

  const einzelanalyseTable = useMemo(
    () =>
      buildEinzelanalyseTable(
        currentPlan,
        foodMap,
        recipeMap,
        foods,
        einzelNutrientIds,
        {
          perKgBodyWeight:
            einzelPerKgEnabled && typeof latestPatientWeightKg === "number"
              ? latestPatientWeightKg
              : undefined,
        },
      ),
    [
      currentPlan,
      foodMap,
      recipeMap,
      foods,
      einzelNutrientIds,
      einzelPerKgEnabled,
      latestPatientWeightKg,
    ],
  )
  const planInariScore = useMemo(() => calculateInariScore(dailyNutrients), [dailyNutrients])
  const positivePlanDrivers = useMemo(
    () =>
      planInariScore.drivers
        .filter((driver) => driver.impact > 0)
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 2),
    [planInariScore],
  )
  const negativePlanDrivers = useMemo(
    () =>
      planInariScore.drivers
        .filter((driver) => driver.impact < 0)
        .sort((a, b) => a.impact - b.impact)
        .slice(0, 2),
    [planInariScore],
  )
  const planSustainability = useMemo(
    () => evaluatePlanSustainability(currentPlan, foods, recipes),
    [currentPlan, foods, recipes],
  )

  const { getResolvedConfig } = useReferenceProfiles()
  const refConfig = useMemo(() => {
    return getResolvedConfig({
      patientId,
      dateOfBirth: patient?.dateOfBirth ?? "1990-01-01",
      gender: patient?.gender ?? "w",
    })
  }, [getResolvedConfig, patient?.dateOfBirth, patient?.gender, patientId])

  const referenceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of refConfig.values) {
      map.set(v.nutrientId, v.amount)
    }
    return map
  }, [refConfig.values])

  const nutrientDefMap = useMemo(() => {
    return new Map(NUTRIENT_DEFINITIONS.map((nd) => [nd.id, nd]))
  }, [])

  const slotCompliance = useMemo(() => {
    const map = {} as Record<MealSlotType, { label: string; status: "ok" | "low" | "high" }[]>
    if (!dietLine) return map

    // Per-slot evaluation only fires for macronutrient targets. Vitamin /
    // mineral targets are daily-aggregate by clinical convention and would
    // produce noise when scaled to a single meal.
    const macroTargets = dietLine.targets.filter((target) => {
      const definition = nutrientDefMap.get(target.nutrientId)
      return definition?.group === "makronaehrstoffe"
    })

    if (macroTargets.length === 0) return map

    for (const slot of currentPlan.slots) {
      if (slot.entries.length === 0) {
        map[slot.type] = []
        continue
      }

      const fraction = MEAL_SLOT_TARGET_FRACTIONS[slot.type] ?? 1 / (currentPlan.slots.length || 1)
      const summed = sumNutrients(
        slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
      )

      map[slot.type] = macroTargets.map((target) => {
        const value =
          target.nutrientId === "broteinheiten"
            ? getBroteinheiten(getNutrientValue(summed, "kohlenhydrate"))
            : getNutrientValue(summed, target.nutrientId)
        const perSlotMin = typeof target.min === "number" ? target.min * fraction : undefined
        const perSlotMax = typeof target.max === "number" ? target.max * fraction : undefined
        return {
          label: target.label,
          status: complianceBadge(value, perSlotMin, perSlotMax),
        }
      })
    }

    return map
  }, [currentPlan.slots, dietLine, foodMap, foods, nutrientDefMap, recipeMap])

  const recipeCategories = useMemo(() => {
    const set = new Set<string>()
    for (const recipe of recipes) {
      if (recipe.category) set.add(recipe.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"))
  }, [recipes])

  const paletteRecipes = useMemo(() => {
    const search = recipeSearch.trim().toLowerCase()
    const indicationTokens = patientIndications
      .map((indication) => indication.trim().toLowerCase())
      .filter(Boolean)

    type EnrichedRecipe = {
      recipe: Recipe
      kcal: number
      totalTime: number
      conflictCount: number
    }

    const enriched: EnrichedRecipe[] = recipes
      .map((recipe) => {
        const kcal =
          recipe.cachedKcalPerPortion ??
          (() => {
            const total = calculateRecipeNutrients(recipe, foods)
            const perServing = calculatePerServing(total, recipe.servings)
            return getNutrientValue(perServing, "energie")
          })()
        const conflictCount =
          patientAllergens.length > 0 && recipe.allergens?.length
            ? checkAllergenConflicts(recipe.allergens, patientAllergens).length
            : 0
        return {
          recipe,
          kcal,
          totalTime: (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0),
          conflictCount,
        }
      })
      .filter(({ recipe, conflictCount }) => {
        if (search) {
          const matchesSearch =
            recipe.name.toLowerCase().includes(search) ||
            recipe.tags?.some((tag) => tag.toLowerCase().includes(search))
          if (!matchesSearch) return false
        }
        if (paletteCategory !== "alle" && recipe.category !== paletteCategory) return false
        if (paletteIndicationOnly && indicationTokens.length > 0) {
          const description = recipe.description?.toLowerCase() ?? ""
          const matches = indicationTokens.some((token) =>
            recipe.tags?.some((tag) => tag.toLowerCase().includes(token)) ||
            description.includes(token),
          )
          if (!matches) return false
        }
        if (paletteAllergenSafeOnly && conflictCount > 0) return false
        return true
      })

    enriched.sort((a, b) => {
      switch (paletteSort) {
        case "kcalAsc":
          return a.kcal - b.kcal
        case "kcalDesc":
          return b.kcal - a.kcal
        case "prep":
          return a.totalTime - b.totalTime
        case "name":
        default:
          return a.recipe.name.localeCompare(b.recipe.name, "de")
      }
    })

    return enriched
  }, [
    recipes,
    foods,
    recipeSearch,
    paletteCategory,
    paletteSort,
    paletteIndicationOnly,
    paletteAllergenSafeOnly,
    patientIndications,
    patientAllergens,
  ])


  const foodCommandSource: FoodSearchItem[] = foodSearchIndex.length > 0 ? foodSearchIndex : foods
  const filteredCommandFoods = useMemo(() => {
    const query = foodCommandQuery.trim().toLowerCase()
    return foodCommandSource
      .filter((food) => !query || food.name.toLowerCase().includes(query))
      .slice(0, 80)
  }, [foodCommandQuery, foodCommandSource])

  const filteredCommandRecipes = useMemo(() => {
    const query = foodCommandQuery.trim().toLowerCase()
    return recipes
      .filter((recipe) => !query || recipe.name.toLowerCase().includes(query))
      .slice(0, 40)
  }, [foodCommandQuery, recipes])

  // Use the lightweight search index for the exchange dialog (instead of all 7,140 full Food objects)
  const exchangeSource: FoodSearchItem[] = foodSearchIndex.length > 0 ? foodSearchIndex : foods
  const filteredExchangeFoods = useMemo(() => {
    const query = exchangeSearch.toLowerCase()
    return exchangeSource
      .filter((food) => {
        const matchesSearch = !query || food.name.toLowerCase().includes(query)
        const matchesCategory = exchangeCategory === "alle" || food.categoryId === exchangeCategory
        return matchesSearch && matchesCategory
      })
      .sort((a, b) =>
        (exchangeNutrientValues.get(b.id) ?? 0) - (exchangeNutrientValues.get(a.id) ?? 0),
      )
  }, [exchangeCategory, exchangeNutrientValues, exchangeSearch, exchangeSource])

  const exchangeOriginal = useMemo(() => {
    if (!exchangeEntryId || !exchangeSlot) return null
    const slot = currentPlan.slots.find((item) => item.type === exchangeSlot)
    const entry = slot?.entries.find((item) => item.id === exchangeEntryId)
    if (!entry) return null

    if (entry.type === "food") {
      const food = foodMap.get(entry.referenceId)
      if (!food) return null
      const scaled = scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
      const nutrients = new Map<string, number>()
      for (const id of exchangeDeltaNutrientIds) {
        nutrients.set(id, getNutrientValue(scaled, id))
      }
      return {
        kind: "food" as const,
        entry,
        name: food.name,
        amount: entry.amount,
        unitLabel: "g",
        nutrients,
      }
    }

    const recipe = recipeMap.get(entry.referenceId)
    if (!recipe) return null
    const totalNutrients = calculateRecipeNutrients(recipe, foods)
    const perServing = calculatePerServing(totalNutrients, recipe.servings)
    const scaled = scaleNutrients(perServing, 1, entry.amount)
    const nutrients = new Map<string, number>()
    for (const id of exchangeDeltaNutrientIds) {
      nutrients.set(id, getNutrientValue(scaled, id))
    }
    return {
      kind: "recipe" as const,
      entry,
      name: recipe.name,
      amount: entry.amount,
      unitLabel: entry.amount === 1 ? "Portion" : "Portionen",
      nutrients,
    }
  }, [
    currentPlan,
    exchangeEntryId,
    exchangeSlot,
    foodMap,
    recipeMap,
    foods,
    exchangeDeltaNutrientIds,
  ])

  const exchangeCompareAmount =
    exchangeOriginal?.kind === "food" ? exchangeOriginal.amount : 100
  const exchangeShowDelta = exchangeOriginal?.kind === "food"

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

  const updateCurrentPlanStatus = async (status: NonNullable<DailyMealPlan["status"]>) => {
    if (status === "approved" && clinicalReview.blockingItems.length > 0) {
      toast.error("Freigabe blockiert: Bitte kritische Prüfpunkte klären.")
      return
    }

    if (status === "approved") {
      const version = await approvePlan(currentDate, {
        approvedAt: currentPlan.approvedAt ?? new Date().toISOString(),
        approvedBy: currentPlan.approvedBy,
      })
      if (version) {
        recordMealPlanVersion(version)
      }
      toast.success(`Planstatus: ${PLAN_STATUS_LABELS[status]}`)
      return
    }

    updatePlanMetadata(currentDate, {
      status,
      approvedAt: undefined,
      approvedBy: undefined,
    })
    toast.success(`Planstatus: ${PLAN_STATUS_LABELS[status]}`)
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

  const openDietLineEditor = () => {
    const baseTargets = dietLine?.targets.length
      ? dietLine.targets.map((target) => ({ ...target }))
      : [createTargetDraft("energie"), createTargetDraft("eiweiss"), createTargetDraft("kohlenhydrate")]

    setDietLineDraftName(
      dietLine ? (isCurrentDietLineEditable ? dietLine.name : `${dietLine.name} Kopie`) : "",
    )
    setDietLineDraftDescription(dietLine?.description ?? "")
    setDietLineDraftTargets(baseTargets)
    setDietLineDialogOpen(true)
  }

  const updateDietLineDraftTarget = (index: number, patch: Partial<DietLineTargetDraft>) => {
    setDietLineDraftTargets((prev) =>
      prev.map((target, targetIndex) => {
        if (targetIndex !== index) return target
        const next = { ...target, ...patch }
        if (patch.nutrientId) {
          const definition = NUTRIENT_DEFINITIONS.find((item) => item.id === patch.nutrientId)
          next.label = definition?.shortName ?? definition?.name ?? patch.nutrientId
          next.unit = definition?.unit ?? ""
        }
        return next
      }),
    )
  }

  const addDietLineDraftTarget = () => {
    const firstUnused = NUTRIENT_DEFINITIONS.find(
      (definition) => !dietLineDraftTargets.some((target) => target.nutrientId === definition.id),
    )
    setDietLineDraftTargets((prev) => [...prev, createTargetDraft(firstUnused?.id ?? "energie")])
  }

  const removeDietLineDraftTarget = (index: number) => {
    setDietLineDraftTargets((prev) => prev.filter((_, targetIndex) => targetIndex !== index))
  }

  const saveDietLineDraft = async () => {
    const name = dietLineDraftName.trim()
    const description = dietLineDraftDescription.trim()
    const targets = dietLineDraftTargets
      .map((target) => ({
        ...target,
        label:
          target.label.trim() ||
          (NUTRIENT_DEFINITIONS.find((item) => item.id === target.nutrientId)?.shortName ?? target.nutrientId),
      }))
      .filter((target) => target.nutrientId && (target.min != null || target.max != null))

    if (!name) {
      toast.error("Bitte einen Namen für das Zielprofil eingeben.")
      return
    }
    if (targets.length === 0) {
      toast.error("Bitte mindestens einen Zielwert mit Unter- oder Obergrenze pflegen.")
      return
    }

    setIsSavingDietLine(true)
    try {
      const savedPreset = await saveDietLinePreset({
        id: isCurrentDietLineEditable ? dietLine?.id : undefined,
        name,
        description,
        targets,
      })
      updatePlanMetadata(currentDate, { dietLineId: savedPreset.id })
      setDietLineDialogOpen(false)
      toast.success("Zielprofil gespeichert.")
    } catch (error) {
      console.error("Failed to save diet line preset:", error)
      toast.error("Zielprofil konnte nicht gespeichert werden.")
    } finally {
      setIsSavingDietLine(false)
    }
  }

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

  const cycleStart = addWeeks(baseWeekStart, cycleOffset * 4)
  const cycleStartIso = format(cycleStart, "yyyy-MM-dd")
  const cyclePlans = useMemo(() => getPlansInRange(cycleStartIso, 28), [cycleStartIso, getPlansInRange])
  const cycleEnd = addDays(cycleStart, 27)
  const cycleRangeLabel = `${format(cycleStart, "d. MMM", { locale: de })} – ${format(cycleEnd, "d. MMM yyyy", { locale: de })}`

  const weekSummaries = useMemo(() => {
    return weekPlans.map((plan) => ({ plan, totals: aggregatePlanNutrients(plan) }))
  }, [aggregatePlanNutrients, weekPlans])

  const teachingKitchenRows = useMemo(() => {
    return weekPlans.map((plan) => {
      const dateLabel = format(parseISO(plan.date), "EEE, dd.MM.", { locale: de })
      const lunch = plan.slots.find((slot) => slot.type === "mittagessen")
      const dinner = plan.slots.find((slot) => slot.type === "abendessen")
      return {
        dateLabel,
        lunch:
          lunch && lunch.entries[0]
            ? getEntryLabel(lunch.entries[0], foodMap, recipeMap)
            : "noch offen",
        dinner:
          dinner && dinner.entries[0]
            ? getEntryLabel(dinner.entries[0], foodMap, recipeMap)
            : "Snack-/Buffetplanung",
        kcal: formatNumber(Math.round(getNutrientValue(aggregatePlanNutrients(plan), "energie"))),
      }
    })
  }, [aggregatePlanNutrients, foodMap, recipeMap, weekPlans])

  const cycleWeekChunks = useMemo(() => {
    return Array.from({ length: 4 }, (_, index) => cyclePlans.slice(index * 7, index * 7 + 7))
  }, [cyclePlans])

  const cycleWeekStats = useMemo(() => {
    return cycleWeekChunks.map((days, index) => {
      const totalsPerDay = days.map((plan) => aggregatePlanNutrients(plan))
      const weeklyTotals = sumNutrients(totalsPerDay)
      const avgEnergy = getNutrientValue(weeklyTotals, "energie") / (days.length || 1)
      const avgProtein = getNutrientValue(weeklyTotals, "eiweiss") / (days.length || 1)
      const avgCarbs = getNutrientValue(weeklyTotals, "kohlenhydrate") / (days.length || 1)
      const highlights = Array.from(
        new Set(
          days
            .map((plan) => plan.slots.find((slot) => slot.type === "mittagessen")?.entries[0])
            .filter(Boolean)
            .map((entry) => getEntryLabel(entry as MealEntry, foodMap, recipeMap)),
        ),
      ).slice(0, 3)
      const energyTarget = dietLine?.targets.find((target) => target.nutrientId === "energie")
      const complianceState = complianceBadge(avgEnergy, energyTarget?.min, energyTarget?.max)
      return {
        weekLabel: `Woche ${index + 1}`,
        avgEnergy,
        avgProtein,
        avgCarbs,
        highlights,
        compliance: complianceState,
      }
    })
  }, [aggregatePlanNutrients, cycleWeekChunks, dietLine, foodMap, recipeMap])

  const dietLineCompliance = useMemo(() => {
    if (!dietLine)
      return [] as {
        nutrientId: string
        label: string
        status: "ok" | "low" | "high"
        value: number
        unit: string
        min?: number
        max?: number
      }[]

    return dietLine.targets.map((target) => {
      const value =
        target.nutrientId === "broteinheiten"
          ? getBroteinheiten(getNutrientValue(dailyNutrients, "kohlenhydrate"))
          : getNutrientValue(dailyNutrients, target.nutrientId)
      return {
        nutrientId: target.nutrientId,
        label: target.label,
        status: complianceBadge(value, target.min, target.max),
        value,
        unit: target.unit,
        min: target.min,
        max: target.max,
      }
    })
  }, [dailyNutrients, dietLine])

  const optimizationSuggestions = useMemo(() => {
    if (!dietLine) return [] as OptimizationSuggestion[]

    const existingKeys = new Set(
      currentPlan.slots.flatMap((slot) =>
        slot.entries.map((entry) => `${entry.type}:${entry.referenceId}`),
      ),
    )

    const rankedSuggestions = dietLineCompliance
      .filter((target) => target.status === "low" && typeof target.min === "number")
      .flatMap((target) => {
        const deficit = Math.max(0, (target.min ?? 0) - target.value)
        if (deficit <= 0) return [] as OptimizationSuggestion[]

        const slotType = chooseOptimizationSlot(target.nutrientId, currentPlan)
        // BE is a derived display nutrient — a food's BE contribution = its
        // carb contribution / 12. Translate the lookup so suggestions still
        // rank correctly if a custom preset ever defines a BE minimum.
        const lookupNutrientId =
          target.nutrientId === "broteinheiten" ? "kohlenhydrate" : target.nutrientId
        const projectContribution = (raw: number) =>
          target.nutrientId === "broteinheiten" ? getBroteinheiten(raw) : raw
        const foodSuggestions = foods
          .filter((food) => !existingKeys.has(`food:${food.id}`) && food.nutrients.length > 0)
          .map((food) => {
            const contribution = projectContribution(
              getNutrientValue(
                scaleNutrients(food.nutrients, food.baseAmount, 100),
                lookupNutrientId,
              ),
            )
            const severeConflict =
              patientAllergens.length > 0 && food.allergens?.length
                ? checkAllergenConflicts(food.allergens, patientAllergens).some((warning) => warning.severity === "severe")
                : false
            return {
              id: `food-${target.nutrientId}-${food.id}`,
              type: "food" as const,
              referenceId: food.id,
              name: food.name,
              slotType,
              amount: 100,
              nutrientId: target.nutrientId,
              targetLabel: target.label,
              unit: target.unit,
              deficit,
              contribution,
              allergens: food.allergens,
              severeConflict,
            }
          })

        const recipeSuggestions = recipes
          .filter((recipe) => !existingKeys.has(`recipe:${recipe.id}`))
          .map((recipe) => {
            const perServing = calculatePerServing(calculateRecipeNutrients(recipe, foods), recipe.servings)
            const contribution = projectContribution(getNutrientValue(perServing, lookupNutrientId))
            const severeConflict =
              patientAllergens.length > 0 && recipe.allergens?.length
                ? checkAllergenConflicts(recipe.allergens, patientAllergens).some((warning) => warning.severity === "severe")
                : false
            return {
              id: `recipe-${target.nutrientId}-${recipe.id}`,
              type: "recipe" as const,
              referenceId: recipe.id,
              name: recipe.name,
              slotType,
              amount: 1,
              nutrientId: target.nutrientId,
              targetLabel: target.label,
              unit: target.unit,
              deficit,
              contribution,
              allergens: recipe.allergens,
              severeConflict,
            }
          })

        return [...foodSuggestions, ...recipeSuggestions]
          .filter((suggestion) => suggestion.contribution > 0 && !suggestion.severeConflict)
          .sort((a, b) => {
            const aCoverage = Math.min(a.contribution, a.deficit) / a.deficit
            const bCoverage = Math.min(b.contribution, b.deficit) / b.deficit
            return bCoverage - aCoverage
          })
          .slice(0, 2)
      })
      .sort((a, b) => b.deficit - a.deficit)

    const seenSuggestions = new Set<string>()
    return rankedSuggestions
      .filter((suggestion) => {
        const key = `${suggestion.type}:${suggestion.referenceId}`
        if (seenSuggestions.has(key)) return false
        seenSuggestions.add(key)
        return true
      })
      .slice(0, 4)
  }, [currentPlan, dietLine, dietLineCompliance, foods, patientAllergens, recipes])

  const clinicalReview = useMemo(() => {
    const totalEntries = currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)
    const allergenConflictCount = Array.from(entryAllergenWarnings.values()).reduce(
      (sum, warnings) => sum + warnings.length,
      0,
    )
    const missingCoreSlots = currentPlan.slots
      .filter((slot) => ["fruehstueck", "mittagessen", "abendessen"].includes(slot.type))
      .filter((slot) => slot.entries.length === 0)
      .map((slot) => MEAL_SLOT_LABELS[slot.type])
    const offTargetItems = dietLineCompliance.filter((target) => target.status !== "ok")
    const items: PlanReviewItem[] = []

    items.push({
      id: "entries",
      label: "Planinhalt",
      description:
        totalEntries > 0
          ? `${totalEntries} Einträge geplant.`
          : "Der Tagesplan enthält noch keine Mahlzeiten.",
      severity: totalEntries > 0 ? "ok" : "critical",
    })

    items.push({
      id: "patient",
      label: "Patientenkontext",
      description:
        patientId && currentPlan.patientId !== patientId
          ? "Der geöffnete Patientenkontext ist noch nicht am Plan gespeichert."
          : currentPlan.patientId
            ? "Patientenkontext ist am Plan gespeichert."
            : "Allgemeiner Plan ohne Patientenzuordnung.",
      severity: patientId && currentPlan.patientId !== patientId ? "critical" : "ok",
    })

    items.push({
      id: "targets",
      label: "Zielprofil",
      description: dietLine
        ? `${dietLine.name}: ${offTargetItems.length === 0 ? "alle Zielwerte im Bereich." : `${offTargetItems.length} Zielwerte außerhalb des Bereichs.`}`
        : "Es ist kein Kostform-/Zielprofil ausgewählt.",
      severity: dietLine ? (offTargetItems.length === 0 ? "ok" : "warning") : "critical",
    })

    items.push({
      id: "allergens",
      label: "Allergenprüfung",
      description:
        allergenConflictCount > 0
          ? `${allergenConflictCount} Konflikthinweise im aktuellen Plan.`
          : patientAllergens.length > 0
            ? "Keine Konflikte gegen die hinterlegten Allergen-/Intoleranzhinweise."
            : "Keine patientenspezifischen Allergenhinweise hinterlegt.",
      severity: allergenConflictCount > 0 ? "critical" : "ok",
    })

    items.push({
      id: "meal-structure",
      label: "Mahlzeitenstruktur",
      description:
        missingCoreSlots.length > 0
          ? `Noch offen: ${missingCoreSlots.join(", ")}.`
          : "Frühstück, Mittagessen und Abendessen sind belegt.",
      severity: missingCoreSlots.length > 0 ? "warning" : "ok",
    })

    items.push({
      id: "inari-score",
      label: "Inari Score",
      description: `${formatNumber(planInariScore.score, 0)} Punkte: ${planInariScore.summary}`,
      severity: planInariScore.score < 60 ? "warning" : "ok",
    })

    const blockingItems = items.filter((item) => item.severity === "critical")
    const warningItems = items.filter((item) => item.severity === "warning")

    return {
      items,
      blockingItems,
      warningItems,
      canApprove: blockingItems.length === 0,
    }
  }, [
    currentPlan.patientId,
    currentPlan.slots,
    dietLine,
    dietLineCompliance,
    entryAllergenWarnings,
    patientAllergens.length,
    patientId,
    planInariScore.score,
    planInariScore.summary,
  ])

  const filteredTemplates = useMemo(() => {
    const query = applyTemplateSearch.trim().toLowerCase()
    const patientIndicationsLower = patientIndications.map((indication) => indication.toLowerCase())
    return mealPlanTemplates.filter((template) => {
      if (applyTemplateScope === "indikation" && patientIndicationsLower.length > 0) {
        const templateIndication = template.indication?.toLowerCase()
        if (!templateIndication || !patientIndicationsLower.includes(templateIndication)) {
          return false
        }
      }
      if (applyTemplateScope === "kostform" && dietLineId) {
        if (template.dietLineId !== dietLineId) {
          return false
        }
      }
      if (!query) return true
      const haystack = [
        template.name,
        template.description ?? "",
        template.indication ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [applyTemplateScope, applyTemplateSearch, dietLineId, mealPlanTemplates, patientIndications])

  const openApplyTemplateDialog = useCallback(() => {
    setApplyTemplateSearch("")
    setApplyTemplateScope(patientIndications.length ? "indikation" : "alle")
    setApplyTemplateDialogOpen(true)
  }, [patientIndications])

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

  const openSaveTemplateDialog = useCallback(() => {
    const totalEntries = currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)
    if (totalEntries === 0) {
      toast.error("Speichern nicht möglich: Der aktuelle Plan enthält keine Einträge.")
      return
    }
    setTemplateDraftName(currentPlan.title ?? "")
    setTemplateDraftDescription("")
    setTemplateDraftIndication(patientIndications[0] ?? "")
    setTemplateDraftDietLineId(dietLineId || "")
    setSaveTemplateDialogOpen(true)
  }, [currentPlan.slots, currentPlan.title, dietLineId, patientIndications])

  const handleSaveTemplate = useCallback(async () => {
    const name = templateDraftName.trim()
    if (!name) {
      toast.error("Bitte einen Namen für die Vorlage eingeben.")
      return
    }
    setIsSavingTemplate(true)
    try {
      await saveMealPlanTemplateFromHook({
        name,
        description: templateDraftDescription.trim() || undefined,
        indication: templateDraftIndication.trim() || undefined,
        dietLineId: templateDraftDietLineId || undefined,
        slots: currentPlan.slots,
        notes: currentPlan.notes,
      })
      setSaveTemplateDialogOpen(false)
      toast.success("Vorlage gespeichert.")
    } catch (error) {
      console.error("Failed to save meal plan template:", error)
      toast.error("Vorlage konnte nicht gespeichert werden.")
    } finally {
      setIsSavingTemplate(false)
    }
  }, [
    currentPlan.notes,
    currentPlan.slots,
    saveMealPlanTemplateFromHook,
    templateDraftDescription,
    templateDraftDietLineId,
    templateDraftIndication,
    templateDraftName,
  ])

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
        helpText="Planen Sie Mahlzeiten für einzelne Tage, Wochen oder Zyklen. Der Inari Score zeigt die Qualität der Planung an und vergleicht die Nährstoffzufuhr mit den DGE-Referenzwerten."
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_minmax(160px,200px)_auto]">
            <div className="space-y-1.5">
              <Label
                htmlFor="planakte-title"
                className="text-muted-foreground text-xs uppercase tracking-wide"
              >
                Titel
              </Label>
              <Input
                id="planakte-title"
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
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Status
              </Label>
              <Select
                value={currentPlan.status ?? "draft"}
                onValueChange={(value) =>
                  void updateCurrentPlanStatus(value as NonNullable<DailyMealPlan["status"]>)
                }
              >
                <SelectTrigger aria-label="Planstatus">
                  <SelectValue placeholder="Status wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem
                      key={value}
                      value={value}
                      disabled={value === "approved" && !clinicalReview.canApprove}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-1.5">
              {patientId && currentPlan.patientId !== patientId && (
                <Button size="sm" variant="outline" onClick={attachCurrentPatient}>
                  Patient zuordnen
                </Button>
              )}
              {currentPlan.status === "approved" && (
                <Button size="sm" variant="outline" onClick={reopenCurrentPlan}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Entwurf öffnen
                </Button>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Inari Score</p>
                <p className="mt-1 text-3xl font-semibold leading-none">
                  {formatNumber(planInariScore.score, 0)}
                </p>
                <p className="text-muted-foreground mt-1.5 line-clamp-1 text-xs">
                  {planInariScore.summary}
                </p>
              </div>
              <Badge
                className={cn(
                  planInariScore.badge.color,
                  "border-none px-2 py-0.5 text-[11px] font-semibold",
                )}
              >
                {planInariScore.badge.label}
              </Badge>
            </div>
            <Progress value={planInariScore.score} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

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
                  onClick={openDietLineEditor}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Vorherige Woche</span>
            </Button>
            <div className="text-sm font-medium">{weekRangeLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((prev) => prev + 1)}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Nächste Woche</span>
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              Bezug: {dietLine?.name ?? "Zielprofil auswählen"}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_1fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {weekSummaries.map(({ plan, totals }) => (
                  <Card key={plan.date}>
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">
                            {format(parseISO(plan.date), "EEE, dd.MM.", { locale: de })}
                          </CardTitle>
                          <CardDescription>
                            {formatNumber(Math.round(getNutrientValue(totals, "energie")))} kcal ·{' '}
                            {formatNumber(getNutrientValue(totals, "eiweiss"), 0)} g Eiweiß
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDate(plan.date)
                            setView("day")
                          }}
                        >
                          Öffnen
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => copyCurrentPlanToDate(plan.date)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Heute hierher
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => copyPlanToNextDay(plan.date)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Auf Folgetag
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => clearPlan(plan.date)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Leeren
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-sm">
                      {plan.slots.map((slot) => (
                        <div key={slot.type} className="flex items-start justify-between gap-2">
                          <span className="font-medium text-muted-foreground">
                            {MEAL_SLOT_LABELS[slot.type]}
                          </span>
                          <span className="text-right">
                            {slot.entries.length > 0
                              ? slot.entries
                                  .map((entry) =>
                                    getEntryLabel(entry, foodMap, recipeMap).split("(")[0]?.trim(),
                                  )
                                  .slice(0, 2)
                                  .join(", ")
                              : "–"}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Wöchentliche Kennzahlen</CardTitle>
                  <CardDescription>Vergleich mit {dietLine?.name ?? "Zielprofil"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dietLineCompliance.map((target) => {
                    const weekTotal = weekSummaries.reduce(
                      (sum, { totals }) => sum + getNutrientValue(totals, target.nutrientId),
                      0,
                    )
                    const divisor = weekSummaries.length || 1
                    const weekAvg = weekTotal / divisor
                    return (
                      <div key={target.label} className="flex items-center justify-between">
                        <span>{target.label}</span>
                        <span className="text-right">
                          {formatNumber(weekAvg, 0)} {target.unit}
                        </span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Lehrküchenplan</CardTitle>
                    <CardDescription>Preview für Aushänge & Druck</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={exportingVariant !== null}
                    onClick={() => void handleExportPlan("lehrkueche")}
                  >
                    {exportingVariant === "lehrkueche" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    PDF exportieren
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tag</TableHead>
                        <TableHead>Mittag</TableHead>
                        <TableHead>Abend</TableHead>
                        <TableHead className="text-right">kcal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachingKitchenRows.map((row) => (
                        <TableRow key={row.dateLabel}>
                          <TableCell className="font-medium">{row.dateLabel}</TableCell>
                          <TableCell>{row.lunch}</TableCell>
                          <TableCell>{row.dinner}</TableCell>
                          <TableCell className="text-right">{row.kcal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Exchange-Listen Notizen</CardTitle>
                  <CardDescription>Markierte Lebensmittel aus Austauschlisten</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Kombiniere Snack-Slots mit ballaststoffreichen Optionen aus den Austauschlisten.
                  Tippe auf einen Slot im Tagesmodus, um Alternativen einzufügen.
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cycle" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCycleOffset((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Vorheriger Zyklus</span>
            </Button>
            <div className="text-sm font-medium">{cycleRangeLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setCycleOffset((prev) => prev + 1)}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Nächster Zyklus</span>
            </Button>
            <Badge variant="secondary" className="ml-auto">
              {dietLine?.name ?? "Zielprofil"}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wochensummen & Zielerreichung</CardTitle>
                <CardDescription>Durchschnittswerte pro Woche</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Woche</TableHead>
                      <TableHead>Ø kcal</TableHead>
                      <TableHead>Ø Eiweiß</TableHead>
                      <TableHead>Ø Kohlenhydrate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycleWeekStats.map((week) => (
                      <TableRow key={week.weekLabel}>
                        <TableCell className="font-medium">{week.weekLabel}</TableCell>
                        <TableCell>{formatNumber(week.avgEnergy, 0)}</TableCell>
                        <TableCell>{formatNumber(week.avgProtein, 0)} g</TableCell>
                        <TableCell>{formatNumber(week.avgCarbs, 0)} g</TableCell>
                        <TableCell>
                          <Badge
                            variant={week.compliance === "ok" ? "secondary" : "outline"}
                            className={
                              week.compliance === "ok"
                                ? "bg-emerald-50 text-emerald-700"
                                : week.compliance === "low"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                            }
                          >
                            {week.compliance === "ok" ? "im Ziel" : week.compliance === "low" ? "unter Ziel" : "über Ziel"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">Menürotation & Highlights</CardTitle>
                <CardDescription>
                  Zeigt Signature-Dishes für Lehrküche und Stationsversorgung.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cycleWeekStats.map((week) => (
                  <div key={week.weekLabel} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                      {week.weekLabel}
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
                      {week.highlights.length > 0 ? (
                        week.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)
                      ) : (
                        <li className="text-muted-foreground">Noch keine Highlights geplant.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="einzelanalyse" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">Einzelanalyse</CardTitle>
                  <CardDescription>
                    Beitrag jedes Lebensmittels und Rezepts zum Tagestotal. Die größte
                    Quelle pro Nährstoff ist hervorgehoben.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="einzel-per-kg"
                      checked={einzelPerKgEnabled}
                      onCheckedChange={setEinzelPerKgEnabled}
                      disabled={typeof latestPatientWeightKg !== "number"}
                    />
                    <Label
                      htmlFor="einzel-per-kg"
                      className="cursor-pointer text-sm font-normal"
                    >
                      pro kg KG
                      {typeof latestPatientWeightKg === "number" ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({formatNumber(latestPatientWeightKg, 0)} kg)
                        </span>
                      ) : (
                        <span className="text-muted-foreground ml-1 text-xs">
                          (Gewicht fehlt)
                        </span>
                      )}
                    </Label>
                  </div>
                  <Popover open={einzelPickerOpen} onOpenChange={setEinzelPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        Nährstoffe ({einzelNutrientIds.length})
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-1" align="end">
                      <div className="max-h-80 overflow-y-auto">
                        {NUTRIENT_DEFINITIONS.map((def) => {
                          const isActive = einzelNutrientIds.includes(def.id)
                          // Block deselecting the last column — an empty table
                          // has no rows to render and offers no signal.
                          const isLastSelected = isActive && einzelNutrientIds.length === 1
                          return (
                            <label
                              key={def.id}
                              className={cn(
                                "hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                                isLastSelected && "cursor-not-allowed opacity-60",
                              )}
                            >
                              <Checkbox
                                checked={isActive}
                                disabled={isLastSelected}
                                onCheckedChange={() => {
                                  setEinzelNutrientIds((prev) =>
                                    prev.includes(def.id)
                                      ? prev.filter((id) => id !== def.id)
                                      : [...prev, def.id],
                                  )
                                }}
                              />
                              <span className="flex-1">{def.name}</span>
                              <span className="text-muted-foreground text-xs">
                                {def.unit}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <EinzelanalyseTableView
                table={einzelanalyseTable}
                nutrientDefinitions={NUTRIENT_DEFINITIONS}
                slotLabels={MEAL_SLOT_LABELS}
                bodyWeightKg={latestPatientWeightKg}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dietLineDialogOpen} onOpenChange={setDietLineDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Kostform/Zielprofil verwalten</DialogTitle>
            <DialogDescription>
              Eigene Vorgaben werden gespeichert und können direkt mit dem aktuellen Tagesplan verknüpft werden.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <div className="space-y-2">
                <Label htmlFor="diet-line-name">Name</Label>
                <Input
                  id="diet-line-name"
                  value={dietLineDraftName}
                  onChange={(event) => setDietLineDraftName(event.target.value)}
                  placeholder="z. B. Dialyse 1800 kcal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diet-line-description">Beschreibung</Label>
                <Input
                  id="diet-line-description"
                  value={dietLineDraftDescription}
                  onChange={(event) => setDietLineDraftDescription(event.target.value)}
                  placeholder="Kurzbeschreibung für Planung und Prüfung"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nährstoff</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="w-28">Min.</TableHead>
                    <TableHead className="w-28">Max.</TableHead>
                    <TableHead className="w-20">Einheit</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Entfernen</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dietLineDraftTargets.map((target, index) => (
                    <TableRow key={`${target.nutrientId}-${index}`}>
                      <TableCell>
                        <Select
                          value={target.nutrientId}
                          onValueChange={(value) => updateDietLineDraftTarget(index, { nutrientId: value })}
                        >
                          <SelectTrigger className="w-[190px]">
                            <SelectValue placeholder="Nährstoff" />
                          </SelectTrigger>
                          <SelectContent>
                            {NUTRIENT_DEFINITIONS.map((definition) => (
                              <SelectItem key={definition.id} value={definition.id}>
                                {definition.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={target.label}
                          onChange={(event) => updateDietLineDraftTarget(index, { label: event.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={target.min ?? ""}
                          onChange={(event) => updateDietLineDraftTarget(index, { min: parseOptionalNumber(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={target.max ?? ""}
                          onChange={(event) => updateDietLineDraftTarget(index, { max: parseOptionalNumber(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{target.unit}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDietLineDraftTarget(index)}
                          disabled={dietLineDraftTargets.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Zielwert entfernen</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" className="w-fit" onClick={addDietLineDraftTarget}>
              <Plus className="mr-2 h-4 w-4" />
              Zielwert hinzufügen
            </Button>
          </div>
          <DialogFooter className="items-center justify-between sm:justify-between">
            <div>
              {isCurrentDietLineEditable && (
                <Button variant="ghost" className="text-destructive" onClick={deleteCurrentDietLine}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDietLineDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={saveDietLineDraft} disabled={isSavingDietLine}>
                <Save className="mr-2 h-4 w-4" />
                {isSavingDietLine ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommandDialog
        open={commandOpen}
        onOpenChange={(open) => {
          setCommandOpen(open)
          if (!open) setFoodCommandQuery("")
        }}
        title="Lebensmittel oder Rezept hinzufügen"
        description="Suche nach einem Lebensmittel oder Rezept."
      >
        <CommandInput
          placeholder="Lebensmittel oder Rezept suchen..."
          value={foodCommandQuery}
          onValueChange={setFoodCommandQuery}
        />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {filteredCommandFoods.map((food) => {
              const hydratedFood = foodMap.get(food.id)
              return (
              <CommandItem
                key={food.id}
                value={`${food.name} ${food.id}`}
                onSelect={() => void handleSelectFood(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {hydratedFood
                    ? `${formatNumber(Math.round(getNutrientValue(hydratedFood.nutrients, "energie")))} kcal / 100g`
                    : "wird beim Einfügen geladen"}
                </span>
              </CommandItem>
              )
            })}
          </CommandGroup>
          <Separator />
          <CommandGroup heading="Rezepte">
            {filteredCommandRecipes.map((recipe) => (
              <CommandItem
                key={recipe.id}
                value={`${recipe.name} ${recipe.id}`}
                onSelect={() => handleSelectRecipe(recipe.id)}
              >
                <span>{recipe.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog
        open={exchangeDialogOpen}
        onOpenChange={(open) => {
          setExchangeDialogOpen(open)
          if (!open) {
            setExchangeSlot(null)
            setExchangeEntryId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {exchangeEntryId ? "Eintrag austauschen" : "Austauschliste"} für{" "}
              {exchangeSlot ? MEAL_SLOT_LABELS[exchangeSlot] : "Slot"}
            </DialogTitle>
            <DialogDescription>
              {exchangeShowDelta
                ? "Werte und Δ beziehen sich auf die ursprüngliche Menge. Beim Austauschen bleibt die bisherige Menge erhalten."
                : "Werte je 100 g. Beim Austauschen bleibt die bisherige Menge erhalten."}
            </DialogDescription>
          </DialogHeader>
          {exchangeOriginal && (
            <div className="bg-muted/40 rounded-md border border-dashed p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                    Original
                  </div>
                  <div className="text-sm font-medium">
                    {exchangeOriginal.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({formatNumber(exchangeOriginal.amount, 0)} {exchangeOriginal.unitLabel})
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {EXCHANGE_DELTA_NUTRIENT_IDS.map((nutrientId) => {
                    const def = nutrientDefMap.get(nutrientId)
                    const value = exchangeOriginal.nutrients.get(nutrientId) ?? 0
                    return (
                      <Badge key={nutrientId} variant="outline" className="bg-background">
                        {def?.shortName ?? nutrientId}:{" "}
                        {formatNumber(value, nutrientId === "energie" ? 0 : 1)} {def?.unit ?? ""}
                      </Badge>
                    )
                  })}
                </div>
              </div>
              {exchangeOriginal.kind === "recipe" && (
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Hinweis: Beim Tausch eines Rezepts gegen ein Lebensmittel ist kein Δ-Vergleich
                  möglich. Die Liste zeigt Werte je 100 g.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Lebensmittel suchen..."
              value={exchangeSearch}
              onChange={(e) => setExchangeSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={exchangeCategory} onValueChange={setExchangeCategory}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {FOOD_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={exchangeNutrient} onValueChange={setExchangeNutrient}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Nährstoff" />
              </SelectTrigger>
              <SelectContent>
                {NUTRIENT_DEFINITIONS.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {exchangeNutrientLoading && (
            <p className="text-muted-foreground mt-2 text-sm">
              Nährstoffwerte werden geladen …
            </p>
          )}
          {exchangeNutrientError && (
            <p className="text-destructive mt-2 text-sm">
              Nährstoffe konnten nicht geladen werden: {exchangeNutrientError}
            </p>
          )}
          <div className="mt-2 max-h-[420px] overflow-hidden rounded-md border">
            <ScrollArea className="h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lebensmittel</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">
                      {nutrientDefMap.get(exchangeNutrient)?.shortName ?? exchangeNutrient}
                      {exchangeShowDelta && (
                        <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                          ({formatNumber(exchangeCompareAmount, 0)} g)
                        </span>
                      )}
                    </TableHead>
                    <TableHead className="text-right">Makros</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExchangeFoods.slice(0, 20).map((food) => {
                    const pivotPer100 = exchangeNutrientValues.get(food.id) ?? 0
                    const pivotAbs = (pivotPer100 * exchangeCompareAmount) / 100
                    const pivotOriginalAbs = exchangeOriginal?.nutrients.get(exchangeNutrient) ?? 0
                    const pivotDelta = exchangeShowDelta ? pivotAbs - pivotOriginalAbs : null
                    const pivotDef = nutrientDefMap.get(exchangeNutrient)
                    const category = FOOD_CATEGORIES.find((cat) => cat.id === food.categoryId)
                    const pivotDecimals = exchangeNutrient === "energie" ? 0 : 1
                    return (
                      <TableRow key={food.id}>
                        <TableCell className="font-medium">{food.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {category?.name ?? "–"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span>
                              {formatNumber(pivotAbs, pivotDecimals)} {pivotDef?.unit ?? ""}
                            </span>
                            {pivotDelta !== null && (
                              <span
                                className={cn(
                                  "text-[11px] font-medium",
                                  Math.abs(pivotDelta) < 0.05
                                    ? "text-muted-foreground"
                                    : pivotDelta > 0
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-orange-600 dark:text-orange-400",
                                )}
                              >
                                {pivotDelta > 0 ? "+" : ""}
                                {formatNumber(pivotDelta, pivotDecimals)} {pivotDef?.unit ?? ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {EXCHANGE_DELTA_NUTRIENT_IDS.filter(
                              (id) => id !== exchangeNutrient,
                            ).map((nutrientId) => {
                              const def = nutrientDefMap.get(nutrientId)
                              const per100 =
                                exchangeDeltaValues.get(nutrientId)?.get(food.id) ?? 0
                              const abs = (per100 * exchangeCompareAmount) / 100
                              const originalAbs =
                                exchangeOriginal?.nutrients.get(nutrientId) ?? 0
                              const delta = exchangeShowDelta ? abs - originalAbs : null
                              const decimals = nutrientId === "energie" ? 0 : 1
                              if (delta === null) {
                                return (
                                  <Badge
                                    key={nutrientId}
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                  >
                                    {def?.shortName ?? nutrientId} {formatNumber(abs, decimals)}
                                  </Badge>
                                )
                              }
                              const isNeutral = Math.abs(delta) < 0.05
                              return (
                                <Badge
                                  key={nutrientId}
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-medium",
                                    isNeutral
                                      ? "text-muted-foreground"
                                      : delta > 0
                                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                                        : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200",
                                  )}
                                >
                                  {def?.shortName ?? nutrientId} {delta > 0 ? "+" : ""}
                                  {formatNumber(delta, decimals)}
                                </Badge>
                              )
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleSelectExchangeFood(food.id)}>
                            {exchangeEntryId ? "Ersetzen" : "Übernehmen"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={applyTemplateDialogOpen} onOpenChange={setApplyTemplateDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Plan aus Vorlage erzeugen</DialogTitle>
            <DialogDescription>
              Die ausgewählte Vorlage ersetzt den aktuellen Tagesplan. Status und Freigabe werden zurückgesetzt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  value={applyTemplateSearch}
                  onChange={(event) => setApplyTemplateSearch(event.target.value)}
                  placeholder="Vorlagen durchsuchen..."
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={applyTemplateScope === "alle" ? "default" : "outline"}
                  onClick={() => setApplyTemplateScope("alle")}
                >
                  Alle
                </Button>
                {patientIndications.length ? (
                  <Button
                    size="sm"
                    variant={applyTemplateScope === "indikation" ? "default" : "outline"}
                    onClick={() => setApplyTemplateScope("indikation")}
                  >
                    {patientIndications.length === 1
                      ? patientIndications[0]
                      : `Indikationen (${patientIndications.length})`}
                  </Button>
                ) : null}
                {dietLine && (
                  <Button
                    size="sm"
                    variant={applyTemplateScope === "kostform" ? "default" : "outline"}
                    onClick={() => setApplyTemplateScope("kostform")}
                  >
                    {dietLine.name}
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[360px] rounded-md border">
              {templatesLoading && filteredTemplates.length === 0 ? (
                <div className="text-muted-foreground p-4 text-sm">Vorlagen werden geladen …</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-muted-foreground p-4 text-sm">
                  Keine Vorlagen für die aktuelle Filterauswahl.
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredTemplates.map((template) => {
                    const entryCount = template.slots.reduce(
                      (sum, slot) => sum + slot.entries.length,
                      0,
                    )
                    const dietLineForTemplate = dietLines.find(
                      (line) => line.id === template.dietLineId,
                    )
                    return (
                      <li key={template.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                        <div className="min-w-[220px] flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{template.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {template.sourceType === "system" ? "System" : "Eigene"}
                            </Badge>
                            {template.indication && (
                              <Badge variant="secondary" className="text-[10px]">
                                {template.indication}
                              </Badge>
                            )}
                            {dietLineForTemplate && (
                              <Badge variant="outline" className="text-[10px]">
                                {dietLineForTemplate.name}
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-muted-foreground mt-1 text-xs">{template.description}</p>
                          )}
                          <p className="text-muted-foreground mt-1 text-xs">
                            {entryCount} {entryCount === 1 ? "Eintrag" : "Einträge"} über alle Mahlzeiten
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handleApplyTemplate(template)}>
                          Übernehmen
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTemplateDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Plan als Vorlage speichern</DialogTitle>
            <DialogDescription>
              Die Vorlage wird Ihrem Konto zugeordnet und steht für künftige Pläne zur Verfügung.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateDraftName}
                onChange={(event) => setTemplateDraftName(event.target.value)}
                placeholder="z. B. Reduktion 1500 kcal Tag 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-description">Beschreibung</Label>
              <Textarea
                id="template-description"
                value={templateDraftDescription}
                onChange={(event) => setTemplateDraftDescription(event.target.value)}
                placeholder="Wofür eignet sich die Vorlage?"
                rows={2}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="template-indication">Indikation</Label>
                <Input
                  id="template-indication"
                  value={templateDraftIndication}
                  onChange={(event) => setTemplateDraftIndication(event.target.value)}
                  placeholder="z. B. Diabetes mellitus Typ 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kostform</Label>
                <Select
                  value={templateDraftDietLineId || "none"}
                  onValueChange={(value) =>
                    setTemplateDraftDietLineId(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kostform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Zuordnung</SelectItem>
                    {dietLines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {isSavingTemplate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingPatientAssignmentId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPatientAssignmentId(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan einem Patienten zuordnen?</DialogTitle>
            <DialogDescription>
              Der aktuelle Tagesplan enthält bereits Einträge. Wählen Sie, ob dieser Plan dem
              Patienten zugeordnet oder nur der Patientenplan für diesen Tag geöffnet werden soll.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              {pendingAssignmentPatient
                ? `${pendingAssignmentPatient.firstName} ${pendingAssignmentPatient.lastName}`
                : "Ausgewählter Patient"}
            </p>
            {pendingAssignmentPatientIndications.length ? (
              <p className="text-muted-foreground">{pendingAssignmentPatientIndications.join(" · ")}</p>
            ) : null}
            <p className="text-muted-foreground mt-2">
              {currentPlan.slots.reduce((sum, slot) => sum + slot.entries.length, 0)} Einträge ·{" "}
              {format(parseISO(currentDate), "dd.MM.yyyy")}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const nextPatientId = pendingPatientAssignmentId
                setPendingPatientAssignmentId(null)
                if (nextPatientId) openPatientContext(nextPatientId)
              }}
            >
              Nur Patientenplan öffnen
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setPendingPatientAssignmentId(null)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (pendingPatientAssignmentId) {
                    assignCurrentPlanToPatient(pendingPatientAssignmentId)
                  }
                }}
                disabled={currentPlan.status === "approved"}
              >
                Diesen Plan zuordnen
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingAllergenIntent !== null}
        onOpenChange={(open) => {
          if (!open) dismissPendingAllergenIntent()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-700">
              Schwere Allergenwarnung – Eintrag blockiert
            </DialogTitle>
            <DialogDescription>
              {pendingAllergenIntent
                ? `${pendingAllergenIntent.itemName} kollidiert mit einem als „schwer“ eingestuften Allergen-/Intoleranzhinweis dieses Patienten.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {pendingAllergenIntent && (
            <div className="space-y-3 text-sm">
              <ul className="space-y-1">
                {pendingAllergenIntent.warnings.map((warning) => (
                  <li
                    key={warning.allergenId}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Badge
                      variant="outline"
                      className={
                        warning.severity === "severe"
                          ? "border-red-300 bg-red-100 text-red-800"
                          : warning.severity === "moderate"
                            ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-yellow-300 bg-yellow-100 text-yellow-800"
                      }
                    >
                      {ALLERGEN_SEVERITY_LABELS[warning.severity]}
                    </Badge>
                    <span className="font-medium">{warning.allergenLabel}</span>
                    <span className="text-muted-foreground text-xs">
                      {ALLERGEN_TYPE_LABELS[warning.type]} · Treffer: {warning.matchedToken}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                Bitte vor der Übernahme die klinische Indikation und alternative Lebensmittel
                prüfen. Eine Übernahme wird im Plan und in der nächsten Versionsspeicherung
                dokumentiert.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={dismissPendingAllergenIntent}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPendingAllergenIntent}
            >
              Trotzdem übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={planAkteOpen} onOpenChange={setPlanAkteOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="text-primary h-4 w-4" />
              Planakte – Detailansicht
            </SheetTitle>
            <SheetDescription>
              Hinweise, Score-Treiber, Nachhaltigkeit und vollständige Versionshistorie.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-5 p-4">
              <section className="space-y-2">
                <Label
                  htmlFor="planakte-notes"
                  className="text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Hinweise
                </Label>
                <Textarea
                  id="planakte-notes"
                  key={`notes-${currentPlan.id}-${currentPlan.date}`}
                  defaultValue={currentPlan.notes ?? ""}
                  placeholder="Indikation, Beratungshinweise, Patientenvorlieben oder interne Prüfnotizen"
                  rows={4}
                  readOnly={currentPlan.status === "approved"}
                  onBlur={(event) => {
                    if (event.currentTarget.value.trim() !== (currentPlan.notes ?? "")) {
                      saveCurrentPlanNotes(event.currentTarget.value)
                    }
                  }}
                />
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Inari Score-Treiber</p>
                  <Badge variant="outline" className="font-normal">
                    {formatNumber(planInariScore.score, 0)} Punkte
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {positivePlanDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      className="rounded-md border border-emerald-100 bg-emerald-50/70 p-2 text-xs"
                    >
                      <p className="font-medium text-emerald-900">{driver.label}</p>
                      <p className="text-muted-foreground mt-0.5">{driver.description}</p>
                    </div>
                  ))}
                  {negativePlanDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      className="rounded-md border border-red-100 bg-red-50/70 p-2 text-xs"
                    >
                      <p className="font-medium text-red-900">{driver.label}</p>
                      <p className="text-muted-foreground mt-0.5">{driver.description}</p>
                    </div>
                  ))}
                  {positivePlanDrivers.length === 0 && negativePlanDrivers.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      Noch keine Treiber – Plan enthält wenig Inhalt.
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Nachhaltigkeit – Top-Verursacher</p>
                  <Badge variant="outline" className="font-normal">
                    {formatNumber(planSustainability.totalCo2, 2)} kg CO₂e
                  </Badge>
                </div>
                {planSustainability.topEmitters.length > 0 ? (
                  <div className="space-y-1.5">
                    {planSustainability.topEmitters.slice(0, 5).map((emitter) => (
                      <div
                        key={emitter.id}
                        className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {MEAL_SLOT_LABELS[emitter.slot] ?? emitter.slot}
                          </Badge>
                          <span className="truncate">{emitter.label}</span>
                        </div>
                        <span className="font-semibold">
                          {formatNumber(emitter.co2, 2)} kg
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Noch keine Daten zu Emittenten.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Versionshistorie</p>
                  <Badge variant="outline" className="font-normal">
                    {mealPlanVersionsLoading ? "lädt" : `${mealPlanVersions.length} Versionen`}
                  </Badge>
                </div>
                {mealPlanVersions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Noch keine freigegebene oder gespeicherte Version.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {mealPlanVersions.map((version) => {
                      const entryCount = version.snapshot.slots.reduce(
                        (sum, slot) => sum + slot.entries.length,
                        0,
                      )
                      return (
                        <div
                          key={version.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">
                              Version {version.versionNumber} ·{" "}
                              {format(parseISO(version.createdAt), "dd.MM.yyyy HH:mm")}
                            </p>
                            <p className="text-muted-foreground">
                              {entryCount} Einträge ·{" "}
                              {version.reason === "approved"
                                ? "Freigabe"
                                : version.reason === "manual"
                                  ? "Checkpoint"
                                  : "Wiederöffnung"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            disabled={currentPlan.status === "approved"}
                            onClick={() => restoreVersion(version)}
                          >
                            Wiederherstellen
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {currentPlan.status === "approved" && mealPlanVersions.length > 0 && (
                  <p className="text-muted-foreground text-[11px]">
                    Zum Wiederherstellen zuerst den Plan als Entwurf öffnen.
                  </p>
                )}
              </section>
            </div>
          </ScrollArea>
          <SheetFooter className="border-t">
            <Button variant="outline" onClick={() => setPlanAkteOpen(false)}>
              Schließen
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ChefHat className="text-primary h-4 w-4" />
              Rezeptbibliothek
            </SheetTitle>
            <SheetDescription>
              {paletteRecipes.length} von {recipes.length} Rezepten ·{" "}
              Treffer landen in {MEAL_SLOT_LABELS[paletteSlot]}.
            </SheetDescription>
          </SheetHeader>
          <div className="border-b p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  value={recipeSearch}
                  onChange={(event) => setRecipeSearch(event.target.value)}
                  placeholder="Name oder Tag..."
                  className="pl-8"
                />
              </div>
              <Select
                value={paletteSlot}
                onValueChange={(value) => setPaletteSlot(value as MealSlotType)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Slot" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MEAL_SLOT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={paletteCategory} onValueChange={setPaletteCategory}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Kategorien</SelectItem>
                  {recipeCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paletteSort}
                onValueChange={(value) =>
                  setPaletteSort(value as "name" | "kcalAsc" | "kcalDesc" | "prep")
                }
              >
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue placeholder="Sortierung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A→Z)</SelectItem>
                  <SelectItem value="kcalAsc">kcal aufsteigend</SelectItem>
                  <SelectItem value="kcalDesc">kcal absteigend</SelectItem>
                  <SelectItem value="prep">Zubereitungszeit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(patientIndications.length || patientAllergens.length > 0) ? (
              <div className="flex flex-wrap gap-2">
                {patientIndications.length ? (
                  <Toggle
                    size="sm"
                    pressed={paletteIndicationOnly}
                    onPressedChange={setPaletteIndicationOnly}
                    className="h-7 text-xs"
                  >
                    Indikation passt
                  </Toggle>
                ) : null}
                {patientAllergens.length > 0 && (
                  <Toggle
                    size="sm"
                    pressed={paletteAllergenSafeOnly}
                    onPressedChange={setPaletteAllergenSafeOnly}
                    className="h-7 text-xs"
                  >
                    Allergen-sicher
                  </Toggle>
                )}
              </div>
            ) : null}
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-4">
              {paletteRecipes.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Keine Rezepte entsprechen den aktuellen Filtern.
                </p>
              )}
              {paletteRecipes.map(({ recipe, kcal, totalTime, conflictCount }) => {
                const tags = (recipe.tags ?? []).slice(0, 3)
                return (
                  <div
                    key={recipe.id}
                    className="hover:border-primary/40 hover:bg-muted/50 rounded-lg border p-3 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">
                          {recipe.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {recipe.category}
                          {tags.length > 0 ? ` · ${tags.join(", ")}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPlan.status === "approved"}
                        onClick={() => {
                          handleQuickAddRecipe(recipe.id)
                        }}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Hinzufügen
                      </Button>
                    </div>
                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      <span>{formatNumber(kcal, 0)} kcal/Portion</span>
                      {totalTime > 0 && <span>· {totalTime} min</span>}
                      {typeof recipe.prodScore === "number" && (
                        <span>· Inari Score {Math.round(recipe.prodScore)}</span>
                      )}
                      {conflictCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-[10px] text-orange-700"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {conflictCount} Allergen-Konflikt
                          {conflictCount === 1 ? "" : "e"}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
