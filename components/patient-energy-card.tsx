"use client"

import { useMemo, useState } from "react"
import { Flame, Minus, Save, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { formatDate, formatNumber } from "@/lib/format"
import {
  PATIENT_ENERGY_FORMULA,
  type EnergySex,
} from "@/lib/nutrition/energy-calculation"
import { isMaintenanceIntake, projectWeight } from "@/lib/nutrition/weight-projection"

/** Steps the slider in portions a practitioner would actually prescribe. */
const STEP_KCAL = 25
/** How far the intake may be moved either side of maintenance. */
const RANGE_KCAL = 1000
const PROJECTION_WEEKS = 26
const MILESTONE_WEEKS = [4, 12] as const

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

/** One line of the prognosis column. */
function ProjectionRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium tabular-nums ${muted ? "text-muted-foreground" : ""}`}
      >
        {value}
      </span>
    </div>
  )
}

interface PatientEnergyCardProps {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: EnergySex
  pal: number
  basalMetabolicRate: number
  totalEnergyExpenditure: number
  dailyCalorieGoal?: number
  goalWeightKg?: number
  onSaveCalorieGoal: (kcal: number) => Promise<void>
}

/**
 * The daily calorie target, and where eating it would lead.
 *
 * The card used to state four numbers and send the practitioner to another tab
 * to change any of them. The question being asked in front of a patient is
 * "what happens if we go to 1.800?", so the target is adjustable right here and
 * the projection answers immediately.
 *
 * The projection is deliberately not a straight line — see
 * `lib/nutrition/weight-projection.ts` for why that matters.
 */
export function PatientEnergyCard({
  weightKg,
  heightCm,
  ageYears,
  sex,
  pal,
  basalMetabolicRate,
  totalEnergyExpenditure,
  dailyCalorieGoal,
  goalWeightKg,
  onSaveCalorieGoal,
}: PatientEnergyCardProps) {
  const [today] = useState(() => new Date())
  const { min: minKcal, max: maxKcal } = calorieRange(totalEnergyExpenditure)
  const savedTarget = dailyCalorieGoal ?? totalEnergyExpenditure

  const clamp = (value: number) => Math.min(maxKcal, Math.max(minKcal, Math.round(value)))
  const initialTarget = clamp(savedTarget)
  const [targetKcal, setTargetKcal] = useState(initialTarget)
  const [draft, setDraft] = useState(() => String(initialTarget))
  const [isSaving, setIsSaving] = useState(false)

  // A new measurement moves maintenance, and with it both the slider's range
  // and the saved goal's place on it. Adjusting during render rather than in an
  // effect avoids the extra pass React would otherwise have to throw away.
  const [lastInputs, setLastInputs] = useState(`${savedTarget}:${minKcal}:${maxKcal}`)
  const inputs = `${savedTarget}:${minKcal}:${maxKcal}`
  if (inputs !== lastInputs) {
    setLastInputs(inputs)
    setTargetKcal(initialTarget)
    setDraft(String(initialTarget))
  }

  const projection = useMemo(
    () =>
      projectWeight({
        targetKcal,
        weightKg,
        heightCm,
        ageYears,
        sex,
        formula: PATIENT_ENERGY_FORMULA,
        pal,
        goalWeightKg,
        weeks: PROJECTION_WEEKS,
      }),
    [ageYears, goalWeightKg, heightCm, pal, sex, targetKcal, weightKg],
  )

  const delta = targetKcal - totalEnergyExpenditure
  const flat = isMaintenanceIntake(projection)
  const trend = flat
    ? { icon: Minus, label: "Gewicht halten", tone: "text-muted-foreground" }
    : projection.weeklyChangeKgNow < 0
      ? { icon: TrendingDown, label: "Abnehmen", tone: "text-sky-500" }
      : { icon: TrendingUp, label: "Zunehmen", tone: "text-amber-600" }
  const TrendIcon = trend.icon

  const commitDraft = () => {
    const parsed = Number(draft.replace(",", "."))
    // Clamped but not snapped: the slider steps in 25s, the field accepts the
    // exact number a practitioner has in mind.
    const next = Number.isFinite(parsed) ? clamp(parsed) : targetKcal
    setTargetKcal(next)
    setDraft(String(next))
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-primary" />
          Energie und Kalorienziel
        </CardTitle>
        <CardDescription>
          Aus den aktuellen Messwerten und dem Aktivitätswert. Verschiebe das Tagesziel, um zu
          sehen, wohin es führt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Grundumsatz
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatNumber(basalMetabolicRate)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Gesamtumsatz
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatNumber(totalEnergyExpenditure)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aktivität
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              PAL {formatNumber(pal, 1)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="daily-calorie-target">Tagesziel</Label>
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
                  className="h-8 w-24 text-right tabular-nums"
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
              onValueChange={(value) => {
                setTargetKcal(value[0])
                setDraft(String(value[0]))
              }}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{formatNumber(minKcal)}</span>
              <span>Erhalt {formatNumber(totalEnergyExpenditure)}</span>
              <span>{formatNumber(maxKcal)}</span>
            </div>
            <p className="text-sm">
              <span className="font-medium tabular-nums">{signed(delta)} kcal</span>{" "}
              <span className="text-muted-foreground">gegenüber dem Gesamtumsatz</span>
            </p>
            {targetKcal < basalMetabolicRate ? (
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Unter dem Grundumsatz von {formatNumber(basalMetabolicRate)} kcal. Dauerhaft nur
                  unter Aufsicht und mit Kontrolle der Nährstoffversorgung.
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${trend.tone}`} />
              <span className="text-sm font-medium">{trend.label}</span>
              {!flat ? (
                <span className="ml-auto text-sm font-medium tabular-nums">
                  {signed(projection.weeklyChangeKgNow, 2)} kg / Woche
                </span>
              ) : null}
            </div>
            {flat ? (
              <p className="py-2 text-sm text-muted-foreground">
                Bei diesem Ziel bleibt das Gewicht ungefähr, wo es ist.
              </p>
            ) : (
              <div>
                {MILESTONE_WEEKS.map((week) => (
                  <ProjectionRow
                    key={week}
                    label={`In ${week} Wochen`}
                    value={`${formatNumber(projection.points[week].weightKg, 1)} kg`}
                  />
                ))}
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
              Die Kurve flacht ab, weil der Umsatz mit dem Gewicht sinkt. Schätzung ohne
              klinische Gewähr.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleSave}
          disabled={isSaving || targetKcal === dailyCalorieGoal}
        >
          <Save className="mr-2 h-4 w-4" />
          {targetKcal === dailyCalorieGoal ? "Als Kalorienziel gespeichert" : "Als Kalorienziel speichern"}
        </Button>
      </CardContent>
    </Card>
  )
}
