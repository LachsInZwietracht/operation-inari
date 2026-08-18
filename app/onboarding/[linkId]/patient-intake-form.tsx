"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGEN_DEFINITIONS } from "@/lib/allergen-constants";
import {
  DIET_EXCLUSIONS,
  DIET_EXCLUSION_LABELS,
  DIET_STYLES,
  DIET_STYLE_DESCRIPTIONS,
  DIET_STYLE_LABELS,
} from "@/lib/diet-constants";
import {
  FOOD_PREFERENCE_GROUP_LABELS,
  FOOD_PREFERENCE_RATING_LABELS,
  INTAKE_FOOD_PREFERENCES,
  INTAKE_FOOD_PREFERENCE_GROUPS,
} from "@/lib/intake-food-preferences";
import {
  INTAKE_BREAKFAST_FREQUENCIES,
  INTAKE_BREAKFAST_LABELS,
  INTAKE_CONDITION_OPTIONS,
  INTAKE_PRIMARY_GOALS,
  INTAKE_PRIMARY_GOAL_LABELS,
  type IntakePayloadInput,
} from "@/lib/intake/schema";
import type { FoodPreferenceRating } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Form schema                                                         */
/* ------------------------------------------------------------------ */

/**
 * Numeric answers are kept as strings so an empty field stays empty instead of
 * collapsing to NaN, and so German comma decimals ("1,8") are accepted.
 */
function parseNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const requiredNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      const parsed = parseNumber(value);
      return parsed !== undefined && parsed >= min && parsed <= max;
    }, message);

const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      const parsed = parseNumber(value);
      return parsed !== undefined && parsed >= min && parsed <= max;
    }, message);

const formSchema = z.object({
  firstName: z.string().trim().min(1, "Bitte Vornamen angeben").max(100),
  lastName: z.string().trim().min(1, "Bitte Nachnamen angeben").max(100),
  dateOfBirth: z
    .string()
    .trim()
    .min(1, "Bitte Geburtsdatum angeben")
    .refine((value) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return false;
      const now = new Date();
      const earliest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
      return parsed <= now && parsed >= earliest;
    }, "Bitte ein gültiges Geburtsdatum angeben"),
  gender: z.enum(["m", "w", "d"], { message: "Bitte auswählen" }),
  email: z.union([z.string().trim().email("Bitte gültige E-Mail angeben"), z.literal("")]),
  phone: z.string().trim().max(50),

  primaryGoals: z
    .array(z.enum(INTAKE_PRIMARY_GOALS))
    .min(1, "Bitte mindestens ein Ziel auswählen"),
  motivation: z.string().trim().max(2_000),
  timeframe: z.string().trim().max(100),

  heightCm: requiredNumber(50, 260, "Bitte Größe zwischen 50 und 260 cm angeben"),
  weightKg: requiredNumber(20, 400, "Bitte Gewicht zwischen 20 und 400 kg angeben"),
  goalWeightKg: optionalNumber(20, 400, "Bitte Wunschgewicht zwischen 20 und 400 kg angeben"),

  jobActivity: z.enum(["", "sitzend", "stehend", "koerperlich"]),
  trainingDaysPerWeek: optionalNumber(0, 14, "Bitte 0 bis 14 angeben"),
  trainingType: z.string().trim().max(300),

  conditions: z.array(z.string()),
  medications: z.string().trim().max(2_000),
  digestion: z.string().trim().max(2_000),
  pregnantOrBreastfeeding: z.boolean(),

  /** allergen id -> "allergy" | "intolerance". Absent means not selected. */
  allergens: z.record(z.string(), z.enum(["allergy", "intolerance"])),

  dietStyle: z.string(),
  exclusions: z.array(z.string()),

  /** food key -> rating. Absent means unanswered. */
  foodPreferences: z.record(z.string(), z.enum(["gerne", "geht", "nie"])),

  mealsPerDay: optionalNumber(1, 10, "Bitte 1 bis 10 angeben"),
  eatsBreakfast: z.enum(["", ...INTAKE_BREAKFAST_FREQUENCIES]),
  cookingSkill: z.enum(["", "wenig", "mittel", "viel"]),
  minutesPerMeal: optionalNumber(0, 240, "Bitte 0 bis 240 Minuten angeben"),
  eatsOutPerWeek: optionalNumber(0, 30, "Bitte 0 bis 30 angeben"),
  whoCooks: z.string().trim().max(200),
  budget: z.enum(["", "niedrig", "mittel", "hoch"]),
  snacking: z.string().trim().max(1_000),
  alcoholPerWeek: optionalNumber(0, 100, "Bitte 0 bis 100 angeben"),
  coffeePerDay: optionalNumber(0, 30, "Bitte 0 bis 30 angeben"),
  sleepHours: optionalNumber(0, 24, "Bitte 0 bis 24 Stunden angeben"),
  waterLitersPerDay: optionalNumber(0, 20, "Bitte 0 bis 20 Liter angeben"),

  previousDiets: z.string().trim().max(2_000),
  whatWorked: z.string().trim().max(2_000),
  whatFailed: z.string().trim().max(2_000),

  // Must be an active opt-in, so this is a boolean that defaults to false and
  // is refined to true rather than a literal the form could start out holding.
  dataProcessing: z.boolean().refine((value) => value === true, {
    message: "Ohne Einwilligung können wir die Angaben nicht speichern.",
  }),
  consentNotes: z.string().trim().max(2_000),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "w",
  email: "",
  phone: "",
  primaryGoals: [],
  motivation: "",
  timeframe: "",
  heightCm: "",
  weightKg: "",
  goalWeightKg: "",
  jobActivity: "",
  trainingDaysPerWeek: "",
  trainingType: "",
  conditions: [],
  medications: "",
  digestion: "",
  pregnantOrBreastfeeding: false,
  allergens: {},
  dietStyle: "",
  exclusions: [],
  foodPreferences: {},
  mealsPerDay: "",
  eatsBreakfast: "",
  cookingSkill: "",
  minutesPerMeal: "",
  eatsOutPerWeek: "",
  whoCooks: "",
  budget: "",
  snacking: "",
  alcoholPerWeek: "",
  coffeePerDay: "",
  sleepHours: "",
  waterLitersPerDay: "",
  previousDiets: "",
  whatWorked: "",
  whatFailed: "",
  dataProcessing: false,
  consentNotes: "",
};

