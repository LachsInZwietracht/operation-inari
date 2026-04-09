import { NutrientDefinition } from "@/lib/types";

export const NUTRIENT_DEFINITIONS: NutrientDefinition[] = [
  // Makronährstoffe
  { id: "energie", name: "Energie", shortName: "Energie", unit: "kcal", group: "makronaehrstoffe", sortOrder: 1 },
  { id: "eiweiss", name: "Eiweiß", shortName: "Eiweiß", unit: "g", group: "makronaehrstoffe", sortOrder: 2 },
  { id: "fett", name: "Fett", shortName: "Fett", unit: "g", group: "makronaehrstoffe", sortOrder: 3 },
  { id: "kohlenhydrate", name: "Kohlenhydrate", shortName: "KH", unit: "g", group: "makronaehrstoffe", sortOrder: 4 },
  { id: "ballaststoffe", name: "Ballaststoffe", shortName: "Ballastst.", unit: "g", group: "makronaehrstoffe", sortOrder: 5 },
  { id: "zucker", name: "Zucker", shortName: "Zucker", unit: "g", group: "makronaehrstoffe", sortOrder: 6 },
  { id: "gesaettigte_fettsaeuren", name: "Gesättigte Fettsäuren", shortName: "Ges. FS", unit: "g", group: "makronaehrstoffe", sortOrder: 7 },
  { id: "ungesaettigte_fettsaeuren", name: "Ungesättigte Fettsäuren", shortName: "Unges. FS", unit: "g", group: "makronaehrstoffe", sortOrder: 8 },
  { id: "wasser", name: "Wasser", shortName: "Wasser", unit: "ml", group: "makronaehrstoffe", sortOrder: 9 },

  // Vitamine
  { id: "vitamin_a", name: "Vitamin A", shortName: "Vit. A", unit: "µg", group: "vitamine", sortOrder: 10 },
  { id: "vitamin_b1", name: "Vitamin B1 (Thiamin)", shortName: "Vit. B1", unit: "mg", group: "vitamine", sortOrder: 11 },
  { id: "vitamin_b2", name: "Vitamin B2 (Riboflavin)", shortName: "Vit. B2", unit: "mg", group: "vitamine", sortOrder: 12 },
  { id: "vitamin_b6", name: "Vitamin B6", shortName: "Vit. B6", unit: "mg", group: "vitamine", sortOrder: 13 },
  { id: "vitamin_b12", name: "Vitamin B12", shortName: "Vit. B12", unit: "µg", group: "vitamine", sortOrder: 14 },
  { id: "vitamin_c", name: "Vitamin C", shortName: "Vit. C", unit: "mg", group: "vitamine", sortOrder: 15 },
  { id: "vitamin_d", name: "Vitamin D", shortName: "Vit. D", unit: "µg", group: "vitamine", sortOrder: 16 },
  { id: "vitamin_e", name: "Vitamin E", shortName: "Vit. E", unit: "mg", group: "vitamine", sortOrder: 17 },
  { id: "folsaeure", name: "Folsäure", shortName: "Folsäure", unit: "µg", group: "vitamine", sortOrder: 18 },
  { id: "niacin", name: "Niacin", shortName: "Niacin", unit: "mg", group: "vitamine", sortOrder: 19 },

  // Mineralstoffe
  { id: "calcium", name: "Calcium", shortName: "Ca", unit: "mg", group: "mineralstoffe", sortOrder: 20 },
  { id: "eisen", name: "Eisen", shortName: "Fe", unit: "mg", group: "mineralstoffe", sortOrder: 21 },
  { id: "magnesium", name: "Magnesium", shortName: "Mg", unit: "mg", group: "mineralstoffe", sortOrder: 22 },
  { id: "kalium", name: "Kalium", shortName: "K", unit: "mg", group: "mineralstoffe", sortOrder: 23 },
  { id: "natrium", name: "Natrium", shortName: "Na", unit: "mg", group: "mineralstoffe", sortOrder: 24 },
  { id: "zink", name: "Zink", shortName: "Zn", unit: "mg", group: "mineralstoffe", sortOrder: 25 },
  { id: "phosphor", name: "Phosphor", shortName: "P", unit: "mg", group: "mineralstoffe", sortOrder: 26 },
  { id: "jod", name: "Jod", shortName: "J", unit: "µg", group: "mineralstoffe", sortOrder: 27 },
];
