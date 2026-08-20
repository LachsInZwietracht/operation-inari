import type {
  ClientFoodLogDay,
  ClientFoodLogEntry,
  ClientMealCompletion,
  ClientPlanEntry,
  ClientPlanEntryFacts,
  Food,
  MealSlotType,
  NutrientValue,
} from "@/lib/types";
import { CLIENT_MICRO_NUTRIENT_IDS } from "@/lib/client-micronutrients";
import { getNutrientValue, scaleNutrients, sumNutrients } from "@/lib/nutrients";

/** The four numbers the diary leads with. */
export const CLIENT_LOG_NUTRIENT_IDS = ["energie", "eiweiss", "fett", "kohlenhydrate"];

/**
 * Everything the client surface loads for a food.
 *
 * Fetched in one go rather than lazily on opening the micronutrient panel:
 * twenty values for a handful of foods is a smaller payload than the round
 * trip that avoiding it would cost, and a panel that has to load before it can
 * answer is a panel nobody opens twice.
 */
export const CLIENT_NUTRIENT_IDS = [
  ...CLIENT_LOG_NUTRIENT_IDS,
  ...CLIENT_MICRO_NUTRIENT_IDS,
];

/**
 * Nutrient totals for logged entries. Catalog entries scale from the food's
 * base amount; custom entries carry their own per-100 g values, which is why
 * they are scaled against a fixed 100 instead of a food record.
 */
export function calculateClientLogNutrients(
  entries: ClientFoodLogEntry[],
  foods: Map<string, Food>,
  /** Per-portion nutrients by recipe id; a recipe entry counts portions. */
  recipeFacts?: Map<string, NutrientValue[]>,
): NutrientValue[] {
  const scaled: NutrientValue[][] = [];

  for (const entry of entries) {
    if (entry.sourceType === "custom") {
      if (!entry.customNutrients?.length) continue;
      scaled.push(scaleNutrients(entry.customNutrients, 100, entry.amount));
      continue;
    }

    if (entry.sourceType === "recipe") {
      const perPortion = entry.recipeId ? recipeFacts?.get(entry.recipeId) : undefined;
      // Same rule as the plan side: an entry that cannot be priced adds
      // nothing rather than a confident zero.
      if (!perPortion?.length) continue;
      scaled.push(scaleNutrients(perPortion, 1, entry.amount));
      continue;
    }

    const food = entry.foodId ? foods.get(entry.foodId) : undefined;
    if (!food) continue;
    scaled.push(scaleNutrients(food.nutrients, food.baseAmount, entry.amount));
  }

  return sumNutrients(scaled);
}

/** How much of a planned entry was eaten. Undefined answer means none of it. */
export function eatenAmount(
  entry: ClientPlanEntry,
  completion: ClientMealCompletion | undefined,
): number {
  if (!completion || completion.skipped) return 0;
  return completion.amount ?? entry.amount;
}

/** What a plan entry contributes at a given amount. */
export function planEntryNutrients(
  facts: ClientPlanEntryFacts | undefined,
  amount: number,
): NutrientValue[] {
  if (!facts || amount <= 0) return [];
  return scaleNutrients(facts.perUnit, 1, amount);
}

/**
 * The whole day: what the client typed in, plus the planned meals they ticked
 * off.
 *
 * The second half is the point. A ticked plan entry is a statement that this
 * food was eaten, exactly like a diary line, and leaving it out of the totals
 * is what made a perfectly adherent day read as zero calories. It is counted
 * where it stands rather than copied into the diary, so there is only ever one
 * record of the fact.
 */
export interface ClientDayInput {
  entries: ClientFoodLogEntry[];
  foods: Map<string, Food>;
  recipeFacts?: Map<string, NutrientValue[]>;
  planEntries?: ClientPlanEntry[];
  completions?: Map<string, ClientMealCompletion>;
  planFacts?: Map<string, ClientPlanEntryFacts>;
}

/**
 * The day, one array per thing eaten, before anything is added up.
 *
 * The totals are just the sum of these, but the parts carry something the sum
 * destroys: which nutrients each source actually had data for. A food with no
 * iron value simply has no iron entry, and once summed that is indistinguishable
 * from an iron value of zero. Micronutrient coverage is computed from here for
 * exactly that reason — and from the same walk, so it can never describe a
 * different day than the totals do.
 */
export function collectClientDayParts(input: ClientDayInput): NutrientValue[][] {
  const parts: NutrientValue[][] = [];

  for (const entry of input.entries) {
    const nutrients = calculateClientLogNutrients([entry], input.foods, input.recipeFacts);
    if (nutrients.length > 0) parts.push(nutrients);
  }

  for (const entry of input.planEntries ?? []) {
    const amount = eatenAmount(entry, input.completions?.get(entry.id));
    if (amount <= 0) continue;
    const nutrients = planEntryNutrients(input.planFacts?.get(entry.id), amount);
    if (nutrients.length > 0) parts.push(nutrients);
  }

  return parts;
}

export function calculateClientDayNutrients(input: ClientDayInput): NutrientValue[] {
  return sumNutrients(collectClientDayParts(input));
}

