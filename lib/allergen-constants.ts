export type AllergenCategory = "eu14" | "intolerance" | "preference";
export type AllergenType = "allergy" | "intolerance" | "preference";
export type AllergenSeverity = "mild" | "moderate" | "severe";

export interface AllergenDefinition {
  id: string;
  label: string;
  category: AllergenCategory;
  foodMatchTokens: string[];
}

/**
 * EU 14 mandatory allergens + common intolerances.
 * `foodMatchTokens` are matched case-insensitively against `food.allergens` / `recipe.allergens` strings.
 */
export const ALLERGEN_DEFINITIONS: AllergenDefinition[] = [
  // ── EU 14 ──
  { id: "gluten", label: "Gluten", category: "eu14", foodMatchTokens: ["gluten", "weizen", "roggen", "gerste", "hafer", "dinkel", "kamut"] },
  { id: "krebstiere", label: "Krebstiere", category: "eu14", foodMatchTokens: ["krebstier", "krebs", "garnele", "shrimp", "hummer", "krabbe"] },
  { id: "ei", label: "Ei", category: "eu14", foodMatchTokens: ["ei", "eier", "egg"] },
  { id: "fisch", label: "Fisch", category: "eu14", foodMatchTokens: ["fisch", "fish"] },
  { id: "erdnuss", label: "Erdnuss", category: "eu14", foodMatchTokens: ["erdnuss", "erdnüsse", "peanut"] },
  { id: "soja", label: "Soja", category: "eu14", foodMatchTokens: ["soja", "soy"] },
  { id: "milch", label: "Milch", category: "eu14", foodMatchTokens: ["milch", "laktose", "lactose", "molke", "kasein", "milk"] },
  { id: "schalenfrüchte", label: "Schalenfrüchte", category: "eu14", foodMatchTokens: ["schalenfrüchte", "nuss", "nüsse", "mandel", "haselnuss", "walnuss", "cashew", "pistazie", "macadamia", "pekan"] },
  { id: "sellerie", label: "Sellerie", category: "eu14", foodMatchTokens: ["sellerie", "celery"] },
  { id: "senf", label: "Senf", category: "eu14", foodMatchTokens: ["senf", "mustard"] },
  { id: "sesam", label: "Sesam", category: "eu14", foodMatchTokens: ["sesam", "sesame"] },
  { id: "schwefeldioxid", label: "Schwefeldioxid & Sulfite", category: "eu14", foodMatchTokens: ["sulfit", "sulfite", "schwefeldioxid", "so2"] },
  { id: "lupine", label: "Lupine", category: "eu14", foodMatchTokens: ["lupine", "lupin"] },
  { id: "weichtiere", label: "Weichtiere", category: "eu14", foodMatchTokens: ["weichtier", "muschel", "schnecke", "tintenfisch", "oktopus", "calamari"] },
  // ── Intolerances ──
  { id: "histamin", label: "Histamin", category: "intolerance", foodMatchTokens: ["histamin"] },
  { id: "fructose", label: "Fruktose", category: "intolerance", foodMatchTokens: ["fructose", "fruktose", "fruchtzucker"] },
  { id: "sorbit", label: "Sorbit", category: "intolerance", foodMatchTokens: ["sorbit", "sorbitol"] },
];

export const ALLERGEN_MAP = new Map(ALLERGEN_DEFINITIONS.map((d) => [d.id, d]));

export const ALLERGEN_TYPE_LABELS: Record<AllergenType, string> = {
  allergy: "Allergie",
  intolerance: "Intoleranz",
  preference: "Präferenz",
};

export const ALLERGEN_SEVERITY_LABELS: Record<AllergenSeverity, string> = {
  mild: "Leicht",
  moderate: "Mittel",
  severe: "Schwer",
};
