"use client"

import { useMemo, useState } from "react"
import {
  Check,
  ChevronRight,
  FileDown,
  FileJson,
  LayoutTemplate,
  Lightbulb,
  Minus,
  MoveRight,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DEMO_ITEMS,
  DEMO_ITEM_MAP,
  DEMO_PATIENT,
  DEMO_SLOT_LABELS,
  DEMO_SLOT_ORDER,
  DEMO_SLOT_TIME,
  DEMO_TEMPLATES,
  WEEKDAY_SHORT,
  fillSuggestions,
  type DayIndex,
  type DemoDay,
  type DemoEntry,
  type DemoItem,
  type DemoSlotType,
  type TargetReading,
} from "./demo-data"
import {
  DEMO_ADDITIVE_INFO,
  DEMO_CHECKINS,
  DEMO_CHECKIN_SUMMARY,
  DEMO_PRINCIPLES,
  dayEnergyShares,
  exchangeCandidates,
  gapCandidates,
  shoppingList,
  type DemoRevision,
} from "./demo-extras"
import {
  ALERT,
  EASE,
  InsetPanel,
  RoundButton,
  SecondaryButton,
  SectionTitle,
  SegmentedControl,
  SYSTEM_FONT,
  TargetBar,
  TONE,
  formatValue,
} from "./studio-ui"

/**
 * The feature surfaces every Flow draft shares.
 *
 * The three drafts differ in how the counselor moves through the work — a
 * wizard, a case history, a day along the clock. What they must *not* differ in
 * is what the planner can do, so every function the real planner carries lives
 * here once and is placed differently in each draft: library, amounts,
 * exchange, gap tool, micronutrients, additives, principles, week, shopping
 * list, export and the release chain.
 *
 * Prototype code for a design decision — demo data only, nothing is persisted.
 */

export function hasConflict(item: DemoItem, allergens: string[] = DEMO_PATIENT.allergens): boolean {
  return Boolean(item.allergens?.some((allergen) => allergens.includes(allergen)))
}

function itemKcal(item: DemoItem, amount: number): number {
  return Math.round((item.nutrients.kcal * amount) / item.base)
}

export function amountLabel(item: DemoItem, amount: number): string {
  return item.unit === "g" ? `${formatNumber(amount)} g` : `${formatNumber(amount, 1)} Portion`
}

/* -------------------------------------------------------------------------- */
/* Bibliothek                                                                  */
/* -------------------------------------------------------------------------- */

type PickerTab = "vorschlag" | "rezepte" | "lebensmittel" | "vorlagen"

/**
 * The library, as one control.
 *
 * Search plus four sources — the suggestions that close today's open targets,
 * recipes, foods, and whole templates. "Vorschläge" is first because it is the
 * only tab that knows what the plan is currently missing; the rest is browsing.
 */