/** Everything a plan prescribes for the day, answered or not — the reference. */
export function calculatePlannedNutrients(
  planEntries: ClientPlanEntry[],
  planFacts: Map<string, ClientPlanEntryFacts>,
): NutrientValue[] {
  return sumNutrients(
    planEntries.map((entry) => planEntryNutrients(planFacts.get(entry.id), entry.amount)),
  );
}

/**
 * What this person actually eats, keyed so a catalog food and a scanned
 * product can sit in the same list.
 */
export function logEntryKey(entry: ClientFoodLogEntry): string {
  if (entry.sourceType === "custom") {
    return `custom:${(entry.customName ?? "").trim().toLowerCase()}`;
  }
  // Recipes need their own namespace: keyed as foods they would all collapse
  // onto the same empty food id and read as one thing eaten many times.
  if (entry.sourceType === "recipe") return `recipe:${entry.recipeId ?? ""}`;
  return `food:${entry.foodId ?? ""}`;
}

export interface ClientRecentEntry {
  key: string;
  /** The most recent logging of this thing — it carries the amount to reuse. */
  entry: ClientFoodLogEntry;
  /** How often it appeared in the slot being filled. 0 = only eaten elsewhere. */
  count: number;
  /** The day it was last logged, in any slot. */
  lastDate: string;
  /** True when this belongs to the slot being filled. */
  inSlot: boolean;
}

/**
 * Everything this person has eaten lately, ordered so the next tap is likely
 * the right one.
 *
 * Most people eat the same twenty foods, and the second time something is
 * logged is the moment that decides whether a diary gets kept — so this is the
 * screen the add dialog opens on, not a list hidden behind a search.
 *
 * Two orderings in one list, because they answer different questions. What
 * belongs in *this* slot comes first, by how often it shows up: breakfast is
 * habit, and habit is best measured by repetition. Everything else follows by
 * recency — the answer to "what did I have last night", which frequency would
 * bury under the daily oats.
 */
export function collectRecentEntries(
  days: ClientFoodLogDay[],
  slot: MealSlotType,
  limit = 20,
): ClientRecentEntry[] {
  const seen = new Map<string, ClientRecentEntry>();

  // Newest first, so the retained entry carries the most recent amount and the
  // first sighting of a key is also its last logging date.
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const entry of day.entries) {
      const key = logEntryKey(entry);
      const inSlot = entry.slotType === slot;
      const existing = seen.get(key);

      if (existing) {
        if (inSlot) existing.count += 1;
        // An entry first seen in another slot keeps its date but adopts the
        // amount of this slot's most recent logging, which is the one being
        // offered here.
        if (inSlot && !existing.inSlot) {
          existing.inSlot = true;
          existing.entry = entry;
        }
        continue;
      }

      seen.set(key, {
        key,
        entry,
        count: inSlot ? 1 : 0,
        lastDate: day.date,
        inSlot,
      });
    }
  }

  return [...seen.values()]
    .sort((a, b) => {
      if (a.inSlot !== b.inSlot) return a.inSlot ? -1 : 1;
      if (a.inSlot && a.count !== b.count) return b.count - a.count;
      return b.lastDate.localeCompare(a.lastDate);
    })
    .slice(0, limit);
}

/** Display label for an entry, independent of whether the catalog knows it. */
export function clientLogEntryLabel(
  entry: ClientFoodLogEntry,
  foods: Map<string, Food>,
  recipeNames?: Map<string, string>,
): string {
  if (entry.sourceType === "custom") return entry.customName ?? "Eigener Eintrag";
  if (entry.sourceType === "recipe") {
    return (entry.recipeId ? recipeNames?.get(entry.recipeId) : undefined) ?? "Rezept";
  }
  const food = entry.foodId ? foods.get(entry.foodId) : undefined;
  return food?.name ?? "Lebensmittel";
}

/**
 * Energy of a single entry, or undefined when it cannot be priced.
 *
 * Undefined rather than 0: a recent-list row that says "0 kcal" claims the
 * food is free, while a row with no number just admits we do not know yet.
 */
export function logEntryKcal(
  entry: ClientFoodLogEntry,
  foods: Map<string, Food>,
  recipeFacts?: Map<string, NutrientValue[]>,
): number | undefined {
  const nutrients = calculateClientLogNutrients([entry], foods, recipeFacts);
  if (nutrients.length === 0) return undefined;
  return Math.round(getNutrientValue(nutrients, "energie"));
}

/** "60 g" or "1 Portion", depending on what the entry counts. */
export function formatLogAmount(entry: ClientFoodLogEntry): string {
  return formatPlanAmount(entry.amount, entry.sourceType === "recipe" ? "portion" : "g");
}

/** "60 g" or "1 Portion" — plan entries carry two different units. */
export function formatPlanAmount(amount: number, unit: "g" | "portion"): string {
  const rounded = Math.round(amount * 10) / 10;
  if (unit === "g") return `${rounded} g`;
  return `${rounded} ${rounded === 1 ? "Portion" : "Portionen"}`;
}
