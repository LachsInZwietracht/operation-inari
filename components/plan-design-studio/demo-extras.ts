/**
 * Everything the three Flow drafts need on top of the shared demo catalogue.
 *
 * `demo-data.ts` holds the plan itself — items, targets, the seed week. This
 * file holds the surfaces that grew around the planner since: the plan
 * principles, the release chain (Stand 1 → Änderungsentwurf → Stand 2), the
 * client's check-ins, and the three tools a counselor reaches for while
 * building (Austausch, Nährstofflücke, Einkaufsliste).
 *
 * Demo data only. Nothing here talks to Supabase.
 */

import {
  DEMO_ITEMS,
  DEMO_ITEM_MAP,
  DEMO_PATIENT,
  DEMO_SLOT_ORDER,
  dayNutrients,
  type DayIndex,
  type DemoDay,
  type DemoItem,
  type NutrientKey,
} from "./demo-data"

/* -------------------------------------------------------------------------- */
/* Plan-Prinzipien                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The rules the client can follow without the plan in front of them.
 *
 * Every one is derived from a number on the record, so it can be traced back —
 * the planner's own principles card works the same way. `source` is what the
 * counselor sees when they ask "woher kommt das?".
 */
export interface DemoPrinciple {
  id: string
  text: string
  source: string
  /** Derived from the record, or written by the counselor. */
  origin: "abgeleitet" | "eigene Regel"
}

export const DEMO_PRINCIPLES: DemoPrinciple[] = [
  {
    id: "p-kcal",
    text: "Rund 2.100 kcal am Tag, verteilt auf drei Mahlzeiten und zwei Snacks",
    source: "Zielwert Energie",
    origin: "abgeleitet",
  },
  {
    id: "p-protein",
    text: "Zu jeder Hauptmahlzeit eine Eiweißquelle",
    source: "Eiweiß 105 g · 1,25 g je kg Körpergewicht",
    origin: "abgeleitet",
  },
  {
    id: "p-fiber",
    text: "Mindestens 30 g Ballaststoffe – Vollkorn statt Weißmehl",
    source: "DGE-Referenzwert",
    origin: "abgeleitet",
  },
  {
    id: "p-veggies",
    text: "Drei Portionen Gemüse, zwei Portionen Obst",
    source: "Kostform Mediterran",
    origin: "abgeleitet",
  },
  {
    id: "p-carbs",
    text: "Kohlenhydrate über den Tag verteilen, abends die kleinste Portion",
    source: "Indikation Typ-2-Diabetes",
    origin: "abgeleitet",
  },
  {
    id: "p-own",
    text: "Kein Fertiggericht an Arbeitstagen – Reste vom Vorabend mitnehmen",
    source: "Im Gespräch vereinbart",
    origin: "eigene Regel",
  },
]

/* -------------------------------------------------------------------------- */
/* Freigabe-Kette                                                              */
/* -------------------------------------------------------------------------- */

export type DemoReleaseStatus = "draft" | "released" | "revision"

export interface DemoRevision {
  revision: number
  releasedAt: string
  replacedAt: string | null
  note: string
}

/**
 * The stands that were already handed over before this session.
 *
 * Stand 1 is released and superseded, which is what makes the chain visible in
 * the drafts: a released plan is never edited, it is replaced.
 */
export const DEMO_HISTORY: DemoRevision[] = [
  {
    revision: 1,
    releasedAt: "14. Juli 2026",
    replacedAt: "4. August 2026",
    note: "Erster Plan nach der Aufnahme · 2.300 kcal",
  },
  {
    revision: 2,
    releasedAt: "4. August 2026",
    replacedAt: null,
    note: "Frühstück auf Overnight Oats umgestellt · 2.100 kcal",
  },
]

/* -------------------------------------------------------------------------- */
/* Rückmeldung der Klientin                                                    */
/* -------------------------------------------------------------------------- */

