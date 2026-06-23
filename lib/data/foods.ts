import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { fetchOrganizationDisabledSourceIds } from "@/lib/data/data-source-activations";
import { getBlockedSourceIds } from "@/lib/data/entitlements";
import { getFoodGroupDescendants } from "@/lib/data/food-groups";
import { BRANDED_FOODS } from "@/lib/mock-data/branded-foods";
import type {
  Food,
  FoodBrowserQuery,
  FoodBrowserResult,
  FoodSearchItem,
  FoodSourceId,
} from "@/lib/types/food";
import type { NutrientValue } from "@/lib/types/nutrients";
import { createClient as createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

const FALLBACK_CATEGORY_ID = "cat_unbekannt";
const FOOD_BASE_COLUMNS = [
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
  "data_quality_score",
  "imported_at",
  "created_at",
  "updated_at",
];
const FOOD_BROWSER_NUTRIENT_IDS = ["energie", "eiweiss", "fett", "kohlenhydrate"];

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

interface SearchFoodsRpcRow {
  food_id: string;
  food_name: string;
  similarity_score: number;
  data_source_id: string;
  bls_code: string | null;
  category_id: string | null;
  food_group_id: string | null;
  is_branded: boolean;
  total_count?: number | null;
}


export async function fetchFoods(options: FoodQueryOptions = {}, isAdmin = false): Promise<FoodQueryResult> {
  try {
    const client = options.supabase || (isAdmin ? await createServiceClient() : await resolveClient());
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

    const { data, error, count } = await withTimeout(
      query,
      10000,
      "Supabase foods request timed out"
    );
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

export async function fetchFoodsByIds(
  ids: string[],
  supabase?: SupabaseClient,
  options: { nutrientIds?: string[]; includePortions?: boolean } = {},
): Promise<Food[]> {
  if (!ids || ids.length === 0) return [];
  try {
    const client = await resolveClient(supabase);
    const uuidIds = ids.filter(isUuid);
    const legacyIds = ids.filter((id) => !isUuid(id));
    const rows: FoodRowWithRelations[] = [];
    const selectColumns = [
      ...FOOD_BASE_COLUMNS,
      "food_nutrients(nutrient_id, amount, per_amount)",
    ];
    if (options.includePortions ?? true) {
      selectColumns.push("food_portions(label, amount_grams)");
    }
    const select = selectColumns.join(",");

    if (uuidIds.length > 0) {
      let query = client
        .from("foods")
        .select(select)
        .in("id", uuidIds);

      if (options.nutrientIds?.length) {
        query = query.in("food_nutrients.nutrient_id", options.nutrientIds);
      }

      const { data, error } = await withTimeout(
        query,
        10000,
        "Supabase foods lookup timed out"
      );

      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as unknown as FoodRowWithRelations[]));
    }

    if (legacyIds.length > 0) {
      let query = client
        .from("foods")
        .select(select)
        .in("source_food_id", legacyIds);

      if (options.nutrientIds?.length) {
        query = query.in("food_nutrients.nutrient_id", options.nutrientIds);
      }

      const { data, error } = await withTimeout(
        query,
        10000,
        "Supabase foods lookup timed out"
      );

      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as unknown as FoodRowWithRelations[]));
    }

    return rows
      .map(mapFoodRow)
      .filter((food, index, self) => self.findIndex((item) => item.id === food.id) === index);
  } catch (error) {
    console.error("fetchFoodsByIds error:", error);
    return [];
  }
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

    const column = isUuid(id) ? "id" : "source_food_id";
    const { data, error } = await withTimeout(
      client
        .from("foods")
        .select(selectColumns.join(","))
        .eq(column, id)
        .single(),
      5000,
      "Supabase food lookup timed out"
    );

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
    const client = await resolveClient(undefined, true);
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
      "data_quality_score",
      "imported_at",
      "created_at",
      "updated_at",
      "food_nutrients(nutrient_id,amount,per_amount)",
      "food_portions(label,amount_grams)",
    ];

    const { data, error } = await withTimeout(
      client
        .from("foods")
        .select(selectColumns.join(","))
        .or("is_branded.eq.true,data_source_id.eq.hersteller")
        .order("name", { ascending: true }),
      5000,
      "Supabase branded foods request timed out"
    );

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
  const food = await fetchFoodById(id, options);
  if (food) {
    return food;
  }

  const brandedFoods = await fetchBrandedFoods();
  return brandedFoods.find((item) => item.id === id) ?? null;
}