export function ItemPicker({
  day,
  allergens = DEMO_PATIENT.allergens,
  onPick,
  onPickTemplate,
  onImport,
  className,
}: {
  day: DemoDay
  allergens?: string[]
  onPick: (itemId: string, amount?: number, slot?: DemoSlotType) => void
  onPickTemplate?: (templateId: string) => void
  onImport?: () => void
  className?: string
}) {
  const [tab, setTab] = useState<PickerTab>("vorschlag")
  const [query, setQuery] = useState("")

  const suggestions = useMemo(() => fillSuggestions(day), [day])
  const needle = query.trim().toLowerCase()

  const results = useMemo(() => {
    const pool =
      tab === "rezepte"
        ? DEMO_ITEMS.filter((item) => item.kind === "recipe")
        : tab === "lebensmittel"
          ? DEMO_ITEMS.filter((item) => item.kind === "food")
          : DEMO_ITEMS
    if (!needle) return pool
    return pool.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle),
    )
  }, [tab, needle])

  // A search is a search: typing looks through everything, not through the tab.
  const searching = needle.length > 0

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="relative px-3 pt-3">
        <Search className="pointer-events-none absolute top-1/2 left-6 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rezept, Zutat oder Vorlage"
          className="h-9 rounded-full border-transparent bg-black/[0.05] pl-9 text-[14px] dark:bg-white/[0.07]"
        />
      </div>

      {!searching && (
        <div className="px-3 pt-3">
          <SegmentedControl
            fill
            size="sm"
            /* The picker also lives in a 320px sidebar, where four segments at
               the default padding would push "Vorlagen" off the edge. */
            className="[&>button]:px-2"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: "vorschlag", label: "Vorschläge" },
              { value: "rezepte", label: "Rezepte" },
              { value: "lebensmittel", label: "Zutaten" },
              { value: "vorlagen", label: "Vorlagen" },
            ]}
          />
        </div>
      )}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-2">
        {!searching && tab === "vorlagen" ? (
          <div className="space-y-1.5 px-3 py-1">
            {DEMO_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onPickTemplate?.(template.id)}
                className="flex w-full items-center gap-3 rounded-[14px] border border-black/[0.07] p-3 text-left transition-colors hover:bg-black/[0.03] dark:border-white/[0.09] dark:hover:bg-white/[0.05]"
              >
                <LayoutTemplate className="size-4 flex-none text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{template.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {template.indication}
                  </span>
                </span>
                <ChevronRight className="size-4 flex-none text-muted-foreground" />
              </button>
            ))}
            {onImport && (
              <button
                type="button"
                onClick={onImport}
                className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-black/[0.12] p-3 text-left text-[13px] text-muted-foreground transition-colors hover:bg-black/[0.03] dark:border-white/[0.14] dark:hover:bg-white/[0.05]"
              >
                <FileJson className="size-4 flex-none" />
                Plan-Datei importieren
              </button>
            )}
          </div>
        ) : !searching && tab === "vorschlag" ? (
          <div className="space-y-1.5 px-3 py-1">
            {suggestions.length === 0 && (
              <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
                Alle Zielwerte sind gedeckt – hier steht nichts mehr offen.
              </p>
            )}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.item.id}
                type="button"
                onClick={() => onPick(suggestion.item.id, suggestion.amount, suggestion.slot)}
                className="flex w-full items-center gap-3 rounded-[14px] border border-black/[0.07] p-3 text-left transition-colors hover:bg-black/[0.03] dark:border-white/[0.09] dark:hover:bg-white/[0.05]"
              >
                <Sparkles className="size-4 flex-none text-[var(--primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">
                    {suggestion.item.name}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {amountLabel(suggestion.item, suggestion.amount)} · schließt{" "}
                    {formatValue(suggestion.gain, suggestion.unit)} {suggestion.closes}
                  </span>
                </span>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  +{formatNumber(suggestion.kcal)} kcal
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-1">
            {results.map((item) => {
              const conflict = hasConflict(item, allergens)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item.id)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[14px]">{item.name}</span>
                      {conflict && (
                        <TriangleAlert className="size-3 flex-none" style={{ color: ALERT }} />
                      )}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {item.category} · {amountLabel(item, item.step)}
                    </span>
                  </span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {formatNumber(itemKcal(item, item.step))} kcal
                  </span>
                </button>
              )
            })}
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                Kein Treffer für „{query}“.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** The library in a popover, for the places that add one item inline. */
export function AddEntryButton({
  day,
  label,
  allergens,
  onPick,
  className,
  align = "start",
}: {
  day: DemoDay
  label: string
  allergens?: string[]
  onPick: (itemId: string, amount?: number) => void
  className?: string
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
            className,
          )}
        >
          <Plus className="size-3.5" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        style={{ fontFamily: SYSTEM_FONT }}
        className="w-[360px] rounded-[18px] border-black/[0.07] p-0 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:border-white/[0.1]"
      >
        <ItemPicker
          day={day}
          allergens={allergens}
          className="max-h-[380px]"
          onPick={(itemId, amount) => {
            onPick(itemId, amount)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */
/* Menge, Austausch, Verschieben                                               */
/* -------------------------------------------------------------------------- */

const FACTORS = [0.5, 1, 1.5, 2] as const

/**
 * Everything that can happen to one entry, in one popover: change the amount,
 * move it to another meal, swap it for something comparable, remove it.
 *
 * Four separate controls in the old planner; here they are four rows of the
 * same sheet, because they are four answers to the same question — "das passt
 * so noch nicht".
 */
export function EntryEditor({
  entry,
  slot,
  onAmount,
  onRemove,
  onMove,
  onExchange,
}: {
  entry: DemoEntry
  slot: DemoSlotType
  onAmount: (amount: number) => void
  onRemove: () => void
  onMove?: (target: DemoSlotType) => void
  onExchange?: (itemId: string, amount: number) => void
}) {
  const item = DEMO_ITEM_MAP.get(entry.itemId)
  const [mode, setMode] = useState<"menge" | "austausch">("menge")
  const exchanges = useMemo(
    () => (item ? exchangeCandidates(entry.itemId, entry.amount) : []),
    [entry.amount, entry.itemId, item],
  )
  if (!item) return null

  const step = item.unit === "g" ? 10 : 0.5
  const factor = entry.amount / item.base
  const nutrients = [
    ["kcal", Math.round(item.nutrients.kcal * factor), ""],
    ["Eiweiß", item.nutrients.protein * factor, "g"],
    ["KH", item.nutrients.carbs * factor, "g"],
    ["Fett", item.nutrients.fat * factor, "g"],
  ] as const

  return (
    <div className="w-[320px]" style={{ fontFamily: SYSTEM_FONT }}>
      <div className="px-4 pt-4">
        <p className="text-[15px] font-semibold">{item.name}</p>
        <p className="text-[12px] text-muted-foreground">
          {item.category} · {DEMO_SLOT_LABELS[slot]}
        </p>
      </div>

      <div className="px-4 pt-3">
        <SegmentedControl
          fill
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "menge", label: "Menge" },
            { value: "austausch", label: "Austausch" },
          ]}
        />
      </div>

      {mode === "menge" ? (
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <RoundButton
              label="Weniger"
              onClick={() => onAmount(Math.max(step, entry.amount - step))}
            >
              <Minus className="size-4" />
            </RoundButton>
            <div className="text-center">
              <p className="text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums">
                {formatNumber(entry.amount, item.unit === "g" ? 0 : 1)}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {item.unit === "g" ? "Gramm" : "Portionen"}
              </p>
            </div>
            <RoundButton label="Mehr" onClick={() => onAmount(entry.amount + step)}>
              <Plus className="size-4" />
            </RoundButton>
          </div>

          <div className="flex gap-1.5">
            {FACTORS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onAmount(item.step * value)}
                className="flex-1 rounded-full bg-black/[0.05] py-1.5 text-[12px] font-medium transition-colors hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
              >
                {formatNumber(value, value % 1 === 0 ? 0 : 1)}×
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {nutrients.map(([label, value, unit]) => (
              <div key={label} className="rounded-[10px] bg-black/[0.03] p-2 text-center dark:bg-white/[0.04]">
                <p className="text-[15px] font-semibold tabular-nums">
                  {formatNumber(value, unit ? 1 : 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {onMove && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">
                In eine andere Mahlzeit
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_SLOT_ORDER.filter((target) => target !== slot).map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => onMove(target)}
                    className="flex items-center gap-1 rounded-full border border-black/[0.08] px-2.5 py-1 text-[12px] transition-colors hover:bg-black/[0.04] dark:border-white/[0.1] dark:hover:bg-white/[0.06]"
                  >
                    <MoveRight className="size-3" />
                    {DEMO_SLOT_LABELS[target]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onRemove}
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--urgency-overdue)_10%,transparent)]"
            style={{ color: ALERT }}
          >
            <Trash2 className="size-3.5" />
            Aus dem Plan entfernen
          </button>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto p-2">
          {exchanges.length === 0 && (
            <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              Für diese Warengruppe liegt keine vergleichbare Alternative in der Demo-Bibliothek.
            </p>
          )}
          {exchanges.map((candidate) => (
            <button
              key={candidate.item.id}
              type="button"
              onClick={() => onExchange?.(candidate.item.id, candidate.amount)}
              className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px]">{candidate.item.name}</span>
                  {candidate.conflict && (
                    <TriangleAlert className="size-3 flex-none" style={{ color: ALERT }} />
                  )}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {amountLabel(candidate.item, candidate.amount)} · {formatNumber(candidate.kcal)} kcal
                </span>
              </span>
              <span
                className="text-[12px] font-medium tabular-nums"
                style={{
                  color:
                    candidate.kcalDelta === 0
                      ? undefined
                      : candidate.kcalDelta < 0
                        ? TONE.ok.fill
                        : TONE.high.fill,
                }}
              >
                {candidate.kcalDelta > 0 ? "+" : ""}
                {formatNumber(candidate.kcalDelta)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One entry as a full-width list row — used wherever a meal is a list. */
export function EntryRow({
  entry,
  slot,
  allergens = DEMO_PATIENT.allergens,
  onAmount,
  onRemove,
  onMove,
  onExchange,
}: {
  entry: DemoEntry
  slot: DemoSlotType
  allergens?: string[]
  onAmount: (amount: number) => void
  onRemove: () => void
  onMove?: (target: DemoSlotType) => void
  onExchange?: (itemId: string, amount: number) => void
}) {
  const item = DEMO_ITEM_MAP.get(entry.itemId)
  if (!item) return null
  const conflict = hasConflict(item, allergens)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px]">{item.name}</span>
              {conflict && <TriangleAlert className="size-3.5 flex-none" style={{ color: ALERT }} />}
            </span>
            <span className="block truncate text-[12px] text-muted-foreground">
              {amountLabel(item, entry.amount)}
              {item.kind === "recipe" ? " · Rezept" : ` · ${item.category}`}
            </span>
          </span>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {formatNumber(itemKcal(item, entry.amount))} kcal
          </span>
          <ChevronRight className="size-4 flex-none text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="rounded-[18px] border-black/[0.07] p-0 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:border-white/[0.1]"
        style={{ width: "auto" }}
      >
        <EntryEditor
          entry={entry}
          slot={slot}
          onAmount={onAmount}
          onRemove={onRemove}
          onMove={onMove}
          onExchange={onExchange}
        />
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */
/* Analyse                                                                     */
/* -------------------------------------------------------------------------- */

export function TargetList({
  readings,
  className,
}: {
  readings: TargetReading[]
  className?: string
}) {
  return (
    <div className={cn("space-y-3.5", className)}>
      {readings.map((reading) => (
        <TargetBar key={reading.target.key} reading={reading} />
      ))}
    </div>
  )
}

/**
 * Micronutrients with the gap tool attached.
 *
 * Reading "Calcium 620 von 1.000 mg" and doing something about it were two
 * different screens in the old planner. Here the row that reports the gap is
 * the row that closes it.
 */
export function MicroPanel({
  readings,
  onAdd,
}: {
  readings: TargetReading[]
  onAdd?: (itemId: string, amount: number) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      {readings.map((reading) => {
        const missing = Math.max(0, reading.remaining)
        const expanded = open === reading.target.key
        const candidates = expanded ? gapCandidates(reading.target.key, missing) : []
        return (
          <div key={reading.target.key}>
            <button
              type="button"
              disabled={missing <= 0 || !onAdd}
              onClick={() => setOpen(expanded ? null : reading.target.key)}
              className="w-full rounded-[12px] px-2 py-1.5 text-left transition-colors enabled:hover:bg-black/[0.03] disabled:cursor-default dark:enabled:hover:bg-white/[0.05]"
            >
              <TargetBar reading={reading} />
              {missing > 0 && onAdd && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--primary)]">
                  <Lightbulb className="size-3" />
                  {formatValue(missing, reading.target.unit)} offen – Lebensmittel zeigen
                </p>
              )}
            </button>

            {expanded && (
              <div className="mt-1 ml-2 space-y-1 border-l border-black/[0.08] pl-3 dark:border-white/[0.1]">
                {candidates.length === 0 && (
                  <p className="py-2 text-[12px] text-muted-foreground">
                    Kein Eintrag der Demo-Bibliothek schließt diese Lücke in einer üblichen Portion.
                  </p>
                )}
                {candidates.map((candidate) => (
                  <button
                    key={candidate.item.id}
                    type="button"
                    onClick={() => {
                      onAdd?.(candidate.item.id, candidate.amount)
                      setOpen(null)
                    }}
                    className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <Plus className="size-3 flex-none text-[var(--primary)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px]">{candidate.item.name}</span>
                        {candidate.conflict && (
                          <TriangleAlert className="size-3 flex-none" style={{ color: ALERT }} />
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {amountLabel(candidate.item, candidate.amount)} ·{" "}
                        {formatValue(candidate.covers, reading.target.unit)}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      +{formatNumber(candidate.kcal)} kcal
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Where the day's energy sits, against the split a counselor would aim for. */
export function SharePanel({ day }: { day: DemoDay }) {
  const shares = dayEnergyShares(day)
  return (
    <div className="space-y-2.5">
      {shares.map((share) => {
        const off = Math.abs(share.share - share.target) > 0.08 && share.share > 0
        return (
          <div key={share.slot} className="flex items-center gap-3">
            <span className="w-32 flex-none truncate text-[13px]">
              {DEMO_SLOT_LABELS[share.slot as DemoSlotType]}
            </span>
            <span className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[var(--color-track)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.min(100, share.share * 100)}%`,
                  background: off ? TONE.high.fill : TONE.ok.fill,
                  transition: `width 400ms ${EASE}`,
                }}
              />
              {/* The target share, as a hairline the bar is read against. */}
              <span
                className="absolute inset-y-0 w-px bg-foreground/40"
                style={{ left: `${share.target * 100}%` }}
              />
            </span>
            <span className="w-16 flex-none text-right text-[12px] text-muted-foreground tabular-nums">
              {formatNumber(Math.round(share.kcal))} kcal
            </span>
          </div>
        )
      })}
      <p className="pt-1 text-[12px] text-muted-foreground">
        Die Linie markiert die angestrebte Verteilung: 25 / 10 / 30 / 10 / 25 %.
      </p>
    </div>
  )
}

export function AdditivePanel({ codes }: { codes: string[] }) {
  if (codes.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Keine deklarationspflichtigen Zusatzstoffe im Plan.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {codes.map((code) => {
        const info = DEMO_ADDITIVE_INFO[code]
        return (
          <div key={code} className="flex items-baseline gap-2.5 text-[13px]">
            <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[12px] font-medium tabular-nums dark:bg-white/[0.07]">
              {code}
            </span>
            <span className="min-w-0">
              <span className="font-medium">{info?.klass ?? "Zusatzstoff"}</span>
              <span className="text-muted-foreground"> · {info?.note ?? "keine Bewertung"}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function PrinciplesPanel() {
  return (
    <div className="space-y-2.5">
      {DEMO_PRINCIPLES.map((principle) => (
        <div key={principle.id} className="flex items-start gap-2.5">
          <span
            className="mt-[3px] flex size-[18px] flex-none items-center justify-center rounded-full"
            style={{
              background: `color-mix(in oklab, ${TONE.ok.fill} 15%, transparent)`,
              color: TONE.ok.fill,
            }}
          >
            <Check className="size-3" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px]">{principle.text}</span>
            <span className="block text-[12px] text-muted-foreground">
              {principle.source}
              {principle.origin === "eigene Regel" ? " · eigene Regel" : ""}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Allergen findings. The one red surface in the drafts. */
export function ConflictBanner({
  conflicts,
  className,
}: {
  conflicts: Array<{ entryId: string; item: DemoItem; allergens: string[] }>
  className?: string
}) {
  if (conflicts.length === 0) return null
  return (
    <div
      className={cn("flex items-start gap-3 rounded-[16px] px-4 py-3", className)}
      style={{ background: `color-mix(in oklab, ${ALERT} 10%, transparent)` }}
    >
      <TriangleAlert className="mt-0.5 size-4 flex-none" style={{ color: ALERT }} />
      <div className="min-w-0 text-[13px]">
        <p className="font-semibold" style={{ color: ALERT }}>
          {conflicts.length} Eintrag{conflicts.length === 1 ? "" : "e"} mit einem Allergen der
          Klientin
        </p>
        <p className="text-muted-foreground">
          {conflicts
            .map((conflict) => `${conflict.item.name} (${conflict.allergens.join(", ")})`)
            .join(" · ")}{" "}
          – austauschen oder bewusst stehen lassen.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Woche                                                                       */
/* -------------------------------------------------------------------------- */

export function WeekStrip({
  weekKcal,
  active,
  target,
  onSelect,
  onCopy,
  className,
}: {
  weekKcal: Array<{ index: DayIndex; kcal: number; entries: number }>
  active: DayIndex
  target: number
  onSelect: (index: DayIndex) => void
  onCopy?: (from: DayIndex, to: DayIndex) => void
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-7 gap-1.5", className)}>
      {weekKcal.map((entry) => {
        const isActive = entry.index === active
        const ratio = target > 0 ? entry.kcal / target : 0
        const status = entry.entries === 0 ? "low" : ratio >= 0.9 && ratio <= 1.1 ? "ok" : ratio > 1.1 ? "high" : "low"
        return (
          <button
            key={entry.index}
            type="button"
            onClick={() => onSelect(entry.index)}
            onDoubleClick={() => onCopy?.(active, entry.index)}
            title={onCopy ? "Doppelklick: aktuellen Tag hierher kopieren" : undefined}
            style={{ transitionTimingFunction: EASE }}
            className={cn(
              "rounded-[14px] border px-1 py-2 text-center transition-all duration-300 active:scale-[0.97]",
              isActive
                ? "border-foreground/70 bg-black/[0.04] dark:bg-white/[0.07]"
                : "border-black/[0.07] hover:bg-black/[0.03] dark:border-white/[0.09] dark:hover:bg-white/[0.05]",
            )}
          >
            <span className="block text-[11px] font-medium text-muted-foreground">
              {WEEKDAY_SHORT[entry.index]}
            </span>
            <span className="mx-auto mt-1.5 block h-1 w-8 rounded-full bg-[var(--color-track)]">
              <span
                className="block h-1 rounded-full"
                style={{
                  width: `${Math.min(100, ratio * 100)}%`,
                  background: TONE[status].fill,
                }}
              />
            </span>
            <span className="mt-1.5 block text-[11px] tabular-nums">
              {entry.entries === 0 ? "–" : formatNumber(Math.round(entry.kcal))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Freigabe, Übergabe, Historie                                                */
/* -------------------------------------------------------------------------- */

export interface ReleaseCheck {
  ok: boolean
  text: string
  /** An allergen finding is the only one that should stop a release. */
  critical?: boolean
}

/**
 * The checks a counselor runs before handing a plan over, as one list.
 *
 * Green is not "correct", it is "nothing left open here" — the amber lines are
 * information, not a lock. Only the allergen line is meant to stop someone.
 */
export function ReleaseChecklist({ checks }: { checks: ReleaseCheck[] }) {
  return (
    <div className="space-y-2">
      {checks.map((check) => {
        const tone = check.ok ? TONE.ok.fill : check.critical ? ALERT : TONE.high.fill
        return (
          <div key={check.text} className="flex items-start gap-2.5 text-[14px]">
            <span
              className="mt-0.5 flex size-[18px] flex-none items-center justify-center rounded-full"
              style={{ background: `color-mix(in oklab, ${tone} 15%, transparent)`, color: tone }}
            >
              {check.ok ? <Check className="size-3" /> : <TriangleAlert className="size-3" />}
            </span>
            <span className={check.ok ? "text-muted-foreground" : "font-medium"}>{check.text}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Every stand this plan has had, newest last. */
export function HistoryPanel({
  history,
  currentRevision,
  status,
}: {
  history: DemoRevision[]
  currentRevision: number
  status: "draft" | "released" | "revision"
}) {
  return (
    <ol className="space-y-0">
      {history.map((entry, index) => (
        <li key={entry.revision} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span
              className="flex size-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold"
              style={
                entry.replacedAt
                  ? { background: "var(--color-track)", color: "var(--muted-foreground)" }
                  : {
                      background: `color-mix(in oklab, ${TONE.ok.fill} 18%, transparent)`,
                      color: TONE.ok.fill,
                    }
              }
            >
              {entry.revision}
            </span>
            {index < history.length - 1 || status !== "released" ? (
              <span className="w-px flex-1 bg-black/[0.09] dark:bg-white/[0.12]" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1 pb-4">
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="text-[14px] font-medium">Stand {entry.revision}</span>
              <span className="text-[12px] text-muted-foreground">
                freigegeben {entry.releasedAt}
                {entry.replacedAt ? ` · ersetzt ${entry.replacedAt}` : " · gültig"}
              </span>
            </span>
            <span className="block text-[13px] text-muted-foreground">{entry.note}</span>
          </span>
        </li>
      ))}

      {status !== "released" && (
        <li className="flex gap-3">
          <span className="flex size-6 flex-none items-center justify-center rounded-full border border-dashed border-black/[0.2] text-[11px] font-semibold text-muted-foreground dark:border-white/[0.25]">
            {currentRevision}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">
              Stand {currentRevision} · {status === "revision" ? "Änderungsentwurf" : "Entwurf"}
            </span>
            <span className="block text-[13px] text-muted-foreground">
              In Arbeit. Bis zur Freigabe bleibt Stand {currentRevision - 1} für die Klientin gültig.
            </span>
          </span>
        </li>
      )}
    </ol>
  )
}

/** Status of the open plan, as one line — the drafts print it in their header. */
export function StandBadge({
  status,
  revision,
}: {
  status: "draft" | "released" | "revision"
  revision: number
}) {
  const meta =
    status === "released"
      ? { label: `Stand ${revision} · freigegeben`, color: TONE.ok.fill }
      : status === "revision"
        ? { label: `Stand ${revision} · Änderungsentwurf`, color: TONE.high.fill }
        : { label: `Stand ${revision} · Entwurf`, color: "var(--muted-foreground)" }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{
        color: meta.color,
        background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Übergabe an die Klientin                                                    */
/* -------------------------------------------------------------------------- */

export function ExportPanel({ week }: { week: Record<DayIndex, DemoDay> }) {
  const [openList, setOpenList] = useState(false)
  const list = useMemo(() => shoppingList(week), [week])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SecondaryButton icon={<FileDown className="size-4" />}>PDF für die Klientin</SecondaryButton>
        <SecondaryButton
          icon={<ShoppingCart className="size-4" />}
          onClick={() => setOpenList((value) => !value)}
        >
          Einkaufsliste
        </SecondaryButton>
        <SecondaryButton icon={<LayoutTemplate className="size-4" />}>
          Als Vorlage sichern
        </SecondaryButton>
        <SecondaryButton icon={<FileJson className="size-4" />}>Plan-Datei</SecondaryButton>
      </div>

      {openList && (
        <InsetPanel className="max-h-[280px] overflow-y-auto">
          <SectionTitle>Einkaufsliste der Woche</SectionTitle>
          <div className="space-y-3">
            {list.map((group) => (
              <div key={group.category}>
                <p className="text-[12px] font-semibold text-muted-foreground">{group.category}</p>
                <ul className="mt-1 space-y-0.5">
                  {group.lines.map((line) => (
                    <li
                      key={line.item.id}
                      className="flex items-baseline justify-between gap-3 text-[13px]"
                    >
                      <span className="truncate">{line.item.name}</span>
                      <span className="flex-none text-muted-foreground tabular-nums">
                        {amountLabel(line.item, line.amount)} · {line.days} Tage
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {list.length === 0 && (
              <p className="text-[13px] text-muted-foreground">Die Woche ist noch leer.</p>
            )}
          </div>
        </InsetPanel>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Rückmeldung                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What came back from the client since the last release.
 *
 * This is the half of the counselor's loop the old planner never showed: a plan
 * is not finished when it is handed over, it is finished when it worked.
 */
export function CheckInPanel() {
  const max = 10
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Energie", "energie"],
            ["Stimmung", "stimmung"],
            ["Verdauung", "verdauung"],
          ] as const
        ).map(([label, key]) => {
          const average =
            DEMO_CHECKINS.reduce((sum, entry) => sum + entry[key], 0) / DEMO_CHECKINS.length
          return (
            <div key={key} className="rounded-[14px] bg-black/[0.03] p-3 dark:bg-white/[0.04]">
              <p className="text-[12px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-[22px] leading-none font-semibold tabular-nums">
                {formatNumber(average, 1)}
                <span className="text-[12px] font-normal text-muted-foreground"> / {max}</span>
              </p>
              {/* One bar per logged day, so the average above has something
                  behind it: a flat 6,6 and a week that swings from 4 to 9 are
                  not the same week. */}
              <div className="mt-2 flex h-6 items-end gap-[3px]">
                {DEMO_CHECKINS.map((entry) => (
                  <span
                    key={entry.day}
                    title={`${entry.day}: ${entry[key]} von ${max}`}
                    className="flex h-full flex-1 flex-col justify-end rounded-full"
                    style={{ background: "var(--color-track)" }}
                  >
                    <span
                      className="w-full rounded-full"
                      style={{
                        height: `${Math.max(12, (entry[key] / max) * 100)}%`,
                        background: entry[key] >= 6 ? TONE.ok.fill : TONE.high.fill,
                      }}
                    />
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
        <span>
          <span className="text-muted-foreground">Gewicht </span>
          <span className="font-medium tabular-nums" style={{ color: TONE.ok.fill }}>
            {formatNumber(DEMO_CHECKIN_SUMMARY.weightDelta, 1)} kg
          </span>
        </span>
        <span className="text-muted-foreground">
          {DEMO_CHECKIN_SUMMARY.logged} von 7 Tagen dokumentiert
        </span>
      </div>

      <p className="border-l-2 border-black/[0.12] pl-3 text-[13px] text-muted-foreground italic dark:border-white/[0.16]">
        „{DEMO_CHECKIN_SUMMARY.quote}“
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Kleinteile                                                                  */
/* -------------------------------------------------------------------------- */

/** Meal heading with its clock time and running energy — used by two drafts. */
export function SlotHeading({
  slot,
  kcal,
  count,
  action,
}: {
  slot: DemoSlotType
  kcal: number
  count: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2.5">
      <span className="text-[15px] font-semibold">{DEMO_SLOT_LABELS[slot]}</span>
      <span className="text-[12px] text-muted-foreground tabular-nums">{DEMO_SLOT_TIME[slot]}</span>
      <span className="ml-auto text-[13px] text-muted-foreground tabular-nums">
        {count === 0 ? "leer" : `${formatNumber(Math.round(kcal))} kcal`}
      </span>
      {action}
    </div>
  )
}

export function EmptyMeal({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-2 text-[13px] text-muted-foreground">{children}</p>
}
