"use client"

import { useState } from "react"
import {
  Flame,
  Info,
  Minus,
  RotateCcw,
  Save,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { formatDate, formatNumber } from "@/lib/format"
import { PAL_LEVELS } from "@/lib/nutrition/energy-calculation"
import { isMaintenanceIntake, type WeightProjection } from "@/lib/nutrition/weight-projection"
import { cn } from "@/lib/utils"

/** Steps the slider in portions a practitioner would actually prescribe. */
const STEP_KCAL = 25
/** How far the intake may be moved either side of maintenance. */
const RANGE_KCAL = 1000
const MILESTONE_WEEKS = [4, 12] as const
/** Matches the CHECK constraint on `patients.basal_metabolic_rate_override`. */
const MIN_BASAL = 500
const MAX_BASAL = 6000

/**
 * The range runs from maintenance, so its stops land on maintenance exactly.
 *
 * That matters: with the range anchored anywhere else, a Gesamtumsatz of 2.544
 * kcal would have no reachable "Erhalt" stop, and the card would open on
 * "Zunehmen, +0,01 kg pro Woche" for a patient nobody had touched yet.
 */
function calorieRange(maintenance: number): { min: number; max: number } {
  return { min: Math.max(800, maintenance - RANGE_KCAL), max: maintenance + RANGE_KCAL }
}

function addWeeks(from: Date, weeks: number): Date {
  const result = new Date(from)
  result.setDate(result.getDate() + Math.round(weeks * 7))
  return result
}

function signed(value: number, decimals = 0): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value), decimals)}`
}

/**
 * A number that reads as text until you touch it.
 *
 * The three energy figures used to be plain labels, which meant changing the
 * one the formula got wrong sent the practitioner to a different tab. They are
 * inputs now, but they still have to read as a summary at a glance — hence no
 * visible box until hover or focus.
 */
function QuietNumberField({
  id,
  value,
  onCommit,
  min,
  max,
  step,
  suffix,
  disabled,
}: {
  id: string
  value: number
  onCommit: (next: number) => void
  min: number
  max: number
  step: number
  suffix: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(String(value))
  }

  const commit = () => {
    const parsed = Number(draft.replace(",", "."))
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)))
    setDraft(String(clamped))
    if (clamped !== value) onCommit(clamped)
  }

  return (
    <span className="flex items-baseline gap-1">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="h-7 w-[4rem] border-transparent bg-transparent px-1 text-lg font-semibold tabular-nums shadow-none transition-colors hover:border-input hover:bg-background focus-visible:border-input focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-xs text-muted-foreground">{suffix}</span>
    </span>
  )
}

/** Label with an info affordance that only shows its explanation on hover. */
function FieldLabel({
  htmlFor,
  children,
  hint,
  accent,
}: {
  htmlFor?: string
  children: React.ReactNode
  hint: string
  accent?: boolean
}) {
  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>
        <Label
          htmlFor={htmlFor}
          className="group w-fit cursor-help gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {children}
          <Info
            className={cn(
              "size-3 transition-colors",
              accent ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground",
            )}
            aria-hidden="true"
          />
        </Label>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 py-2 text-sm" side="top" align="start">
        {hint}
      </HoverCardContent>
    </HoverCard>
  )
}

/** One line of the prognosis detail, shown inside the hover card. */
function ProjectionRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium tabular-nums", muted && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  )
}

interface PatientEnergyCardProps {
  weightKg: number
  pal: number
  onPalChange: (pal: number) => void
  /** What the app calculates in, i.e. the override when set, the formula otherwise. */
  basalMetabolicRate: number
  /** Mifflin-St Jeor from the current measurements, for the reset affordance. */
  calculatedBasalMetabolicRate: number
  /** Present only when a practitioner set the basal rate by hand. */
  basalOverride?: number
  onSaveBasalOverride: (kcal: number | undefined) => Promise<void>
  totalEnergyExpenditure: number
  dailyCalorieGoal?: number
  goalWeightKg?: number
  /** Owned by the overview, so the weight chart can draw the same scenario. */
  targetKcal: number
  onTargetChange: (kcal: number) => void
  projection: WeightProjection
  onSaveCalorieGoal: (kcal: number) => Promise<void>
}

/**
 * The daily calorie target, and where eating it would lead.
 *
 * Three numbers decide everything downstream — basal rate, activity factor and
 * the target itself — and all three are editable here. Mifflin-St Jeor is a
 * population formula; a practitioner holding a calorimetry reading has to be
 * able to overrule it without leaving the conversation, and the projection
 * follows immediately.
 *
 * Everything that explains rather than decides — what a PAL is, when the goal
 * would be reached, where the curve settles — sits behind a hover, because this
 * card is read far more often than it is used.
 *
 * The projection is deliberately not a straight line — see
 * `lib/nutrition/weight-projection.ts` for why that matters.
 */
export function PatientEnergyCard({
  weightKg,
  pal,
  onPalChange,
  basalMetabolicRate,
  calculatedBasalMetabolicRate,
  basalOverride,
  onSaveBasalOverride,
  totalEnergyExpenditure,
  dailyCalorieGoal,
  goalWeightKg,
  targetKcal,
  onTargetChange,
  projection,
  onSaveCalorieGoal,
}: PatientEnergyCardProps) {
  const [today] = useState(() => new Date())
  const { min: minKcal, max: maxKcal } = calorieRange(totalEnergyExpenditure)

  const clamp = (value: number) => Math.min(maxKcal, Math.max(minKcal, Math.round(value)))
  const [draft, setDraft] = useState(String(targetKcal))
  const [isSaving, setIsSaving] = useState(false)

  // Keeps the field in step when the target changes from outside — a new
  // measurement shifts maintenance and with it the whole range.
  const [lastTarget, setLastTarget] = useState(targetKcal)
  if (targetKcal !== lastTarget) {
    setLastTarget(targetKcal)
    setDraft(String(targetKcal))
  }

  const setTarget = (value: number) => {
    onTargetChange(value)
    setDraft(String(value))
  }

  const delta = targetKcal - totalEnergyExpenditure
  const flat = isMaintenanceIntake(projection)
  const trend = flat
    ? { Icon: Minus, label: "Gewicht halten", tone: "text-muted-foreground" }
    : projection.weeklyChangeKgNow < 0
      ? { Icon: TrendingDown, label: "Abnehmen", tone: "text-sky-500" }
      : { Icon: TrendingUp, label: "Zunehmen", tone: "text-amber-600" }
  const TrendIcon = trend.Icon

  const commitDraft = () => {
    const parsed = Number(draft.replace(",", "."))
    // Clamped but not snapped: the slider steps in 25s, the field accepts the
    // exact number a practitioner has in mind.
    setTarget(Number.isFinite(parsed) ? clamp(parsed) : targetKcal)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSaveCalorieGoal(targetKcal)
      toast.success(`Kalorienziel auf ${formatNumber(targetKcal)} kcal gesetzt`)
    } catch {
      toast.error("Kalorienziel konnte nicht gespeichert werden")
    } finally {
      setIsSaving(false)
    }
  }

  const handleBasalCommit = (next: number | undefined) => {
    void (async () => {
      try {
        await onSaveBasalOverride(next)
        toast.success(
          next === undefined
            ? "Grundumsatz wieder berechnet"
            : `Grundumsatz auf ${formatNumber(next)} kcal gesetzt`,
        )
      } catch {
        toast.error("Grundumsatz konnte nicht gespeichert werden")
      }
    })()
  }

  // Only worth a line once it says something the milestones do not: a plateau
  // that is still a real distance from where the patient stands today.
  const showPlateau =
    projection.plateauWeightKg !== null &&
    Math.abs(projection.plateauWeightKg - weightKg) >= 0.5

  const goalText = (() => {
    if (goalWeightKg === undefined) return "Kein Zielgewicht hinterlegt"
    if (projection.weeksToGoal !== null) {
      return formatDate(addWeeks(today, projection.weeksToGoal))
    }
    // Not reached inside the search horizon. Whether that is "too slow" or
    // "never" depends on which side of the goal the plateau lands on.
    const plateau = projection.plateauWeightKg
    const passesGoal =
      plateau !== null &&
      (weightKg > goalWeightKg ? plateau <= goalWeightKg : plateau >= goalWeightKg)
    return passesGoal ? "Dauert über 5 Jahre" : "So nicht erreichbar"
  })()

  const palLabel =
    PAL_LEVELS.find((level) => Number(level.value) === pal)?.short ?? "Eigener Wert"

  return (
    <Card>
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Left: what the body costs. Three numbers, two of them the
            practitioner's to set. */}
        <div className="space-y-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Flame className="size-3.5" />
            Energiebedarf
          </p>

          {/* Read as an equation, top to bottom: rate × factor = requirement.
              Three side-by-side tiles left the column half empty and hid the
              fact that the third number is the product of the first two. */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 border-b py-1.5">
              <FieldLabel
                htmlFor="basal-rate"
                accent={basalOverride !== undefined}
                hint={
                  basalOverride !== undefined
                    ? `Von Hand gesetzt. Berechnet wären ${formatNumber(calculatedBasalMetabolicRate)} kcal nach Mifflin-St Jeor.`
                    : "Nach Mifflin-St Jeor aus Gewicht, Größe, Alter und Geschlecht. Klicken, um ihn zu überschreiben."
                }
              >
                Grundumsatz
              </FieldLabel>
              <div className="flex items-center gap-2">
                {basalOverride !== undefined ? (
                  <button
                    type="button"
                    onClick={() => handleBasalCommit(undefined)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    <RotateCcw className="size-3" />
                    {formatNumber(calculatedBasalMetabolicRate)}
                  </button>
                ) : null}
                <QuietNumberField
                  id="basal-rate"
                  value={Math.round(basalMetabolicRate)}
                  min={MIN_BASAL}
                  max={MAX_BASAL}
                  step={10}
                  suffix="kcal"
                  onCommit={(next) => handleBasalCommit(next)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-b py-1.5">
              <FieldLabel
                htmlFor="pal-level"
                hint="Physical Activity Level: der Faktor, mit dem der Grundumsatz auf den Alltag hochgerechnet wird. 1,4 entspricht überwiegend sitzender Arbeit."
              >
                Aktivität
              </FieldLabel>
              <Select value={String(pal)} onValueChange={(value) => onPalChange(Number(value))}>
                <SelectTrigger
                  id="pal-level"
                  size="sm"
                  className="h-7 w-[13rem] justify-end gap-2 border-transparent bg-transparent px-2 shadow-none transition-colors hover:border-input hover:bg-background data-[state=open]:border-input dark:bg-transparent dark:hover:bg-input/30"
                >
                  <SelectValue>
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-xs text-muted-foreground">{palLabel}</span>
                      <span className="text-lg font-semibold tabular-nums">
                        {formatNumber(pal, 1)}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAL_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <FieldLabel hint="Grundumsatz × Aktivitätsfaktor. Die Energie, bei der das Gewicht ungefähr bleibt, wo es ist.">
                Gesamtumsatz
              </FieldLabel>
              <p className="px-1 text-lg font-semibold tabular-nums">
                {formatNumber(totalEnergyExpenditure)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
              </p>
            </div>
          </div>

          {targetKcal < basalMetabolicRate ? (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Tagesziel unter dem Grundumsatz. Dauerhaft nur unter Aufsicht und mit
                Kontrolle der Nährstoffversorgung.
              </span>
            </p>
          ) : null}
        </div>

        {/* Right: the one number the plan is built on, and where it leads. */}
        <div className="space-y-3 lg:border-l lg:pl-6">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="daily-calorie-target"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Tagesziel
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="daily-calorie-target"
                type="number"
                inputMode="numeric"
                min={minKcal}
                max={maxKcal}
                step={STEP_KCAL}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur()
                }}
                className="h-8 w-24 text-right text-base font-semibold tabular-nums"
              />
              <span className="w-8 text-xs text-muted-foreground">kcal</span>
            </div>
          </div>

          <Slider
            value={[targetKcal]}
            min={minKcal}
            max={maxKcal}
            step={STEP_KCAL}
            aria-label="Tagesziel in Kalorien"
            onValueChange={(value) => setTarget(value[0])}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">{formatNumber(minKcal)}</span>
            <button
              type="button"
              onClick={() => setTarget(clamp(totalEnergyExpenditure))}
              className="tabular-nums underline-offset-2 hover:text-foreground hover:underline"
            >
              Erhalt {formatNumber(totalEnergyExpenditure)}
            </button>
            <span className="tabular-nums">{formatNumber(maxKcal)}</span>
          </div>

          {/* The whole answer in one line, with the arithmetic behind it on
              hover. This line is what gets read out loud in a session. */}
          <HoverCard openDelay={80} closeDelay={120}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="flex w-full cursor-help items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <TrendIcon className={cn("size-4 shrink-0", trend.tone)} />
                <span className="text-sm font-medium">{trend.label}</span>
                {!flat ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {signed(projection.weeklyChangeKgNow, 2)} kg / Woche
                  </span>
                ) : null}
                <span className="ml-auto flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  {signed(delta)} kcal
                  <Info className="size-3 text-muted-foreground/50" aria-hidden="true" />
                </span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72" side="top" align="end">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prognose
              </p>
              {flat ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Bei diesem Ziel bleibt das Gewicht ungefähr, wo es ist.
                </p>
              ) : (
                <div className="mt-1">
                  {MILESTONE_WEEKS.map((week) =>
                    projection.points[week] ? (
                      <ProjectionRow
                        key={week}
                        label={`In ${week} Wochen`}
                        value={`${formatNumber(projection.points[week].weightKg, 1)} kg`}
                      />
                    ) : null,
                  )}
                  <ProjectionRow
                    label="Ziel erreicht"
                    value={goalText}
                    muted={goalWeightKg === undefined || projection.weeksToGoal === null}
                  />
                  {showPlateau ? (
                    <ProjectionRow
                      label="Pendelt sich ein bei"
                      value={`${formatNumber(projection.plateauWeightKg!, 1)} kg`}
                    />
                  ) : null}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Die Kurve flacht ab, weil der Umsatz mit dem Gewicht sinkt. Schätzung
                ohne klinische Gewähr.
              </p>
            </HoverCardContent>
          </HoverCard>

          <Button
            type="button"
            variant={targetKcal === dailyCalorieGoal ? "outline" : "default"}
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || targetKcal === dailyCalorieGoal}
          >
            <Save className="mr-2 size-4" />
            {targetKcal === dailyCalorieGoal
              ? "Als Kalorienziel gespeichert"
              : "Als Kalorienziel speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