async function resolveClient(provided?: SupabaseClient, isAdmin = false) {
  if (provided) return provided;
  if (isAdmin) return await createServiceClient();
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
    legacyId: row.source_food_id,
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
    dataQualityScore: row.data_quality_score ?? undefined,
    isBranded: row.is_branded,
    isCustom: row.is_custom,
    isRecipeDerived: row.is_recipe_derived,
    portionSizes: portionSizes ?? [],
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
    case "off":
      return "Open Food Facts";
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

/* ─── RPC-based food fetching (single query instead of sequential batches) ─── */

interface RpcFoodRow {
  food_id: string;
  food_name: string;
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
  data_quality_score: number | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
  nutrients: Array<{ nutrient_id: string; amount: number; per_amount: number }> | null;
}

function mapRpcFoodRow(row: RpcFoodRow): Food {
  const rawNutrients = Array.isArray(row.nutrients) ? row.nutrients : [];
  const nutrients: NutrientValue[] = rawNutrients.map((n) => ({
    nutrientId: n.nutrient_id,
    amount: Number(n.amount),
  }));

  const baseAmount = rawNutrients[0]?.per_amount
    ? Number(rawNutrients[0].per_amount)
    : 100;

  return {
    id: row.food_id,
    legacyId: row.source_food_id,
    name: row.food_name,
    categoryId: row.category_id ?? FALLBACK_CATEGORY_ID,
    source: formatSourceFromRpc(row),
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
    dataQualityScore: row.data_quality_score ?? undefined,
    isBranded: row.is_branded,
    isCustom: row.is_custom,
    isRecipeDerived: row.is_recipe_derived,
    portionSizes: [],
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatSourceFromRpc(row: RpcFoodRow): string {
  const version = row.source_version ?? "";
  switch (row.data_source_id as FoodSourceId) {
    case "bls":
      return version ? `BLS ${version}` : "BLS";
    case "custom":
      return "Eigene Eingabe";
    case "off":
      return "Open Food Facts";
    case "hersteller":
      return "Hersteller";
    default:
      return version
        ? `${row.data_source_id.toUpperCase()} ${version}`
        : row.data_source_id.toUpperCase();
  }
}

export interface FetchFoodsViaRpcOptions {
  nutrientIds?: string[];
  foodIds?: string[];
  limit?: number;
  offset?: number;
}

export async function fetchFoodsViaRpc(options: FetchFoodsViaRpcOptions = {}): Promise<Food[]> {
  try {
    const client = await createServiceClient();
    const { data, error } = await withTimeout(
      client.rpc("get_foods_with_nutrients", {
        nutrient_filter: options.nutrientIds ?? null,
        food_id_filter: options.foodIds ?? null,
        page_limit: options.limit ?? 10000,
        page_offset: options.offset ?? 0,
      }),
      15000,
      "Supabase RPC get_foods_with_nutrients timed out",
    );

    if (error) {
      throw new Error(`RPC get_foods_with_nutrients failed: ${error.message}`);
    }

    return ((data ?? []) as RpcFoodRow[]).map(mapRpcFoodRow);
  } catch (error) {
    console.error("fetchFoodsViaRpc error, falling back to direct fetch:", error);
    const { foods } = await fetchFoods(
      {
        includeNutrients: true,
        nutrientIds: options.nutrientIds,
        includePortions: false,
        limit: options.limit ?? 10000,
        offset: options.offset ?? 0,
        withCount: false,
      },
      true,
    );
    return foods;
  }
}

function clampPage(value: number | undefined) {
  if (!value || Number.isNaN(value) || value < 1) return 1;
  return Math.floor(value);
}

function clampPageSize(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 50;
  return Math.min(100, Math.max(10, Math.floor(value)));
}

function normalizeNutrientBound(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

function normalizeFoodBrowserQuery(query: FoodBrowserQuery) {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);
  const nutrientId = query.nutrientId?.trim() || null;
  const nutrientSort: "asc" | "desc" | null =
    query.nutrientSort === "asc" || query.nutrientSort === "desc" ? query.nutrientSort : null;
  return {
    q: query.q?.trim() ?? "",
    mode: query.mode ?? "name",
    categoryId: query.categoryId ?? null,
    dataSourceId:
      query.dataSourceId && query.dataSourceId !== "all" ? query.dataSourceId : null,
    groupId: query.groupId ?? null,
    nutrientId,
    nutrientMin: normalizeNutrientBound(query.nutrientMin),
    nutrientMax: normalizeNutrientBound(query.nutrientMax),
    nutrientSort,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

/**
 * Name-mode search via Postgres RPCs with three-tier fallback:
 * 1. search_foods_with_total — trigram + phonetic + ILIKE, with pagination count
 * 2. search_foods — same matching, no total count (estimated from offset + rows)
 * 3. Empty result — if both RPCs are unavailable
 *
 * See docs/database-guide.md "Search RPC Migration Path" for details.
 */
async function fetchFoodsBrowserPageByName(
  query: ReturnType<typeof normalizeFoodBrowserQuery>,
  client: SupabaseClient,
): Promise<FoodBrowserResult> {
  try {
    const params = {
      search_query: query.q,
      source_filter: query.dataSourceId,
      category_filter: query.categoryId,
      group_filter: query.groupId,
      branded_only: query.dataSourceId === "off" ? true : null,
      requesting_user_id: null,
      result_limit: query.pageSize,
      result_offset: query.offset,
    };

    let rows: SearchFoodsRpcRow[] = [];
    let totalCount = 0;

    const { data, error } = await withTimeout(
      client.rpc("search_foods_with_total", params),
      10000,
      "Supabase search_foods_with_total request timed out",
    );

    if (error) {
      const fallback = await withTimeout(
        client.rpc("search_foods", params),
        10000,
        "Supabase search_foods request timed out",
      );

      if (fallback.error) {
        console.error(
          `Food browser name search RPCs failed; falling back to direct query: ${fallback.error.message}`,
        );
        return fetchFoodsBrowserPageByQuery(query, client);
      }

      rows = ((fallback.data ?? []) as SearchFoodsRpcRow[]).map((row) => ({
        ...row,
        total_count: null,
      }));
      totalCount = rows.length + query.offset;
    } else {
      rows = (data ?? []) as SearchFoodsRpcRow[];
      totalCount = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
    }

    if (rows.length === 0) {
      return {
        foods: [],
        totalCount,
        page: query.page,
        pageSize: query.pageSize,
        hasMore: false,
      };
    }

    const foods = await fetchFoodsByIds(
      rows.map((row) => row.food_id),
      client,
      { nutrientIds: FOOD_BROWSER_NUTRIENT_IDS, includePortions: false },
    );
    const byId = new Map(foods.map((food) => [food.id, food]));
    const orderedFoods = rows
      .map((row) => byId.get(row.food_id))
      .filter((food): food is Food => Boolean(food));

    return {
      foods: orderedFoods,
      totalCount,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: query.offset + orderedFoods.length < totalCount,
    };
  } catch (error) {
    console.error("fetchFoodsBrowserPageByName error:", error);
    return {
      foods: [],
      totalCount: 0,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: false,
    };
  }
}

async function fetchFoodsBrowserPageByQuery(
  query: ReturnType<typeof normalizeFoodBrowserQuery>,
  client: SupabaseClient,
): Promise<FoodBrowserResult> {
  try {
    const withExactCount = shouldUseExactFoodBrowserCount(query);
    let builder = client
      .from("foods")
      .select(
        [
          ...FOOD_BASE_COLUMNS,
          "food_nutrients(nutrient_id,amount,per_amount)",
        ].join(","),
        withExactCount ? { count: "exact" } : undefined,
      )
      .order(query.mode === "code" ? "bls_code" : "name", { ascending: true });

    if (query.dataSourceId) {
      builder = builder.eq("data_source_id", query.dataSourceId);
    }
    if (query.categoryId) {
      builder = builder.eq("category_id", query.categoryId);
    }
    if (query.groupId) {
      builder = builder.in("food_group_id", getFoodGroupDescendants(query.groupId));
    }
    if (query.dataSourceId === "off") {
      builder = builder.eq("is_branded", true);
    }
    if (query.mode === "code" && query.q) {
      const escaped = escapeForILike(query.q);
      builder = builder.or(`bls_code.ilike.%${escaped}%,source_food_id.ilike.%${escaped}%`);
    } else if (query.mode !== "browse" && query.q) {
      const escaped = escapeForILike(query.q);
      builder = builder.ilike("name", `%${escaped}%`);
    }

    builder = builder.in("food_nutrients.nutrient_id", FOOD_BROWSER_NUTRIENT_IDS);

    builder = builder.range(query.offset, query.offset + query.pageSize - 1);

    const { data, error, count } = await withTimeout(
      builder,
      10000,
      "Supabase food browser request timed out",
    );

    if (error) {
      console.error(`Food browser query failed: ${error.message}`);
      return {
        foods: [],
        totalCount: 0,
        page: query.page,
        pageSize: query.pageSize,
        hasMore: false,
      };
    }

    const foods = ((data ?? []) as unknown as FoodRowWithRelations[]).map(mapFoodRow);
    const totalCount = count ?? query.offset + foods.length;

    return {
      foods,
      totalCount,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: count == null ? foods.length === query.pageSize : query.offset + foods.length < totalCount,
    };
  } catch (error) {
    console.error("fetchFoodsBrowserPageByQuery error:", error);
    return {
      foods: [],
      totalCount: 0,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: false,
    };
  }
}

function shouldUseExactFoodBrowserCount(query: ReturnType<typeof normalizeFoodBrowserQuery>) {
  return Boolean(
    query.page > 1 ||
      query.q ||
      query.categoryId ||
      query.dataSourceId ||
      query.groupId ||
      query.mode !== "name",
  );
}

interface FilterFoodsByNutrientRpcRow {
  food_id: string;
  nutrient_amount: number | null;
  total_count: number | null;
}

/**
 * Nutrient-mode browsing: sort and/or threshold-filter foods by a single
 * nutrient (PRODI-feedback #4) via the `filter_foods_by_nutrient` RPC. Falls
 * back to the plain query path if the RPC is unavailable so results still load.
 */
async function fetchFoodsBrowserPageByNutrient(
  query: ReturnType<typeof normalizeFoodBrowserQuery>,
  client: SupabaseClient,
): Promise<FoodBrowserResult> {
  if (!query.nutrientId) {
    return fetchFoodsBrowserPageByQuery(query, client);
  }
  try {
    const params = {
      nutrient_key: query.nutrientId,
      min_per_100g: query.nutrientMin,
      max_per_100g: query.nutrientMax,
      sort_direction: query.nutrientSort ?? "desc",
      source_filter: query.dataSourceId,
      category_filter: query.categoryId,
      group_filter: query.groupId ? getFoodGroupDescendants(query.groupId) : null,
      branded_only: query.dataSourceId === "off" ? true : null,
      name_query: query.mode === "code" ? null : query.q || null,
      requesting_user_id: null,
      result_limit: query.pageSize,
      result_offset: query.offset,
    };

    const { data, error } = await withTimeout(
      client.rpc("filter_foods_by_nutrient", params),
      10000,
      "Supabase filter_foods_by_nutrient request timed out",
    );

    if (error) {
      console.error(
        `Food browser nutrient sort RPC failed; falling back to direct query: ${error.message}`,
      );
      return fetchFoodsBrowserPageByQuery(query, client);
    }

    const rows = (data ?? []) as FilterFoodsByNutrientRpcRow[];
    const totalCount = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    if (rows.length === 0) {
      return {
        foods: [],
        totalCount,
        page: query.page,
        pageSize: query.pageSize,
        hasMore: false,
      };
    }

    const foods = await fetchFoodsByIds(
      rows.map((row) => row.food_id),
      client,
      {
        nutrientIds: Array.from(new Set([...FOOD_BROWSER_NUTRIENT_IDS, query.nutrientId])),
        includePortions: false,
      },
    );
    const byId = new Map(foods.map((food) => [food.id, food]));
    const orderedFoods = rows
      .map((row) => byId.get(row.food_id))
      .filter((food): food is Food => Boolean(food));

    return {
      foods: orderedFoods,
      totalCount,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: query.offset + orderedFoods.length < totalCount,
    };
  } catch (error) {
    console.error("fetchFoodsBrowserPageByNutrient error:", error);
    return {
      foods: [],
      totalCount: 0,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: false,
    };
  }
}

export async function fetchFoodsBrowserPage(
  query: FoodBrowserQuery,
  supabase?: SupabaseClient,
): Promise<FoodBrowserResult> {
  const normalized = normalizeFoodBrowserQuery(query);
  const client = await resolveClient(supabase);

  const nutrientModeActive = Boolean(
    normalized.nutrientId &&
      (normalized.nutrientSort ||
        normalized.nutrientMin != null ||
        normalized.nutrientMax != null),
  );

  let result: FoodBrowserResult;
  if (nutrientModeActive) {
    result = await fetchFoodsBrowserPageByNutrient(normalized, client);
  } else if (normalized.mode === "name" && normalized.q) {
    result = await fetchFoodsBrowserPageByName(normalized, client);
  } else {
    result = await fetchFoodsBrowserPageByQuery(normalized, client);
  }

  // Filter out blocked data sources: tariff-gated (e.g., SFK without license)
  // plus any source the organization has switched off in /datenbank.
  const blocked = new Set<FoodSourceId>(getBlockedSourceIds());
  for (const id of await fetchOrganizationDisabledSourceIds()) {
    blocked.add(id);
  }
  if (blocked.size > 0) {
    result = {
      ...result,
      foods: result.foods.filter((f) => !blocked.has(f.sourceId as FoodSourceId)),
    };
  }

  return result;
}

/* ─── Chunked caching (keeps each unstable_cache entry under 2 MB) ─── */

/**
 * Tag constants for revalidation
 */
export const CACHE_TAGS = {
  FOODS: "foods",
  BLS: "bls",
  SEARCH: "search-index",
};

interface ChunkedFetchOptions {
  cacheKeyPrefix: string;
  nutrientIds?: string[];
  chunkSize?: number;
  revalidate?: number;
  tags?: string[];
}

async function fetchFoodsChunked(options: ChunkedFetchOptions): Promise<Food[]> {
  const nutrientCount = options.nutrientIds?.length ?? 265;
  const estimatedBytesPerFood = 400 + nutrientCount * 25;
  const chunkSize =
    options.chunkSize ?? Math.max(100, Math.floor(1_500_000 / estimatedBytesPerFood));
  const revalidate = options.revalidate ?? 3600;
  const tags = options.tags ?? [CACHE_TAGS.FOODS, CACHE_TAGS.BLS];

  const allFoods: Food[] = [];
  let chunkIndex = 0;

  while (true) {
    const idx = chunkIndex;
    const chunkFoods = await unstable_cache(
      async () => {
        try {
          return await fetchFoodsViaRpc({
            nutrientIds: options.nutrientIds,
            limit: chunkSize,
            offset: idx * chunkSize,
          });
        } catch (error) {
          console.error(`${options.cacheKeyPrefix} chunk ${idx} error:`, error);
          // Return [] to avoid crashing the entire page. 
          // Stale-while-revalidate will try again later.
          return [];
        }
      },
      [`${options.cacheKeyPrefix}-chunk-${idx}`],
      { revalidate, tags: [...tags, `${options.cacheKeyPrefix}-chunk-${idx}`] },
    )();

    if (!chunkFoods || chunkFoods.length === 0) break;
    
    allFoods.push(...chunkFoods);
    if (chunkFoods.length < chunkSize) break;
    chunkIndex++;
  }

  return allFoods;
}

/**
 * Purges all food-related caches.
 * Call this after ETL imports or custom food changes.
 */
export async function revalidateAllFoods() {
  revalidateTag(CACHE_TAGS.FOODS, "max");
  revalidateTag(CACHE_TAGS.BLS, "max");
  revalidateTag(CACHE_TAGS.SEARCH, "max");
}

/**
 * Cached helper that fetches the complete foods catalog (including nutrients)
 */
export const fetchAllFoods = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-full" });
});

/**
 * Nutrients needed by the list/table views.
 */
const LIST_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
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

const COMPARISON_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "natrium",
  "kalium",
];

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
 * Lightweight variant of fetchAllFoods for list views.
 */
export const fetchAllFoodsForList = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-list", nutrientIds: LIST_NUTRIENT_IDS });
});

