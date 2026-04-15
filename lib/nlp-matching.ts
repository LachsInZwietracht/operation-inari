import { HOUSEHOLD_MEASURES } from "./constants";
import { type Food } from "./types";

export interface SmartMatchResult {
  foodId: string;
  foodName: string;
  amount: number;
  unit?: string;
  quantity?: number;
  confidence: number;
}

const UNIT_KEYWORDS: Record<string, string[]> = {
  teaspoon: ["tl", "teelöffel"],
  tablespoon: ["el", "esslöffel"],
  cup: ["tasse", "tassen", "cup", "cups"],
  glass: ["glas", "gläser"],
  slice: ["scheibe", "scheiben"],
  handful: ["handvoll"],
  piece: ["stück", "stk"],
  scoop: ["kelle", "schöpfkelle"],
  grams: ["g", "gramm"]
};

/**
 * AI-Assisted matching logic (NLP lite)
 * In a real-world scenario, this would call an LLM or a specialized NLP service.
 * For this MVP, we use a robust heuristic-based keyword matcher.
 */
export function matchSmartInput(text: string, foods: Food[]): SmartMatchResult | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  // 1. Extract Quantity (e.g. "1.5", "2", "ein")
  let quantity = 1;
  const quantityMatch = normalized.match(/^(\d+([.,]\d+)?)/);
  if (quantityMatch) {
    quantity = parseFloat(quantityMatch[1].replace(",", "."));
  } else if (normalized.startsWith("ein ")) {
    quantity = 1;
  } else if (normalized.startsWith("eine ")) {
    quantity = 1;
  }

  // 2. Extract Unit
  let unit: string | undefined = undefined;
  let foodSearchText = normalized.replace(/^(\d+([.,]\d+)?|ein|eine)\s*/, "");

  for (const [unitId, keywords] of Object.entries(UNIT_KEYWORDS)) {
    for (const kw of keywords) {
      if (foodSearchText.startsWith(kw + " ")) {
        unit = unitId;
        foodSearchText = foodSearchText.substring(kw.length).trim();
        break;
      }
    }
    if (unit) break;
  }

  // 3. Find Food
  // Search strategy:
  // a) Exact match
  // b) Starts with
  // c) Includes
  // d) Keyword score
  
  let bestMatch: Food | null = null;
  let maxScore = 0;

  for (const food of foods) {
    const foodName = food.name.toLowerCase();
    let score = 0;

    if (foodName === foodSearchText) {
      score = 100;
    } else if (foodName.startsWith(foodSearchText)) {
      score = 80;
    } else if (foodName.includes(foodSearchText)) {
      score = 50;
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = food;
    }
  }

  if (!bestMatch || maxScore < 30) return null;

  // 4. Calculate Amount
  let amount = 100; // Default fallback
  if (unit === "grams") {
    amount = quantity;
  } else if (unit) {
    const measure = HOUSEHOLD_MEASURES.find(m => m.id === unit);
    if (measure) {
      amount = measure.grams * quantity;
    }
  } else {
    // If no unit, assume "piece" if quantity is small, otherwise grams?
    // Better: default to "piece" equivalent (100g)
    amount = 100 * quantity;
  }

  return {
    foodId: bestMatch.id,
    foodName: bestMatch.name,
    amount,
    unit: unit === "grams" ? undefined : unit,
    quantity: unit === "grams" ? undefined : quantity,
    confidence: maxScore / 100
  };
}
