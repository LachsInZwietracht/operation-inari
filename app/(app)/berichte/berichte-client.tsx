"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import type { TooltipProps } from "recharts"
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FileText,
  Leaf,
  ListChecks,
  Scale,
  Trash2,
  Pencil,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { NutrientChart, type NutrientChartDataPoint } from "@/components/nutrient-chart"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { useReportTemplates } from "@/hooks/use-report-templates"
import { FOOD_CATEGORIES } from "@/lib/data/food-categories"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import {
  scaleNutrients,
  sumNutrients,
  calculateRecipeNutrients,
  calculatePerServing,
  getNutrientValue,
  percentOfReference,
} from "@/lib/nutrients"
import { formatNumber, formatNutrient, formatPercent, formatDate } from "@/lib/format"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type {
  DailyMealPlan,
  Food,
  MealEntry,
  NutrientValue,
  Recipe,
  ReportTemplate,
  ReportExportRequest,
} from "@/lib/types"
import { toast } from "sonner"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import { getReferenceAmount } from "@/lib/reference-values"
import { createRecipeLookup } from "@/lib/recipes"
import { useFoods } from "@/components/foods-provider"
import { loadBrowserMealPlans } from "@/lib/data/meal-plan-browser-source"
import { downloadResponseFile } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPORT_SECTIONS = [
  {
    id: "summary",
    label: "Kurzfazit & Indikatoren",
    description: "PRODIscore, Energie- und Makroabdeckung in Stichpunkten",
  },
  {
    id: "table",
    label: "Nährstofftabellen",
    description: "Detailtabellen für Makros, Vitamine und Mineralstoffe",
  },
  {
    id: "charts",
    label: "Diagramme",
    description: "Verteilungsdiagramme für Makros und Mahlzeiten",
  },
  {
    id: "meals",
    label: "Speiseplanübersicht",
    description: "Mahlzeitenliste inkl. wichtiger Komponenten",
  },
  {
    id: "notes",
    label: "Individuelle Hinweise",
    description: "Freitext und Beratungsnotizen",
  },
] as const

type ReportSectionId = (typeof REPORT_SECTIONS)[number]["id"]

const MACRO_COLORS = ["#0ea5e9", "#f97316", "#22c55e", "#a855f7", "#e11d48"]
const RECIPE_PORTION_WEIGHT_G = 350
const DEFAULT_TABLE_NUTRIENTS = [
  "energie",
  "eiweiss",
  "fett",
  "gesaettigte_fettsaeuren",
  "kohlenhydrate",
  "ballaststoffe",
  "zucker",
  "ungesaettigte_fettsaeuren",
]

const LMIV_FIELDS = [
  { id: "energie", label: "Brennwert", unit: "kcal" },
  { id: "fett", label: "Fett", unit: "g" },
  { id: "gesaettigte_fettsaeuren", label: "davon gesättigte Fettsäuren", unit: "g" },
  { id: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
  { id: "zucker", label: "davon Zucker", unit: "g" },
  { id: "ballaststoffe", label: "Ballaststoffe", unit: "g" },
  { id: "eiweiss", label: "Eiweiß", unit: "g" },
]

const PLACEHOLDER_FIELDS = [
  { token: "{{patientName}}", label: "Patient" },
  { token: "{{planDate}}", label: "Plan-Datum" },
  { token: "{{energyCoverage}}", label: "Energie %" },
  { token: "{{co2}}", label: "CO₂" },
  { token: "{{dietLine}}", label: "Diet Line" },
  { token: "{{focus}}", label: "Therapie-Fokus" },
]

const HEALTH_CLAIM_RULES = [
  {
    id: "fiber",
    label: "Ballaststoffreich",
    condition: (data: { fiberPer100: number }) => data.fiberPer100 >= 6,
    note: "≥ 6 g Ballaststoffe pro 100 g",
  },
  {
    id: "protein",
    label: "Proteinquelle",
    condition: (data: { proteinPercentEnergy: number }) => data.proteinPercentEnergy >= 12,
    note: "Mind. 12 % der Energie aus Protein",
  },
  {
    id: "fat",
    label: "Arm an gesättigten Fettsäuren",
    condition: (data: { satFatPercent: number }) => data.satFatPercent <= 10,
    note: "≤ 10 % gesättigte Fettsäuren",
  },
]

type FoodResolver = (referenceId: string) => Food | undefined

function getEntryNutrientValues(
  entry: MealEntry,
  resolveFood: FoodResolver,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): NutrientValue[] {
  if (entry.type === "food") {
    const food = resolveFood(entry.referenceId)
    if (!food) return []
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount)
  }
  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return []
  const totalRecipeNutrients = calculateRecipeNutrients(recipe, foods)
  const perServing = calculatePerServing(totalRecipeNutrients, recipe.servings)
  return scaleNutrients(perServing, 1, entry.amount)
}

function getEntryEnergy(
  entry: MealEntry,
  resolveFood: FoodResolver,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): number {
  const nutrients = getEntryNutrientValues(entry, resolveFood, recipeMap, foods)
  return getNutrientValue(nutrients, "energie")
}

function getEntryLabel(
  entry: MealEntry,
  resolveFood: FoodResolver,
  recipeMap: Map<string, Recipe>,
): string {
  if (entry.type === "food") {
    return resolveFood(entry.referenceId)?.name ?? "Unbekanntes Lebensmittel"
  }
  return recipeMap.get(entry.referenceId)?.name ?? "Unbekanntes Rezept"
}

function getEntryWeight(entry: MealEntry): number {
  if (entry.type === "food") {
    return entry.amount
  }
  return entry.amount * RECIPE_PORTION_WEIGHT_G
}

function getEntryCo2(
  entry: MealEntry,
  resolveFood: FoodResolver,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): number {
  if (entry.type === "food") {
    const food = resolveFood(entry.referenceId)
    if (!food) return 0
    if (food.co2PerPortion) {
      const referenceAmount = food.portionSizes?.[0]?.amount ?? food.baseAmount ?? 100
      const perGram = food.co2PerPortion / referenceAmount
      return perGram * entry.amount
    }
    const energyKcal = getEntryEnergy(entry, resolveFood, recipeMap, foods)
    return energyKcal * 0.00045
  }
  const recipe = recipeMap.get(entry.referenceId)
  if (!recipe) return 0
  if (recipe.co2PerPortion) {
    return recipe.co2PerPortion * entry.amount
  }
  const energyKcal = getEntryEnergy(entry, resolveFood, recipeMap, foods)
  return energyKcal * 0.0005
}

