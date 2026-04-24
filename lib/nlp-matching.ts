import { HOUSEHOLD_MEASURES } from "./constants";
import { scoreMatch, type SearchMatch } from "./search/fuzzy-search";
import { type Food } from "./types";

export interface SmartMatchResult {
  foodId: string;
  foodName: string;
  amount: number;
  unit?: string;
  quantity?: number;
  confidence: number;
}

export interface SmartMatchCandidate {
  foodId: string;
  foodName: string;
  amount: number;
  unit?: string;
  quantity?: number;
  confidence: number;
  matchType: SearchMatch["matchType"];
}

export interface SmartMatchResultSet {
  inputFragment: string;
  candidates: SmartMatchCandidate[];
  best: SmartMatchCandidate | null;
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
  grams: ["g", "gramm"],
};

const COMPOUND_SEPARATORS = /\s+mit\s+|\s+und\s+|\s*,\s+|\s+sowie\s+/i;

function splitCompoundInput(text: string): string[] {
  return text
    .split(COMPOUND_SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractQuantityAndUnit(text: string): {
  quantity: number;
  unit: string | undefined;
  foodSearchText: string;
} {
  const normalized = text.toLowerCase().trim();

  let quantity = 1;
  const quantityMatch = normalized.match(/^(\d+([.,]\d+)?)/);
  if (quantityMatch) {
    quantity = parseFloat(quantityMatch[1].replace(",", "."));
  }

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

  return { quantity, unit, foodSearchText };
}

function calculateAmount(
  unit: string | undefined,
  quantity: number,
): number {
  if (unit === "grams") {
    return quantity;
  }
  if (unit) {
    const measure = HOUSEHOLD_MEASURES.find((m) => m.id === unit);
    if (measure) {
      return measure.grams * quantity;
    }
  }
  return 100 * quantity;
}

interface MatchSmartInputMultiOptions {
  maxCandidates?: number;
}

export function matchSmartInputMulti(
  text: string,
  foods: Food[],
  options?: MatchSmartInputMultiOptions,
): SmartMatchResultSet[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxCandidates = options?.maxCandidates ?? 3;
  const fragments = splitCompoundInput(trimmed);

  // First fragment inherits the parsed quantity/unit, subsequent fragments default
  const firstParsed = extractQuantityAndUnit(fragments[0]);

  return fragments.map((fragment, index) => {
    const { quantity, unit, foodSearchText } =
      index === 0
        ? firstParsed
        : (() => {
            const parsed = extractQuantityAndUnit(fragment);
            // If subsequent fragment has no explicit quantity/unit, use defaults
            const hasExplicitQuantity = /^(\d+([.,]\d+)?|ein|eine)\b/i.test(
              fragment.trim(),
            );
            return {
              quantity: hasExplicitQuantity ? parsed.quantity : 1,
              unit: parsed.unit,
              foodSearchText: hasExplicitQuantity
                ? parsed.foodSearchText
                : fragment.toLowerCase().trim(),
            };
          })();

    if (!foodSearchText) {
      return { inputFragment: fragment, candidates: [], best: null };
    }

    // Score every food using the fuzzy search engine
    const scored: { food: Food; match: SearchMatch }[] = [];
    for (const food of foods) {
      const match = scoreMatch(foodSearchText, food.name);
      if (match) {
        scored.push({ food, match });
      }
    }

    // Sort by score descending, take top N
    scored.sort((a, b) => b.match.score - a.match.score);
    const topN = scored.slice(0, maxCandidates);

    const candidates: SmartMatchCandidate[] = topN.map(({ food, match }) => ({
      foodId: food.id,
      foodName: food.name,
      amount: calculateAmount(unit, quantity),
      unit: unit === "grams" ? undefined : unit,
      quantity: unit === "grams" ? undefined : quantity,
      confidence: match.score,
      matchType: match.matchType,
    }));

    return {
      inputFragment: fragment,
      candidates,
      best: candidates[0] ?? null,
    };
  });
}

/**
 * AI-Assisted matching logic (NLP lite) — now powered by fuzzy search engine.
 * Backward-compatible wrapper around matchSmartInputMulti.
 */
export function matchSmartInput(
  text: string,
  foods: Food[],
): SmartMatchResult | null {
  const results = matchSmartInputMulti(text, foods, { maxCandidates: 1 });
  if (results.length === 0) return null;

  const best = results[0].best;
  if (!best) return null;

  return {
    foodId: best.foodId,
    foodName: best.foodName,
    amount: best.amount,
    unit: best.unit,
    quantity: best.quantity,
    confidence: best.confidence,
  };
}
