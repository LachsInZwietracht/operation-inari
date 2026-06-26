import type { Food, FoodBrowserQuery, FoodBrowserResult } from "@/lib/types";
import { normalizeText, scoreMatch } from "@/lib/search";

type SearchMode = Extract<NonNullable<FoodBrowserQuery["mode"]>, "name" | "code">;

interface FoodBrowserSearchOptions {
  signal?: AbortSignal;
  pageSize?: number;
  categoryId?: string | null;
}

const EMPTY_RESULT: FoodBrowserResult = {
  foods: [],
  totalCount: 0,
  page: 1,
  pageSize: 0,
  hasMore: false,
};

const SEARCH_SYNONYM_GROUPS = [
  ["karotte", "karotten", "moehre", "moehren", "mohre", "mohren"],
];

function shouldPrioritizeCodeSearch(query: string) {
  const compact = query.trim().replace(/\s+/g, "");
  return /^[a-z]{1,4}\d/i.test(compact) || /^\d{2,}[a-z]?$/i.test(compact);
}

function buildFoodBrowserUrl(query: string, mode: SearchMode, options: FoodBrowserSearchOptions) {
  const params = new URLSearchParams({
    q: query,
    mode,
    page: "1",
    pageSize: String(options.pageSize ?? 25),
  });

  if (options.categoryId) {
    params.set("categoryId", options.categoryId);
  }

  return `/api/foods/browser?${params.toString()}`;
}

function getQueryVariants(query: string) {
  const normalizedQuery = normalizeText(query);
  const variants = new Set([query]);

  for (const group of SEARCH_SYNONYM_GROUPS) {
    if (group.some((term) => normalizedQuery.includes(term))) {
      for (const term of group) {
        variants.add(term);
      }
    }
  }

  return Array.from(variants);
}

function getFoodSearchScore(food: Food, query: string) {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(food.name);
  const words = normalizedName.split(/[\s,;:()[\]{}-]+/).filter(Boolean);
  const directMatch = scoreMatch(query, food.name);
  let score = directMatch?.score ?? 0;

  for (const variant of getQueryVariants(query)) {
    const match = scoreMatch(variant, food.name);
    score = Math.max(score, match?.score ?? 0);
    if (words.some((word) => word === normalizeText(variant))) score = Math.max(score, 0.98);
  }

  if (normalizedName === normalizedQuery) score += 0.25;
  if (normalizedName.startsWith(`${normalizedQuery} `)) score += 0.2;
  if (words[0] === normalizedQuery) score += 0.15;
  if (/\broh\b/.test(normalizedName)) score += 0.08;
  if (food.sourceId === "bls") score += 0.04;
  if (normalizedName.includes("gemuese-kartoffel") || normalizedName.includes("beikost")) score -= 0.2;
  score -= Math.min(normalizedName.length / 400, 0.18);

  return score;
}

function mergeFoodResults(results: FoodBrowserResult[], query: string) {
  const merged = new Map<string, Food>();
  for (const result of results) {
    for (const food of result.foods) {
      merged.set(food.id, food);
    }
  }
  return Array.from(merged.values()).sort((a, b) => {
    const scoreDiff = getFoodSearchScore(b, query) - getFoodSearchScore(a, query);
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    return a.name.localeCompare(b.name, "de");
  });
}

export async function searchFoodsInBrowser(
  rawQuery: string,
  options: FoodBrowserSearchOptions = {},
): Promise<FoodBrowserResult> {
  const query = rawQuery.trim();
  if (query.length < 2) {
    return EMPTY_RESULT;
  }

  const modes: SearchMode[] = shouldPrioritizeCodeSearch(query)
    ? ["code", "name"]
    : ["name", "code"];

  const queryVariants = getQueryVariants(query);
  const responses = await Promise.allSettled(
    queryVariants.flatMap((queryVariant) =>
      modes.map(async (mode) => {
        const response = await fetch(buildFoodBrowserUrl(queryVariant, mode, options), {
          signal: options.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Lebensmittelsuche fehlgeschlagen");
        }

        return (await response.json()) as FoodBrowserResult;
      }),
    ),
  );

  const successfulResults = responses
    .filter((response): response is PromiseFulfilledResult<FoodBrowserResult> => response.status === "fulfilled")
    .map((response) => response.value);

  if (successfulResults.length === 0) {
    const rejected = responses.find(
      (response): response is PromiseRejectedResult => response.status === "rejected",
    );
    throw rejected?.reason instanceof Error
      ? rejected.reason
      : new Error("Lebensmittelsuche fehlgeschlagen");
  }

  const foods = mergeFoodResults(successfulResults, query);
  const totalCount = Math.max(foods.length, ...successfulResults.map((result) => result.totalCount));

  return {
    foods,
    totalCount,
    page: 1,
    pageSize: options.pageSize ?? 25,
    hasMore: successfulResults.some((result) => result.hasMore),
  };
}
