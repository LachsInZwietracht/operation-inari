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
import { scaleNutrients, sumNutrients } from "@/lib/nutrients";

/** Macros shown in the client surface; keeps the by-ids payload small. */
export const CLIENT_LOG_NUTRIENT_IDS = ["energie", "eiweiss", "fett", "kohlenhydrate"];

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
export function calculateClientDayNutrients(input: {
  entries: ClientFoodLogEntry[];
  foods: Map<string, Food>;
  recipeFacts?: Map<string, NutrientValue[]>;
  planEntries?: ClientPlanEntry[];
  completions?: Map<string, ClientMealCompletion>;
  planFacts?: Map<string, ClientPlanEntryFacts>;
}): NutrientValue[] {
  const parts: NutrientValue[][] = [
    calculateClientLogNutrients(input.entries, input.foods, input.recipeFacts),
  ];

  for (const entry of input.planEntries ?? []) {
    const amount = eatenAmount(entry, input.completions?.get(entry.id));
    if (amount <= 0) continue;
    parts.push(planEntryNutrients(input.planFacts?.get(entry.id), amount));
  }

  return sumNutrients(parts);
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
  return entry.sourceType === "custom"
    ? `custom:${(entry.customName ?? "").trim().toLowerCase()}`
    : `food:${entry.foodId ?? ""}`;
}

export interface ClientLogSuggestion {
  key: string;
  entry: ClientFoodLogEntry;
  /** How often it appeared in the window — the reason it is being offered. */
  count: number;
}

/**
 * The things worth offering before the person starts typing.
 *
 * Most people eat the same twenty foods, and the second time something is
 * logged is the moment that decides whether a diary gets kept. Ranked by how
 * often it appears in this slot, with the most recent amount carried along, so
 * accepting a suggestion is one tap rather than a search and a number.
 *
 * Scoped to the slot on purpose: what belongs at breakfast is rarely what
 * belongs at dinner, and a single global list would bury both.
 */
export function collectFrequentEntries(
  days: ClientFoodLogDay[],
  slot: MealSlotType,
  limit = 6,
): ClientLogSuggestion[] {
  const seen = new Map<string, ClientLogSuggestion>();

  // Newest first, so the retained entry carries the most recent amount.
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const entry of day.entries) {
      if (entry.slotType !== slot) continue;
      const key = logEntryKey(entry);
      const existing = seen.get(key);
      if (existing) existing.count += 1;
      else seen.set(key, { key, entry, count: 1 });
    }
  }

  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** The entries of one slot on the day before `date` — the "wie gestern" source. */
export function previousDayEntries(
  days: ClientFoodLogDay[],
  date: string,
  slot: MealSlotType,
): ClientFoodLogEntry[] {
  const previous = [...days]
    .filter((day) => day.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return (previous?.entries ?? []).filter((entry) => entry.slotType === slot);
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
