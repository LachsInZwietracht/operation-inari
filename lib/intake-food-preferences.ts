import type { FoodPreferenceRating } from "@/lib/types/patient";

export type FoodPreferenceGroup =
  | "protein"
  | "kohlenhydrate"
  | "gemuese"
  | "obst"
  | "milchprodukte"
  | "fette"
  | "getraenke";

export interface IntakeFoodPreferenceItem {
  /** Stable key persisted as `patient_food_preferences.food_key`. Never rename. */
  id: string;
  label: string;
  group: FoodPreferenceGroup;
  /** Matched case-insensitively against food names for swap suggestions. */
  foodMatchTokens: string[];
}

export const FOOD_PREFERENCE_GROUP_LABELS: Record<FoodPreferenceGroup, string> = {
  protein: "Eiweiß",
  kohlenhydrate: "Kohlenhydrate & Getreide",
  gemuese: "Gemüse",
  obst: "Obst",
  milchprodukte: "Milchprodukte",
  fette: "Fette & Nüsse",
  getraenke: "Getränke",
};

export const FOOD_PREFERENCE_RATING_LABELS: Record<FoodPreferenceRating, string> = {
  gerne: "Gerne",
  geht: "Geht",
  nie: "Nie",
};

/**
 * Curated catalog of common German staples used by the intake preference grid.
 * This is production reference data, not demo data — it drives which foods a
 * plan may suggest and which swaps are acceptable for a given patient.
 */
