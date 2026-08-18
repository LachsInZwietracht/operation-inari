"use client"

import { useState } from "react"
import { ArrowRight, Flag, Scale, ShieldAlert, Utensils } from "lucide-react"
import { toast } from "sonner"

import { PlanPrinciplesCard } from "@/components/plan-principles-card"
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
import { MACRO_PRESETS, findMacroPreset } from "@/lib/nutrition/macro-presets"
import { FIBER_TARGET_G } from "@/lib/nutrition/principles"
import type { DietLinePreset, Patient, PatientAllergenEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Matches the bounds the Kalorienrechner and the patient energy card use. */
const MIN_KCAL = 800
const MAX_KCAL = 6000

const NO_PRESET_VALUE = "__none__"

interface PlanStrategyViewProps {
  patient?: Patient
  patientAllergens: PatientAllergenEntry[]
  /** Active Kostform, the one plan-level rule set that belongs to the strategy. */
  dietLine?: DietLinePreset
  /** Nutrient totals of the day currently open in the Tag view, by nutrient id. */
  dayTotals: Record<string, number>
  /** Human-readable date of that day, e.g. "Montag, 18. August 2026". */
  dayLabel: string
  onOpenDay: () => void
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
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

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <GoalCard patient={patient} />

      <TargetsCard
        patient={patient}
        preset={preset}
        macros={macros}
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
        dietLineTargets={dietLine?.targets}
        dayTotals={dayTotals}
      />

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Utensils className="h-4 w-4" />
            Umsetzung
          </CardTitle>
          <CardDescription>
            Die Strategie sagt, wohin es geht. Der Tagesplan ist ein Weg dorthin.
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
function GoalCard({ patient }: { patient?: Patient }) {
  const goalText = patient?.patientGoals?.trim() || patient?.intakeReason?.trim()
  const indications = patient?.indications ?? []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flag className="h-4 w-4" />
          Ziel
        </CardTitle>
        <CardDescription>Was mit diesem Plan erreicht werden soll.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {goalText ? (
          <p className="text-sm whitespace-pre-line">{goalText}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Für diesen Patienten ist kein Ziel hinterlegt. Es kommt aus dem
            Aufnahmebogen oder wird in der Patientenakte eingetragen.
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
  onSavePatient: (updates: Partial<Patient>) => Promise<void>
}

/**
 * The two numbers the whole plan hangs on. Both are stored on the patient, so
 * editing them here changes the strategy everywhere — the Kalorienrechner and
 * the patient overview read the same fields.
 */
function TargetsCard({ patient, preset, macros, onSavePatient }: TargetsCardProps) {
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

  const commitCalories = () => {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(calorieGoal ? String(calorieGoal) : "")
      return
    }
    const clamped = Math.min(MAX_KCAL, Math.max(MIN_KCAL, parsed))
    setDraft(String(clamped))
    if (clamped === calorieGoal) return
    void save({ dailyCalorieGoal: clamped })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Zielwerte</CardTitle>
        <CardDescription>
          Die Zahlen, an denen jeder Tag gemessen wird. Sie gelten für den
          Patienten, nicht nur für diesen Plan.
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
                onBlur={commitCalories}
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

          <div className="space-y-1.5">
            <Label htmlFor="strategy-macro">Makroverteilung</Label>
            <Select
              value={patient?.macroPreset ?? NO_PRESET_VALUE}
              disabled={disabled}
              onValueChange={(value) =>
                void save({ macroPreset: value === NO_PRESET_VALUE ? undefined : value })
              }
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
              </SelectContent>
            </Select>
          </div>
        </div>

        {calorieGoal ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MacroFact label="Eiweiß" grams={macros.protein} percent={preset?.protein} />
            <MacroFact label="Kohlenhydrate" grams={macros.carbs} percent={preset?.carbs} />
            <MacroFact label="Fett" grams={macros.fat} percent={preset?.fat} />
            <MacroFact label="Ballaststoffe" grams={FIBER_TARGET_G} note="DGE" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Ohne Kalorienziel gibt es keine Gramm-Zielwerte. Tragen Sie oben einen
            Wert ein oder berechnen Sie ihn im Kalorienrechner.
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
          <ShieldAlert className="h-4 w-4" />
          Rahmen
        </CardTitle>
        <CardDescription>Was in keinem Tag vorkommen darf.</CardDescription>
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
