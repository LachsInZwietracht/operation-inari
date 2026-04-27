import type { Food, Ingredient } from "@/lib/types";
import { ALLERGEN_DEFINITIONS } from "@/lib/allergen-constants";

/**
 * BLS food-group → EU 14 allergen mapping.
 * Since BLS 4.0 does not include explicit allergen fields, we infer likely
 * allergens from the food group hierarchy.  These are conservative "contains"
 * assumptions based on the dominant composition of each BLS category.
 */
const FOOD_GROUP_ALLERGEN_MAP: Record<string, string[]> = {
  // Brot und Kleingebäck → Gluten
  fg_B: ["Gluten"],
  fg_B1: ["Gluten"],
  fg_B2: ["Gluten"],
  fg_B3: ["Gluten"],
  fg_B4: ["Gluten"],
  fg_B5: ["Gluten"],
  // Cerealien, Getreide und Teigwaren → Gluten
  fg_C: ["Gluten"],
  fg_C1: ["Gluten"],
  fg_C2: ["Gluten"],
  fg_C3: ["Gluten"],
  fg_C5: ["Gluten"],
  fg_C6: ["Gluten"],
  // Kuchen und Gebäck → Gluten, Ei, Milch (typical ingredients)
  fg_D: ["Gluten", "Ei", "Milch"],
  fg_D1: ["Gluten", "Ei", "Milch"],
  fg_D2: ["Gluten", "Ei", "Milch"],
  // Eier
  fg_E: ["Ei"],
  fg_E1: ["Ei"],
  fg_E2: ["Ei"],
  // Milch und Milcherzeugnisse
  fg_M: ["Milch"],
  fg_M1: ["Milch"],
  fg_M2: ["Milch"],
  fg_M3: ["Milch"],
  fg_M4: ["Milch"],
  fg_M5: ["Milch"],
  // Fisch und Meeresfrüchte
  fg_T: ["Fisch"],
  fg_T1: ["Fisch"],
  fg_T2: ["Fisch"],
  fg_T3: ["Fisch", "Krebstiere", "Weichtiere"],
  fg_T4: ["Fisch"],
  // Nüsse, Samen und Ölfrüchte
  fg_N: ["Schalenfrüchte"],
  fg_N1: ["Schalenfrüchte"],
  // Hülsenfrüchte (sub-group of Gemüse) — soja check done via name tokens
  fg_G6: ["Soja"],
  // Süßwaren → often contain Milch
  fg_S2: ["Milch"],
  fg_S3: ["Milch", "Ei"],
};

/**
 * Derive allergens from a recipe's ingredients using three strategies:
 * 1. Collect explicit `food.allergens` arrays.
 * 2. Infer from BLS food-group membership.
 * 3. Match food names against `ALLERGEN_DEFINITIONS.foodMatchTokens`.
 *
 * Returns deduplicated allergen labels (EU 14 + intolerances) sorted alphabetically.
 */
export function deriveRecipeAllergens(
  ingredients: Ingredient[],
  foods: Food[],
): string[] {
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const allergenSet = new Set<string>();

  for (const ingredient of ingredients) {
    const food = foodMap.get(ingredient.foodId);
    if (!food) continue;

    // Strategy 1: explicit allergens on the food
    if (food.allergens?.length) {
      for (const a of food.allergens) {
        allergenSet.add(a);
      }
    }

    // Strategy 2: food-group → allergen mapping
    if (food.foodGroupId) {
      const groupAllergens = FOOD_GROUP_ALLERGEN_MAP[food.foodGroupId];
      if (groupAllergens) {
        for (const a of groupAllergens) allergenSet.add(a);
      }
    }

    // Strategy 3: name-token matching
    const nameLower = food.name.toLowerCase();
    for (const def of ALLERGEN_DEFINITIONS) {
      if (allergenSet.has(def.label)) continue;
      for (const token of def.foodMatchTokens) {
        if (nameLower.includes(token.toLowerCase())) {
          allergenSet.add(def.label);
          break;
        }
      }
    }
  }

  return Array.from(allergenSet).sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Compute the ingredient-level CO₂ breakdown for a recipe.
 * Returns one entry per ingredient with its individual CO₂ contribution.
 */
export interface IngredientCo2Entry {
  foodId: string;
  foodName: string;
  co2: number;
  isPlantBased: boolean;
}

const PLANT_CATEGORIES = new Set([
  "cat_gemuese", "cat_obst", "cat_getreide", "cat_huelsenfruechte",
  "cat_nuesse", "cat_oele", "cat_gewuerze", "cat_fruehstueck", "cat_snacks",
]);

const ANIMAL_CATEGORIES = new Set([
  "cat_fleisch", "cat_fisch", "cat_milch", "cat_eier",
]);

const CATEGORY_CO2: Record<string, number> = {
  cat_gemuese: 1.2, cat_obst: 1.1, cat_getreide: 1.8,
  cat_huelsenfruechte: 1.5, cat_nuesse: 2.6, cat_oele: 3.2,
  cat_fisch: 5.4, cat_fleisch: 13.5, cat_milch: 3.5, cat_eier: 4.8,
  cat_getraenke: 0.8, cat_gewuerze: 0.6, cat_fruehstueck: 1.9,
  cat_snacks: 2.4, cat_fertiggerichte: 4.2, cat_unbekannt: 2.2,
};

export function computeIngredientCo2(
  ingredients: Ingredient[],
  foods: Food[],
): { entries: IngredientCo2Entry[]; totalCo2: number; plantShare: number; animalShare: number } {
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const entries: IngredientCo2Entry[] = [];
  let totalCo2 = 0;
  let plantMass = 0;
  let animalMass = 0;

  for (const ingredient of ingredients) {
    const food = foodMap.get(ingredient.foodId);
    if (!food) continue;

    const factor = CATEGORY_CO2[food.categoryId] ?? 2.2;
    const co2 = (ingredient.amount / 1000) * factor;
    totalCo2 += co2;

    const massKg = ingredient.amount / 1000;
    const isPlant = PLANT_CATEGORIES.has(food.categoryId);
    if (isPlant) plantMass += massKg;
    else if (ANIMAL_CATEGORIES.has(food.categoryId)) animalMass += massKg;

    entries.push({
      foodId: food.id,
      foodName: food.name,
      co2,
      isPlantBased: isPlant,
    });
  }

  entries.sort((a, b) => b.co2 - a.co2);
  const totalMass = plantMass + animalMass;

  return {
    entries,
    totalCo2,
    plantShare: totalMass > 0 ? plantMass / totalMass : 0,
    animalShare: totalMass > 0 ? animalMass / totalMass : 0,
  };
}