/** One day of the client's check-in: energy, mood, digestion, weight. */
export interface DemoCheckIn {
  day: string
  energie: number
  stimmung: number
  verdauung: number
  gewicht?: number
  note?: string
}

export const DEMO_CHECKINS: DemoCheckIn[] = [
  { day: "Mo", energie: 6, stimmung: 7, verdauung: 5, gewicht: 83.4 },
  { day: "Di", energie: 7, stimmung: 7, verdauung: 6 },
  { day: "Mi", energie: 5, stimmung: 6, verdauung: 4, note: "Nachmittags Heißhunger" },
  { day: "Do", energie: 7, stimmung: 8, verdauung: 7, gewicht: 83.1 },
  { day: "Fr", energie: 8, stimmung: 8, verdauung: 7 },
  { day: "Sa", energie: 6, stimmung: 7, verdauung: 6 },
  { day: "So", energie: 7, stimmung: 8, verdauung: 7, gewicht: 82.6 },
]

export const DEMO_CHECKIN_SUMMARY = {
  /** Days the client logged something at all, out of seven. */
  logged: 7,
  weightDelta: -0.8,
  strongest: "Stimmung",
  weakest: "Verdauung",
  quote: "Der Nachmittag ist schwierig, danach esse ich abends zu viel.",
}

/* -------------------------------------------------------------------------- */
/* Austausch                                                                   */
/* -------------------------------------------------------------------------- */

export interface DemoExchange {
  item: DemoItem
  amount: number
  kcal: number
  kcalDelta: number
  proteinDelta: number
  /** True when the alternative carries an allergen the client reacts to. */
  conflict: boolean
}

/**
 * Alternatives for one entry: same library category, comparable portion, sorted
 * by how close they land on the entry's energy content.
 *
 * The counselor's question is never "what else exists" but "what can I put here
 * without redoing the day", so the deltas are the answer, not the absolutes.
 */
export function exchangeCandidates(itemId: string, amount: number): DemoExchange[] {
  const source = DEMO_ITEM_MAP.get(itemId)
  if (!source) return []
  const sourceFactor = amount / source.base
  const sourceKcal = source.nutrients.kcal * sourceFactor
  const sourceProtein = source.nutrients.protein * sourceFactor

  return DEMO_ITEMS.filter(
    (item) => item.id !== source.id && item.category === source.category && item.unit === source.unit,
  )
    .map((item) => {
      const candidateAmount = source.unit === "g" ? amount : item.step
      const factor = candidateAmount / item.base
      return {
        item,
        amount: candidateAmount,
        kcal: Math.round(item.nutrients.kcal * factor),
        kcalDelta: Math.round(item.nutrients.kcal * factor - sourceKcal),
        proteinDelta: item.nutrients.protein * factor - sourceProtein,
        conflict: Boolean(
          item.allergens?.some((allergen) => DEMO_PATIENT.allergens.includes(allergen)),
        ),
      }
    })
    .sort((a, b) => Math.abs(a.kcalDelta) - Math.abs(b.kcalDelta))
    .slice(0, 6)
}

/* -------------------------------------------------------------------------- */
/* Nährstofflücke                                                              */
/* -------------------------------------------------------------------------- */

export interface DemoGapCandidate {
  item: DemoItem
  /** Portion that closes exactly the amount that is missing. */
  amount: number
  kcal: number
  covers: number
  conflict: boolean
}

/**
 * Foods that close a named gap — "400 mg Calcium fehlen" — with the portion
 * that actually closes it and what that portion costs in energy.
 *
 * Portions are capped at four times the library's default so the answer stays
 * something a person would eat; anything that would need more is dropped.
 */
