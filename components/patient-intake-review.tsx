"use client"

import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { ALLERGEN_TYPE_LABELS } from "@/lib/allergen-constants"
import { DIET_EXCLUSION_LABELS, DIET_STYLE_LABELS } from "@/lib/diet-constants"
import {
  FOOD_PREFERENCE_RATING_LABELS,
  INTAKE_FOOD_PREFERENCE_MAP,
} from "@/lib/intake-food-preferences"
import { describeAllergen } from "@/lib/intake/apply-submission"
import {
  INTAKE_BREAKFAST_LABELS,
  INTAKE_PRIMARY_GOAL_LABELS,
  readBreakfastFrequency,
  readPrimaryGoals,
} from "@/lib/intake/schema"
import type { PatientIntakeSubmission } from "@/lib/types"

const GENDER_LABELS: Record<string, string> = {
  m: "männlich",
  w: "weiblich",
  d: "divers",
}

const JOB_ACTIVITY_LABELS: Record<string, string> = {
  sitzend: "überwiegend sitzend",
  stehend: "viel stehend / gehend",
  koerperlich: "körperlich anstrengend",
}

const COOKING_SKILL_LABELS: Record<string, string> = {
  wenig: "kocht wenig",
  mittel: "kocht gelegentlich",
  viel: "kocht gerne",
}