interface StepDefinition {
  id: string;
  title: string;
  description: string;
  /** Validated before the step may be left. Empty means nothing is required. */
  fields: (keyof FormValues)[];
}

const STEPS: StepDefinition[] = [
  {
    id: "person",
    title: "Über dich",
    description: "Damit deine Beratung weiß, wer den Plan bekommt.",
    fields: ["firstName", "lastName", "dateOfBirth", "gender", "email"],
  },
  {
    id: "goal",
    title: "Dein Ziel",
    description: "Das Wichtigste zuerst: Was soll sich ändern?",
    fields: ["primaryGoals"],
  },
  {
    id: "body",
    title: "Körper",
    description: "Grundlage für Kalorien- und Nährstoffziele.",
    fields: ["heightCm", "weightKg", "goalWeightKg"],
  },
  {
    id: "activity",
    title: "Bewegung",
    description: "Wie viel bewegst du dich im Alltag und im Sport?",
    fields: ["trainingDaysPerWeek"],
  },
  {
    id: "health",
    title: "Gesundheit",
    description: "Alles, was beim Plan berücksichtigt werden muss.",
    fields: [],
  },
  {
    id: "allergens",
    title: "Unverträglichkeiten",
    description: "Was verträgst du nicht? Mehrfachauswahl möglich.",
    fields: [],
  },
  {
    id: "diet",
    title: "Ernährungsform",
    description: "Wie isst du grundsätzlich, und was kommt nicht auf den Teller?",
    fields: [],
  },
  {
    id: "food",
    title: "Lebensmittel",
    description: "Das Wichtigste für einen Plan, den du wirklich isst.",
    fields: [],
  },
  {
    id: "habits",
    title: "Dein Alltag",
    description: "Damit der Plan zu deinem Tag passt, nicht umgekehrt.",
    fields: ["mealsPerDay", "minutesPerMeal", "eatsOutPerWeek", "sleepHours"],
  },
  {
    id: "history",
    title: "Erfahrung",
    description: "Was hast du schon probiert?",
    fields: [],
  },
  {
    id: "consent",
    title: "Einwilligung",
    description: "Ein letzter Schritt, dann bist du fertig.",
    fields: ["dataProcessing"],
  },
];