export function gapCandidates(nutrient: NutrientKey, missing: number): DemoGapCandidate[] {
  if (missing <= 0) return []
  return DEMO_ITEMS.map((item) => {
    const perUnit = item.nutrients[nutrient] / item.base
    if (perUnit <= 0) return null
    const needed = missing / perUnit
    const amount = item.unit === "g" ? Math.round(needed / 5) * 5 : Math.round(needed * 2) / 2
    if (amount <= 0 || amount > item.step * 4) return null
    const factor = amount / item.base
    return {
      item,
      amount,
      kcal: Math.round(item.nutrients.kcal * factor),
      covers: item.nutrients[nutrient] * factor,
      conflict: Boolean(
        item.allergens?.some((allergen) => DEMO_PATIENT.allergens.includes(allergen)),
      ),
    }
  })
    .filter((candidate): candidate is DemoGapCandidate => candidate !== null)
    // Cheapest way to close the gap, in energy — the counselor's real currency.
    .sort((a, b) => a.kcal - b.kcal)
    .slice(0, 5)
}

/* -------------------------------------------------------------------------- */
/* Einkaufsliste                                                               */
/* -------------------------------------------------------------------------- */

export interface DemoShoppingLine {
  item: DemoItem
  amount: number
  days: number
}

/** The week's entries added up per item and grouped by library category. */
export function shoppingList(
  week: Record<DayIndex, DemoDay>,
): Array<{ category: string; lines: DemoShoppingLine[] }> {
  const totals = new Map<string, { amount: number; days: Set<DayIndex> }>()

  for (const index of [0, 1, 2, 3, 4, 5, 6] as DayIndex[]) {
    for (const slot of DEMO_SLOT_ORDER) {
      for (const entry of week[index][slot]) {
        const current = totals.get(entry.itemId) ?? { amount: 0, days: new Set<DayIndex>() }
        current.amount += entry.amount
        current.days.add(index)
        totals.set(entry.itemId, current)
      }
    }
  }

  const groups = new Map<string, DemoShoppingLine[]>()
  for (const [itemId, value] of totals) {
    const item = DEMO_ITEM_MAP.get(itemId)
    if (!item) continue
    const list = groups.get(item.category) ?? []
    list.push({ item, amount: value.amount, days: value.days.size })
    groups.set(item.category, list)
  }

  return Array.from(groups, ([category, lines]) => ({
    category,
    lines: lines.sort((a, b) => a.item.name.localeCompare(b.item.name, "de")),
  })).sort((a, b) => a.category.localeCompare(b.category, "de"))
}

/* -------------------------------------------------------------------------- */
/* Verteilung über den Tag                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How the day's energy is spread over its five slots, against the split a
 * counselor would aim for. The share matters more than the absolute number:
 * 2.100 kcal with 1.400 of them after 18 Uhr is not the same plan.
 */
export const DEMO_SLOT_SHARE: Record<string, number> = {
  fruehstueck: 0.25,
  snack_vormittag: 0.1,
  mittagessen: 0.3,
  snack_nachmittag: 0.1,
  abendessen: 0.25,
}

export function dayEnergyShares(day: DemoDay): Array<{ slot: string; kcal: number; share: number; target: number }> {
  const total = dayNutrients(day).kcal
  return DEMO_SLOT_ORDER.map((slot) => {
    const kcal = day[slot].reduce((sum, entry) => {
      const item = DEMO_ITEM_MAP.get(entry.itemId)
      return item ? sum + (item.nutrients.kcal * entry.amount) / item.base : sum
    }, 0)
    return {
      slot,
      kcal,
      share: total > 0 ? kcal / total : 0,
      target: DEMO_SLOT_SHARE[slot] ?? 0,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Zusatzstoffe                                                                */
/* -------------------------------------------------------------------------- */

/** LMIV class and clinical note per E-number used in the demo catalogue. */
export const DEMO_ADDITIVE_INFO: Record<string, { klass: string; note: string }> = {
  "E 330": { klass: "Säuerungsmittel", note: "Citronensäure – unbedenklich" },
  "E 440": { klass: "Geliermittel", note: "Pektin – unbedenklich" },
  "E 160c": { klass: "Farbstoff", note: "Paprikaextrakt – unbedenklich" },
}