export const INTAKE_FOOD_PREFERENCES: IntakeFoodPreferenceItem[] = [
  // ── Eiweiß ──
  { id: "haehnchen", label: "Hähnchen", group: "protein", foodMatchTokens: ["hähnchen", "huhn", "poulet", "geflügel"] },
  { id: "rind", label: "Rindfleisch", group: "protein", foodMatchTokens: ["rind", "beef", "steak", "hackfleisch"] },
  { id: "schwein", label: "Schweinefleisch", group: "protein", foodMatchTokens: ["schwein", "kasseler", "schnitzel"] },
  { id: "lachs", label: "Lachs", group: "protein", foodMatchTokens: ["lachs", "salmon"] },
  { id: "thunfisch", label: "Thunfisch", group: "protein", foodMatchTokens: ["thunfisch", "tuna"] },
  { id: "garnelen", label: "Garnelen", group: "protein", foodMatchTokens: ["garnele", "shrimp", "prawn"] },
  { id: "eier", label: "Eier", group: "protein", foodMatchTokens: ["ei", "eier"] },
  { id: "tofu", label: "Tofu", group: "protein", foodMatchTokens: ["tofu", "sojaquark"] },
  { id: "linsen", label: "Linsen", group: "protein", foodMatchTokens: ["linse", "linsen"] },
  { id: "kichererbsen", label: "Kichererbsen", group: "protein", foodMatchTokens: ["kichererbse", "hummus"] },
  { id: "bohnen", label: "Bohnen", group: "protein", foodMatchTokens: ["bohne", "bohnen", "kidney"] },

  // ── Kohlenhydrate & Getreide ──
  { id: "haferflocken", label: "Haferflocken", group: "kohlenhydrate", foodMatchTokens: ["hafer", "haferflocken", "porridge"] },
  { id: "reis", label: "Reis", group: "kohlenhydrate", foodMatchTokens: ["reis", "rice"] },
  { id: "kartoffeln", label: "Kartoffeln", group: "kohlenhydrate", foodMatchTokens: ["kartoffel", "erdapfel"] },
  { id: "suesskartoffel", label: "Süßkartoffel", group: "kohlenhydrate", foodMatchTokens: ["süßkartoffel", "batate"] },
  { id: "nudeln", label: "Nudeln & Pasta", group: "kohlenhydrate", foodMatchTokens: ["nudel", "pasta", "spaghetti"] },
  { id: "vollkornbrot", label: "Vollkornbrot", group: "kohlenhydrate", foodMatchTokens: ["vollkornbrot", "brot"] },
  { id: "quinoa", label: "Quinoa", group: "kohlenhydrate", foodMatchTokens: ["quinoa"] },
  { id: "couscous", label: "Couscous & Bulgur", group: "kohlenhydrate", foodMatchTokens: ["couscous", "bulgur"] },

  // ── Gemüse ──
  { id: "brokkoli", label: "Brokkoli", group: "gemuese", foodMatchTokens: ["brokkoli", "broccoli"] },
  { id: "paprika", label: "Paprika", group: "gemuese", foodMatchTokens: ["paprika"] },
  { id: "spinat", label: "Spinat", group: "gemuese", foodMatchTokens: ["spinat"] },
  { id: "tomaten", label: "Tomaten", group: "gemuese", foodMatchTokens: ["tomate", "tomaten"] },
  { id: "gurke", label: "Gurke", group: "gemuese", foodMatchTokens: ["gurke"] },
  { id: "karotten", label: "Karotten", group: "gemuese", foodMatchTokens: ["karotte", "möhre"] },
  { id: "zucchini", label: "Zucchini", group: "gemuese", foodMatchTokens: ["zucchini"] },
  { id: "blattsalat", label: "Blattsalat", group: "gemuese", foodMatchTokens: ["salat", "rucola", "feldsalat"] },
  { id: "pilze", label: "Pilze", group: "gemuese", foodMatchTokens: ["pilz", "champignon"] },
  { id: "kohl", label: "Kohl & Sauerkraut", group: "gemuese", foodMatchTokens: ["kohl", "sauerkraut", "wirsing"] },

  // ── Obst ──
  { id: "apfel", label: "Apfel", group: "obst", foodMatchTokens: ["apfel"] },
  { id: "banane", label: "Banane", group: "obst", foodMatchTokens: ["banane"] },
  { id: "beeren", label: "Beeren", group: "obst", foodMatchTokens: ["beere", "himbeere", "heidelbeere", "erdbeere"] },
  { id: "zitrusfruechte", label: "Zitrusfrüchte", group: "obst", foodMatchTokens: ["orange", "mandarine", "zitrone", "grapefruit"] },
  { id: "trauben", label: "Trauben", group: "obst", foodMatchTokens: ["traube", "weintraube"] },

  // ── Milchprodukte ──
  { id: "quark", label: "Quark", group: "milchprodukte", foodMatchTokens: ["quark"] },
  { id: "skyr", label: "Skyr & Joghurt", group: "milchprodukte", foodMatchTokens: ["skyr", "joghurt"] },
  { id: "kaese", label: "Käse", group: "milchprodukte", foodMatchTokens: ["käse", "gouda", "feta", "mozzarella"] },
  { id: "milch", label: "Milch", group: "milchprodukte", foodMatchTokens: ["milch"] },

  // ── Fette & Nüsse ──
  { id: "nuesse", label: "Nüsse", group: "fette", foodMatchTokens: ["nuss", "nüsse", "mandel", "walnuss"] },
  { id: "olivenoel", label: "Olivenöl", group: "fette", foodMatchTokens: ["olivenöl", "olive"] },
  { id: "butter", label: "Butter", group: "fette", foodMatchTokens: ["butter"] },
  { id: "avocado", label: "Avocado", group: "fette", foodMatchTokens: ["avocado"] },

  // ── Getränke ──
  { id: "kaffee", label: "Kaffee", group: "getraenke", foodMatchTokens: ["kaffee", "espresso"] },
  { id: "tee", label: "Tee", group: "getraenke", foodMatchTokens: ["tee"] },
  { id: "softdrinks", label: "Softdrinks", group: "getraenke", foodMatchTokens: ["cola", "limonade", "softdrink"] },
];

export const INTAKE_FOOD_PREFERENCE_MAP = new Map(
  INTAKE_FOOD_PREFERENCES.map((item) => [item.id, item]),
);

export const INTAKE_FOOD_PREFERENCE_GROUPS: FoodPreferenceGroup[] = [
  "protein",
  "kohlenhydrate",
  "gemuese",
  "obst",
  "milchprodukte",
  "fette",
  "getraenke",
];