const FOOD_RATINGS: FoodPreferenceRating[] = ["gerne", "geht", "nie"];

function draftKey(linkId: string) {
  return `inari_intake_draft_${linkId}`;
}

/**
 * Brings a draft saved in a browser onto the current field shape.
 *
 * Someone can have a half-finished questionnaire open from before goals became
 * multi-select. Carrying the old single goal over keeps their answer; forcing
 * the array type matters more, because a non-array here would crash the goal
 * step on `.includes` rather than fail politely.
 */
function migrateDraft(raw: unknown): Partial<FormValues> {
  if (!raw || typeof raw !== "object") return {};
  const draft = { ...(raw as Record<string, unknown>) };

  if (!Array.isArray(draft.primaryGoals)) {
    const legacy = draft.primaryGoal;
    draft.primaryGoals =
      typeof legacy === "string" &&
      (INTAKE_PRIMARY_GOALS as readonly string[]).includes(legacy)
        ? [legacy]
        : [];
  }
  delete draft.primaryGoal;

  if (!Array.isArray(draft.conditions)) draft.conditions = [];
  if (!Array.isArray(draft.exclusions)) draft.exclusions = [];

  return draft as Partial<FormValues>;
}

/* ------------------------------------------------------------------ */
/* Payload conversion                                                  */
/* ------------------------------------------------------------------ */

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function objectOrUndefined<T extends Record<string, unknown>>(value: T): T | undefined {
  return Object.values(value).some((entry) => entry !== undefined) ? value : undefined;
}

function toPayload(values: FormValues): IntakePayloadInput {
  const allergens = Object.entries(values.allergens).map(([allergenId, type]) => ({
    allergenId,
    type,
  }));

  const foodPreferences = Object.entries(values.foodPreferences).map(
    ([foodKey, rating]) => ({ foodKey, rating }),
  );

  const payload = {
    person: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
      email: emptyToUndefined(values.email),
      phone: emptyToUndefined(values.phone),
    },
    goal: {
      // Both are written: the array is the truth, the scalar keeps readers that
      // predate multi-select working against the same row.
      primaryGoal: values.primaryGoals[0],
      primaryGoals: values.primaryGoals,
      motivation: emptyToUndefined(values.motivation),
      timeframe: emptyToUndefined(values.timeframe),
    },
    body: {
      heightCm: parseNumber(values.heightCm)!,
      weightKg: parseNumber(values.weightKg)!,
      goalWeightKg: parseNumber(values.goalWeightKg),
    },
    activity: objectOrUndefined({
      jobActivity: values.jobActivity || undefined,
      trainingDaysPerWeek: parseNumber(values.trainingDaysPerWeek),
      trainingType: emptyToUndefined(values.trainingType),
    }),
    health: objectOrUndefined({
      conditions: values.conditions.length ? values.conditions : undefined,
      medications: emptyToUndefined(values.medications),
      digestion: emptyToUndefined(values.digestion),
      pregnantOrBreastfeeding: values.pregnantOrBreastfeeding || undefined,
    }),
    allergens: allergens.length ? allergens : undefined,
    diet: objectOrUndefined({
      style: values.dietStyle || undefined,
      exclusions: values.exclusions.length ? values.exclusions : undefined,
    }),
    foodPreferences: foodPreferences.length ? foodPreferences : undefined,
    habits: objectOrUndefined({
      mealsPerDay: parseNumber(values.mealsPerDay),
      eatsBreakfast:
        values.eatsBreakfast === "" ? undefined : values.eatsBreakfast !== "nein",
      breakfastFrequency: values.eatsBreakfast || undefined,
      cookingSkill: values.cookingSkill || undefined,
      minutesPerMeal: parseNumber(values.minutesPerMeal),
      eatsOutPerWeek: parseNumber(values.eatsOutPerWeek),
      whoCooks: emptyToUndefined(values.whoCooks),
      budget: values.budget || undefined,
      snacking: emptyToUndefined(values.snacking),
      alcoholPerWeek: parseNumber(values.alcoholPerWeek),
      coffeePerDay: parseNumber(values.coffeePerDay),
      sleepHours: parseNumber(values.sleepHours),
      waterLitersPerDay: parseNumber(values.waterLitersPerDay),
    }),
    history: objectOrUndefined({
      previousDiets: emptyToUndefined(values.previousDiets),
      whatWorked: emptyToUndefined(values.whatWorked),
      whatFailed: emptyToUndefined(values.whatFailed),
    }),
    consent: {
      dataProcessing: true as const,
      notes: emptyToUndefined(values.consentNotes),
    },
  };

  return payload as IntakePayloadInput;
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function ChoiceButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={className}
    >
      {children}
    </Button>
  );
}

