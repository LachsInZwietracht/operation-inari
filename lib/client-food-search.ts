import type { NutrientValue } from "@/lib/types";

/**
 * One searchable thing the client can log.
 *
 * Foods, recipes and saved meals sit in a single list on purpose. Filing them
 * into separate tabs is a filing-cabinet model: it asks the person to know, in
 * advance, which drawer "Linsensuppe" lives in — catalog food, a recipe from
 * their plan, or the meal they saved last week. They do not know, and with
 * three tabs they search three times. One search, a badge that says what a hit
 * is, and filters for narrowing after the fact.
 */

export type ClientSearchKind = "food" | "recipe" | "meal";

/** The filter chips above the results. "own" cuts across kinds. */
export type ClientSearchFilter = "alle" | "food" | "recipe" | "own";

export interface ClientSearchItem {
  /** Unique across kinds — ids may repeat between tables. */
  key: string;
  kind: ClientSearchKind;
  id: string;
  name: string;
  /** Manufacturer, source, or what a saved meal contains. */
  subtitle?: string;
  /** Energy for one unit: 100 g of a food, one portion of a recipe or meal. */
  kcalPerUnit?: number;
  /** Full macros for one unit — the answer to "is this the one I meant?". */
  nutrientsPerUnit?: NutrientValue[];
  unit: "g" | "portion";
  /** Pre-filled amount when picked. */
  defaultAmount: number;
  /** Created by this client, not by the catalog or their counselor. */
  isOwn: boolean;
}

export const SEARCH_FILTER_LABELS: Record<ClientSearchFilter, string> = {
  alle: "Alle",
  food: "Lebensmittel",
  recipe: "Rezepte",
  own: "Meine",
};

export const KIND_LABELS: Record<ClientSearchKind, string> = {
  food: "Lebensmittel",
  recipe: "Rezept",
  meal: "Mahlzeit",
};

export function matchesFilter(item: ClientSearchItem, filter: ClientSearchFilter): boolean {
  switch (filter) {
    case "alle":
      return true;
    case "own":
      return item.isOwn;
    case "recipe":
      // A saved meal is a recipe in everything but name, so it belongs here
      // rather than in a category of its own that would hold two entries.
      return item.kind === "recipe" || item.kind === "meal";
    case "food":
      return item.kind === "food";
  }
}

/** Which filters are worth showing — an empty chip is a dead end. */
export function availableFilters(items: ClientSearchItem[]): ClientSearchFilter[] {
  const filters: ClientSearchFilter[] = ["alle"];
  if (items.some((item) => item.kind === "food")) filters.push("food");
  if (items.some((item) => item.kind === "recipe" || item.kind === "meal")) {
    filters.push("recipe");
  }
  if (items.some((item) => item.isOwn)) filters.push("own");
  // "Alle" plus a single category is not a choice — it is the same list twice.
  return filters.length > 2 ? filters : [];
}

/** kcal for an amount, given the item's unit convention. */
export function itemKcal(item: ClientSearchItem, amount: number): number | undefined {
  if (item.kcalPerUnit === undefined) return undefined;
  const perUnit = item.unit === "g" ? item.kcalPerUnit / 100 : item.kcalPerUnit;
  return Math.round(perUnit * amount);
}

/** The line under a food's name: what actually tells six protein bars apart. */
export function foodSubtitle(input: {
  manufacturer?: string;
  sourceId?: string;
  isOwn: boolean;
}): string {
  const parts: string[] = [];
  if (input.manufacturer) parts.push(input.manufacturer);
  else if (input.isOwn) parts.push("Eigenes Lebensmittel");
  else if (input.sourceId === "off") parts.push("Open Food Facts");
  else if (input.sourceId === "bls") parts.push("Katalog");
  return parts.join(" · ");
}

/** Energy per 100 g from a nutrient list, or undefined when it is not known. */
export function energyPer100g(
  nutrients: NutrientValue[] | undefined,
  baseAmount = 100,
): number | undefined {
  const energy = nutrients?.find((nutrient) => nutrient.nutrientId === "energie");
  if (!energy || baseAmount <= 0) return undefined;
  return Math.round((energy.amount / baseAmount) * 100);
}
