import type { ClientFoodLogEntry, Food, NutrientValue } from "@/lib/types";
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
): NutrientValue[] {
  const scaled: NutrientValue[][] = [];

  for (const entry of entries) {
    if (entry.sourceType === "custom") {
      if (!entry.customNutrients?.length) continue;
      scaled.push(scaleNutrients(entry.customNutrients, 100, entry.amount));
      continue;
    }

    const food = entry.foodId ? foods.get(entry.foodId) : undefined;
    if (!food) continue;
    scaled.push(scaleNutrients(food.nutrients, food.baseAmount, entry.amount));
  }

  return sumNutrients(scaled);
}

/** Display label for an entry, independent of whether the catalog knows it. */
export function clientLogEntryLabel(
  entry: ClientFoodLogEntry,
  foods: Map<string, Food>,
): string {
  if (entry.sourceType === "custom") return entry.customName ?? "Eigener Eintrag";
  const food = entry.foodId ? foods.get(entry.foodId) : undefined;
  return food?.name ?? "Lebensmittel";
}
