"use client"

import { useState } from "react"
import { ArrowRight, CalendarRange, Scale, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { PlanPrinciplesCard } from "@/components/plan-principles-card"
import { DirectionIcon, StrategyIcon } from "@/components/strategy-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALLERGEN_MAP, ALLERGEN_TYPE_LABELS } from "@/lib/allergen-constants"
import { macroGramsFromKcal } from "@/lib/client-targets"
import { DIET_EXCLUSION_LABELS, DIET_STYLE_LABELS } from "@/lib/diet-constants"
import { formatNumber } from "@/lib/format"
import { parsePatientGoals } from "@/lib/intake/patient-goals"
import {
  CUSTOM_MACRO_LABEL,
  MACRO_PRESETS,
  findMacroPreset,
  isCustomMacroPreset,
  isValidMacroSplit,
  serializeMacroSplit,
  type MacroSplit,
} from "@/lib/nutrition/macro-presets"
import { FIBER_TARGET_G } from "@/lib/nutrition/principles"
import type { DietLinePreset, Patient, PatientAllergenEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Matches the bounds the Kalorienrechner and the patient energy card use. */
const MIN_KCAL = 800
const MAX_KCAL = 6000

const NO_PRESET_VALUE = "__none__"
const CUSTOM_SELECT_VALUE = "__custom__"

/** Steps a counselor would actually prescribe either side of maintenance. */
const DEFICIT_KCAL = 500
const SURPLUS_KCAL = 300
/** Below this the target is close enough to maintenance to call it flat. */
const FLAT_KCAL = 75

/**
 * The patient's current energy figures, handed down from the record.
 *
 * The plan strategy needs them to say what a calorie target *means*. Passed in
 * rather than recomputed so the planner and the patient overview cannot quote
 * two different maintenance requirements for the same person.
 */
export interface PatientEnergyContext {
  weightKg?: number
  basalMetabolicRate?: number
  totalEnergyExpenditure?: number
  pal?: number
}

type Direction = "reduce" | "hold" | "build"

interface DirectionMeta {
  id: Direction
  label: string
  tone: string
}

const DIRECTIONS: Record<Direction, DirectionMeta> = {
  reduce: { id: "reduce", label: "Abnehmen", tone: "text-sky-500" },
  hold: { id: "hold", label: "Gewicht halten", tone: "text-muted-foreground" },
  build: { id: "build", label: "Aufbauen", tone: "text-amber-600" },
}

/**
 * Which way the weight is supposed to go, from the two facts on the record.
 *
 * Read from the goal weight against the current one rather than from the free
 * text in "Ziel": a counselor writing "Muskeln aufbauen" means something the
 * app cannot verify, while 91 kg heading for 95 kg is a fact it can.
 */
function intendedDirection(goalWeightKg?: number, currentWeightKg?: number): Direction | null {
  if (goalWeightKg === undefined || currentWeightKg === undefined) return null
  const difference = goalWeightKg - currentWeightKg
  if (Math.abs(difference) < 0.5) return "hold"
  return difference > 0 ? "build" : "reduce"
}

/** Which way the calorie target actually points, against maintenance. */
function targetDirection(calorieGoal?: number, maintenance?: number): Direction | null {
  if (!calorieGoal || !maintenance) return null
  const delta = calorieGoal - maintenance
  if (Math.abs(delta) < FLAT_KCAL) return "hold"
  return delta > 0 ? "build" : "reduce"
}

interface PlanStrategyViewProps {
  patient?: Patient
  patientAllergens: PatientAllergenEntry[]
  energyContext?: PatientEnergyContext
  /** Active Kostform, the one plan-level rule set that belongs to the strategy. */
  dietLine?: DietLinePreset
  /** Nutrient totals of the day currently open in the Tag view, by nutrient id. */
  dayTotals: Record<string, number>
  /** Human-readable date of that day, e.g. "Montag, 18. August 2026". */
  dayLabel: string
  onOpenDay: () => void
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
}

interface PlanStatusGuidanceProps {
  patient: Patient
  patientAllergens: PatientAllergenEntry[]
  energyContext?: PatientEnergyContext
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
}

/**
 * Patient-wide rules that must be decided before a concrete week is built.
 *
 * The patient cockpit owns these values now: they apply to every future plan,
 * while a Kostform remains plan-specific and therefore stays in the builder.
 */
export function PlanStatusGuidance({
  patient,
  patientAllergens,
  energyContext,
  onSavePatient,
}: PlanStatusGuidanceProps) {
  const calorieGoal = patient.dailyCalorieGoal
  const macros = calorieGoal ? macroGramsFromKcal(calorieGoal, patient.macroPreset) : {}
  const preset = findMacroPreset(patient.macroPreset)
  const allergies = patientAllergens.filter((entry) => entry.type !== "preference")
  const exclusions = patient.nutritionPreferences ?? []
  const goalDirection = intendedDirection(patient.goalWeight, energyContext?.weightKg)

  return (
    <section className="space-y-4">
      <div className="px-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
          Leitplanken
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
          Was für jede Planwoche gelten soll
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Zielwerte und Ausschlüsse werden einmal am Patienten festgelegt. Die
          Wochenplanung setzt sie anschließend konkret um.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TargetsCard
          patient={patient}
          preset={preset}
          macros={macros}
          energyContext={energyContext}
          goalDirection={goalDirection}
          onSavePatient={onSavePatient}
        />
        <FrameCard
          patient={patient}
          allergies={allergies}
          exclusions={exclusions}
        />
      </div>
    </section>
  )
}

/**
 * The strategy half of a meal plan: what the plan is supposed to achieve and
 * the numbers it will be measured against.
 *
 * Everything here lives on the patient record rather than on a single day, so
 * it stays true across every day the counselor builds. The Tag and Woche views
 * are one concrete way to reach it — this view is the reason they look the way
 * they do.
 */
export function PlanStrategyView({
  patient,
  patientAllergens,
  energyContext,
  dietLine,
  dayTotals,
  dayLabel,
  onOpenDay,
  onSavePatient,
}: PlanStrategyViewProps) {
  const calorieGoal = patient?.dailyCalorieGoal
  const macros = calorieGoal ? macroGramsFromKcal(calorieGoal, patient?.macroPreset) : {}
  const preset = findMacroPreset(patient?.macroPreset)
  const dayKcal = dayTotals.energie ?? 0

  const allergies = patientAllergens.filter((entry) => entry.type !== "preference")
  const exclusions = patient?.nutritionPreferences ?? []

  const goalDirection = intendedDirection(patient?.goalWeight, energyContext?.weightKg)

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <GoalCard patient={patient} direction={goalDirection} />

      <TargetsCard
        patient={patient}
        preset={preset}
        macros={macros}
        energyContext={energyContext}
        goalDirection={goalDirection}
        onSavePatient={onSavePatient}
      />

      <FrameCard
        patient={patient}
        allergies={allergies}
        exclusions={exclusions}
        dietLine={dietLine}
      />

      <PlanPrinciplesCard
        calorieGoal={calorieGoal}
        macroPreset={patient?.macroPreset}
        dietStyle={patient?.dietStyle}
        exclusions={exclusions}
        weightKg={energyContext?.weightKg}
        dietLineTargets={dietLine?.targets}
        dayTotals={dayTotals}
        overrides={patient?.planPrinciples}
        onSaveOverrides={
          patient ? (next) => onSavePatient({ planPrinciples: next }) : undefined
        }
      />

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StrategyIcon name="umsetzung" />
            Umsetzung
          </CardTitle>
          <CardDescription>
            Der Tagesplan setzt die Zielwerte oben in Mahlzeiten um.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium capitalize">{dayLabel}</p>
            <p className="text-muted-foreground">
              {dayKcal > 0
                ? `${formatNumber(Math.round(dayKcal))} kcal geplant`
                : "Noch nichts geplant"}
              {calorieGoal ? ` · Ziel ${formatNumber(calorieGoal)} kcal` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={onOpenDay}>
            Zum Tagesplan
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/** What is supposed to happen, in the patient's own terms. */
function GoalCard({ patient, direction }: { patient?: Patient; direction: Direction | null }) {
  // The card is already titled "Ziel", so the intake's own "Ziel:" label is
  // stripped off rather than printed under it. See lib/intake/patient-goals.
  const goals = parsePatientGoals(patient?.patientGoals)
  const goalText = goals.goal ?? patient?.intakeReason?.trim()
  const indications = patient?.indications ?? []
  const meta = direction ? DIRECTIONS[direction] : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <StrategyIcon name="ziel" />
          Ziel
        </CardTitle>
        <CardDescription>Wohin die Beratung führen soll.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* The direction, drawn from the goal weight rather than from the free
            text: it is the half of the goal the plan can actually be checked
            against. */}
        {meta ? (
          <div className="flex items-center gap-2">
            <DirectionIcon direction={meta.id} className={meta.tone} />
            <span className="text-sm font-medium">{meta.label}</span>
          </div>
        ) : null}

        {goalText ? (
          <p className="text-sm whitespace-pre-line">{goalText}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Noch kein Ziel hinterlegt. Es kommt aus dem Aufnahmebogen oder wird in
            der Patientenakte eingetragen.
          </p>
        )}

        {patient?.goalWeight ? (
          <div className="flex items-center gap-2 text-sm">
            <Scale className="text-muted-foreground h-4 w-4" />
            <span>
              Zielgewicht{" "}
              <span className="font-medium">{formatNumber(patient.goalWeight)} kg</span>
            </span>
          </div>
        ) : null}

        {goals.timeframe ? (
          <div className="flex items-center gap-2 text-sm">
            <CalendarRange className="text-muted-foreground h-4 w-4" />
            <span>
              Zeithorizont <span className="font-medium">{goals.timeframe}</span>
            </span>
          </div>
        ) : null}

        {/* In the patient's own words. It decides nothing, and it is the line a
            counselor wants in front of them when the plan gets hard. */}
        {goals.motivation ? (
          <p className="text-muted-foreground border-l-2 pl-3 text-sm whitespace-pre-line">
            {goals.motivation}
          </p>
        ) : null}

        {indications.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {indications.map((indication) => (
              <Badge key={indication} variant="secondary">
                {indication}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface TargetsCardProps {
  patient?: Patient
  preset?: { id: string; label: string; carbs: number; fat: number; protein: number }
  macros: { protein?: number; fat?: number; carbs?: number }
  energyContext?: PatientEnergyContext
  goalDirection: Direction | null
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
}

/**
 * The two numbers the whole plan hangs on. Both are stored on the patient, so
 * editing them here changes the strategy everywhere — the Kalorienrechner and
 * the patient overview read the same fields.
 */
function TargetsCard({
  patient,
  preset,
  macros,
  energyContext,
  goalDirection,
  onSavePatient,
}: TargetsCardProps) {
  const calorieGoal = patient?.dailyCalorieGoal
  const [draft, setDraft] = useState(calorieGoal ? String(calorieGoal) : "")
  const [isSaving, setIsSaving] = useState(false)

  // Keep the field in step with the record without an effect: when the stored
  // goal changes underneath us (patient switch, save elsewhere), reset the draft
  // during render instead of after it.
  const [lastGoal, setLastGoal] = useState(calorieGoal)
  if (calorieGoal !== lastGoal) {
    setLastGoal(calorieGoal)
    setDraft(calorieGoal ? String(calorieGoal) : "")
  }

  const disabled = !patient || isSaving
  const maintenance = energyContext?.totalEnergyExpenditure

  const save = async (updates: Partial<Patient>) => {
    if (!patient) return
    setIsSaving(true)
    try {
      await onSavePatient(updates)
      toast.success("Strategie gespeichert.")
    } catch {
      toast.error("Speichern fehlgeschlagen.")
    } finally {
      setIsSaving(false)
    }
  }

  const commitCalories = (value: number) => {
    const clamped = Math.min(MAX_KCAL, Math.max(MIN_KCAL, Math.round(value)))
    setDraft(String(clamped))
    if (clamped === calorieGoal) return
    void save({ dailyCalorieGoal: clamped })
  }

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(calorieGoal ? String(calorieGoal) : "")
      return
    }
    commitCalories(parsed)
  }

  const delta = calorieGoal && maintenance ? calorieGoal - maintenance : undefined
  const actualDirection = targetDirection(calorieGoal, maintenance)
  // Worth saying out loud: the record says one thing, the number says another.
  const conflict =
    goalDirection !== null &&
    actualDirection !== null &&
    goalDirection !== actualDirection &&
    goalDirection !== "hold"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <StrategyIcon name="zielwerte" />
          Zielwerte
        </CardTitle>
        <CardDescription>
          Jeder Tag wird an diesen Zahlen gemessen. Sie hängen am Patienten und
          gelten deshalb auch für jeden weiteren Plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="strategy-kcal">Energie pro Tag</Label>
            <div className="flex items-center gap-2">
              <Input
                id="strategy-kcal"
                type="number"
                inputMode="numeric"
                min={MIN_KCAL}
                max={MAX_KCAL}
                step={10}
                value={draft}
                disabled={disabled}
                placeholder="—"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }}
                className="w-28"
              />
              <span className="text-muted-foreground text-sm">kcal</span>
            </div>
          </div>

          <MacroField patient={patient} preset={preset} disabled={disabled} onSave={save} />
        </div>

        {/* What the number means. A bare "2.100 kcal" says nothing about
            whether this plan is meant to take weight off or put it on. */}
        {maintenance ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {actualDirection ? (
                <>
                  <DirectionIcon
                    direction={actualDirection}
                    className={DIRECTIONS[actualDirection].tone}
                  />
                  <span className="font-medium">{DIRECTIONS[actualDirection].label}</span>
                </>
              ) : null}
              {delta !== undefined ? (
                <span className="text-muted-foreground tabular-nums">
                  {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                  {formatNumber(Math.abs(delta))} kcal gegenüber dem Erhaltungsbedarf von{" "}
                  {formatNumber(maintenance)} kcal
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Erhaltungsbedarf {formatNumber(maintenance)} kcal
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => commitCalories(maintenance - DEFICIT_KCAL)}
              >
                Defizit −{formatNumber(DEFICIT_KCAL)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => commitCalories(maintenance)}
              >
                Erhalt
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => commitCalories(maintenance + SURPLUS_KCAL)}
              >
                Aufbau +{formatNumber(SURPLUS_KCAL)}
              </Button>
            </div>

            {conflict && goalDirection ? (
              <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-500">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Das Ziel lautet {DIRECTIONS[goalDirection].label.toLowerCase()}, das
                  Tagesziel liegt aber{" "}
                  {actualDirection === "hold"
                    ? "beim Erhaltungsbedarf"
                    : actualDirection === "reduce"
                      ? "darunter"
                      : "darüber"}
                  .
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {calorieGoal ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MacroFact label="Eiweiß" grams={macros.protein} percent={preset?.protein} />
            <MacroFact label="Kohlenhydrate" grams={macros.carbs} percent={preset?.carbs} />
            <MacroFact label="Fett" grams={macros.fat} percent={preset?.fat} />
            <MacroFact label="Ballaststoffe" grams={FIBER_TARGET_G} note="DGE" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Gramm-Zielwerte entstehen erst aus dem Kalorienziel. Tragen Sie oben
            einen Wert ein oder holen Sie ihn aus dem Kalorienrechner.
          </p>
        )}

        {calorieGoal && !preset ? (
          <p className="text-muted-foreground text-sm">
            Ohne Makroverteilung bleiben Eiweiß, Kohlenhydrate und Fett offen.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * The macro split: one of the presets, or three percentages typed by hand.
 *
 * The presets cover the common cases and nothing else, which made the field
 * useless the moment a counselor wanted 45/25/30. A hand-set split is stored in
 * the same column as the preset ids (`custom:45/25/30`), so everything that
 * already reads that column keeps working.
 */
function MacroField({
  patient,
  preset,
  disabled,
  onSave,
}: {
  patient?: Patient
  preset?: { carbs: number; fat: number; protein: number }
  disabled: boolean
  onSave: (updates: Partial<Patient>) => Promise<void>
}) {
  const isCustom = isCustomMacroPreset(patient?.macroPreset)
  const [split, setSplit] = useState<MacroSplit>(() => ({
    carbs: preset?.carbs ?? 50,
    fat: preset?.fat ?? 30,
    protein: preset?.protein ?? 20,
  }))
  const [showCustom, setShowCustom] = useState(isCustom)

  // Follow the record when it changes underneath us — a patient switch, or a
  // preset picked somewhere else — without an effect.
  const [lastPresetId, setLastPresetId] = useState(patient?.macroPreset)
  if (patient?.macroPreset !== lastPresetId) {
    setLastPresetId(patient?.macroPreset)
    setShowCustom(isCustomMacroPreset(patient?.macroPreset))
    if (preset) setSplit({ carbs: preset.carbs, fat: preset.fat, protein: preset.protein })
  }

  const sum = split.carbs + split.fat + split.protein
  const valid = isValidMacroSplit(split)

  const setPart = (key: keyof MacroSplit, raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    setSplit((previous) => ({
      ...previous,
      [key]: Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0,
    }))
  }

  const commitSplit = () => {
    if (!valid) return
    const serialized = serializeMacroSplit(split)
    if (serialized === patient?.macroPreset) return
    void onSave({ macroPreset: serialized })
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="strategy-macro">Makroverteilung</Label>
      <Select
        value={
          showCustom
            ? CUSTOM_SELECT_VALUE
            : (patient?.macroPreset ?? NO_PRESET_VALUE)
        }
        disabled={disabled}
        onValueChange={(value) => {
          if (value === CUSTOM_SELECT_VALUE) {
            setShowCustom(true)
            return
          }
          setShowCustom(false)
          void onSave({ macroPreset: value === NO_PRESET_VALUE ? undefined : value })
        }}
      >
        <SelectTrigger id="strategy-macro" className="w-full">
          <SelectValue placeholder="Keine gewählt" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PRESET_VALUE}>Keine gewählt</SelectItem>
          {MACRO_PRESETS.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_SELECT_VALUE}>{CUSTOM_MACRO_LABEL}</SelectItem>
        </SelectContent>
      </Select>

      {showCustom ? (
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <MacroPercentInput
              id="macro-carbs"
              label="KH"
              value={split.carbs}
              disabled={disabled}
              onChange={(raw) => setPart("carbs", raw)}
              onCommit={commitSplit}
            />
            <MacroPercentInput
              id="macro-fat"
              label="Fett"
              value={split.fat}
              disabled={disabled}
              onChange={(raw) => setPart("fat", raw)}
              onCommit={commitSplit}
            />
            <MacroPercentInput
              id="macro-protein"
              label="Eiweiß"
              value={split.protein}
              disabled={disabled}
              onChange={(raw) => setPart("protein", raw)}
              onCommit={commitSplit}
            />
          </div>
          <p
            className={cn(
              "text-xs tabular-nums",
              valid ? "text-muted-foreground" : "text-destructive",
            )}
          >
            Summe {sum} % {valid ? "" : "— muss 100 % ergeben"}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function MacroPercentInput({
  id,
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  id: string
  label: string
  value: number
  disabled: boolean
  onChange: (raw: string) => void
  onCommit: () => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={5}
          value={String(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          className="h-8 w-full px-2 tabular-nums"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

function MacroFact({
  label,
  grams,
  percent,
  note,
}: {
  label: string
  grams?: number
  percent?: number
  note?: string
}) {
  return (
    <div className="bg-muted/40 rounded-md px-3 py-2" data-testid={`strategy-macro-${label}`}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("text-sm font-medium", grams === undefined && "text-muted-foreground")}>
        {grams === undefined ? "—" : `${formatNumber(grams)} g`}
      </p>
      {percent !== undefined ? (
        <p className="text-muted-foreground text-xs">{percent} % der Energie</p>
      ) : note ? (
        <p className="text-muted-foreground text-xs">{note}</p>
      ) : null}
    </div>
  )
}

interface FrameCardProps {
  patient?: Patient
  allergies: PatientAllergenEntry[]
  exclusions: Patient["nutritionPreferences"]
  dietLine?: DietLinePreset
}

/** The hard limits every day has to respect, whatever the numbers say. */
function FrameCard({ patient, allergies, exclusions, dietLine }: FrameCardProps) {
  const hasFrame =
    Boolean(patient?.dietStyle) || (exclusions?.length ?? 0) > 0 || allergies.length > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <StrategyIcon name="rahmen" />
          Rahmen
        </CardTitle>
        <CardDescription>Was auf keinen Teller darf.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasFrame ? (
          <div className="flex flex-wrap gap-1.5">
            {patient?.dietStyle ? (
              <Badge variant="outline">{DIET_STYLE_LABELS[patient.dietStyle]}</Badge>
            ) : null}
            {exclusions?.map((exclusion) => (
              <Badge key={exclusion} variant="outline">
                {DIET_EXCLUSION_LABELS[exclusion]}
              </Badge>
            ))}
            {allergies.map((entry) => (
              <Badge key={entry.id} variant="destructive">
                {ALLERGEN_MAP.get(entry.allergenId)?.label ?? entry.allergenId} (
                {ALLERGEN_TYPE_LABELS[entry.type]})
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Keine Einschränkungen hinterlegt.
          </p>
        )}

        {dietLine ? (
          <div className="border-t pt-3">
            <p className="text-sm font-medium">Kostform: {dietLine.name}</p>
            {dietLine.description ? (
              <p className="text-muted-foreground mt-0.5 text-sm">{dietLine.description}</p>
            ) : null}
            {dietLine.targets.length > 0 ? (
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                {dietLine.targets.map((target) => (
                  <li key={target.nutrientId}>
                    {target.label}:{" "}
                    {target.min !== undefined && target.max !== undefined
                      ? `${formatNumber(target.min)}–${formatNumber(target.max)} ${target.unit}`
                      : target.min !== undefined
                        ? `mind. ${formatNumber(target.min)} ${target.unit}`
                        : target.max !== undefined
                          ? `max. ${formatNumber(target.max)} ${target.unit}`
                          : "—"}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
