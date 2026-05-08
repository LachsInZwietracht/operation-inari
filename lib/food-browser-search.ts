import type { Food, FoodBrowserQuery, FoodBrowserResult } from "@/lib/types";

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

function mergeFoodResults(results: FoodBrowserResult[]) {
  const merged = new Map<string, Food>();
  for (const result of results) {
    for (const food of result.foods) {
      merged.set(food.id, food);
    }
  }
  return Array.from(merged.values());
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

  const responses = await Promise.allSettled(
    modes.map(async (mode) => {
      const response = await fetch(buildFoodBrowserUrl(query, mode, options), {
        signal: options.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Lebensmittelsuche fehlgeschlagen");
      }

      return (await response.json()) as FoodBrowserResult;
    }),
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

  const foods = mergeFoodResults(successfulResults);
  const totalCount = Math.max(foods.length, ...successfulResults.map((result) => result.totalCount));

  return {
    foods,
    totalCount,
    page: 1,
    pageSize: options.pageSize ?? 25,
    hasMore: successfulResults.some((result) => result.hasMore),
  };
}
