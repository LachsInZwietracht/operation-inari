"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Pencil, Plus, X } from "lucide-react"

import { PatientIntakeReview } from "@/components/patient-intake-review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ALLERGEN_DEFINITIONS, ALLERGEN_TYPE_LABELS } from "@/lib/allergen-constants"
import { DIET_EXCLUSIONS, DIET_EXCLUSION_LABELS, DIET_STYLES, DIET_STYLE_LABELS } from "@/lib/diet-constants"
import { INTAKE_FOOD_PREFERENCES } from "@/lib/intake-food-preferences"
import { findIntakeReviewWarnings } from "@/lib/intake/review-rules"
import { INTAKE_PRIMARY_GOALS, INTAKE_PRIMARY_GOAL_LABELS, readPrimaryGoals } from "@/lib/intake/schema"
import type { DietExclusion, DietStyle, Gender, PatientIntakePayload, PatientIntakeSubmission } from "@/lib/types"

interface PatientIntakeReviewEditorProps {
  submission: PatientIntakeSubmission
  payload: PatientIntakePayload
  onPayloadChange: (payload: PatientIntakePayload) => void
  reviewerNotes: string
  onReviewerNotesChange: (notes: string) => void
}

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function PatientIntakeReviewEditor({
  submission,
  payload,
  onPayloadChange,
  reviewerNotes,
  onReviewerNotesChange,
}: PatientIntakeReviewEditorProps) {
  const [editing, setEditing] = useState(false)
  const [allergenToAdd, setAllergenToAdd] = useState("")
  const warnings = useMemo(() => findIntakeReviewWarnings(payload), [payload])

  const reviewedSubmission = useMemo(
    () => ({ ...submission, payload }),
    [submission, payload],
  )

  function updatePerson<K extends keyof PatientIntakePayload["person"]>(
    key: K,
    value: PatientIntakePayload["person"][K],
  ) {
    onPayloadChange({ ...payload, person: { ...payload.person, [key]: value } })
  }

  function updateBody<K extends keyof PatientIntakePayload["body"]>(
    key: K,
    value: PatientIntakePayload["body"][K],
  ) {
    onPayloadChange({ ...payload, body: { ...payload.body, [key]: value } })
  }

  const selectedGoals = readPrimaryGoals(payload.goal)

  /**
   * Writes both goal fields together. The scalar stays in step with the array's
   * first entry so the two never disagree about what the patient came for.
   * Deselecting the last goal is refused — the record has to say something.
   */
  function toggleGoal(goal: PatientIntakePayload["goal"]["primaryGoal"]) {
    const next = selectedGoals.includes(goal)
      ? selectedGoals.filter((entry) => entry !== goal)
      : [...selectedGoals, goal]
    if (next.length === 0) return
    onPayloadChange({
      ...payload,
      goal: { ...payload.goal, primaryGoal: next[0], primaryGoals: next },
    })
  }

  function updateFoodRating(foodKey: string, rating: "" | "gerne" | "geht" | "nie") {
    const remaining = (payload.foodPreferences ?? []).filter((entry) => entry.foodKey !== foodKey)
    onPayloadChange({
      ...payload,
      foodPreferences: rating ? [...remaining, { foodKey, rating }] : remaining,
    })
  }

  function toggleExclusion(exclusion: DietExclusion) {
    const current = new Set(payload.diet?.exclusions ?? [])
    if (current.has(exclusion)) current.delete(exclusion)
    else current.add(exclusion)
    onPayloadChange({
      ...payload,
      diet: { ...payload.diet, exclusions: [...current] },
    })
  }

  function addAllergen() {
    if (!allergenToAdd || payload.allergens?.some((entry) => entry.allergenId === allergenToAdd)) {
      return
    }
    onPayloadChange({
      ...payload,
      allergens: [
        ...(payload.allergens ?? []),
        { allergenId: allergenToAdd, type: "intolerance" },
      ],
    })
    setAllergenToAdd("")
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label="Automatische Prüfung">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Automatische Plausibilitätsprüfung</h3>
            <Badge variant={warnings.length > 0 ? "destructive" : "secondary"}>
              {warnings.length > 0 ? `${warnings.length} zu klären` : "Keine Widersprüche"}
            </Badge>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing((value) => !value)}>
            <Pencil className="mr-1.5 size-3.5" />
            {editing ? "Bearbeitung schließen" : "Angaben bearbeiten"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Die Regeln finden klare Widersprüche. Sie treffen keine medizinische Entscheidung.
        </p>
        {warnings.map((warning) => (
          <div key={warning.id} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium">{warning.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{warning.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {editing ? (
        <div className="space-y-6 rounded-xl border bg-muted/20 p-4">
          <EditorSection title="Person">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vorname">
                <Input value={payload.person.firstName} onChange={(event) => updatePerson("firstName", event.target.value)} />
              </Field>
              <Field label="Nachname">
                <Input value={payload.person.lastName} onChange={(event) => updatePerson("lastName", event.target.value)} />
              </Field>
              <Field label="Geburtsdatum">
                <Input type="date" value={payload.person.dateOfBirth} onChange={(event) => updatePerson("dateOfBirth", event.target.value)} />
              </Field>
              <Field label="Geschlecht">
                <select className={fieldClass} value={payload.person.gender} onChange={(event) => updatePerson("gender", event.target.value as Gender)}>
                  <option value="m">männlich</option>
                  <option value="w">weiblich</option>
                  <option value="d">divers</option>
                </select>
              </Field>
              <Field label="E-Mail">
                <Input type="email" value={payload.person.email ?? ""} onChange={(event) => updatePerson("email", event.target.value || undefined)} />
              </Field>
              <Field label="Telefon">
                <Input value={payload.person.phone ?? ""} onChange={(event) => updatePerson("phone", event.target.value || undefined)} />
              </Field>
            </div>
          </EditorSection>

          <EditorSection title="Ziel und Körper">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ziele">
                <div className="flex flex-wrap gap-1.5">
                  {INTAKE_PRIMARY_GOALS.map((goal) => {
                    const active = selectedGoals.includes(goal)
                    return (
                      <Button
                        key={goal}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        aria-pressed={active}
                        onClick={() => toggleGoal(goal)}
                      >
                        {INTAKE_PRIMARY_GOAL_LABELS[goal]}
                      </Button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Zeithorizont">
                <Input value={payload.goal.timeframe ?? ""} onChange={(event) => onPayloadChange({ ...payload, goal: { ...payload.goal, timeframe: event.target.value || undefined } })} />
              </Field>
              <Field label="Größe in cm">
                <Input type="number" min={50} max={260} value={payload.body.heightCm} onChange={(event) => updateBody("heightCm", Number(event.target.value))} />
              </Field>
              <Field label="Gewicht in kg">
                <Input type="number" min={20} max={400} step="0.1" value={payload.body.weightKg} onChange={(event) => updateBody("weightKg", Number(event.target.value))} />
              </Field>
              <Field label="Wunschgewicht in kg">
                <Input type="number" min={20} max={400} step="0.1" value={payload.body.goalWeightKg ?? ""} onChange={(event) => updateBody("goalWeightKg", event.target.value ? Number(event.target.value) : undefined)} />
              </Field>
            </div>
            <Field label="Motivation">
              <Textarea rows={3} value={payload.goal.motivation ?? ""} onChange={(event) => onPayloadChange({ ...payload, goal: { ...payload.goal, motivation: event.target.value || undefined } })} />
            </Field>
          </EditorSection>

          <EditorSection title="Gesundheit">
            <Field label="Diagnosen und Beschwerden, durch Komma getrennt">
              <Input
                value={payload.health?.conditions?.join(", ") ?? ""}
                onChange={(event) => onPayloadChange({
                  ...payload,
                  health: {
                    ...payload.health,
                    conditions: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                  },
                })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Medikamente">
                <Textarea rows={3} value={payload.health?.medications ?? ""} onChange={(event) => onPayloadChange({ ...payload, health: { ...payload.health, medications: event.target.value || undefined } })} />
              </Field>
              <Field label="Verdauung">
                <Textarea rows={3} value={payload.health?.digestion ?? ""} onChange={(event) => onPayloadChange({ ...payload, health: { ...payload.health, digestion: event.target.value || undefined } })} />
              </Field>
            </div>
          </EditorSection>

          <EditorSection title="Ernährungsform und Ausschlüsse">
            <Field label="Ernährungsform">
              <select
                className={fieldClass}
                value={payload.diet?.style ?? ""}
                onChange={(event) => onPayloadChange({ ...payload, diet: { ...payload.diet, style: (event.target.value || undefined) as DietStyle | undefined } })}
              >
                <option value="">Keine Angabe</option>
                {DIET_STYLES.map((style) => <option key={style} value={style}>{DIET_STYLE_LABELS[style]}</option>)}
              </select>
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              {DIET_EXCLUSIONS.map((exclusion) => (
                <label key={exclusion} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                  <input type="checkbox" checked={payload.diet?.exclusions?.includes(exclusion) ?? false} onChange={() => toggleExclusion(exclusion)} />
                  {DIET_EXCLUSION_LABELS[exclusion]}
                </label>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Allergien und Unverträglichkeiten">
            <div className="space-y-2">
              {(payload.allergens ?? []).map((entry) => (
                <div key={entry.allergenId} className="flex items-center gap-2 rounded-md border bg-background p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{ALLERGEN_DEFINITIONS.find((item) => item.id === entry.allergenId)?.label ?? entry.allergenId}</span>
                  <select
                    className={`${fieldClass} w-36`}
                    value={entry.type}
                    onChange={(event) => onPayloadChange({ ...payload, allergens: (payload.allergens ?? []).map((item) => item.allergenId === entry.allergenId ? { ...item, type: event.target.value as "allergy" | "intolerance" } : item) })}
                  >
                    {(["allergy", "intolerance"] as const).map((type) => <option key={type} value={type}>{ALLERGEN_TYPE_LABELS[type]}</option>)}
                  </select>
                  <Button type="button" size="icon" variant="ghost" onClick={() => onPayloadChange({ ...payload, allergens: (payload.allergens ?? []).filter((item) => item.allergenId !== entry.allergenId) })}>
                    <X className="size-4" />
                    <span className="sr-only">Entfernen</span>
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <select className={fieldClass} value={allergenToAdd} onChange={(event) => setAllergenToAdd(event.target.value)}>
                <option value="">Eintrag auswählen</option>
                {ALLERGEN_DEFINITIONS.filter((definition) => !payload.allergens?.some((entry) => entry.allergenId === definition.id)).map((definition) => (
                  <option key={definition.id} value={definition.id}>{definition.label}</option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={addAllergen} disabled={!allergenToAdd}>
                <Plus className="mr-1.5 size-4" /> Hinzufügen
              </Button>
            </div>
          </EditorSection>

          <EditorSection title="Lebensmittel">
            <p className="text-xs text-muted-foreground">Ändere eine Bewertung, um einen Widerspruch direkt zu klären.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {INTAKE_FOOD_PREFERENCES.map((food) => {
                const rating = payload.foodPreferences?.find((entry) => entry.foodKey === food.id)?.rating ?? ""
                return (
                  <label key={food.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <span>{food.label}</span>
                    <select className={`${fieldClass} w-28`} value={rating} onChange={(event) => updateFoodRating(food.id, event.target.value as "" | "gerne" | "geht" | "nie")}>
                      <option value="">Ohne Angabe</option>
                      <option value="gerne">Gerne</option>
                      <option value="geht">Geht</option>
                      <option value="nie">Nie</option>
                    </select>
                  </label>
                )
              })}
            </div>
          </EditorSection>
        </div>
      ) : (
        <PatientIntakeReview submission={reviewedSubmission} />
      )}

      <section className="space-y-2">
        <Label htmlFor="intake-review-notes">Interne Notiz zur Prüfung</Label>
        <Textarea
          id="intake-review-notes"
          rows={3}
          maxLength={4_000}
          value={reviewerNotes}
          onChange={(event) => onReviewerNotesChange(event.target.value)}
          placeholder="Zum Beispiel: Widerspruch telefonisch geklärt; Garnelen werden nicht vertragen."
        />
        <p className="text-xs text-muted-foreground">
          Die Notiz wird mit der Prüfung gespeichert und in die Patientenakte übernommen.
        </p>
      </section>
    </div>
  )
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}