export const fetchFoodsForMealPlans = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-meal-plans", nutrientIds: MEAL_PLAN_NUTRIENT_IDS });
});

export const fetchFoodsForComparison = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-comparison", nutrientIds: COMPARISON_NUTRIENT_IDS });
});

export const fetchFoodsForReports = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-reports", nutrientIds: REPORT_NUTRIENT_IDS });
});

export const fetchFoodsForProtocols = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-protocols", nutrientIds: PROTOCOL_NUTRIENT_IDS });
});

export const fetchFoodsForInstitution = cache(async () => {
  return fetchFoodsChunked({ cacheKeyPrefix: "foods-institution" });
});

export const fetchFoodSearchIndex = cache(async (): Promise<FoodSearchItem[]> => {
  return unstable_cache(
    async () => {
      try {
        const client = await resolveClient(undefined, true);
        const { data, error } = await withTimeout(
          client
            .from("foods")
            .select("id,name,category_id,data_source_id,is_custom")
            .order("name", { ascending: true })
            .limit(10000),
          10000,
          "Supabase food search index request timed out"
        );

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

        const blocked = new Set(getBlockedSourceIds());
        return ((data ?? []) as SearchRow[])
          .filter((row) => !blocked.has(row.data_source_id as FoodSourceId))
          .map((row) => ({
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
    },
    ["food-search-index"],
    { revalidate: 3600, tags: [CACHE_TAGS.FOODS, CACHE_TAGS.BLS, CACHE_TAGS.SEARCH] }
  )();
});