/**
 * Free-text conditions, on top of the chips.
 *
 * Its own state, so typing does not re-render the whole 11-step form on every
 * keystroke; only a confirmed entry reaches the form.
 */
function CustomConditionInput({
  entries,
  onAdd,
  onRemove,
}: {
  entries: string[];
  onAdd: (entry: string) => boolean;
  onRemove: (entry: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    if (onAdd(draft)) setDraft("");
  };

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={120}
          placeholder="Sonstiges, z. B. Rheuma"
          aria-label="Sonstige Erkrankung"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter would otherwise walk the wizard to the next step.
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={commit} disabled={!draft.trim()}>
          Hinzufügen
        </Button>
      </div>
      {entries.length ? (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <Button
              key={entry}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onRemove(entry)}
              aria-label={`${entry} entfernen`}
            >
              {entry}
              <X className="ml-1 h-3 w-3" />
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

interface PatientIntakeFormProps {
  linkId: string;
}

export function PatientIntakeForm({ linkId }: PatientIntakeFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { reset, watch, setValue, getValues, formState } = form;

  // Restore a draft so a phone call mid-form does not cost eight minutes.
  //
  // The fields stay unmounted until this has run. `reset()` lands one tick after
  // mount, and anything typed before then would be silently wiped — a real race
  // on a slow phone, not just in tests.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(linkId));
      if (raw) {
        reset({ ...DEFAULT_VALUES, ...migrateDraft(JSON.parse(raw)) });
      }
    } catch {
      // A corrupt draft is not worth surfacing; start clean.
    } finally {
      setDraftLoaded(true);
    }
  }, [linkId, reset]);

  // Persisted on step transitions rather than on every keystroke: it keeps the
  // form out of React Compiler's bail-out path for `watch()` subscriptions, and
  // a step boundary is the only place losing progress would actually hurt.
  const persistDraft = useCallback(() => {
    if (!draftLoaded) return;
    try {
      window.localStorage.setItem(draftKey(linkId), JSON.stringify(getValues()));
    } catch {
      // Storage full or blocked — the form still works, just without a draft.
    }
  }, [draftLoaded, getValues, linkId]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const values = watch();
  const errors = formState.errors;

  const goNext = useCallback(async () => {
    const valid = await form.trigger(step.fields.length ? step.fields : undefined);
    if (!valid && step.fields.length) return;
    persistDraft();
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [form, persistDraft, step.fields]);

  const goBack = useCallback(() => {
    persistDraft();
    setStepIndex((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [persistDraft]);

  const setAllergen = useCallback(
    (allergenId: string, type: "allergy" | "intolerance") => {
      const current = { ...getValues("allergens") };
      if (current[allergenId] === type) {
        delete current[allergenId];
      } else {
        current[allergenId] = type;
      }
      setValue("allergens", current, { shouldDirty: true });
    },
    [getValues, setValue],
  );

  const setFoodPreference = useCallback(
    (foodKey: string, rating: FoodPreferenceRating) => {
      const current = { ...getValues("foodPreferences") };
      if (current[foodKey] === rating) {
        delete current[foodKey];
      } else {
        current[foodKey] = rating;
      }
      setValue("foodPreferences", current, { shouldDirty: true });
    },
    [getValues, setValue],
  );

  const toggleInArray = useCallback(
    (field: "conditions" | "exclusions", entry: string) => {
      const current = getValues(field);
      const next = current.includes(entry)
        ? current.filter((item) => item !== entry)
        : [...current, entry];
      setValue(field, next, { shouldDirty: true });
    },
    [getValues, setValue],
  );

  const toggleGoal = useCallback(
    (goal: FormValues["primaryGoals"][number]) => {
      const current = getValues("primaryGoals");
      const next = current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal];
      setValue("primaryGoals", next, { shouldDirty: true });
    },
    [getValues, setValue],
  );

  /**
   * Adds a condition the chips do not cover.
   *
   * These land in the same `conditions` array as the chips, so a dietitian
   * reading the record sees one list rather than having to check a second
   * "other" field for anything important.
   */
  const addCondition = useCallback(
    (raw: string) => {
      const entry = raw.trim().slice(0, 120);
      if (!entry) return false;
      const current = getValues("conditions");
      if (current.some((item) => item.toLowerCase() === entry.toLowerCase())) return true;
      if (current.length >= 30) return false;
      setValue("conditions", [...current, entry], { shouldDirty: true });
      return true;
    },
    [getValues, setValue],
  );

  // Everything the chip list does not already offer.
  const customConditions = useMemo(
    () =>
      values.conditions.filter(
        (entry) => !INTAKE_CONDITION_OPTIONS.includes(entry as (typeof INTAKE_CONDITION_OPTIONS)[number]),
      ),
    [values.conditions],
  );

  const answeredFoodCount = useMemo(
    () => Object.keys(values.foodPreferences ?? {}).length,
    [values.foodPreferences],
  );

  async function onSubmit(formValues: FormValues) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId, payload: toPayload(formValues) }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Fehler beim Absenden (${response.status})`);
      }

      try {
        window.localStorage.removeItem(draftKey(linkId));
      } catch {
        // Nothing to do — the submission already succeeded.
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Hold the fields back until the draft restore has settled, so no keystroke
  // can be overwritten by it.
  if (!draftLoaded) {
    return (
      <div className="space-y-4 py-8" aria-busy="true">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold">Vielen Dank!</h1>
        <p className="mt-2 text-muted-foreground">
          Deine Angaben sind angekommen. Deine Ernährungsberatung meldet sich mit dem
          nächsten Schritt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Schritt {stepIndex + 1} von {STEPS.length}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{step.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        <Progress value={progress} className="mt-4 h-2" />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {step.id === "person" && (
          <div className="space-y-4">
            <Field label="Vorname" htmlFor="firstName" error={errors.firstName?.message}>
              <Input id="firstName" autoComplete="given-name" {...form.register("firstName")} />
            </Field>
            <Field label="Nachname" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" autoComplete="family-name" {...form.register("lastName")} />
            </Field>
            <Field
              label="Geburtsdatum"
              htmlFor="dateOfBirth"
              error={errors.dateOfBirth?.message}
            >
              <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
            </Field>
            <Field label="Geschlecht" error={errors.gender?.message}>
              <div className="flex gap-2">
                {(
                  [
                    ["w", "Weiblich"],
                    ["m", "Männlich"],
                    ["d", "Divers"],
                  ] as const
                ).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    active={values.gender === value}
                    onClick={() => setValue("gender", value, { shouldDirty: true })}
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field
              label="E-Mail (optional)"
              htmlFor="email"
              error={errors.email?.message}
            >
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            </Field>
            <Field label="Telefon (optional)" htmlFor="phone">
              <Input id="phone" type="tel" autoComplete="tel" {...form.register("phone")} />
            </Field>
          </div>
        )}

        {step.id === "goal" && (
          <div className="space-y-4">
            <Field
              label="Was möchtest du erreichen?"
              hint="Du kannst mehrere anklicken — das erste zählt als das wichtigste."
              error={errors.primaryGoals?.message}
            >
              <div className="grid gap-2">
                {INTAKE_PRIMARY_GOALS.map((goal) => (
                  <Button
                    key={goal}
                    type="button"
                    variant={values.primaryGoals.includes(goal) ? "default" : "outline"}
                    className="justify-start"
                    aria-pressed={values.primaryGoals.includes(goal)}
                    onClick={() => toggleGoal(goal)}
                  >
                    {INTAKE_PRIMARY_GOAL_LABELS[goal]}
                  </Button>
                ))}
              </div>
            </Field>
            <Field
              label="Warum gerade jetzt? (optional)"
              htmlFor="motivation"
              hint="Je ehrlicher, desto besser passt der Plan."
            >
              <Textarea id="motivation" rows={3} {...form.register("motivation")} />
            </Field>
            <Field label="Zeithorizont (optional)" htmlFor="timeframe">
              <Input
                id="timeframe"
                placeholder="z. B. 3 Monate, bis zum Sommer"
                {...form.register("timeframe")}
              />
            </Field>
          </div>
        )}

        {step.id === "body" && (
          <div className="space-y-4">
            <Field label="Größe in cm" htmlFor="heightCm" error={errors.heightCm?.message}>
              <Input
                id="heightCm"
                inputMode="decimal"
                placeholder="175"
                {...form.register("heightCm")}
              />
            </Field>
            <Field label="Gewicht in kg" htmlFor="weightKg" error={errors.weightKg?.message}>
              <Input
                id="weightKg"
                inputMode="decimal"
                placeholder="72"
                {...form.register("weightKg")}
              />
            </Field>
            <Field
              label="Wunschgewicht in kg (optional)"
              htmlFor="goalWeightKg"
              error={errors.goalWeightKg?.message}
            >
              <Input id="goalWeightKg" inputMode="decimal" {...form.register("goalWeightKg")} />
            </Field>
          </div>
        )}

        {step.id === "activity" && (
          <div className="space-y-4">
            <Field label="Wie ist dein Alltag? (optional)">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["sitzend", "Überwiegend sitzend"],
                    ["stehend", "Viel stehend / gehend"],
                    ["koerperlich", "Körperlich anstrengend"],
                  ] as const
                ).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    active={values.jobActivity === value}
                    onClick={() =>
                      setValue("jobActivity", values.jobActivity === value ? "" : value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field
              label="Trainingstage pro Woche (optional)"
              htmlFor="trainingDaysPerWeek"
              error={errors.trainingDaysPerWeek?.message}
            >
              <Input
                id="trainingDaysPerWeek"
                inputMode="numeric"
                placeholder="3"
                {...form.register("trainingDaysPerWeek")}
              />
            </Field>
            <Field label="Welche Sportart? (optional)" htmlFor="trainingType">
              <Input
                id="trainingType"
                placeholder="z. B. Krafttraining, Laufen"
                {...form.register("trainingType")}
              />
            </Field>
          </div>
        )}

        {step.id === "health" && (
          <div className="space-y-4">
            <Field
              label="Bestehende Erkrankungen (optional)"
              hint="Mehreres ist möglich. Was hier fehlt, trägst du darunter ein."
            >
              <div className="flex flex-wrap gap-2">
                {INTAKE_CONDITION_OPTIONS.map((condition) => (
                  <ChoiceButton
                    key={condition}
                    active={values.conditions.includes(condition)}
                    onClick={() => toggleInArray("conditions", condition)}
                  >
                    {condition}
                  </ChoiceButton>
                ))}
              </div>
              <CustomConditionInput
                entries={customConditions}
                onAdd={addCondition}
                onRemove={(entry) => toggleInArray("conditions", entry)}
              />
            </Field>
            <Field label="Medikamente (optional)" htmlFor="medications">
              <Textarea id="medications" rows={2} {...form.register("medications")} />
            </Field>
            <Field
              label="Verdauung & Beschwerden (optional)"
              htmlFor="digestion"
              hint="z. B. Blähungen, Sodbrennen, Verstopfung"
            >
              <Textarea id="digestion" rows={2} {...form.register("digestion")} />
            </Field>
            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={values.pregnantOrBreastfeeding}
                onCheckedChange={(checked) =>
                  setValue("pregnantOrBreastfeeding", checked === true, { shouldDirty: true })
                }
              />
              <span>Ich bin schwanger oder stille</span>
            </label>
          </div>
        )}

        {step.id === "allergens" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tippe auf <span className="font-medium">Allergie</span> oder{" "}
              <span className="font-medium">Intoleranz</span>. Nochmal tippen hebt die Auswahl
              wieder auf.
            </p>
            <div className="space-y-2">
              {ALLERGEN_DEFINITIONS.map((allergen) => (
                <div
                  key={allergen.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{allergen.label}</span>
                  <div className="flex shrink-0 gap-1.5">
                    <ChoiceButton
                      active={values.allergens[allergen.id] === "allergy"}
                      onClick={() => setAllergen(allergen.id, "allergy")}
                    >
                      Allergie
                    </ChoiceButton>
                    <ChoiceButton
                      active={values.allergens[allergen.id] === "intolerance"}
                      onClick={() => setAllergen(allergen.id, "intolerance")}
                    >
                      Intoleranz
                    </ChoiceButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step.id === "diet" && (
          <div className="space-y-5">
            <Field label="Wie isst du grundsätzlich? (optional)">
              <div className="grid gap-2">
                {DIET_STYLES.map((style) => (
                  <Button
                    key={style}
                    type="button"
                    variant={values.dietStyle === style ? "default" : "outline"}
                    className="h-auto justify-start py-2.5 text-left"
                    onClick={() =>
                      setValue("dietStyle", values.dietStyle === style ? "" : style, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <span>
                      <span className="block font-medium">{DIET_STYLE_LABELS[style]}</span>
                      <span className="block text-xs font-normal opacity-80">
                        {DIET_STYLE_DESCRIPTIONS[style]}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </Field>
            <Field
              label="Was kommt nicht auf den Teller? (optional)"
              hint="Mehreres ist möglich."
            >
              <div className="flex flex-wrap gap-2">
                {DIET_EXCLUSIONS.map((exclusion) => (
                  <ChoiceButton
                    key={exclusion}
                    active={values.exclusions.includes(exclusion)}
                    onClick={() => toggleInArray("exclusions", exclusion)}
                  >
                    {DIET_EXCLUSION_LABELS[exclusion]}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step.id === "food" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Kurz durchtippen — das entscheidet, ob du deinen Plan wirklich isst.{" "}
              <span className="font-medium">{answeredFoodCount}</span> von{" "}
              {INTAKE_FOOD_PREFERENCES.length} beantwortet.
            </p>
            {INTAKE_FOOD_PREFERENCE_GROUPS.map((group) => (
              <div key={group} className="space-y-2">
                <h2 className="text-sm font-semibold">
                  {FOOD_PREFERENCE_GROUP_LABELS[group]}
                </h2>
                {INTAKE_FOOD_PREFERENCES.filter((item) => item.group === group).map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                    >
                      <span className="text-sm">{item.label}</span>
                      <div className="flex shrink-0 gap-1.5">
                        {FOOD_RATINGS.map((rating) => (
                          <ChoiceButton
                            key={rating}
                            active={values.foodPreferences[item.id] === rating}
                            onClick={() => setFoodPreference(item.id, rating)}
                          >
                            {FOOD_PREFERENCE_RATING_LABELS[rating]}
                          </ChoiceButton>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        )}

        {step.id === "habits" && (
          <div className="space-y-4">
            <Field
              label="Mahlzeiten pro Tag (optional)"
              htmlFor="mealsPerDay"
              error={errors.mealsPerDay?.message}
            >
              <Input id="mealsPerDay" inputMode="numeric" {...form.register("mealsPerDay")} />
            </Field>
            <Field label="Frühstückst du? (optional)">
              <div className="flex gap-2">
                {INTAKE_BREAKFAST_FREQUENCIES.map((value) => (
                  <ChoiceButton
                    key={value}
                    active={values.eatsBreakfast === value}
                    onClick={() =>
                      setValue("eatsBreakfast", values.eatsBreakfast === value ? "" : value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {INTAKE_BREAKFAST_LABELS[value]}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field label="Wie gerne kochst du? (optional)">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["wenig", "Wenig"],
                    ["mittel", "Geht so"],
                    ["viel", "Gerne"],
                  ] as const
                ).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    active={values.cookingSkill === value}
                    onClick={() =>
                      setValue("cookingSkill", values.cookingSkill === value ? "" : value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field
              label="Minuten pro Mahlzeit (optional)"
              htmlFor="minutesPerMeal"
              error={errors.minutesPerMeal?.message}
            >
              <Input
                id="minutesPerMeal"
                inputMode="numeric"
                {...form.register("minutesPerMeal")}
              />
            </Field>
            <Field
              label="Wie oft isst du auswärts pro Woche? (optional)"
              htmlFor="eatsOutPerWeek"
              error={errors.eatsOutPerWeek?.message}
            >
              <Input
                id="eatsOutPerWeek"
                inputMode="numeric"
                {...form.register("eatsOutPerWeek")}
              />
            </Field>
            <Field label="Wer kocht bei dir? (optional)" htmlFor="whoCooks">
              <Input id="whoCooks" {...form.register("whoCooks")} />
            </Field>
            <Field label="Budget fürs Essen (optional)">
              <div className="flex gap-2">
                {(
                  [
                    ["niedrig", "Niedrig"],
                    ["mittel", "Mittel"],
                    ["hoch", "Hoch"],
                  ] as const
                ).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    active={values.budget === value}
                    onClick={() =>
                      setValue("budget", values.budget === value ? "" : value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field
              label="Snacks & Naschen (optional)"
              htmlFor="snacking"
              hint="Wann und was greifst du zwischendurch?"
            >
              <Textarea id="snacking" rows={2} {...form.register("snacking")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kaffee/Tag" htmlFor="coffeePerDay">
                <Input id="coffeePerDay" inputMode="decimal" {...form.register("coffeePerDay")} />
              </Field>
              <Field label="Alkohol/Woche" htmlFor="alcoholPerWeek">
                <Input
                  id="alcoholPerWeek"
                  inputMode="decimal"
                  {...form.register("alcoholPerWeek")}
                />
              </Field>
              <Field label="Schlaf (h)" htmlFor="sleepHours" error={errors.sleepHours?.message}>
                <Input id="sleepHours" inputMode="decimal" {...form.register("sleepHours")} />
              </Field>
              <Field label="Wasser (l/Tag)" htmlFor="waterLitersPerDay">
                <Input
                  id="waterLitersPerDay"
                  inputMode="decimal"
                  {...form.register("waterLitersPerDay")}
                />
              </Field>
            </div>
          </div>
        )}

        {step.id === "history" && (
          <div className="space-y-4">
            <Field label="Was hast du schon probiert? (optional)" htmlFor="previousDiets">
              <Textarea id="previousDiets" rows={3} {...form.register("previousDiets")} />
            </Field>
            <Field label="Was hat funktioniert? (optional)" htmlFor="whatWorked">
              <Textarea id="whatWorked" rows={3} {...form.register("whatWorked")} />
            </Field>
            <Field label="Was hat nicht funktioniert? (optional)" htmlFor="whatFailed">
              <Textarea id="whatFailed" rows={3} {...form.register("whatFailed")} />
            </Field>
          </div>
        )}

        {step.id === "consent" && (
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={values.dataProcessing}
                onCheckedChange={(checked) =>
                  setValue("dataProcessing", checked === true, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <span>
                Ich bin damit einverstanden, dass meine Angaben — einschließlich
                Gesundheitsangaben — an meine Ernährungsberatung übermittelt und dort zur
                Erstellung meines Ernährungsplans gespeichert werden.
              </span>
            </label>
            {errors.dataProcessing ? (
              <p className="text-xs text-destructive">{errors.dataProcessing.message}</p>
            ) : null}
            <Field label="Möchtest du noch etwas ergänzen? (optional)" htmlFor="consentNotes">
              <Textarea id="consentNotes" rows={3} {...form.register("consentNotes")} />
            </Field>
          </div>
        )}

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="flex items-center gap-3 pt-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} className="flex-1">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Zurück
            </Button>
          ) : null}

          {isLastStep ? (
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Wird gesendet…" : "Absenden"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} className="flex-1">
              Weiter
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
