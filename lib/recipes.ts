import type { Recipe } from "@/lib/types";

export function createRecipeLookup(recipes: Recipe[]): Map<string, Recipe> {
  const entries: Array<[string, Recipe]> = [];
  for (const recipe of recipes) {
    entries.push([recipe.id, recipe]);
    if (recipe.legacyId) {
      entries.push([recipe.legacyId, recipe]);
    }
  }
  return new Map(entries);
}
