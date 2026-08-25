"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CopyPlus,
  LayoutTemplate,
  Lock,
  Minus,
  PencilLine,
  Plus,
  Send,
  Sparkles,
  SquarePen,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { Slider } from "@/components/ui/slider"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DEMO_DIET_LINES,
  DEMO_ITEMS,
  DEMO_MACRO_TARGETS,
  DEMO_PATIENT,
  DEMO_SLOT_LABELS,
  DEMO_SLOT_ORDER,
  DEMO_TEMPLATES,
  readTarget,
} from "./demo-data"
import {
  AddEntryButton,
  ConflictBanner,
  CheckInPanel,
  EmptyMeal,
  EntryRow,
  HistoryPanel,
  ItemPicker,
  MicroPanel,
  PrinciplesPanel,
  ReleaseChecklist,
  SharePanel,
  SlotHeading,
  StandBadge,
  TargetList,
  WeekStrip,
  AdditivePanel,
  ExportPanel,
  hasConflict,
} from "./flow-shared"
import { useDemoPlan } from "./use-demo-plan"
import { useDemoRelease } from "./use-demo-release"
import {
  ALERT,
  Chip,
  ChipGroup,
  ChoiceCard,
  EASE,
  InsetPanel,
  PrimaryButton,
  ProgressRing,
  RoundButton,
  SectionTitle,
  SegmentedControl,
  SYSTEM_FONT,
  StudioCard,
  TONE,
  formatValue,
} from "./studio-ui"

/**
 * Konzept 1 — "Assistent".
 *
 * The flow follows the counselor's decisions: five questions in the order they
 * actually come up in a session, one screen each, with the consequence of every
 * answer visible in the footer while it is being given.
 *
 * What changed since the first draft: the journey no longer ends at the plan.
 * It starts with what came back from the client and ends with a binding
 * release, because that is what the planner now models — a plan is a stand that
 * is handed over, superseded and handed over again.
 *
 * Prototype for a design decision. Demo data only, nothing is persisted.
 */

type StepId = 0 | 1 | 2 | 3 | 4

const STEPS: Array<{ id: StepId; label: string; question: string; hint: string }> = [
  {
    id: 0,
    label: "Ziel",
    question: "Wo steht Anna Berger?",
    hint: "Der letzte freigegebene Stand, die Rückmeldung dazu und die Richtung, die daraus folgt.",
  },
  {
    id: 1,
    label: "Zielwerte",
    question: "Woran wird der Plan gemessen?",
    hint: "Energie, Makroverteilung und Kostform gelten für jeden Tag – sie hängen an der Klientin, nicht am Datum.",
  },
  {
    id: 2,
    label: "Rahmen",
    question: "Was darf nicht auf den Teller?",
    hint: "Kostform, Ausschlüsse und Allergien filtern jede Auswahl. Prinzipien sind das, was ohne Plan im Kopf bleibt.",
  },
  {
    id: 3,
    label: "Mahlzeiten",
    question: "Womit fangen wir an?",
    hint: "Vorlage, Vortag oder leerer Tag – danach wird nur noch ergänzt und verschoben.",
  },
  {
    id: 4,
    label: "Prüfen & freigeben",
    question: "Passt das so?",
    hint: "Zielwerte, Mikronährstoffe und Konflikte im Blick – und dann verbindlich übergeben.",
  },
]

const GOAL_OPTIONS = [
  { id: "reduzieren", label: "Gewicht reduzieren", hint: "Defizit unter dem Gesamtumsatz", icon: TrendingDown, kcal: 2100 },
  { id: "halten", label: "Gewicht halten", hint: "Energiezufuhr auf Höhe des Umsatzes", icon: Check, kcal: 2350 },
  { id: "aufbauen", label: "Substanz aufbauen", hint: "Überschuss bei erhöhtem Eiweißanteil", icon: TrendingUp, kcal: 2650 },
] as const

