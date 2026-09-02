"use client"

import { ArrowLeft, CircleAlert, CircleCheck, LoaderCircle, Pencil, TriangleAlert } from "lucide-react"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { analyseDayPlan, type DayAnalysisNutrient } from "@/lib/day-plan-analysis"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DailyMealPlan, DietLinePreset, Food, Recipe, ReferenceNutrientValue, ResolvedReferenceConfig } from "@/lib/types"

const GROUP_LABELS = {
  makronaehrstoffe: "Makronährstoffe",
  vitamine: "Vitamine",
  mineralstoffe: "Mineralstoffe",
  fettsaeuren: "Fettsäuren",
  aminosaeuren: "Aminosäuren",
  sonstige: "Sonstige Werte",
} as const

interface PlanDayAnalysisProps {
  plan: DailyMealPlan
  foods: Food[]
  foodMap: Map<string, Food>
  recipeMap: Map<string, Recipe>
  dietLine?: DietLinePreset
  refConfig: ResolvedReferenceConfig
  referenceValues: ReferenceNutrientValue[]
  patientEnergyTarget?: number
  hydration: "ready" | "loading" | "error"
  onBack: () => void
  onEdit: () => void
}

/** Full, read-only daily nutrient review for the planner's current workspace. */
export function PlanDayAnalysis({
  plan,
  foods,
  foodMap,
  recipeMap,
  dietLine,
  refConfig,
  referenceValues,
  patientEnergyTarget,
  hydration,
  onBack,
  onEdit,
}: PlanDayAnalysisProps) {
  const analysis = analyseDayPlan({ plan, foods, foodMap, recipeMap, dietLine, refConfig, referenceValues, patientEnergyTarget })
  const groups = Object.entries(GROUP_LABELS).map(([group, label]) => ({
    group,
    label,
    nutrients: analysis.nutrients.filter((nutrient) => nutrient.definition.group === group),
  })).filter((item) => item.nutrients.length > 0)
  const canAssess = hydration === "ready" && analysis.hasEntries
  const attention = canAssess ? analysis.attention : []
  const summary = !analysis.hasEntries
    ? "Tag noch nicht geplant"
    : hydration === "loading"
      ? "Nährwertdaten werden geladen"
      : hydration === "error"
        ? "Nährwertdaten unvollständig"
        : analysis.unavailableCount > 0
          ? "Datenlücken prüfen"
          : attention.length > 0
            ? "Handlungsbedarf"
            : analysis.evaluatedCount > 0
              ? "Im Zielbereich"
              : "Noch keine Zielwerte"

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-4" />
          Zur Wochenansicht
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 size-4" />
          Tag bearbeiten
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">Tagesanalyse</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {format(parseISO(plan.date), "EEEE, d. MMMM yyyy", { locale: de })}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {dietLine ? `Ziele aus ${dietLine.name}; für übrige Werte ${refConfig.standardName}-Referenzwerte.` : `${refConfig.standardName}-Referenzwerte für ${refConfig.ageGroupLabel}.`}
            </p>
          </div>
          <SummaryBadge summary={summary} canAssess={canAssess} attention={attention.length > 0} hasGaps={hydration !== "ready" || analysis.unavailableCount > 0} />
        </div>
      </div>

      {!analysis.hasEntries ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="font-medium">Dieser Tag enthält noch keine Mahlzeiten.</p>
            <p className="text-muted-foreground mt-1 text-sm">Füge im Tagesplan Lebensmittel oder Rezepte hinzu, um die Nährwerte zu analysieren.</p>
            <Button className="mt-4" onClick={onEdit}>Tag planen</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {hydration !== "ready" ? (
            <Card className={cn("py-0", hydration === "error" && "border-amber-300 bg-amber-50/60 dark:bg-amber-950/15")}>
              <CardContent className="flex items-start gap-3 py-3 text-sm">
                {hydration === "loading" ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-primary" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />}
                <p>{hydration === "loading"
                  ? "Die vollständigen Nährwertdaten der eingeplanten Lebensmittel und Rezeptzutaten werden geladen. Bewertungen erscheinen danach verbindlich."
                  : "Mindestens ein eingeplantes Lebensmittel oder eine Rezeptzutat konnte nicht geladen werden. Betroffene Nährstoffe bleiben als Datenlücke markiert; es wird nichts als 0 oder im Zielbereich gewertet."}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-primary/15 bg-primary/[0.035] py-0">
            <CardContent className="grid gap-3 py-4 sm:grid-cols-3">
              <Metric label="Bewertet im Zielbereich" value={canAssess ? `${analysis.evaluatedCount}` : "–"} />
              <Metric label="Handlungsbedarf" value={canAssess ? `${attention.length}` : "–"} attention={attention.length > 0} />
              <Metric label="Datenlücken" value={canAssess ? `${analysis.unavailableCount}` : "–"} attention={canAssess && analysis.unavailableCount > 0} />
            </CardContent>
          </Card>

          <section className="space-y-2" aria-labelledby="day-analysis-attention">
            <h2 id="day-analysis-attention" className="text-sm font-semibold">Handlungsbedarf</h2>
            {attention.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {attention.map((nutrient) => (
                  <div key={nutrient.definition.id} className="flex items-center justify-between rounded-lg border border-amber-300/70 bg-amber-50/60 px-3 py-2 text-sm dark:bg-amber-950/10">
                    <span className="font-medium">{nutrient.definition.name}</span>
                    <span className="text-amber-900 dark:text-amber-200">{nutrient.status === "low" ? "unter Ziel" : "über Ziel"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{!canAssess ? "Die Bewertung folgt, sobald alle Nährwertquellen vollständig vorliegen." : analysis.unavailableCount > 0 ? "Für die vollständig auswertbaren Zielwerte liegt kein klarer Handlungsbedarf vor." : "Für die bewertbaren Zielwerte besteht kein Handlungsbedarf."}</p>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.group} className="py-0">
                <CardHeader className="border-b px-4 py-3">
                  <CardTitle className="text-base">{group.label}</CardTitle>
                </CardHeader>
                <CardContent className="divide-y px-4">
                  {group.nutrients.map((nutrient) => <NutrientRow key={nutrient.definition.id} nutrient={nutrient} evaluationState={hydration} />)}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">Referenzwerte werden in dieser Ansicht als Untergrenzen bewertet. Nur ausdrücklich in der Kostform hinterlegte Obergrenzen werden als „über Ziel“ gewertet. Energie nutzt ein individuelles Patientenziel mit ±5-%-Korridor; ohne individuelles oder Kostform-Ziel bleibt sie neutral. BE wird aus Kohlenhydraten abgeleitet.</p>
        </>
      )}
    </div>
  )
}

function SummaryBadge({ summary, canAssess, attention, hasGaps }: { summary: string; canAssess: boolean; attention: boolean; hasGaps: boolean }) {
  const Icon = canAssess && !attention && !hasGaps ? CircleCheck : hasGaps ? CircleAlert : TriangleAlert
  return <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5", canAssess && !attention && !hasGaps ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}><Icon className="size-3.5" />{summary}</Badge>
}

function Metric({ label, value, attention }: { label: string; value: string; attention?: boolean }) {
  return <div><p className="text-muted-foreground text-xs">{label}</p><p className={cn("mt-0.5 text-xl font-semibold", attention && "text-amber-700")}>{value}</p></div>
}

function NutrientRow({ nutrient, evaluationState }: { nutrient: DayAnalysisNutrient; evaluationState: "ready" | "loading" | "error" }) {
  const decimals = nutrient.definition.unit === "kcal" || Math.abs(nutrient.value) >= 100 ? 0 : 1
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2.5 text-sm">
      <div className="min-w-0"><p className="truncate font-medium">{nutrient.definition.name}{nutrient.derived ? " (abgeleitet)" : ""}</p><p className="text-muted-foreground text-xs">{targetText(nutrient)}</p></div>
      <div className="text-right"><p className="font-mono font-medium">{nutrient.evaluable ? "" : "Teilwert "}{formatNumber(nutrient.value, decimals)} {nutrient.definition.unit}</p><p className={cn("text-xs", evaluationState !== "ready" || nutrient.status === "low" || nutrient.status === "high" || nutrient.status === "unavailable" ? "text-amber-700" : "text-muted-foreground")}>{evaluationState === "loading" ? "wird geladen" : evaluationState === "error" ? "Datenlücke" : statusText(nutrient)}</p></div>
    </div>
  )
}

function targetText(nutrient: DayAnalysisNutrient) {
  const source = nutrient.targetSource ? ` · ${nutrient.targetSource}` : ""
  if (nutrient.energyCorridor && nutrient.min != null) return `Ziel ${formatNumber(nutrient.min)} ${nutrient.definition.unit} ±5 %${source}`
  if (nutrient.min != null && nutrient.max != null) return `Ziel ${formatNumber(nutrient.min)}–${formatNumber(nutrient.max)} ${nutrient.definition.unit}${source}`
  if (nutrient.min != null) return `mind. ${formatNumber(nutrient.min)} ${nutrient.definition.unit}${source}`
  if (nutrient.max != null) return `max. ${formatNumber(nutrient.max)} ${nutrient.definition.unit}${source}`
  return "Kein Zielwert"
}

function statusText(nutrient: DayAnalysisNutrient) {
  if (nutrient.status === "unavailable") return "Datenlücke"
  if (nutrient.status === "low") return "unter Ziel"
  if (nutrient.status === "high") return "über Ziel"
  if (nutrient.status === "ok") return "im Zielbereich"
  return "ohne Bewertung"
}