const BUDGET_LABELS: Record<string, string> = {
  niedrig: "niedrig",
  mittel: "mittel",
  hoch: "hoch",
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Line({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="whitespace-pre-line">{value}</span>
    </p>
  )
}

interface PatientIntakeReviewProps {
  submission: PatientIntakeSubmission
}

/**
 * Read-only rendering of a submitted intake. Nothing here writes — the payload
 * only reaches the patient record when the practitioner applies it.
 */
export function PatientIntakeReview({ submission }: PatientIntakeReviewProps) {
  const payload = submission.payload

  const foodsByRating = useMemo(() => {
    const grouped: Record<string, string[]> = { gerne: [], geht: [], nie: [] }
    for (const entry of payload.foodPreferences ?? []) {
      const label = INTAKE_FOOD_PREFERENCE_MAP.get(entry.foodKey)?.label ?? entry.foodKey
      grouped[entry.rating]?.push(label)
    }
    return grouped
  }, [payload.foodPreferences])

  const bmi = useMemo(() => {
    const heightM = payload.body.heightCm / 100
    if (!heightM) return undefined
    return Math.round((payload.body.weightKg / (heightM * heightM)) * 10) / 10
  }, [payload.body.heightCm, payload.body.weightKg])

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Eingereicht am {new Date(submission.submittedAt).toLocaleString("de-DE")}
      </p>

      <Section title="Person">
        <Line
          label="Name"
          value={`${payload.person.firstName} ${payload.person.lastName}`}
        />
        <Line
          label="Geburtsdatum"
          value={new Date(payload.person.dateOfBirth).toLocaleDateString("de-DE")}
        />
        <Line label="Geschlecht" value={GENDER_LABELS[payload.person.gender]} />
        <Line label="E-Mail" value={payload.person.email} />
        <Line label="Telefon" value={payload.person.phone} />
      </Section>

      <Section title="Ziel">
        <Line
          label={readPrimaryGoals(payload.goal).length > 1 ? "Ziele" : "Ziel"}
          value={readPrimaryGoals(payload.goal)
            .map((goal) => INTAKE_PRIMARY_GOAL_LABELS[goal])
            .join(", ")}
        />
        <Line label="Zeithorizont" value={payload.goal.timeframe} />
        <Line label="Motivation" value={payload.goal.motivation} />
      </Section>

      <Section title="Körper">
        <Line label="Größe" value={`${payload.body.heightCm} cm`} />
        <Line label="Gewicht" value={`${payload.body.weightKg} kg`} />
        <Line label="Wunschgewicht" value={payload.body.goalWeightKg ? `${payload.body.goalWeightKg} kg` : undefined} />
        <Line label="BMI" value={bmi} />
      </Section>

      {payload.activity ? (
        <Section title="Bewegung">
          <Line
            label="Alltag"
            value={
              payload.activity.jobActivity
                ? JOB_ACTIVITY_LABELS[payload.activity.jobActivity]
                : undefined
            }
          />
          <Line label="Trainingstage/Woche" value={payload.activity.trainingDaysPerWeek} />
          <Line label="Sportart" value={payload.activity.trainingType} />
        </Section>
      ) : null}

      {payload.health ? (
        <Section title="Gesundheit">
          {payload.health.conditions?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {payload.health.conditions.map((condition) => (
                <Badge key={condition} variant="secondary">
                  {condition}
                </Badge>
              ))}
            </div>
          ) : null}
          <Line label="Medikamente" value={payload.health.medications} />
          <Line label="Verdauung" value={payload.health.digestion} />
          {payload.health.pregnantOrBreastfeeding ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
              Schwangerschaft / Stillzeit angegeben
            </p>
          ) : null}
        </Section>
      ) : null}

      {payload.allergens?.length ? (
        <Section title="Unverträglichkeiten (Selbstauskunft)">
          <div className="flex flex-wrap gap-1.5">
            {payload.allergens.map((entry) => (
              <Badge key={entry.allergenId} variant="outline">
                {describeAllergen(entry.allergenId)} · {ALLERGEN_TYPE_LABELS[entry.type]}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Wird beim Übernehmen als unbestätigte Selbstauskunft gespeichert.
          </p>
        </Section>
      ) : null}

      {payload.diet ? (
        <Section title="Ernährungsform">
          <Line
            label="Stil"
            value={payload.diet.style ? DIET_STYLE_LABELS[payload.diet.style] : undefined}
          />
          {payload.diet.exclusions?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {payload.diet.exclusions.map((exclusion) => (
                <Badge key={exclusion} variant="outline">
                  {DIET_EXCLUSION_LABELS[exclusion]}
                </Badge>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {payload.foodPreferences?.length ? (
        <Section title="Lebensmittel">
          {(["gerne", "geht", "nie"] as const).map((rating) =>
            foodsByRating[rating]?.length ? (
              <Line
                key={rating}
                label={FOOD_PREFERENCE_RATING_LABELS[rating]}
                value={foodsByRating[rating].join(", ")}
              />
            ) : null,
          )}
        </Section>
      ) : null}

      {payload.habits ? (
        <Section title="Alltag">
          <Line label="Mahlzeiten/Tag" value={payload.habits.mealsPerDay} />
          <Line
            label="Frühstück"
            value={(() => {
              const frequency = readBreakfastFrequency(payload.habits);
              return frequency ? INTAKE_BREAKFAST_LABELS[frequency] : undefined;
            })()}
          />
          <Line
            label="Kochen"
            value={
              payload.habits.cookingSkill
                ? COOKING_SKILL_LABELS[payload.habits.cookingSkill]
                : undefined
            }
          />
          <Line label="Minuten pro Mahlzeit" value={payload.habits.minutesPerMeal} />
          <Line label="Auswärts essen/Woche" value={payload.habits.eatsOutPerWeek} />
          <Line label="Wer kocht" value={payload.habits.whoCooks} />
          <Line
            label="Budget"
            value={payload.habits.budget ? BUDGET_LABELS[payload.habits.budget] : undefined}
          />
          <Line label="Snacks" value={payload.habits.snacking} />
          <Line label="Kaffee/Tag" value={payload.habits.coffeePerDay} />
          <Line label="Alkohol/Woche" value={payload.habits.alcoholPerWeek} />
          <Line label="Schlaf" value={payload.habits.sleepHours ? `${payload.habits.sleepHours} h` : undefined} />
          <Line
            label="Wasser"
            value={
              payload.habits.waterLitersPerDay
                ? `${payload.habits.waterLitersPerDay} l/Tag`
                : undefined
            }
          />
        </Section>
      ) : null}

      {payload.history ? (
        <Section title="Erfahrung">
          <Line label="Bisher probiert" value={payload.history.previousDiets} />
          <Line label="Hat funktioniert" value={payload.history.whatWorked} />
          <Line label="Hat nicht funktioniert" value={payload.history.whatFailed} />
        </Section>
      ) : null}

      {payload.consent.notes ? (
        <Section title="Anmerkungen">
          <Line label="Frei ergänzt" value={payload.consent.notes} />
        </Section>
      ) : null}
    </div>
  )
}