function calculatePlanNutrients(
  plan: DailyMealPlan,
  resolveFood: FoodResolver,
  recipeMap: Map<string, Recipe>,
  foods: Food[],
): NutrientValue[] {
  const arrays: NutrientValue[][] = []

  for (const slot of plan.slots) {
    for (const entry of slot.entries) {
      const nutrients = getEntryNutrientValues(entry, resolveFood, recipeMap, foods)
      if (nutrients.length > 0) {
        arrays.push(nutrients)
      }
    }
  }

  return sumNutrients(arrays)
}

// getReferenceForNutrient is now resolved via refConfig from the hook

function getStatusColor(percent: number): string {
  if (percent >= 80) return "var(--color-chart-2)" // green
  if (percent >= 50) return "var(--color-chart-4)" // yellow / amber
  return "var(--color-chart-5)" // red
}

// ---------------------------------------------------------------------------
// Percent Bar Tooltip
// ---------------------------------------------------------------------------

interface PercentDataPoint {
  name: string
  percent: number
  value: number
  reference: number
  unit: string
}

interface PercentTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: PercentDataPoint }>
  label?: string
}

function PercentTooltip({ active, payload, label }: PercentTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as PercentDataPoint | undefined
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-sm">
        Istwert: {formatNumber(point.value, 1)} {point.unit}
      </p>
      <p className="text-muted-foreground text-sm">
        Referenz: {formatNumber(point.reference, 1)} {point.unit}
      </p>
      <p className="text-muted-foreground text-sm">
        Abdeckung: {formatPercent(point.percent)}
      </p>
    </div>
  )
}

interface SimpleTooltipPayload {
  name: string
  energie: number
}

type ChartTooltipProps<TPayload> = TooltipProps<number, string> & {
  payload?: Array<{ payload?: TPayload }>
}

function MealEnergyTooltip({ active, payload }: ChartTooltipProps<SimpleTooltipPayload>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as SimpleTooltipPayload | undefined
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(point.energie, 0)} kcal
      </p>
    </div>
  )
}

interface ContributionPayload {
  name: string
  energie: number
  share: number
}

function ContributionTooltip({ active, payload }: ChartTooltipProps<ContributionPayload>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as ContributionPayload | undefined
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(point.energie, 0)} kcal ({formatPercent(point.share)})
      </p>
    </div>
  )
}

function MacroPieTooltip({ active, payload }: ChartTooltipProps<{ name: string; value: number; unit: string }>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as { name: string; value: number; unit: string } | undefined
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(point.value, 1)} {point.unit}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

interface BerichtePageClientProps {
  recipes: Recipe[]
  basePlans: DailyMealPlan[]
}

