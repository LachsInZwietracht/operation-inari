"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  ChefHat,
  Copy,
  Download,
  FileText,
  History,
  LayoutTemplate,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Users,
  Utensils,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  MealSlotCard,
  MEAL_PLAN_DRAG_ID,
  MEAL_PLAN_DRAG_TYPE,
} from "@/components/meal-slot"
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
} from "@/lib/nutrients"
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
  Recipe,
  DietLinePreset,
} from "@/lib/types"
import { calculateProdScore } from "@/lib/prodi-score"
import { evaluatePlanSustainability } from "@/lib/sustainability"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import { useFoods, useFoodSearch } from "@/components/foods-provider"
import { createRecipeLookup } from "@/lib/recipes"
import { useNutrientValues } from "@/hooks/use-nutrient-values"
import type { FoodSearchItem } from "@/lib/types"
import { usePatientAllergens } from "@/hooks/use-patient-allergens"
import { checkAllergenConflicts } from "@/lib/allergen-warnings"
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
import { downloadResponseFile } from "@/lib/utils"

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

type DietLineTargetDraft = DietLinePreset["targets"][number]
type PlanReviewSeverity = "critical" | "warning" | "ok"

interface PlanReviewItem {
  id: string
  label: string
  description: string
  severity: PlanReviewSeverity
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

function reviewSeverityBadgeClass(severity: PlanReviewSeverity): string {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-700"
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

interface ErnaehrungsplanPageClientProps {
  recipes: Recipe[]
  initialPlans: DailyMealPlan[]
  initialTemplates?: MealPlanTemplate[]
  patientId?: string
  initialDate?: string
}

export function ErnaehrungsplanPageClient({ recipes, initialPlans, initialTemplates, patientId, initialDate }: ErnaehrungsplanPageClientProps) {
  const serverFoods = useFoods()
  const { index: foodSearchIndex, loadIndex: loadFoodSearchIndex } = useFoodSearch()
  const { getPatient } = usePatients()
  const patient = patientId ? getPatient(patientId) : undefined
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
    removeEntry,
    updateEntryAmount,
    replaceEntry,
    copyPlanToDate,
    clearPlanForDate,
    updatePlanMetadata,
    applyTemplateToDate,
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

  const [commandOpen, setCommandOpen] = useState(false)
  const [foodCommandQuery, setFoodCommandQuery] = useState("")
  const [activeSlot, setActiveSlot] = useState<MealSlotType>("fruehstueck")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [view, setView] = useState("day")
  const [paletteSlot, setPaletteSlot] = useState<MealSlotType>("mittagessen")
  const [recipeSearch, setRecipeSearch] = useState("")
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
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const {
    values: exchangeNutrientValues,
    isLoading: exchangeNutrientLoading,
    error: exchangeNutrientError,
  } = useNutrientValues(exchangeNutrient, hydratedFoods, {
    forceRemote: foodSearchIndex.length > hydratedFoods.length,
  })
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

  const entryAllergenWarnings = useMemo(() => {
    if (patientAllergens.length === 0) return new Map<string, string[]>()
    const map = new Map<string, string[]>()
    for (const slot of currentPlan.slots) {
      for (const entry of slot.entries) {
        const allergens = entry.type === "food"
          ? foodMap.get(entry.referenceId)?.allergens
          : recipeMap.get(entry.referenceId)?.allergens
        if (allergens?.length) {
          const warnings = checkAllergenConflicts(allergens, patientAllergens)
          if (warnings.length > 0) {
            map.set(entry.id, warnings.map((w) => w.allergenLabel))
          }
        }
      }
    }
    return map
  }, [currentPlan, foodMap, recipeMap, patientAllergens])

  const aggregatePlanNutrients = useCallback(
    (plan: DailyMealPlan): NutrientValue[] =>
      sumNutrients(
        plan.slots.flatMap((slot) =>
          slot.entries.map((entry) => calculateEntryNutrients(entry, foodMap, foods, recipeMap)),
        ),
      ),
    [foodMap, foods, recipeMap],
  )

  const parsedDate = parseISO(currentDate)
  const formattedDate = format(parsedDate, "EEEE, d. MMMM yyyy", { locale: de })

  const handleAddEntry = (slotType: MealSlotType) => {
    setActiveSlot(slotType)
    setCommandOpen(true)
  }

  const handleSelectFood = async (foodId: string) => {
    const food = await hydrateFood(foodId)
    if (!food) return

    addEntry(activeSlot, { type: "food", referenceId: food.id, amount: 100 })
    setCommandOpen(false)
    setFoodCommandQuery("")

    if (patientAllergens.length > 0) {
      if (food?.allergens?.length) {
        const warnings = checkAllergenConflicts(food.allergens, patientAllergens)
        for (const w of warnings) {
          toast.warning(`Allergenwarnung: ${food.name} enthält ${w.allergenLabel}`)
        }
      }
    }
  }

  const handleSelectRecipe = (recipeId: string) => {
    addEntry(activeSlot, { type: "recipe", referenceId: recipeId, amount: 1 })
    setCommandOpen(false)
    setFoodCommandQuery("")

    if (patientAllergens.length > 0) {
      const recipe = recipeMap.get(recipeId)
      if (recipe?.allergens?.length) {
        const warnings = checkAllergenConflicts(recipe.allergens, patientAllergens)
        for (const w of warnings) {
          toast.warning(`Allergenwarnung: ${recipe.name} enthält ${w.allergenLabel}`)
        }
      }
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setDate(format(date, "yyyy-MM-dd"))
      setCalendarOpen(false)
    }
  }

  const handleDropPayload = async (slotType: MealSlotType, payload: { type: MealEntry["type"]; referenceId: string }) => {
    if (payload.type === "recipe") {
      addEntry(slotType, { type: "recipe", referenceId: payload.referenceId, amount: 1 })
    } else {
      const food = await hydrateFood(payload.referenceId)
      if (food) addEntry(slotType, { type: "food", referenceId: food.id, amount: 120 })
    }
  }

  const handleQuickAddRecipe = (recipeId: string) => {
    addEntry(paletteSlot, { type: "recipe", referenceId: recipeId, amount: 1 })
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
    if (exchangeEntryId) {
      const slot = currentPlan.slots.find((item) => item.type === exchangeSlot)
      const existing = slot?.entries.find((entry) => entry.id === exchangeEntryId)
      replaceEntry(exchangeSlot, exchangeEntryId, {
        type: "food",
        referenceId: food.id,
        amount: existing?.amount ?? 100,
      })
    } else {
      addEntry(exchangeSlot, { type: "food", referenceId: food.id, amount: 100 })
    }
    setExchangeDialogOpen(false)
    setExchangeSlot(null)
    setExchangeEntryId(null)
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
  const planProdScore = useMemo(() => calculateProdScore(dailyNutrients), [dailyNutrients])
  const positivePlanDrivers = useMemo(
    () =>
      planProdScore.drivers
        .filter((driver) => driver.impact > 0)
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 2),
    [planProdScore],
  )
  const negativePlanDrivers = useMemo(
    () =>
      planProdScore.drivers
        .filter((driver) => driver.impact < 0)
        .sort((a, b) => a.impact - b.impact)
        .slice(0, 2),
    [planProdScore],
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
        const value = getNutrientValue(summed, target.nutrientId)
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

  const filteredRecipes = useMemo(() => {
    const search = recipeSearch.toLowerCase()
    return recipes.filter((recipe) =>
      recipe.name.toLowerCase().includes(search) || recipe.tags?.some((tag) => tag.toLowerCase().includes(search)),
    )
  }, [recipeSearch, recipes])

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

  const baseWeekStart = startOfWeek(parsedDate, { weekStartsOn: 1 })
  const computedWeekStart = addWeeks(baseWeekStart, weekOffset)
  const computedWeekStartIso = format(computedWeekStart, "yyyy-MM-dd")
  const weekPlans = useMemo(() => getPlansInRange(computedWeekStartIso, 7), [computedWeekStartIso, getPlansInRange])
  const weekRangeLabel = `${format(computedWeekStart, "d. MMM", { locale: de })} – ${format(
    addDays(computedWeekStart, 6),
    "d. MMM yyyy",
    { locale: de },
  )}`

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

  const updateCurrentPlanStatus = (status: NonNullable<DailyMealPlan["status"]>) => {
    if (status === "approved" && clinicalReview.blockingItems.length > 0) {
      toast.error("Freigabe blockiert: Bitte kritische Prüfpunkte klären.")
      return
    }

    const wasApproved = currentPlan.status === "approved"
    updatePlanMetadata(currentDate, {
      status,
      approvedAt: status === "approved" ? currentPlan.approvedAt ?? new Date().toISOString() : undefined,
      approvedBy: status === "approved" ? currentPlan.approvedBy : undefined,
    })
    toast.success(`Planstatus: ${PLAN_STATUS_LABELS[status]}`)

    // Snapshots are written by the hook after persistence completes; give that
    // round-trip a moment to land before refetching the version list so the
    // newly-approved revision shows up in the history immediately.
    if (status === "approved" && !wasApproved) {
      window.setTimeout(() => {
        void refreshMealPlanVersions()
      }, 800)
    }
  }

  const attachCurrentPatient = () => {
    if (!patientId) return
    updatePlanMetadata(currentDate, {
      patientId,
      title: currentPlan.title ?? (patient ? `Ernährungsplan ${patient.firstName} ${patient.lastName}` : undefined),
    })
    toast.success("Patientenkontext am Plan gespeichert.")
  }

  const reopenCurrentPlan = () => {
    reopenPlan(currentDate)
    toast.success("Plan wurde als Entwurf wieder geöffnet.")
  }

  const restoreVersion = (version: MealPlanVersion) => {
    if (currentPlan.status === "approved") {
      toast.error("Freigegebene Pläne vor dem Wiederherstellen als Entwurf öffnen.")
      return
    }

    restorePlanVersion(currentDate, version.snapshot)
    toast.success(`Version ${version.versionNumber} wurde als Entwurf übernommen.`)
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
      const value = getNutrientValue(dailyNutrients, target.nutrientId)
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
      id: "prodiscore",
      label: "PRODIscore",
      description: `${formatNumber(planProdScore.score, 0)} Punkte: ${planProdScore.summary}`,
      severity: planProdScore.score < 60 ? "warning" : "ok",
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
    planProdScore.score,
    planProdScore.summary,
  ])

  const filteredTemplates = useMemo(() => {
    const query = applyTemplateSearch.trim().toLowerCase()
    return mealPlanTemplates.filter((template) => {
      if (applyTemplateScope === "indikation" && patient?.indication) {
        if (template.indication?.toLowerCase() !== patient.indication.toLowerCase()) {
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
  }, [applyTemplateScope, applyTemplateSearch, dietLineId, mealPlanTemplates, patient?.indication])

  const openApplyTemplateDialog = useCallback(() => {
    setApplyTemplateSearch("")
    setApplyTemplateScope(patient?.indication ? "indikation" : "alle")
    setApplyTemplateDialogOpen(true)
  }, [patient?.indication])

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
    setTemplateDraftIndication(patient?.indication ?? "")
    setTemplateDraftDietLineId(dietLineId || "")
    setSaveTemplateDialogOpen(true)
  }, [currentPlan.slots, currentPlan.title, dietLineId, patient?.indication])

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
        patientIndication: patient?.indication,
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
        description={`Steuerung für Tag, Woche oder Zyklus – aktuell ${formattedDate}`}
        helpText="Planen Sie Mahlzeiten für einzelne Tage, Wochen oder Zyklen. Der PRODIscore zeigt die Qualität der Planung an und vergleicht die Nährstoffzufuhr mit den DGE-Referenzwerten."
      />

      {patientId && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">
                Patientenkontext: {patient ? `${patient.firstName} ${patient.lastName}` : "Patient wird geladen"}
              </p>
              <p className="text-muted-foreground">
                DGE-Referenzen und Allergenwarnungen werden für diesen Kontext ausgewertet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{refConfig.standardId.toUpperCase()}</Badge>
              {patient?.indication && <Badge variant="outline">{patient.indication}</Badge>}
              {patientAllergens.length > 0 && (
                <Badge variant="outline">{patientAllergens.length} Allergen-/Intoleranzhinweise</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Planakte</CardTitle>
              <CardDescription>
                Titel, Status und klinische Hinweise für den aktuellen Tagesplan.
              </CardDescription>
            </div>
            <Badge variant={currentPlan.status === "approved" ? "secondary" : "outline"}>
              {PLAN_STATUS_LABELS[currentPlan.status ?? "draft"]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-muted-foreground">Titel</p>
              <Input
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
              <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
              <Select value={currentPlan.status ?? "draft"} onValueChange={(value) => updateCurrentPlanStatus(value as NonNullable<DailyMealPlan["status"]>)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} disabled={value === "approved" && !clinicalReview.canApprove}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Hinweise</p>
              <Textarea
                key={`notes-${currentPlan.id}-${currentPlan.date}`}
                defaultValue={currentPlan.notes ?? ""}
                placeholder="Indikation, Beratungshinweise, Patientenvorlieben oder interne Prüfnotizen"
                rows={2}
                readOnly={currentPlan.status === "approved"}
                onBlur={(event) => {
                  if (event.currentTarget.value.trim() !== (currentPlan.notes ?? "")) {
                    saveCurrentPlanNotes(event.currentTarget.value)
                  }
                }}
              />
            </div>
          </div>
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Patient</span>
              <span className="text-right font-medium">
                {currentPlan.patientId
                  ? patient && currentPlan.patientId === patient.id
                    ? `${patient.firstName} ${patient.lastName}`
                    : "zugeordnet"
                  : "nicht zugeordnet"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Freigabe</span>
              <span className="text-right font-medium">
                {currentPlan.approvedAt ? format(parseISO(currentPlan.approvedAt), "dd.MM.yyyy HH:mm") : "offen"}
              </span>
            </div>
            {currentPlan.status === "approved" && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Bearbeitung</span>
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  gesperrt
                </span>
              </div>
            )}
            {patientId && currentPlan.patientId !== patientId && (
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={attachCurrentPatient}>
                Patient zuordnen
              </Button>
            )}
            {currentPlan.status === "approved" && (
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={reopenCurrentPlan}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Als Entwurf öffnen
              </Button>
            )}
          </div>
          <div className="rounded-md border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ClipboardCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Klinische Freigabeprüfung</p>
                  <p className="text-xs text-muted-foreground">
                    {clinicalReview.canApprove
                      ? clinicalReview.warningItems.length > 0
                        ? `${clinicalReview.warningItems.length} Hinweise prüfen; Freigabe ist möglich.`
                        : "Alle kritischen Prüfpunkte sind erfüllt."
                      : `${clinicalReview.blockingItems.length} kritische Prüfpunkte blockieren die Freigabe.`}
                  </p>
                </div>
              </div>
              <Badge className={reviewSeverityBadgeClass(clinicalReview.canApprove ? "ok" : "critical")} variant="outline">
                {clinicalReview.canApprove ? "freigabereif" : "blockiert"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {clinicalReview.items.map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center gap-2">
                    {item.severity === "ok" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className={item.severity === "critical" ? "h-3.5 w-3.5 text-red-600" : "h-3.5 w-3.5 text-amber-600"} />
                    )}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <History className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Versionshistorie</p>
                  <p className="text-xs text-muted-foreground">
                    Freigaben werden als unveränderliche Snapshots gespeichert.
                  </p>
                </div>
              </div>
              <Badge variant="outline">
                {mealPlanVersionsLoading ? "lädt" : `${mealPlanVersions.length} Versionen`}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {mealPlanVersions.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Noch keine freigegebene Version für diesen Tagesplan.
                </p>
              )}
              {mealPlanVersions.slice(0, 3).map((version) => {
                const entryCount = version.snapshot.slots.reduce(
                  (sum, slot) => sum + slot.entries.length,
                  0,
                )
                return (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        Version {version.versionNumber} · {format(parseISO(version.createdAt), "dd.MM.yyyy HH:mm")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {entryCount} Einträge · {version.reason === "approved" ? "Freigabe" : version.reason}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPlan.status === "approved"}
                      onClick={() => restoreVersion(version)}
                    >
                      Wiederherstellen
                    </Button>
                  </div>
                )
              })}
              {currentPlan.status === "approved" && mealPlanVersions.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Zum Wiederherstellen zuerst den Plan als Entwurf öffnen.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PRODIscore Tagesplan</CardTitle>
            <CardDescription>Qualität der heutigen Planung auf einen Blick.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Ø Score</p>
                <p className="text-3xl font-semibold">{formatNumber(planProdScore.score, 0)}</p>
                <p className="text-muted-foreground text-xs">{planProdScore.summary}</p>
              </div>
              <Badge className={`${planProdScore.badge.color} border-none px-3 py-1 text-xs font-bold`}>
                PRODIscore {planProdScore.badge.label}
              </Badge>
            </div>
            <Progress value={planProdScore.score} />
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              {positivePlanDrivers.map((driver) => (
                <div key={driver.id} className="rounded-md bg-emerald-50/70 p-2">
                  <p className="font-medium">{driver.label}</p>
                  <p className="text-muted-foreground">{driver.description}</p>
                </div>
              ))}
              {negativePlanDrivers.map((driver) => (
                <div key={driver.id} className="rounded-md bg-red-50/70 p-2">
                  <p className="font-medium">{driver.label}</p>
                  <p className="text-muted-foreground">{driver.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nachhaltigkeit</CardTitle>
            <CardDescription>CO₂-Fußabdruck & Top-Verursacher des Plans.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-semibold">
                  {formatNumber(planSustainability.totalCo2, 2)} kg CO₂e
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Pflanzlich</p>
                <p className="font-semibold">
                  {formatNumber(planSustainability.plantShare * 100, 0)}%
                </p>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Pflanzlich</span>
                <span>{formatNumber(planSustainability.plantShare * 100, 0)}%</span>
              </div>
              <Progress value={planSustainability.plantShare * 100} />
              <div className="mt-2 mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Tierisch</span>
                <span>{formatNumber(planSustainability.animalShare * 100, 0)}%</span>
              </div>
              <Progress value={planSustainability.animalShare * 100} className="bg-orange-100" />
            </div>
            <div className="space-y-1 text-xs">
              {planSustainability.topEmitters.slice(0, 3).map((emitter) => (
                <div key={emitter.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {MEAL_SLOT_LABELS[emitter.slot] ?? emitter.slot}
                    </Badge>
                    <span>{emitter.label}</span>
                  </div>
                  <span className="font-medium">
                    {formatNumber(emitter.co2, 2)} kg
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="day">Tag</TabsTrigger>
          <TabsTrigger value="week">Woche</TabsTrigger>
          <TabsTrigger value="cycle">4-Wochen-Zyklus</TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Vorheriger Tag</span>
            </Button>
            <div className="text-sm font-medium capitalize">{formattedDate}</div>
            <Button variant="outline" size="icon" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Nächster Tag</span>
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="sr-only">Datum wählen</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={parsedDate} onSelect={handleDateSelect} locale={de} />
              </PopoverContent>
            </Popover>
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={dietLineId}
                onValueChange={handleDietLineChange}
                disabled={currentPlan.status === "approved"}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Kostform/Zielprofil" />
                </SelectTrigger>
                <SelectContent>
                  {dietLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}{line.userId ? " (eigene)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={openDietLineEditor}>
                <Settings2 className="h-4 w-4" />
                <span className="sr-only">Zielprofil verwalten</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LayoutTemplate className="mr-2 h-4 w-4" />
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
                        {patient?.indication
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Plan exportieren
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>PDF-Export</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleExportPlan("clinical")}>
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Klinischer Bericht</span>
                      <span className="text-muted-foreground text-xs">Soll-/Ist-Abgleich, Vitamine, Mineralstoffe</span>
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
                      <span className="text-muted-foreground text-xs">7-Tage-Aushang für Küche & Station</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

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
                <CardHeader>
                  <CardTitle className="text-base">Kostform- und Zielvorgaben</CardTitle>
                  <CardDescription>
                    {dietLine?.description ?? (dietLinesLoading ? "Zielprofile werden geladen" : "Ziele setzen")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dietLineCompliance.length === 0 && (
                    <p className="text-muted-foreground text-sm">Noch keine Zielwerte gepflegt.</p>
                  )}
                  {dietLineCompliance.map((target) => (
                    <div key={target.label} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{target.label}</p>
                        <p className="text-muted-foreground text-xs">
                          Ziel {target.min != null ? formatNumber(target.min, 0) : "–"}–
                          {target.max != null ? formatNumber(target.max, 0) : "–"} {target.unit}
                        </p>
                      </div>
                      <Badge
                        variant={target.status === "ok" ? "secondary" : "outline"}
                        className={
                          target.status === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : target.status === "low"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }
                      >
                        {formatNumber(target.value, 0)} {target.unit}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tagesübersicht</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/30">
                      <p className="text-muted-foreground text-xs">Energie</p>
                      <p className="text-lg font-bold">{formatNumber(Math.round(totalKcal))} kcal</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                      <p className="text-muted-foreground text-xs">Eiweiß</p>
                      <p className="text-lg font-bold">{formatNutrient(totalProtein, "g")}</p>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/30">
                      <p className="text-muted-foreground text-xs">Fett</p>
                      <p className="text-lg font-bold">{formatNutrient(totalFat, "g")}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                      <p className="text-muted-foreground text-xs">Kohlenhydrate</p>
                      <p className="text-lg font-bold">{formatNutrient(totalCarbs, "g")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nährstoffe vs. DGE-Referenz</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base">Rezeptbibliothek (Drag & Drop)</CardTitle>
                  <CardDescription>
                    Ziehe Rezepte direkt in einen Slot oder füge sie per Klick hinzu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Rezepte durchsuchen..."
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                  <Select value={paletteSlot} onValueChange={(value) => setPaletteSlot(value as MealSlotType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Slot wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEAL_SLOT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ScrollArea className="h-[360px] pr-2">
                    <div className="space-y-2">
                      {filteredRecipes.map((recipe) => (
                        <div
                          key={recipe.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData(MEAL_PLAN_DRAG_TYPE, "recipe")
                            event.dataTransfer.setData(MEAL_PLAN_DRAG_ID, recipe.id)
                            event.dataTransfer.effectAllowed = "copy"
                          }}
                          className="cursor-grab rounded-lg border p-3 transition hover:bg-muted active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium leading-tight">{recipe.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {(recipe.tags ?? []).slice(0, 2).join(", ") || recipe.category}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleQuickAddRecipe(recipe.id)}>
                              In {MEAL_SLOT_LABELS[paletteSlot]}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filteredRecipes.length === 0 && (
                        <p className="text-muted-foreground text-sm">Keine passenden Rezepte gefunden.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {exchangeEntryId ? "Eintrag austauschen" : "Austauschliste"} für{" "}
              {exchangeSlot ? MEAL_SLOT_LABELS[exchangeSlot] : "Slot"}
            </DialogTitle>
            <DialogDescription>
              Filtere nach Kategorie oder Nährstoff. Beim Austauschen bleibt die bisherige Menge erhalten.
            </DialogDescription>
          </DialogHeader>
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
          <div className="mt-4 max-h-[360px] overflow-hidden rounded-md border">
            <ScrollArea className="h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lebensmittel</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">
                      {nutrientDefMap.get(exchangeNutrient)?.shortName ?? exchangeNutrient}
                    </TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExchangeFoods.slice(0, 20).map((food) => {
                    const nutrientVal = exchangeNutrientValues.get(food.id) ?? 0
                    const category = FOOD_CATEGORIES.find((cat) => cat.id === food.categoryId)
                    return (
                      <TableRow key={food.id}>
                        <TableCell className="font-medium">{food.name}</TableCell>
                        <TableCell className="text-muted-foreground">{category?.name ?? "–"}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(nutrientVal, 1)} {nutrientDefMap.get(exchangeNutrient)?.unit}
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
                {patient?.indication && (
                  <Button
                    size="sm"
                    variant={applyTemplateScope === "indikation" ? "default" : "outline"}
                    onClick={() => setApplyTemplateScope("indikation")}
                  >
                    {patient.indication}
                  </Button>
                )}
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
    </div>
  )
}
