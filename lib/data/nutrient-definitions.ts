import type { NutrientDefinition } from "@/lib/types";

export const NUTRIENT_DEFINITIONS: NutrientDefinition[] = [
  // Makronährstoffe
  { id: "energie", name: "Energie", shortName: "Energie", unit: "kcal", group: "makronaehrstoffe", sortOrder: 1 },
  { id: "energie_kj", name: "Energie (kJ)", shortName: "Energie kJ", unit: "kJ", group: "makronaehrstoffe", sortOrder: 2 },
  { id: "eiweiss", name: "Eiweiß", shortName: "Eiweiß", unit: "g", group: "makronaehrstoffe", sortOrder: 3 },
  { id: "fett", name: "Fett", shortName: "Fett", unit: "g", group: "makronaehrstoffe", sortOrder: 4 },
  { id: "kohlenhydrate", name: "Kohlenhydrate", shortName: "KH", unit: "g", group: "makronaehrstoffe", sortOrder: 5 },
  { id: "ballaststoffe", name: "Ballaststoffe", shortName: "Ballastst.", unit: "g", group: "makronaehrstoffe", sortOrder: 6 },
  { id: "zucker", name: "Zucker", shortName: "Zucker", unit: "g", group: "makronaehrstoffe", sortOrder: 7 },
  { id: "gesaettigte_fettsaeuren", name: "Gesättigte Fettsäuren", shortName: "Ges. FS", unit: "g", group: "makronaehrstoffe", sortOrder: 8 },
  { id: "ungesaettigte_fettsaeuren", name: "Ungesättigte Fettsäuren", shortName: "Unges. FS", unit: "g", group: "makronaehrstoffe", sortOrder: 9 },
  { id: "wasser", name: "Wasser", shortName: "Wasser", unit: "g", group: "makronaehrstoffe", sortOrder: 10 },
  { id: "alkohol", name: "Alkohol", shortName: "Alkohol", unit: "g", group: "makronaehrstoffe", sortOrder: 11 },

  // Vitamine
  { id: "vitamin_a", name: "Vitamin A (RE)", shortName: "Vit. A", unit: "µg", group: "vitamine", sortOrder: 20 },
  { id: "vitamin_b1", name: "Vitamin B1 (Thiamin)", shortName: "Vit. B1", unit: "mg", group: "vitamine", sortOrder: 21 },
  { id: "vitamin_b2", name: "Vitamin B2 (Riboflavin)", shortName: "Vit. B2", unit: "mg", group: "vitamine", sortOrder: 22 },
  { id: "vitamin_b6", name: "Vitamin B6", shortName: "Vit. B6", unit: "mg", group: "vitamine", sortOrder: 23 },
  { id: "vitamin_b12", name: "Vitamin B12", shortName: "Vit. B12", unit: "µg", group: "vitamine", sortOrder: 24 },
  { id: "vitamin_c", name: "Vitamin C", shortName: "Vit. C", unit: "mg", group: "vitamine", sortOrder: 25 },
  { id: "vitamin_d", name: "Vitamin D", shortName: "Vit. D", unit: "µg", group: "vitamine", sortOrder: 26 },
  { id: "vitamin_e", name: "Vitamin E", shortName: "Vit. E", unit: "mg", group: "vitamine", sortOrder: 27 },
  { id: "folsaeure", name: "Folat-Äquivalent", shortName: "Folat", unit: "µg", group: "vitamine", sortOrder: 28 },
  { id: "niacin", name: "Niacin-Äquivalent", shortName: "Niacin", unit: "mg", group: "vitamine", sortOrder: 29 },
  { id: "vitamin_k", name: "Vitamin K", shortName: "Vit. K", unit: "µg", group: "vitamine", sortOrder: 30 },
  { id: "biotin", name: "Biotin", shortName: "Biotin", unit: "µg", group: "vitamine", sortOrder: 31 },
  { id: "pantothensaeure", name: "Pantothensäure", shortName: "Pantoth.", unit: "mg", group: "vitamine", sortOrder: 32 },

  // Mineralstoffe
  { id: "calcium", name: "Calcium", shortName: "Ca", unit: "mg", group: "mineralstoffe", sortOrder: 40 },
  { id: "eisen", name: "Eisen", shortName: "Fe", unit: "mg", group: "mineralstoffe", sortOrder: 41 },
  { id: "magnesium", name: "Magnesium", shortName: "Mg", unit: "mg", group: "mineralstoffe", sortOrder: 42 },
  { id: "kalium", name: "Kalium", shortName: "K", unit: "mg", group: "mineralstoffe", sortOrder: 43 },
  { id: "natrium", name: "Natrium", shortName: "Na", unit: "mg", group: "mineralstoffe", sortOrder: 44 },
  { id: "zink", name: "Zink", shortName: "Zn", unit: "mg", group: "mineralstoffe", sortOrder: 45 },
  { id: "phosphor", name: "Phosphor", shortName: "P", unit: "mg", group: "mineralstoffe", sortOrder: 46 },
  { id: "jod", name: "Jod", shortName: "J", unit: "µg", group: "mineralstoffe", sortOrder: 47 },
  { id: "kupfer", name: "Kupfer", shortName: "Cu", unit: "µg", group: "mineralstoffe", sortOrder: 48 },
  { id: "mangan", name: "Mangan", shortName: "Mn", unit: "µg", group: "mineralstoffe", sortOrder: 49 },
  { id: "fluorid", name: "Fluorid", shortName: "F", unit: "µg", group: "mineralstoffe", sortOrder: 50 },
  { id: "chlorid", name: "Chlorid", shortName: "Cl", unit: "mg", group: "mineralstoffe", sortOrder: 51 },
  { id: "salz", name: "Salz (NaCl)", shortName: "Salz", unit: "g", group: "mineralstoffe", sortOrder: 52 },

  // Sonstige
  { id: "cholesterin", name: "Cholesterin", shortName: "Chol.", unit: "mg", group: "sonstige", sortOrder: 60 },
];