const MACRO_PRESETS = [
  { id: "ausgewogen", label: "Ausgewogen", protein: 0.2, carbs: 0.45, fat: 0.35 },
  { id: "kh-reduziert", label: "KH-reduziert", protein: 0.25, carbs: 0.35, fat: 0.4 },
  { id: "eiweissbetont", label: "Eiweißbetont", protein: 0.3, carbs: 0.4, fat: 0.3 },
] as const

const DIET_STYLES = ["Mischkost", "Vegetarisch", "Vegan", "Pescetarisch"]
const EXCLUSIONS = ["Schweinefleisch", "Rindfleisch", "Alkohol", "Rohmilchprodukte", "Rohes Ei"]
const ALLERGENS = ["Gluten", "Laktose", "Schalenfrüchte", "Fisch", "Sesam", "Ei"]

const START_OPTIONS = [
  { id: "vorlage", label: "Aus einer Vorlage", hint: "Fertiger Tag, danach angepasst", icon: LayoutTemplate },
  { id: "vortag", label: "Vom Vortag", hint: "Gestern kopieren und variieren", icon: CopyPlus },
  { id: "leer", label: "Leer beginnen", hint: "Mahlzeit für Mahlzeit selbst füllen", icon: SquarePen },
] as const

export function ConceptAssistent() {
  const plan = useDemoPlan(3)
  const release = useDemoRelease("revision")
  const [step, setStep] = useState<StepId>(0)

  const [goal, setGoal] = useState<(typeof GOAL_OPTIONS)[number]["id"]>("reduzieren")
  const [kcalTarget, setKcalTarget] = useState(2100)
  const [macroPreset, setMacroPreset] = useState<(typeof MACRO_PRESETS)[number]["id"]>("ausgewogen")
  const [dietLineId, setDietLineId] = useState(DEMO_DIET_LINES[0].id)

  const [dietStyle, setDietStyle] = useState("Mischkost")
  const [exclusions, setExclusions] = useState<string[]>(["Schweinefleisch"])
  const [allergens, setAllergens] = useState<string[]>(["Schalenfrüchte"])

  const [start, setStart] = useState<(typeof START_OPTIONS)[number]["id"] | null>("vorlage")
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)

  const preset = MACRO_PRESETS.find((candidate) => candidate.id === macroPreset)!
  const derived = useMemo(
    () => ({
      protein: Math.round((kcalTarget * preset.protein) / 4),
      carbs: Math.round((kcalTarget * preset.carbs) / 4),
      fat: Math.round((kcalTarget * preset.fat) / 9),
    }),
    [kcalTarget, preset],
  )

  const kcalReading = readTarget({ ...DEMO_MACRO_TARGETS[0], goal: kcalTarget }, plan.totals.kcal)
  const macroReadings = useMemo(
    () => [
      readTarget({ ...DEMO_MACRO_TARGETS[1], goal: derived.protein }, plan.totals.protein),
      readTarget({ ...DEMO_MACRO_TARGETS[2], goal: derived.carbs }, plan.totals.carbs),
      readTarget({ ...DEMO_MACRO_TARGETS[3], goal: derived.fat }, plan.totals.fat),
      plan.macroReadings[4],
    ],
    [derived, plan.macroReadings, plan.totals],
  )

  const conflicts = useMemo(
    () =>
      plan.conflicts.filter((conflict) =>
        conflict.item.allergens?.some((allergen) => allergens.includes(allergen)),
      ),
    [plan.conflicts, allergens],
  )

  const emptySlots = DEMO_SLOT_ORDER.filter((slot) => plan.day[slot].length === 0)
  const deficit = DEMO_PATIENT.energyRequirement - kcalTarget
  const locked = release.status === "released"
  const current = STEPS[step]

  const checks = [
    {
      ok: kcalReading.status === "ok",
      text:
        kcalReading.status === "ok"
          ? "Tagesenergie im Zielkorridor"
          : kcalReading.status === "low"
            ? `${formatNumber(Math.round(kcalReading.remaining))} kcal unter dem Tagesziel`
            : `${formatNumber(Math.abs(Math.round(kcalReading.remaining)))} kcal über dem Tagesziel`,
    },
    {
      ok: macroReadings[0].status !== "low",
      text:
        macroReadings[0].status !== "low"
          ? "Eiweißmenge erreicht"
          : `${formatValue(Math.abs(macroReadings[0].remaining), "g")} Eiweiß fehlen noch`,
    },
    {
      ok: macroReadings[3].status !== "low",
      text:
        macroReadings[3].status !== "low"
          ? `Ballaststoffe erreicht (${formatValue(macroReadings[3].value, "g")})`
          : `${formatValue(Math.abs(macroReadings[3].remaining), "g")} Ballaststoffe fehlen`,
    },
    {
      ok: plan.microReadings.every((reading) => reading.status !== "low"),
      text: plan.microReadings.some((reading) => reading.status === "low")
        ? `${plan.microReadings
            .filter((reading) => reading.status === "low")
            .map((reading) => reading.target.label)
            .join(", ")} unter dem Referenzwert`
        : "Alle Mikronährstoffe gedeckt",
    },
    {
      critical: true,
      ok: conflicts.length === 0,
      text:
        conflicts.length === 0
          ? "Keine Allergenkonflikte im Plan"
          : `${conflicts.length} Eintrag${conflicts.length === 1 ? "" : "e"} mit Allergen: ${conflicts
              .map((conflict) => conflict.item.name)
              .join(", ")}`,
    },
    {
      ok: emptySlots.length === 0,
      text:
        emptySlots.length === 0
          ? "Alle fünf Mahlzeiten belegt"
          : `${emptySlots.map((slot) => DEMO_SLOT_LABELS[slot]).join(", ")} noch leer`,
    },
  ]

  return (
    <div style={{ fontFamily: SYSTEM_FONT }} className="mx-auto w-full max-w-[900px] pb-28">
      {/* Progress: five questions, always visible, always reachable backwards. */}
      <ol className="flex items-center gap-2">
        {STEPS.map((entry, index) => {
          const done = index < step
          const active = index === step
          return (
            <li key={entry.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(entry.id)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span
                  style={{ transitionTimingFunction: EASE }}
                  className={cn(
                    "flex size-7 flex-none items-center justify-center rounded-full text-[12px] font-semibold transition-all duration-300",
                    done && "bg-[var(--primary)] text-[var(--primary-foreground)]",
                    active && "bg-foreground text-background",
                    !done && !active && "bg-black/[0.07] text-muted-foreground dark:bg-white/[0.09]",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[13px] font-medium transition-colors lg:block",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {entry.label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <span className="h-px min-w-3 flex-1 bg-black/[0.09] dark:bg-white/[0.12]">
                  <span
                    className="block h-px bg-[var(--primary)]"
                    style={{ width: done ? "100%" : "0%", transition: `width 400ms ${EASE}` }}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[32px] leading-[1.1] font-bold tracking-[-0.022em]">
            {current.question}
          </h2>
          <p className="mt-2 max-w-[54ch] text-[15px] text-muted-foreground">{current.hint}</p>
        </div>
        <StandBadge status={release.status} revision={release.revision} />
      </div>

      <div className="mt-7 space-y-4">
        {/* ------------------------------------------------------------------ */}
        {step === 0 && (
          <>
            <StudioCard className="p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-14 flex-none items-center justify-center rounded-full bg-black/[0.05] text-[18px] font-semibold dark:bg-white/[0.08]">
                  {DEMO_PATIENT.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[20px] font-semibold tracking-[-0.01em]">{DEMO_PATIENT.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {DEMO_PATIENT.age} Jahre · {DEMO_PATIENT.indication} · {DEMO_PATIENT.weight} kg,
                    Ziel {DEMO_PATIENT.targetWeight} kg
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-muted-foreground">Gesamtumsatz</p>
                  <p className="text-[18px] font-semibold tabular-nums">
                    {formatNumber(DEMO_PATIENT.energyRequirement)} kcal
                  </p>
                </div>
              </div>
            </StudioCard>

            <StudioCard className="p-6 sm:p-7">
              <SectionTitle>Rückmeldung seit Stand 2</SectionTitle>
              <CheckInPanel />
            </StudioCard>

            <StudioCard className="p-6 sm:p-7">
              <SectionTitle>Richtung</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {GOAL_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.id}
                    selected={goal === option.id}
                    onClick={() => {
                      setGoal(option.id)
                      setKcalTarget(option.kcal)
                    }}
                    icon={<option.icon className="size-5" />}
                    title={option.label}
                    hint={option.hint}
                  />
                ))}
              </div>
            </StudioCard>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {step === 1 && (
          <StudioCard className="space-y-8 p-6 sm:p-8">
            <InsetPanel className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-muted-foreground">Energie pro Tag</p>
                  <p className="mt-1 text-[40px] leading-none font-bold tracking-[-0.025em] tabular-nums">
                    {formatNumber(kcalTarget)}
                    <span className="ml-2 text-[16px] font-medium text-muted-foreground">kcal</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RoundButton
                    label="Weniger"
                    onClick={() => setKcalTarget((value) => Math.max(1200, value - 50))}
                  >
                    <Minus className="size-4" />
                  </RoundButton>
                  <RoundButton
                    label="Mehr"
                    onClick={() => setKcalTarget((value) => Math.min(3600, value + 50))}
                  >
                    <Plus className="size-4" />
                  </RoundButton>
                </div>
              </div>

              <Slider
                className="mt-5"
                min={1200}
                max={3600}
                step={50}
                value={[kcalTarget]}
                onValueChange={([value]) => setKcalTarget(value)}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["Defizit −500", DEMO_PATIENT.energyRequirement - 500],
                    ["Erhalt", DEMO_PATIENT.energyRequirement],
                    ["Aufbau +300", DEMO_PATIENT.energyRequirement + 300],
                  ] as const
                ).map(([label, value]) => (
                  <Chip key={label} active={kcalTarget === value} onClick={() => setKcalTarget(value)}>
                    {label}
                  </Chip>
                ))}
              </div>

              <p className="mt-4 text-[13px] text-muted-foreground">
                Gesamtumsatz {formatNumber(DEMO_PATIENT.energyRequirement)} kcal ·{" "}
                {deficit > 0 ? (
                  <span className="font-medium text-foreground">
                    Defizit {formatNumber(deficit)} kcal ≈ {formatNumber(deficit / 1000, 2)} kg pro
                    Woche
                  </span>
                ) : deficit < 0 ? (
                  <span className="font-medium text-foreground">
                    Überschuss {formatNumber(Math.abs(deficit))} kcal
                  </span>
                ) : (
                  <span className="font-medium text-foreground">bedarfsdeckend</span>
                )}
              </p>
            </InsetPanel>

            <div>
              <SectionTitle>Makroverteilung</SectionTitle>
              <SegmentedControl
                value={macroPreset}
                onValueChange={setMacroPreset}
                options={MACRO_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
              />
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(
                  [
                    ["Eiweiß", derived.protein, preset.protein],
                    ["Kohlenhydrate", derived.carbs, preset.carbs],
                    ["Fett", derived.fat, preset.fat],
                  ] as const
                ).map(([label, grams, share]) => (
                  <div
                    key={label}
                    className="rounded-[14px] border border-black/[0.06] p-3.5 dark:border-white/[0.08]"
                  >
                    <p className="text-[12px] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-[20px] font-semibold tabular-nums">
                      {formatNumber(grams)}
                      <span className="ml-1 text-[13px] font-normal text-muted-foreground">g</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatNumber(share * 100)} % der Energie
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>Zielprofil</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {DEMO_DIET_LINES.map((line) => (
                  <Chip
                    key={line.id}
                    active={dietLineId === line.id}
                    onClick={() => setDietLineId(line.id)}
                  >
                    {line.name}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Das Zielprofil liefert die Korridore, gegen die jeder Tag geprüft wird – Makros wie
                Mikronährstoffe.
              </p>
            </div>
          </StudioCard>
        )}

        {/* ------------------------------------------------------------------ */}
        {step === 2 && (
          <>
            <StudioCard className="space-y-8 p-6 sm:p-8">
              <ChipGroup
                title="Kostform"
                hint="Bestimmt, welche Warengruppen überhaupt vorgeschlagen werden."
                options={DIET_STYLES}
                selected={[dietStyle]}
                onToggle={setDietStyle}
              />
              <ChipGroup
                title="Ausschlüsse"
                hint="Persönliche oder kulturelle Einschränkungen."
                options={EXCLUSIONS}
                selected={exclusions}
                onToggle={(value) =>
                  setExclusions((list) =>
                    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value],
                  )
                }
              />
              <ChipGroup
                title="Allergien und Unverträglichkeiten"
                hint="Treffer im Plan werden markiert, nicht stillschweigend entfernt."
                options={ALLERGENS}
                selected={allergens}
                tone="alert"
                onToggle={(value) =>
                  setAllergens((list) =>
                    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value],
                  )
                }
              />

              <InsetPanel className="flex items-start gap-3 text-[13px]">
                <Sparkles className="mt-0.5 size-4 flex-none text-[var(--primary)]" />
                <p className="text-muted-foreground">
                  Mit diesem Rahmen bleiben{" "}
                  <span className="font-medium text-foreground">
                    {formatNumber(DEMO_ITEMS.filter((item) => !hasConflict(item, allergens)).length)}{" "}
                    von {DEMO_ITEMS.length}
                  </span>{" "}
                  Einträgen der Bibliothek ohne Warnhinweis vorschlagbar. Der Rest wird weiter
                  angeboten, aber markiert.
                </p>
              </InsetPanel>
            </StudioCard>

            <StudioCard className="p-6 sm:p-8">
              <SectionTitle>Prinzipien</SectionTitle>
              <p className="mb-4 -mt-1 text-[13px] text-muted-foreground">
                Die Regeln, die ohne Plan im Kopf bleiben. Jede ist aus einer Zahl oben abgeleitet –
                oder im Gespräch entstanden.
              </p>
              <PrinciplesPanel />
            </StudioCard>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {step === 3 && (
          <>
            <StudioCard className="p-6 sm:p-7">
              <SectionTitle>Startpunkt</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {START_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.id}
                    selected={start === option.id}
                    onClick={() => {
                      setStart(option.id)
                      if (option.id === "leer") {
                        plan.clearDay()
                        setAppliedTemplate(null)
                      }
                      if (option.id === "vortag") {
                        plan.duplicateDay(2, 3)
                        setAppliedTemplate(null)
                      }
                    }}
                    icon={<option.icon className="size-5" />}
                    title={option.label}
                    hint={option.hint}
                  />
                ))}
              </div>

              {start === "vorlage" && (
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {DEMO_TEMPLATES.map((template) => {
                    const active = appliedTemplate === template.id
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          plan.applyTemplate(template.id)
                          setAppliedTemplate(template.id)
                        }}
                        style={{ transitionTimingFunction: EASE }}
                        className={cn(
                          "flex items-center gap-3 rounded-[16px] border p-4 text-left transition-all duration-300 active:scale-[0.99]",
                          active
                            ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
                            : "border-black/[0.08] hover:bg-black/[0.03] dark:border-white/[0.1] dark:hover:bg-white/[0.05]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">
                            {template.name}
                          </span>
                          <span className="block truncate text-[13px] text-muted-foreground">
                            {template.indication}
                          </span>
                        </span>
                        {active && (
                          <span className="flex size-5 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </StudioCard>

            <ConflictBanner conflicts={conflicts} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                {DEMO_SLOT_ORDER.map((slot) => (
                  <StudioCard key={slot} className="overflow-hidden">
                    <SlotHeading
                      slot={slot}
                      kcal={plan.slotTotals.get(slot)?.kcal ?? 0}
                      count={plan.day[slot].length}
                    />
                    <div className="h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                    {plan.day[slot].length === 0 ? (
                      <EmptyMeal>Noch nichts geplant.</EmptyMeal>
                    ) : (
                      plan.day[slot].map((entry, index) => (
                        <div key={entry.id}>
                          {index > 0 && (
                            <div className="ml-4 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                          )}
                          <EntryRow
                            entry={entry}
                            slot={slot}
                            allergens={allergens}
                            onAmount={(amount) => plan.setAmount(slot, entry.id, amount)}
                            onRemove={() => plan.removeEntry(slot, entry.id)}
                            onMove={(target) => plan.moveEntry(slot, target, entry.id)}
                            onExchange={(itemId, amount) => {
                              plan.removeEntry(slot, entry.id)
                              plan.addItem(slot, itemId, amount)
                            }}
                          />
                        </div>
                      ))
                    )}
                    <div className="border-t border-black/[0.06] px-2 py-1.5 dark:border-white/[0.08]">
                      <AddEntryButton
                        day={plan.day}
                        allergens={allergens}
                        label={`Zu ${DEMO_SLOT_LABELS[slot]} hinzufügen`}
                        onPick={(itemId, amount) => plan.addItem(slot, itemId, amount)}
                      />
                    </div>
                  </StudioCard>
                ))}
              </div>

              <div className="space-y-4">
                <StudioCard className="overflow-hidden">
                  <div className="px-4 pt-4">
                    <SectionTitle>Bibliothek</SectionTitle>
                  </div>
                  <ItemPicker
                    day={plan.day}
                    allergens={allergens}
                    className="h-[420px] -mt-2"
                    onPick={(itemId, amount, slot) =>
                      plan.addItem(slot ?? "snack_nachmittag", itemId, amount)
                    }
                    onPickTemplate={(templateId) => {
                      plan.applyTemplate(templateId)
                      setAppliedTemplate(templateId)
                      setStart("vorlage")
                    }}
                    onImport={() => undefined}
                  />
                </StudioCard>

                <StudioCard className="p-4">
                  <SectionTitle>Woche</SectionTitle>
                  <WeekStrip
                    weekKcal={plan.weekKcal}
                    active={plan.activeDay}
                    target={kcalTarget}
                    onSelect={plan.setActiveDay}
                    onCopy={plan.duplicateDay}
                  />
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Tag wählen zum Bearbeiten, Doppelklick kopiert den offenen Tag dorthin.
                  </p>
                </StudioCard>
              </div>
            </div>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {step === 4 && (
          <>
            <StudioCard className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-8">
                <ProgressRing
                  ratio={kcalReading.ratio}
                  size={148}
                  stroke={14}
                  status={kcalReading.status}
                >
                  <span className="text-[32px] leading-none font-bold tracking-[-0.02em] tabular-nums">
                    {formatNumber(Math.round(kcalReading.value))}
                  </span>
                  <span className="mt-1 text-[12px] text-muted-foreground">
                    von {formatNumber(kcalTarget)} kcal
                  </span>
                </ProgressRing>
                <TargetList readings={macroReadings} className="min-w-[240px] flex-1" />
              </div>
            </StudioCard>

            <ConflictBanner conflicts={conflicts} />

            <div className="grid gap-4 lg:grid-cols-2">
              <StudioCard className="p-5 sm:p-6">
                <SectionTitle>Mikronährstoffe</SectionTitle>
                <MicroPanel
                  readings={plan.microReadings}
                  onAdd={(itemId, amount) => plan.addItem("snack_nachmittag", itemId, amount)}
                />
              </StudioCard>

              <div className="space-y-4">
                <StudioCard className="p-5 sm:p-6">
                  <SectionTitle>Verteilung über den Tag</SectionTitle>
                  <SharePanel day={plan.day} />
                </StudioCard>
                <StudioCard className="p-5 sm:p-6">
                  <SectionTitle>Zusatzstoffe</SectionTitle>
                  <AdditivePanel codes={plan.additives} />
                </StudioCard>
              </div>
            </div>

            <StudioCard className="p-6 sm:p-8">
              <SectionTitle>Vor der Freigabe</SectionTitle>
              <ReleaseChecklist checks={checks} />

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/[0.07] pt-6 dark:border-white/[0.09]">
                {locked ? (
                  <>
                    <span
                      className="flex items-center gap-2 text-[15px] font-semibold"
                      style={{ color: TONE.ok.fill }}
                    >
                      <Lock className="size-4" />
                      Stand {release.revision} ist übergeben
                    </span>
                    <PrimaryButton
                      icon={<PencilLine className="size-4" />}
                      onClick={release.beginRevision}
                      className="ml-auto"
                    >
                      Änderung beginnen
                    </PrimaryButton>
                  </>
                ) : (
                  <>
                    <PrimaryButton
                      icon={<Send className="size-4" />}
                      disabled={plan.entryCount === 0}
                      onClick={release.release}
                    >
                      Stand {release.revision} verbindlich freigeben
                    </PrimaryButton>
                    <p className="max-w-[46ch] text-[12px] text-muted-foreground">
                      Der Stand wird unveränderlich und für die Klientin sichtbar. Spätere
                      Anpassungen beginnen als neuer Entwurf; bis dahin bleibt Stand{" "}
                      {release.revision - 1} gültig.
                    </p>
                  </>
                )}
              </div>
            </StudioCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <StudioCard className="p-5 sm:p-6">
                <SectionTitle>Stände</SectionTitle>
                <HistoryPanel
                  history={release.history}
                  currentRevision={release.revision}
                  status={release.status}
                />
              </StudioCard>
              <StudioCard className="p-5 sm:p-6">
                <SectionTitle>Übergabe</SectionTitle>
                <ExportPanel week={plan.week} />
              </StudioCard>
            </div>
          </>
        )}
      </div>

      {/* Footer: back/forward plus the consequence of every answer so far. */}
      <div className="sticky bottom-4 z-30 mt-6 flex justify-center">
        <div className="flex w-full max-w-[900px] items-center gap-3 rounded-full border border-black/[0.07] bg-background/80 py-2 pr-2 pl-3 shadow-[0_8px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-background/70">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1) as StepId)}
            disabled={step === 0}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="size-4" />
            Zurück
          </button>

          <div className="mx-auto hidden items-center gap-4 text-[13px] sm:flex">
            <span className="tabular-nums">
              <span className="font-semibold">{formatNumber(Math.round(plan.totals.kcal))}</span>
              <span className="text-muted-foreground"> / {formatNumber(kcalTarget)} kcal</span>
            </span>
            <span className="h-4 w-px bg-black/[0.12] dark:bg-white/[0.14]" />
            <span className="text-muted-foreground">
              {dietStyle}
              {allergens.length > 0 ? ` · ${allergens.length} Allergien` : ""}
            </span>
            {conflicts.length > 0 && (
              <span className="font-medium" style={{ color: ALERT }}>
                {conflicts.length} Konflikt{conflicts.length === 1 ? "" : "e"}
              </span>
            )}
          </div>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(4, value + 1) as StepId)}
              className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-[14px] font-semibold text-background transition-transform duration-200 active:scale-[0.97]"
            >
              Weiter
              <ArrowRight className="size-4" />
            </button>
          ) : locked ? (
            <button
              type="button"
              onClick={release.beginRevision}
              className="flex items-center gap-1.5 rounded-full border border-black/[0.09] px-5 py-2 text-[14px] font-semibold transition-colors hover:bg-black/[0.04] dark:border-white/[0.12] dark:hover:bg-white/[0.06]"
            >
              <PencilLine className="size-4" />
              Änderung
            </button>
          ) : (
            <button
              type="button"
              onClick={release.release}
              className="flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-5 py-2 text-[14px] font-semibold text-[var(--primary-foreground)] transition-transform duration-200 active:scale-[0.97]"
            >
              <Send className="size-4" />
              Freigeben
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