export function BerichtePageClient({ recipes, basePlans }: BerichtePageClientProps) {
  const foods = useFoods()
  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods])
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes])
  const categoryMap = useMemo(() => new Map(FOOD_CATEGORIES.map((category) => [category.id, category])), [])
  const resolveFood = useCallback(
    (referenceId: string) => foodMap.get(referenceId),
    [foodMap],
  )
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [allPlans, setAllPlans] = useState<DailyMealPlan[]>(basePlans)
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")
  const [reportLength, setReportLength] = useState<"short" | "full">("short")
  const [customNotes, setCustomNotes] = useState("")
  const [selectedSections, setSelectedSections] = useState<Record<ReportSectionId, boolean>>(() => {
    return REPORT_SECTIONS.reduce((acc, section) => {
      acc[section.id] = true
      return acc
    }, {} as Record<ReportSectionId, boolean>)
  })
  const [visibleNutrientIds, setVisibleNutrientIds] = useState<string[]>(DEFAULT_TABLE_NUTRIENTS)
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useReportTemplates()
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: "", category: "", content: "" })
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      const plans = await loadBrowserMealPlans(basePlans, foods)
      if (!cancelled) {
        setAllPlans(plans)
      }
    }

    void loadPlans()

    return () => {
      cancelled = true
    }
  }, [basePlans, foods])

  // Default selection
  useEffect(() => {
    if (!selectedPlanId && allPlans.length > 0) {
      setSelectedPlanId(allPlans[0].id)
    }
  }, [allPlans, selectedPlanId])

  const selectedPlan = useMemo(
    () => allPlans.find((p) => p.id === selectedPlanId),
    [allPlans, selectedPlanId],
  )

  const planNutrients = useMemo(
    () => (selectedPlan ? calculatePlanNutrients(selectedPlan, resolveFood, recipeMap, foods) : []),
    [selectedPlan, resolveFood, recipeMap, foods],
  )

  const planEntries = useMemo(
    () =>
      selectedPlan
        ? selectedPlan.slots.flatMap((slot) => slot.entries.map((entry) => ({ slotType: slot.type, entry })))
        : [],
    [selectedPlan],
  )

  const totalPlanWeight = useMemo(
    () => planEntries.reduce((sum, item) => sum + getEntryWeight(item.entry), 0),
    [planEntries],
  )

  const { getResolvedConfig } = useReferenceProfiles()
  const refConfig = useMemo(() => {
    return getResolvedConfig({
      dateOfBirth: "1990-01-01",
      gender: "w",
    })
  }, [getResolvedConfig])

  // ---- Macro data --------------------------------------------------------

  const macroIds = ["eiweiss", "fett", "kohlenhydrate", "ballaststoffe"]
  const macroChartData: NutrientChartDataPoint[] = macroIds.map((id) => {
    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
    return {
      name: def.name,
      value: getNutrientValue(planNutrients, id),
      reference: getReferenceAmount(refConfig, id),
      unit: def.unit,
    }
  })

  const macroPieData = macroChartData
    .map((item, index) => ({
      name: item.name,
      value: Math.max(0, item.value),
      color: MACRO_COLORS[index % MACRO_COLORS.length],
      unit: item.unit,
    }))
    .filter((item) => item.value > 0)

  const energieValue = getNutrientValue(planNutrients, "energie")
  const energieRef = getReferenceAmount(refConfig, "energie")
  const energieDef = NUTRIENT_DEFINITIONS.find((d) => d.id === "energie")!
  const energyCoverage = percentOfReference(energieValue, energieRef)

  const macroTableIds = DEFAULT_TABLE_NUTRIENTS

  const mealEnergyData = useMemo(() => {
    if (!selectedPlan) return []
    return selectedPlan.slots.map((slot) => {
      const energy = slot.entries.reduce(
        (sum, entry) => sum + getEntryEnergy(entry, resolveFood, recipeMap, foods),
        0,
      )
      return {
        name: MEAL_SLOT_LABELS[slot.type],
        energie: Math.round(energy),
      }
    })
  }, [selectedPlan, resolveFood, recipeMap, foods])

  const totalMealEnergy = mealEnergyData.reduce((sum, meal) => sum + meal.energie, 0)

  const foodContributionData = useMemo(() => {
    if (!selectedPlan || totalMealEnergy === 0) return []
    const contributions = new Map<string, number>()
    for (const slot of selectedPlan.slots) {
      for (const entry of slot.entries) {
        const energy = getEntryEnergy(entry, resolveFood, recipeMap, foods)
        if (energy <= 0) continue
        const key = getEntryLabel(entry, resolveFood, recipeMap)
        contributions.set(key, (contributions.get(key) ?? 0) + energy)
      }
    }
    return [...contributions.entries()]
      .map(([name, energie]) => ({ name, energie, share: (energie / totalMealEnergy) * 100 }))
      .sort((a, b) => b.energie - a.energie)
      .slice(0, 6)
  }, [selectedPlan, totalMealEnergy, resolveFood, recipeMap, foods])

  // ---- Vitamin data -------------------------------------------------------

  const vitaminDefs = NUTRIENT_DEFINITIONS.filter((d) => d.group === "vitamine").sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const vitaminPercentData = vitaminDefs.map((def) => {
    const value = getNutrientValue(planNutrients, def.id)
    const ref = getReferenceAmount(refConfig, def.id)
    const pct = percentOfReference(value, ref)
    return { name: def.shortName, percent: pct, value, reference: ref, unit: def.unit }
  })

  // ---- Mineral data -------------------------------------------------------

  const mineralDefs = NUTRIENT_DEFINITIONS.filter((d) => d.group === "mineralstoffe").sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const mineralPercentData = mineralDefs.map((def) => {
    const value = getNutrientValue(planNutrients, def.id)
    const ref = getReferenceAmount(refConfig, def.id)
    const pct = percentOfReference(value, ref)
    return { name: def.shortName, percent: pct, value, reference: ref, unit: def.unit }
  })

  const nutrientDisplayOptions = useMemo(() => {
    const optionalIds = [...vitaminDefs.slice(0, 4), ...mineralDefs.slice(0, 4)].map((def) => def.id)
    const uniqueIds = Array.from(new Set([...macroTableIds, ...optionalIds]))
    return uniqueIds.map((id) => {
      const definition = NUTRIENT_DEFINITIONS.find((n) => n.id === id)
      return {
        id,
        label: definition?.name ?? id,
        unit: definition?.unit ?? "",
      }
    })
  }, [macroTableIds, vitaminDefs, mineralDefs])

  const displayedNutrientIds = visibleNutrientIds.length ? visibleNutrientIds : macroTableIds

  const macroHighlights = macroChartData.map((item) => ({
    name: item.name,
    percent: percentOfReference(item.value, item.reference),
    value: item.value,
    unit: item.unit,
  }))

  const micronutrientAlerts = useMemo(() => {
    const combined = [...vitaminPercentData, ...mineralPercentData]
    const low = combined.filter((entry) => entry.percent < 80).slice(0, 3)
    return low
  }, [vitaminPercentData, mineralPercentData])

  const planPreviewRows = useMemo(() => {
    if (!selectedPlan) return []
    return selectedPlan.slots.map((slot) => {
      const items = slot.entries
        .map((entry) => getEntryLabel(entry, resolveFood, recipeMap))
        .join(", ")
      return {
        slot: MEAL_SLOT_LABELS[slot.type],
        summary: items || "Keine Einträge",
      }
    })
  }, [selectedPlan, resolveFood, recipeMap])

  const analysisNarrative = useMemo(() => {
    if (!selectedPlan) return "Kein Ernährungsplan ausgewählt."
    const macroSentence = macroHighlights
      .map((highlight) => `${highlight.name}: ${formatPercent(highlight.percent)}`)
      .join(" · ")
    const microSentence = micronutrientAlerts.length
      ? `Auffällig niedrig: ${micronutrientAlerts
          .map((entry) => `${entry.name} (${formatPercent(entry.percent)})`)
          .join(", " )}.`
      : "Alle geprüften Mikronährstoffe liegen im Sollbereich."
    return `Der ausgewählte Tagesplan deckt ${formatPercent(energyCoverage)} des Energiebedarfs.
Makronährstoffprofil: ${macroSentence}.
${microSentence}`
  }, [selectedPlan, energyCoverage, macroHighlights, micronutrientAlerts])

  const previewSections = useMemo(
    () => REPORT_SECTIONS.filter((section) => selectedSections[section.id]),
    [selectedSections],
  )

  const selectedSectionCount = previewSections.length
  const planDateLabel = selectedPlan ? formatDate(selectedPlan.date) : ""

  const previewMicronutrients = useMemo(() => {
    const combined = [...vitaminPercentData, ...mineralPercentData]
    return combined
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5)
  }, [vitaminPercentData, mineralPercentData])

  const co2BySlot = useMemo(() => {
    if (!selectedPlan) return []
    return selectedPlan.slots.map((slot) => {
      const value = slot.entries.reduce(
        (sum, entry) => sum + getEntryCo2(entry, resolveFood, recipeMap, foods),
        0,
      )
      return {
        name: MEAL_SLOT_LABELS[slot.type],
        value,
      }
    })
  }, [selectedPlan, resolveFood, recipeMap, foods])

  const totalCo2 = co2BySlot.reduce((sum, entry) => sum + entry.value, 0)
  const co2Per100g = totalPlanWeight > 0 ? (totalCo2 / totalPlanWeight) * 100 : totalCo2
  const co2Category = totalCo2 <= 4 ? "niedrig" : totalCo2 <= 7 ? "mittel" : "hoch"

  const aggregatedAllergens = useMemo(() => {
    const values = new Set<string>()
    planEntries.forEach(({ entry }) => {
      if (entry.type === "food") {
        const food = resolveFood(entry.referenceId)
        food?.allergens?.forEach((allergen) => values.add(allergen))
      } else {
        const recipe = recipeMap.get(entry.referenceId)
        recipe?.allergens?.forEach((allergen) => values.add(allergen))
      }
    })
    return Array.from(values)
  }, [planEntries, resolveFood, recipeMap])

  const aggregatedAdditives = useMemo(() => {
    const values = new Set<string>()
    planEntries.forEach(({ entry }) => {
      if (entry.type === "food") {
        const food = resolveFood(entry.referenceId)
        food?.additives?.forEach((additive) => values.add(additive))
      } else {
        const recipe = recipeMap.get(entry.referenceId)
        recipe?.additives?.forEach((additive) => values.add(additive))
      }
    })
    return Array.from(values)
  }, [planEntries, resolveFood, recipeMap])

  const saltValue = useMemo(() => {
    const natrium = getNutrientValue(planNutrients, "natrium")
    return (natrium / 1000) * 2.5
  }, [planNutrients])

  const per100Factor = totalPlanWeight > 0 ? 100 / totalPlanWeight : 0

  const lmivRows = useMemo(() => {
    const rows = LMIV_FIELDS.map((field) => {
      const value = getNutrientValue(planNutrients, field.id)
      return {
        id: field.id,
        label: field.label,
        unit: field.unit,
        perPortion: value,
        per100: value * per100Factor,
      }
    })
    const saltRow = {
      id: "salt",
      label: "Salz",
      unit: "g",
      perPortion: saltValue,
      per100: saltValue * per100Factor,
    }
    return [...rows, saltRow]
  }, [planNutrients, per100Factor, saltValue])

  const energyKj = energieValue * 4.186

  const foodGroupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    planEntries.forEach(({ entry }) => {
      if (entry.type === "food") {
        const food = resolveFood(entry.referenceId)
        if (food) {
          counts.set(food.categoryId, (counts.get(food.categoryId) ?? 0) + 1)
        }
      } else {
        const recipe = recipeMap.get(entry.referenceId)
        if (recipe?.category) {
          counts.set(recipe.category, (counts.get(recipe.category) ?? 0) + 1)
        }
      }
    })
    return counts
  }, [planEntries, resolveFood, recipeMap])

  const uniqueGroupCount = foodGroupCounts.size
  const diversityTarget = 8
  const diversityPercent = diversityTarget > 0 ? Math.min(100, (uniqueGroupCount / diversityTarget) * 100) : 0
  const missingGroups = FOOD_CATEGORIES.filter((category) => !foodGroupCounts.has(category.id)).slice(0, 3)

  const fiberPer100 = totalPlanWeight > 0 ? (getNutrientValue(planNutrients, "ballaststoffe") / totalPlanWeight) * 100 : 0
  const proteinPercentEnergy = energieValue > 0 ? ((getNutrientValue(planNutrients, "eiweiss") * 4) / energieValue) * 100 : 0
  const satFatPercent = energieValue > 0 ? ((getNutrientValue(planNutrients, "gesaettigte_fettsaeuren") * 9) / energieValue) * 100 : 0

  const claimData = { fiberPer100, proteinPercentEnergy, satFatPercent }
  const healthClaimResults = HEALTH_CLAIM_RULES.map((rule) => ({
    ...rule,
    met: rule.condition(claimData),
  }))

  const combinedMicroAverage = previewMicronutrients.length
    ? previewMicronutrients.reduce((sum, entry) => sum + entry.percent, 0) / previewMicronutrients.length
    : 0
  const macroAverage = macroHighlights.length
    ? macroHighlights.reduce((sum, entry) => sum + Math.min(120, entry.percent), 0) / macroHighlights.length
    : 0
  const prodiScoreValue = Math.round(
    Math.min(100, macroAverage * 0.6 + Math.min(120, combinedMicroAverage) * 0.4),
  )
  const prodiLevel = prodiScoreValue >= 85 ? 5 : prodiScoreValue >= 70 ? 4 : prodiScoreValue >= 55 ? 3 : prodiScoreValue >= 40 ? 2 : 1
  const prodiLabel = ["kritisch", "ausbaufähig", "solide", "gut", "exzellent"][prodiLevel - 1]

  const placeholderValues = useMemo(
    () => ({
      patientName: "Max Beispiel",
      planDate: planDateLabel || "--",
      energyCoverage: formatPercent(energyCoverage),
      co2: `${formatNumber(totalCo2, 1)} kg`,
      dietLine: "Standard",
      focus:
        micronutrientAlerts[0]?.name
          ? `${micronutrientAlerts[0].name} (${formatPercent(micronutrientAlerts[0].percent)})`
          : "Makro-Balance",
      recommendation1: "Gemüseanteil steigern",
      recommendation2: "Fermentierte Produkte einbauen",
      trackingDays: "3",
      fiber: formatNumber(getNutrientValue(planNutrients, "ballaststoffe"), 1),
      fiberAssessment: fiberPer100 >= 6 ? "im Ziel" : "unter Referenz",
      actionItem: "zusätzliche Hülsenfrüchte",
      nextStep1: "CO₂-Monitor teilen",
      nextStep2: "Rezeptpool aktualisieren",
      claimTarget: String(healthClaimResults.filter((claim) => claim.met).length),
    }),
    [planDateLabel, energyCoverage, totalCo2, micronutrientAlerts, planNutrients, fiberPer100, healthClaimResults],
  )

  const resolvedNotes = useMemo(() => {
    return customNotes.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, token) => {
      const key = token.trim()
      return placeholderValues[key as keyof typeof placeholderValues] ?? match
    })
  }, [customNotes, placeholderValues])

  const reportPayload = useMemo<ReportExportRequest | null>(() => {
    if (!selectedPlan) return null

    return {
      format: "PDF",
      title: "Operation Prodi Bericht",
      fileBaseName: `prodi-bericht-${selectedPlan.date}`,
      planDateLabel,
      reportLength,
      selectedSections,
      activeSectionLabels: previewSections.map((section) => section.label),
      summaryMetrics: [
        {
          label: "Energieabdeckung",
          value: `${formatNumber(energieValue, 0)} ${energieDef.unit}`,
          reference: `${formatNumber(energieRef, 0)} ${energieDef.unit}`,
          coverage: formatPercent(energyCoverage),
        },
        ...macroHighlights.map((highlight) => ({
          label: highlight.name,
          value: `${formatNumber(highlight.value, 1)} ${highlight.unit}`,
          reference: undefined,
          coverage: formatPercent(highlight.percent),
        })),
      ],
      nutrientRows: displayedNutrientIds.map((id) => {
        const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
        const val = getNutrientValue(planNutrients, id)
        const ref = getReferenceAmount(refConfig, id)
        return {
          label: def.name,
          value: `${formatNumber(val, 1)} ${def.unit}`,
          reference: `${formatNumber(ref, 1)} ${def.unit}`,
          coverage: formatPercent(percentOfReference(val, ref)),
        }
      }),
      vitaminRows: vitaminDefs.map((def) => {
        const val = getNutrientValue(planNutrients, def.id)
        const ref = getReferenceAmount(refConfig, def.id)
        return {
          label: def.name,
          value: `${formatNumber(val, 1)} ${def.unit}`,
          reference: `${formatNumber(ref, 1)} ${def.unit}`,
          coverage: formatPercent(percentOfReference(val, ref)),
        }
      }),
      mineralRows: mineralDefs.map((def) => {
        const val = getNutrientValue(planNutrients, def.id)
        const ref = getReferenceAmount(refConfig, def.id)
        return {
          label: def.name,
          value: `${formatNumber(val, 1)} ${def.unit}`,
          reference: `${formatNumber(ref, 1)} ${def.unit}`,
          coverage: formatPercent(percentOfReference(val, ref)),
        }
      }),
      mealRows: planPreviewRows,
      notes: resolvedNotes,
      narrative: analysisNarrative,
      badges: [
        `Plan ${planDateLabel}`,
        reportLength === "short" ? "Kurzbericht" : "Vollversion",
        `${selectedSectionCount} Abschnitte`,
      ],
      specialNotes: [
        `CO₂ gesamt: ${formatNumber(totalCo2, 1)} kg`,
        `PRODIscore: ${prodiScoreValue} (${prodiLabel})`,
        `Health Claims: ${healthClaimResults.filter((claim) => claim.met).length}/${healthClaimResults.length}`,
      ],
    }
  }, [
    selectedPlan,
    planDateLabel,
    reportLength,
    selectedSections,
    previewSections,
    energieValue,
    energieDef.unit,
    energieRef,
    energyCoverage,
    macroHighlights,
    displayedNutrientIds,
    planNutrients,
    refConfig,
    vitaminDefs,
    mineralDefs,
    planPreviewRows,
    resolvedNotes,
    analysisNarrative,
    selectedSectionCount,
    totalCo2,
    prodiScoreValue,
    prodiLabel,
    healthClaimResults,
  ])

  const handleSectionToggle = (sectionId: ReportSectionId) => {
    setSelectedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  const handleReportLengthChange = (length: "short" | "full") => {
    setReportLength(length)
  }

  const handleExport = async (format: "pdf" | "csv") => {
    if (!reportPayload) return
    setIsExporting(true)
    try {
      const response = await fetch("/api/exports/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...reportPayload,
          format: format.toUpperCase(),
        }),
      })
      await downloadResponseFile(response, `${reportPayload.fileBaseName}.${format}`)
      toast.success(`Bericht als ${format.toUpperCase()} exportiert`)
    } catch (error) {
      toast.error((error as Error).message || "Bericht konnte nicht exportiert werden")
    } finally {
      setIsExporting(false)
    }
  }

  const handlePreview = async () => {
    if (!reportPayload || typeof window === "undefined") return
    setIsExporting(true)
    try {
      const response = await fetch("/api/exports/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...reportPayload,
          format: "PDF",
          disposition: "inline",
        }),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      setTimeout(() => URL.revokeObjectURL(url), 1000 * 60)
    } catch (error) {
      toast.error((error as Error).message || "Druckvorschau konnte nicht geöffnet werden")
    } finally {
      setIsExporting(false)
    }
  }

  const handleAdoptNarrative = () => {
    setCustomNotes((prev) => (prev ? `${prev}\n${analysisNarrative}` : analysisNarrative))
  }

  const handleInsertPlaceholder = (token: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart ?? customNotes.length
    const end = textarea.selectionEnd ?? customNotes.length
    const newValue = customNotes.slice(0, start) + token + customNotes.slice(end)
    setCustomNotes(newValue)
    requestAnimationFrame(() => {
      textarea.focus()
      const caret = start + token.length
      textarea.selectionStart = caret
      textarea.selectionEnd = caret
    })
  }

  const applyFormatting = (mode: "bold" | "italic" | "list") => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? 0
    const selection = customNotes.slice(start, end) || "Text"
    let insert = selection
    if (mode === "bold") {
      insert = `**${selection}**`
    } else if (mode === "italic") {
      insert = `*${selection}*`
    } else if (mode === "list") {
      const lineStart = customNotes.lastIndexOf("\n", start - 1) + 1
      const prefix = "- "
      const insertion = selection || "Eintrag"
      insert = `${prefix}${insertion}`
      const newValue =
        customNotes.slice(0, lineStart) + prefix + customNotes.slice(lineStart, start) + insertion + customNotes.slice(end)
      setCustomNotes(newValue)
      requestAnimationFrame(() => {
        textarea.focus()
        const caret = lineStart + insert.length
        textarea.selectionStart = caret
        textarea.selectionEnd = caret
      })
      return
    }
    const newValue = customNotes.slice(0, start) + insert + customNotes.slice(end)
    setCustomNotes(newValue)
    requestAnimationFrame(() => {
      textarea.focus()
      const caret = start + insert.length
      textarea.selectionStart = caret
      textarea.selectionEnd = caret
    })
  }

  const handleNutrientToggle = (nutrientId: string) => {
    setVisibleNutrientIds((prev) =>
      prev.includes(nutrientId)
        ? prev.filter((id) => id !== nutrientId)
        : [...prev, nutrientId],
    )
  }

  const handleResetNutrients = () => {
    setVisibleNutrientIds(DEFAULT_TABLE_NUTRIENTS)
  }

  const handleOpenTemplateDialog = (template?: ReportTemplate) => {
    setEditingTemplate(template ?? null)
    setTemplateForm({
      name: template?.name ?? "Neue Vorlage",
      category: template?.category ?? "Allgemein",
      content: template?.content ?? (customNotes || ""),
    })
    setTemplateDialogOpen(true)
  }

  const handleTemplateSave = () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) return
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        name: templateForm.name.trim(),
        category: templateForm.category.trim(),
        content: templateForm.content.trim(),
      })
    } else {
      addTemplate({
        name: templateForm.name.trim(),
        category: templateForm.category.trim(),
        content: templateForm.content.trim(),
      })
    }
    setTemplateDialogOpen(false)
  }

  const handleTemplateApply = (template: ReportTemplate) => {
    setCustomNotes((prev) => (prev ? `${prev}\n\n${template.content}` : template.content))
  }

  // ---- Render -------------------------------------------------------------

  if (allPlans.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Berichte" description="Nährstoffanalyse und Auswertungen" helpText="Erstellen Sie detaillierte Nährstoffanalysen Ihrer Ernährungspläne. Vergleichen Sie Ist- und Sollwerte nach DGE-Referenzen und exportieren Sie Berichte für Ihre Patienten." />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Keine Ernährungspläne vorhanden. Erstelle zuerst einen Ernährungsplan.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Berichte" description="Nährstoffanalyse und Auswertungen" helpText="Erstellen Sie detaillierte Nährstoffanalysen Ihrer Ernährungspläne. Vergleichen Sie Ist- und Sollwerte nach DGE-Referenzen und exportieren Sie Berichte für Ihre Patienten." />

      {/* Plan selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Ernährungsplan:</span>
        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Plan auswählen" />
          </SelectTrigger>
          <SelectContent>
            {allPlans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {formatDate(plan.date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="makro">
        <TabsList>
          <TabsTrigger value="makro">Makronährstoffe</TabsTrigger>
          <TabsTrigger value="vitamine">Vitamine</TabsTrigger>
          <TabsTrigger value="mineralstoffe">Mineralstoffe</TabsTrigger>
        </TabsList>

        {/* ── Makronährstoffe ────────────────────────────── */}
        <TabsContent value="makro" className="space-y-6">
          {/* Energy highlight card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Energiezufuhr</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {formatNumber(energieValue, 0)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {energieDef.unit}
                </span>
                <span className="text-muted-foreground text-sm">
                  von {formatNumber(energieRef, 0)} {energieDef.unit} Referenzwert
                </span>
                <span
                  className="ml-2 rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor:
                      energyCoverage >= 80
                        ? "var(--color-chart-2)"
                        : energyCoverage >= 50
                          ? "var(--color-chart-4)"
                          : "var(--color-chart-5)",
                    color: "white",
                  }}
                >
                  {formatPercent(energyCoverage)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Makronährstoffe &ndash; Ist vs. Referenz
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NutrientChart data={macroChartData} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Makroverteilung (Piechart)</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Zeigt das Verhältnis der aufgenommenen Energieanteile pro Makronährstoff.
                </p>
              </CardHeader>
              <CardContent className="h-[320px]">
                {macroPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={macroPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {macroPieData.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<MacroPieTooltip />} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">Keine Makrodaten vorhanden.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Zusammensetzung nach Mahlzeiten</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Visualisiert, welche Mahlzeiten den größten Energiebeitrag liefern.
                </p>
              </CardHeader>
              <CardContent className="h-[280px]">
                {mealEnergyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mealEnergyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit=" kcal" />
                      <Tooltip content={<MealEnergyTooltip />} />
                      <Bar dataKey="energie" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">Keine Mahlzeiten im Plan vorhanden.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top-Energiequellen</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Größte Einzelbeiträge (Lebensmittel & Rezepte) im Bericht.
                </p>
              </CardHeader>
              <CardContent className="h-[280px]">
                {foodContributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={foodContributionData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} unit=" kcal" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={140} />
                      <Tooltip content={<ContributionTooltip />} />
                      <Bar dataKey="energie" barSize={16} radius={[0, 4, 4, 0]} fill="var(--color-chart-3)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">Noch keine Energiequellen erfasst.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail table */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Nährstoffanzeige konfigurieren</CardTitle>
                <CardDescription>Steuere, welche Nährstoffe in Tabellen & Export auftauchen.</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={handleResetNutrients}>
                Auswahl zurücksetzen
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nutrientDisplayOptions.map((option) => (
                <label key={option.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    {option.label}
                    {option.unit ? <span className="text-muted-foreground text-xs"> · {option.unit}</span> : null}
                  </span>
                  <Switch
                    checked={displayedNutrientIds.includes(option.id)}
                    onCheckedChange={() => handleNutrientToggle(option.id)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nährstoff</TableHead>
                    <TableHead className="text-right">Istwert</TableHead>
                    <TableHead className="text-right">Einheit</TableHead>
                    <TableHead className="text-right">Referenzwert</TableHead>
                    <TableHead className="text-right">% der Referenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedNutrientIds.map((id) => {
                    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
                    const val = getNutrientValue(planNutrients, id)
                    const ref = getReferenceAmount(refConfig, id)
                    const pct = percentOfReference(val, ref)
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-medium">{def.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(val, 1)}
                        </TableCell>
                        <TableCell className="text-right">{def.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(ref, 1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(pct)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vitamine ───────────────────────────────────── */}
        <TabsContent value="vitamine" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Vitamine &ndash; Abdeckung der DGE-Referenzwerte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(300, vitaminPercentData.length * 50)}
              >
                <BarChart
                  data={vitaminPercentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit=" %" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={75}
                  />
                  <Tooltip content={<PercentTooltip />} />
                  <Bar dataKey="percent" name="% der Referenz" radius={[0, 4, 4, 0]} barSize={18}>
                    {vitaminPercentData.map((entry, idx) => (
                      <Cell key={idx} fill={getStatusColor(entry.percent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vitamin</TableHead>
                    <TableHead className="text-right">Istwert</TableHead>
                    <TableHead className="text-right">Einheit</TableHead>
                    <TableHead className="text-right">Referenzwert</TableHead>
                    <TableHead className="text-right">% der Referenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitaminDefs.map((def) => {
                    const val = getNutrientValue(planNutrients, def.id)
                    const ref = getReferenceAmount(refConfig, def.id)
                    const pct = percentOfReference(val, ref)
                    return (
                      <TableRow key={def.id}>
                        <TableCell className="font-medium">{def.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(val, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">{def.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(ref, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(pct)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Mineralstoffe ──────────────────────────────── */}
        <TabsContent value="mineralstoffe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Mineralstoffe &ndash; Abdeckung der DGE-Referenzwerte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(300, mineralPercentData.length * 50)}
              >
                <BarChart
                  data={mineralPercentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit=" %" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={75}
                  />
                  <Tooltip content={<PercentTooltip />} />
                  <Bar dataKey="percent" name="% der Referenz" radius={[0, 4, 4, 0]} barSize={18}>
                    {mineralPercentData.map((entry, idx) => (
                      <Cell key={idx} fill={getStatusColor(entry.percent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mineralstoff</TableHead>
                    <TableHead className="text-right">Istwert</TableHead>
                    <TableHead className="text-right">Einheit</TableHead>
                    <TableHead className="text-right">Referenzwert</TableHead>
                    <TableHead className="text-right">% der Referenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mineralDefs.map((def) => {
                    const val = getNutrientValue(planNutrients, def.id)
                    const ref = getReferenceAmount(refConfig, def.id)
                    const pct = percentOfReference(val, ref)
                    return (
                      <TableRow key={def.id}>
                        <TableCell className="font-medium">{def.name}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(val, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">{def.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatNutrient(ref, "").trim()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(pct)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report builder */}
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Berichtskonfiguration</CardTitle>
              <p className="text-muted-foreground text-sm">
                Wähle Umfang und Abschnitte für die druckbare Auswertung.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={reportLength === "short" ? "default" : "outline"}
                  onClick={() => handleReportLengthChange("short")}
                >
                  Kurzbericht
                </Button>
                <Button
                  size="sm"
                  variant={reportLength === "full" ? "default" : "outline"}
                  onClick={() => handleReportLengthChange("full")}
                >
                  Vollversion
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Aktive Abschnitte: {selectedSectionCount} / {REPORT_SECTIONS.length}
              </p>
              <div className="space-y-3">
                {REPORT_SECTIONS.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <Switch
                      checked={selectedSections[section.id]}
                      onCheckedChange={() => handleSectionToggle(section.id)}
                      aria-label={`${section.label} aktivieren`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Druckvorschau</CardTitle>
              <p className="text-muted-foreground text-sm">
                Zusammenfassung der ausgewählten Elemente für den PDF-Export.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {planDateLabel && <Badge variant="secondary">Plan {planDateLabel}</Badge>}
                <Badge variant="outline">{reportLength === "short" ? "Kurzbericht" : "Vollversion"}</Badge>
                <Badge variant="outline">{selectedSectionCount} Abschnitte</Badge>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4 shadow-sm">
                {selectedSectionCount > 0 ? (
                  <div className="space-y-4 text-sm">
                    {selectedSections.summary && (
                      <div className="space-y-2">
                        <p className="font-semibold">Kurzfazit & Kennzahlen</p>
                        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          <li>Energie: {formatPercent(energyCoverage)} des Tagesziels</li>
                          {macroHighlights.map((highlight) => (
                            <li key={highlight.name}>
                              {highlight.name}: {formatNumber(highlight.value, 1)} {highlight.unit} ({formatPercent(highlight.percent)})
                            </li>
                          ))}
                          {micronutrientAlerts.length > 0 ? (
                            <li>
                              Kritische Mikronährstoffe: {micronutrientAlerts
                                .map((entry) => `${entry.name} (${formatPercent(entry.percent)})`)
                                .join(", ")}
                            </li>
                          ) : (
                            <li>Keine Auffälligkeiten bei Vitaminen/Mineralstoffen</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {selectedSections.table && (
                      <div className="space-y-2">
                        <p className="font-semibold">Nährstofftabelle (Auszug)</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nährstoff</TableHead>
                              <TableHead className="text-right">Ist</TableHead>
                              <TableHead className="text-right">Referenz</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {macroTableIds.slice(0, 4).map((id) => {
                              const def = NUTRIENT_DEFINITIONS.find((d) => d.id === id)!
                              const val = getNutrientValue(planNutrients, id)
                              const ref = getReferenceAmount(refConfig, id)
                              return (
                                <TableRow key={`preview-${id}`}>
                                  <TableCell>{def.shortName ?? def.name}</TableCell>
                                  <TableCell className="text-right">
                                    {formatNumber(val, 1)} {def.unit}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNumber(ref, 1)} {def.unit}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {selectedSections.charts && (
                      <div className="space-y-1">
                        <p className="font-semibold">Diagramme & Visualisierung</p>
                        <p className="text-xs text-muted-foreground">
                          Makropiechart + Mahlzeiten-Balken werden dem Bericht als Grafik hinzugefügt.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {mealEnergyData.map((meal) => (
                            <Badge key={meal.name} variant="outline">
                              {meal.name}: {meal.energie} kcal
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSections.meals && (
                      <div className="space-y-2">
                        <p className="font-semibold">Speiseplanübersicht</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {planPreviewRows.map((row) => (
                            <p key={row.slot}>
                              <span className="font-medium">{row.slot}:</span> {row.summary}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSections.notes && (
                      <div className="space-y-2">
                        <p className="font-semibold">Beratungshinweise</p>
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                          {resolvedNotes || "Noch keine individuellen Hinweise ergänzt."}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Bitte aktiviere mindestens einen Abschnitt.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {previewMicronutrients.map((entry) => (
                  <Badge key={entry.name} variant="secondary">
                    {entry.name}: {formatPercent(entry.percent)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">Textvorlagen & Platzhalter</CardTitle>
                <CardDescription>Speichere Berichtsbausteine und setze Platzhalter ein.</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenTemplateDialog()}>
                Neue Vorlage
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {templates.length > 0 ? (
                templates.map((template) => (
                  <div key={template.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.category}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleTemplateApply(template)}>
                          Einfügen
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenTemplateDialog(template)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Vorlage bearbeiten</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTemplate(template.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Vorlage löschen</span>
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {template.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Noch keine Vorlagen gespeichert. Nutze „Neue Vorlage“, um den aktuellen Text zu sichern.
                </p>
              )}
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4" /> Platzhalter-Vorschau
                </p>
                <div className="space-y-1">
                  {PLACEHOLDER_FIELDS.map((field) => {
                    const key = field.token.replace(/\{|\}/g, "")
                    return (
                      <div key={field.token} className="flex items-center justify-between gap-2">
                        <span>{field.label}</span>
                        <span className="font-mono text-[11px] text-primary">
                          {placeholderValues[key as keyof typeof placeholderValues] ?? "-"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Automatische Bewertung</CardTitle>
              <CardDescription>Generierter Textbaustein für den Bericht.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="whitespace-pre-wrap">{analysisNarrative}</p>
              <Button size="sm" variant="outline" onClick={handleAdoptNarrative}>
                Text übernehmen
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Eigene Hinweise & Verlauf</CardTitle>
              <CardDescription>Freitext erscheint im Abschnitt „Individuelle Hinweise“.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="icon" variant="outline" onClick={() => applyFormatting("bold")}>
                  <strong>B</strong>
                  <span className="sr-only">Fett</span>
                </Button>
                <Button size="icon" variant="outline" onClick={() => applyFormatting("italic")}>
                  <em>I</em>
                  <span className="sr-only">Kursiv</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyFormatting("list")}>
                  • Liste
                </Button>
                {PLACEHOLDER_FIELDS.map((field) => (
                  <Button
                    key={field.token}
                    size="sm"
                    variant="secondary"
                    onClick={() => handleInsertPlaceholder(field.token)}
                  >
                    {field.label}
                  </Button>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={customNotes}
                onChange={(event) => setCustomNotes(event.target.value)}
                placeholder="z. B. Fokus auf Ballaststoffe, Laborkontrolle in 4 Wochen, ..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                {customNotes.length} Zeichen · Platzhalter werden beim Export automatisch ersetzt.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export & Druck</CardTitle>
            <p className="text-muted-foreground text-sm">Erzeugt echte PDF- und CSV-Dateien über den Server.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => void handleExport("pdf")} disabled={isExporting}>
              {isExporting ? "Wird erstellt..." : "PDF erstellen"}
            </Button>
            <Button variant="secondary" onClick={() => void handleExport("csv")} disabled={isExporting}>
              CSV/Nährstoffdaten
            </Button>
            <Button variant="outline" onClick={() => void handlePreview()} disabled={isExporting}>
              Druckvorschau anzeigen
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Spezielle Ausgaben</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-500" /> CO₂ & Nachhaltigkeit
                </CardTitle>
                <CardDescription>Fußabdruck pro Plan und Mahlzeit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-full bg-emerald-50 px-5 py-4 text-center dark:bg-emerald-500/10">
                    <p className="text-xs uppercase text-muted-foreground">Gesamt</p>
                    <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-200">
                      {formatNumber(totalCo2, 1)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">pro 100 g</p>
                    <p className="font-semibold">{formatNumber(co2Per100g, 2)} kg</p>
                    <Badge variant="outline" className="mt-1">
                      {co2Category === "niedrig" ? "Niedrig" : co2Category === "mittel" ? "Mittel" : "Hoch"}
                    </Badge>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={co2BySlot} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} unit=" kg" />
                    <Tooltip formatter={(value: number) => `${formatNumber(value as number, 2)} kg`} />
                    <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" /> LMIV Nährwertkennzeichnung
                </CardTitle>
                <CardDescription>Automatisch aus dem aktiven Plan generiert.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border px-4 py-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                    <span>Pro Portion</span>
                    <span>Pro 100 g</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Brennwert</span>
                      <span>
                        {formatNumber(energyKj, 0)} kJ / {formatNumber(energieValue, 0)} kcal
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Brennwert je 100 g</span>
                      <span>
                        {formatNumber(energyKj * per100Factor, 0)} kJ / {formatNumber(energieValue * per100Factor, 0)} kcal
                      </span>
                    </div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nährstoff</TableHead>
                      <TableHead className="text-right">pro Portion</TableHead>
                      <TableHead className="text-right">pro 100 g</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lmivRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.perPortion, 1)} {row.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.per100, 1)} {row.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-xs text-muted-foreground">
                  <p>Allergene: {aggregatedAllergens.length > 0 ? aggregatedAllergens.join(", ") : "keine Angabe"}</p>
                  <p>Additive: {aggregatedAdditives.length > 0 ? aggregatedAdditives.join(", ") : "keine Angabe"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4" /> Health Claims & PRODIscore
                </CardTitle>
                <CardDescription>Prüft, welche Claims erlaubt sind.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      prodiLevel >= 4
                        ? "bg-emerald-100 text-emerald-800"
                        : prodiLevel === 3
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    PRODIscore {prodiScoreValue} · {prodiLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {healthClaimResults.filter((claim) => claim.met).length} / {healthClaimResults.length} Claims
                  </span>
                </div>
                <div className="space-y-2">
                  {healthClaimResults.map((claim) => (
                    <div
                      key={claim.id}
                      className="flex items-start justify-between rounded-lg border px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-sm">{claim.label}</p>
                        <p className="text-muted-foreground">{claim.note}</p>
                      </div>
                      {claim.met ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" /> Lebensmittelgruppen-Diversität
                </CardTitle>
                <CardDescription>Wie viele Gruppen deckt der Tagesplan ab?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {uniqueGroupCount} von {diversityTarget} Zielgruppen
                    </span>
                    <span>{formatPercent(diversityPercent)}</span>
                  </div>
                  <Progress value={diversityPercent} className="mt-2" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from(foodGroupCounts.entries()).map(([categoryId, count]) => (
                    <div key={categoryId} className="rounded-lg border px-3 py-2 text-sm">
                      <p className="font-medium">{categoryMap.get(categoryId)?.name ?? categoryId}</p>
                      <p className="text-xs text-muted-foreground">{count} Einträge</p>
                    </div>
                  ))}
                </div>
                {missingGroups.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Noch zu ergänzen: {missingGroups.map((group) => group.name).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exporthinweise</CardTitle>
                <CardDescription>Erinnerung für Spezialausgaben.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• LMIV-Export enthält alle Allergene inklusive Platzhaltertexte.</p>
                <p>• Der Berichtsexport nutzt den aktuell ausgewählten Ernährungsplan.</p>
                <p>• Health-Claim Checkliste wird automatisch zum PDF hinzugefügt.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open)
          if (!open) setEditingTemplate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Textvorlage {editingTemplate ? "bearbeiten" : "anlegen"}</DialogTitle>
            <DialogDescription>
              Vorlagen erscheinen im linken Panel und können jederzeit in Berichte eingefügt werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="template-category">Kategorie</Label>
              <Input
                id="template-category"
                value={templateForm.category}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, category: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="template-content">Inhalt</Label>
              <Textarea
                id="template-content"
                rows={6}
                value={templateForm.content}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, content: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTemplateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleTemplateSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
