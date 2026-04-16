import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { BRANDED_FOODS } from "@/lib/mock-data/branded-foods";
import type { Food, FoodSearchItem, FoodSourceId } from "@/lib/types/food";
import type { NutrientValue } from "@/lib/types/nutrients";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const FALLBACK_CATEGORY_ID = "cat_unbekannt";

interface FoodRow {
  id: string;
  name: string;
  data_source_id: string;
  source_food_id: string;
  source_version: string | null;
  bls_code: string | null;
  food_group_id: string | null;
  category_id: string | null;
  manufacturer: string | null;
  allergens: string[] | null;
  additives: string[] | null;
  tags: string[] | null;
  is_branded: boolean;
  is_custom: boolean;
  is_recipe_derived: boolean;
  co2_per_portion: number | null;
  sustainability_score: number | null;
  prod_score: number | null;
  data_quality_score: number | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

interface FoodRowWithRelations extends FoodRow {
  food_nutrients?: Array<{
    nutrient_id: string;
    amount: number;
    per_amount: number;
  }>;
  food_portions?: Array<{
    label: string;
    amount_grams: number;
  }>;
}

export interface FoodQueryOptions {
  search?: string;
  categoryId?: string;
  dataSourceId?: string;
  limit?: number;
  offset?: number;
  includeNutrients?: boolean;
  /** When set, only these nutrient IDs are fetched (reduces payload size). */
  nutrientIds?: string[];
  includePortions?: boolean;
  supabase?: SupabaseClient;
  /** Set to false to skip expensive COUNT(*) queries. Defaults to true. */
  withCount?: boolean;
}

export interface FoodQueryResult {
  foods: Food[];
  count: number | null;
}

async function fetchFoodsPaginated(
  options: FoodQueryOptions,
  batchSize = 2000
): Promise<Food[]> {
  const { offset, ...rest } = options;
  let currentOffset = offset ?? 0;
  const aggregated: Food[] = [];

  while (true) {
    const { foods: page } = await fetchFoods({
      ...rest,
      limit: batchSize,
      offset: currentOffset,
      withCount: false,
    });
    aggregated.push(...page);

    if (page.length < batchSize) {
      break;
    }
    currentOffset += batchSize;
  }

  return aggregated;
}

export async function fetchFoods(options: FoodQueryOptions = {}): Promise<FoodQueryResult> {
  try {
    const client = await resolveClient(options.supabase);
    const includeNutrients = options.includeNutrients ?? true;
    const includePortions = options.includePortions ?? false;
    const withCount = options.withCount ?? true;

    const selectColumns = [
      "id",
      "name",
      "data_source_id",
      "source_food_id",
      "source_version",
      "bls_code",
      "food_group_id",
      "category_id",
      "manufacturer",
      "allergens",
      "additives",
      "tags",
      "is_branded",
      "is_custom",
      "is_recipe_derived",
      "co2_per_portion",
      "sustainability_score",
      "prod_score",
      "data_quality_score",
      "imported_at",
      "created_at",
      "updated_at",
    ];

    if (includeNutrients) {
      selectColumns.push("food_nutrients(nutrient_id,amount,per_amount)");
    }
    if (includePortions) {
      selectColumns.push("food_portions(label,amount_grams)");
    }

    const selectOptions = withCount ? { count: "exact" as const } : undefined;

    let query = client
      .from("foods")
      .select(selectColumns.join(","), selectOptions)
      .order("name", { ascending: true });

    if (options.search) {
      const escapedSearch = escapeForILike(options.search);
      query = query.ilike("name", `%${escapedSearch}%`);
    }
    if (options.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }
    if (options.dataSourceId) {
      query = query.eq("data_source_id", options.dataSourceId);
    }
    if (includeNutrients && options.nutrientIds?.length) {
      query = query.in(
        "food_nutrients.nutrient_id",
        options.nutrientIds
      );
    }

    if (typeof options.limit === "number") {
      const start = options.offset ?? 0;
      query = query.range(start, start + options.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new Error(`Failed to fetch foods: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as FoodRowWithRelations[];

    return {
      foods: rows.map(mapFoodRow),
      count: count ?? null,
    };
  } catch (error) {
    console.error("fetchFoods error:", error);
    return { foods: [], count: 0 };
  }
}

export interface FetchFoodByIdOptions {
  includeNutrients?: boolean;
  includePortions?: boolean;
  supabase?: SupabaseClient;
}

export async function fetchFoodById(
  id: string,
  options: FetchFoodByIdOptions = {}
): Promise<Food | null> {
  try {
    const client = await resolveClient(options.supabase);
    const includeNutrients = options.includeNutrients ?? true;
    const includePortions = options.includePortions ?? true;

    const selectColumns = [
      "id",
      "name",
      "data_source_id",
      "source_food_id",
      "source_version",
      "bls_code",
      "food_group_id",
      "category_id",
      "manufacturer",
      "allergens",
      "additives",
      "tags",
      "is_branded",
      "is_custom",
      "is_recipe_derived",
      "co2_per_portion",
      "sustainability_score",
      "prod_score",
      "data_quality_score",
      "imported_at",
      "created_at",
      "updated_at",
    ];

    if (includeNutrients) {
      selectColumns.push("food_nutrients(nutrient_id,amount,per_amount)");
    }
    if (includePortions) {
      selectColumns.push("food_portions(label,amount_grams)");
    }

    const { data, error } = await client
      .from("foods")
      .select(selectColumns.join(","))
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch food ${id}: ${error.message}`);
    }

    const row = data as unknown as FoodRowWithRelations | null;
    return row ? mapFoodRow(row) : null;
  } catch (error) {
    console.error(`fetchFoodById(${id}) error:`, error);
    return null;
  }
}

export const fetchBrandedFoods = cache(async () => {
  try {
    const client = await resolveClient();
    const selectColumns = [
      "id",
      "name",
      "data_source_id",
      "source_food_id",
      "source_version",
      "bls_code",
      "food_group_id",
      "category_id",
      "manufacturer",
      "allergens",
      "additives",
      "tags",
      "is_branded",
      "is_custom",
      "is_recipe_derived",
      "co2_per_portion",
      "sustainability_score",
      "prod_score",
      "data_quality_score",
      "imported_at",
      "created_at",
      "updated_at",
      "food_nutrients(nutrient_id,amount,per_amount)",
      "food_portions(label,amount_grams)",
    ];

    const { data, error } = await client
      .from("foods")
      .select(selectColumns.join(","))
      .or("is_branded.eq.true,data_source_id.eq.hersteller")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch branded foods: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as FoodRowWithRelations[];
    if (rows.length === 0) {
      return BRANDED_FOODS;
    }

    return rows.map(mapFoodRow);
  } catch (error) {
    console.error("fetchBrandedFoods error:", error);
    return BRANDED_FOODS;
  }
});

export async function fetchCatalogFoodById(
  id: string,
  options: FetchFoodByIdOptions = {}
): Promise<Food | null> {
  if (!isUuid(id)) {
    const brandedFoods = await fetchBrandedFoods();
    return brandedFoods.find((item) => item.id === id) ?? null;
  }

  const food = await fetchFoodById(id, options);
  if (food) {
    return food;
  }

  const brandedFoods = await fetchBrandedFoods();
  return brandedFoods.find((item) => item.id === id) ?? null;
}

async function resolveClient(provided?: SupabaseClient) {
  if (provided) return provided;
  return await createServerSupabaseClient();
}

function mapFoodRow(row: FoodRowWithRelations): Food {
  const nutrients: NutrientValue[] = (row.food_nutrients ?? []).map((n) => ({
    nutrientId: n.nutrient_id,
    amount: Number(n.amount),
  }));

  const baseAmount = row.food_nutrients?.[0]?.per_amount
    ? Number(row.food_nutrients[0].per_amount)
    : 100;

  const portionSizes = row.food_portions?.map((portion) => ({
    label: portion.label,
    amount: Number(portion.amount_grams),
  }));

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id ?? FALLBACK_CATEGORY_ID,
    source: formatSource(row),
    sourceId: row.data_source_id as FoodSourceId,
    sourceVersion: row.source_version ?? undefined,
    blsCode: row.bls_code ?? undefined,
    foodGroupId: row.food_group_id ?? undefined,
    nutrients,
    baseAmount,
    manufacturer: row.manufacturer ?? undefined,
    allergens: row.allergens ?? undefined,
    additives: row.additives ?? undefined,
    co2PerPortion: row.co2_per_portion ?? undefined,
    sustainabilityScore: row.sustainability_score ?? undefined,
    prodScore: row.prod_score ?? undefined,
    isBranded: row.is_branded,
    isCustom: row.is_custom,
    isRecipeDerived: row.is_recipe_derived,
    portionSizes,
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatSource(row: FoodRow): string {
  const version = row.source_version ?? "";
  switch (row.data_source_id as FoodSourceId) {
    case "bls":
      return version ? `BLS ${version}` : "BLS";
    case "custom":
      return "Eigene Eingabe";
    case "hersteller":
      return "Hersteller";
    default:
      return version
        ? `${row.data_source_id.toUpperCase()} ${version}`
        : row.data_source_id.toUpperCase();
  }
}

function escapeForILike(input: string): string {
  return input.replace(/([%_\\])/g, "\\$1");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Cached helper that fetches the complete foods catalog (including nutrients)
 * so multiple server components/layouts can share the same data without
 * hitting Supabase repeatedly within a single request.
 */
export const fetchAllFoods = cache(async () => {
  try {
    return await fetchFoodsPaginated(
      {
        includeNutrients: true,
        includePortions: true,
      },
      2000
    );
  } catch (error) {
    console.error("fetchAllFoods error:", error);
    return [];
  }
});

/**
 * Nutrients needed by the list/table views: 4 display columns + 11 for
 * PRODIscore fallback calculation.  Fetching only these instead of all ~37
 * cuts the payload from ~46 MB to ~2-3 MB.
 */
const LIST_NUTRIENT_IDS = [
  // Table display
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  // PRODIscore calculation (calculateProdScore in lib/prodi-score.ts)
  "ballaststoffe",
  "gesaettigte_fettsaeuren",
  "ungesaettigte_fettsaeuren",
  "zucker",
  "natrium",
  "vitamin_c",
  "calcium",
  "eisen",
  "magnesium",
];

const MEAL_PLAN_EXTRA_NUTRIENT_IDS = ["vitamin_d", "kalium", "phosphor"];
const MEAL_PLAN_NUTRIENT_IDS = Array.from(
  new Set([...LIST_NUTRIENT_IDS, ...MEAL_PLAN_EXTRA_NUTRIENT_IDS]),
);

const REPORT_NUTRIENT_IDS = Array.from(
  new Set([
    ...LIST_NUTRIENT_IDS,
    "vitamin_a",
    "vitamin_b1",
    "vitamin_b2",
    "vitamin_b6",
    "vitamin_b12",
    "vitamin_d",
    "vitamin_e",
    "folsaeure",
    "niacin",
    "zink",
    "jod",
  ]),
);

const PROTOCOL_NUTRIENT_IDS = NUTRIENT_DEFINITIONS.map((definition) => definition.id);

/**
 * Lightweight variant of fetchAllFoods that only ships the nutrients required
 * for list views (table columns + PRODIscore).  ~97% smaller payload.
 */
export const fetchAllFoodsForList = cache(async () => {
  try {
    return await fetchFoodsPaginated(
      {
        includeNutrients: true,
        nutrientIds: LIST_NUTRIENT_IDS,
        includePortions: false,
      },
      2500
    );
  } catch (error) {
    console.error("fetchAllFoodsForList error:", error);
    return [];
  }
});

export const fetchFoodsForMealPlans = cache(async () => {
  try {
    return await fetchFoodsPaginated(
      {
        includeNutrients: true,
        nutrientIds: MEAL_PLAN_NUTRIENT_IDS,
        includePortions: false,
      },
      2500
    );
  } catch (error) {
    console.error("fetchFoodsForMealPlans error:", error);
    return [];
  }
});

export const fetchFoodsForReports = cache(async () => {
  try {
    return await fetchFoodsPaginated(
      {
        includeNutrients: true,
        nutrientIds: REPORT_NUTRIENT_IDS,
        includePortions: false,
      },
      2500
    );
  } catch (error) {
    console.error("fetchFoodsForReports error:", error);
    return [];
  }
});

export const fetchFoodsForProtocols = cache(async () => {
  try {
    return await fetchFoodsPaginated(
      {
        includeNutrients: true,
        nutrientIds: PROTOCOL_NUTRIENT_IDS,
        includePortions: false,
      },
      2500
    );
  } catch (error) {
    console.error("fetchFoodsForProtocols error:", error);
    return [];
  }
});

export const fetchFoodsForInstitution = cache(async () => {
  try {
    return await fetchFoodsPaginated(
      {
        includeNutrients: false,
        includePortions: false,
      },
      2500
    );
  } catch (error) {
    console.error("fetchFoodsForInstitution error:", error);
    return [];
  }
});

export const fetchFoodSearchIndex = cache(async (): Promise<FoodSearchItem[]> => {
  try {
    const client = await resolveClient();
    const { data, error } = await client
      .from("foods")
      .select("id,name,category_id,data_source_id,is_custom")
      .order("name", { ascending: true })
      .limit(10000);

    if (error) {
      throw new Error(`Failed to load food search index: ${error.message}`);
    }

    type SearchRow = {
      id: string;
      name: string;
      category_id: string | null;
      data_source_id: string;
      is_custom: boolean;
    };

    return ((data ?? []) as SearchRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      categoryId: row.category_id ?? FALLBACK_CATEGORY_ID,
      sourceId: row.data_source_id as FoodSourceId,
      isCustom: row.is_custom,
    }));
  } catch (error) {
    console.error("fetchFoodSearchIndex error:", error);
    return [];
  }
});
