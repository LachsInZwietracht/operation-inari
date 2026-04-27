import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  categories?: string;
  countries_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
  nutrition_data_per?: string;
};

type NormalizedProduct = {
  barcode: string;
  productName: string;
  brands: string | null;
  categories: string | null;
  countriesTags: string[];
  nutriments: Record<string, number>;
  validationErrors: string[];
  dataQualityErrors: string[];
  dataQualityScore: number;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OFF_SOURCE_URL = process.env.OFF_SOURCE_URL;
const OFF_SOURCE_FILE = process.env.OFF_SOURCE_FILE;
const OFF_PAGE_SIZE = Number(process.env.OFF_PAGE_SIZE || "100");
const OFF_LIMIT = Number(process.env.OFF_LIMIT || "500");

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SAMPLE_PRODUCTS: OffProduct[] = [
  {
    code: "8000300403759",
    product_name: "Barilla Spaghetti No. 5",
    brands: "Barilla",
    nutriments: {
      energy_kcal_100g: 359,
      proteins_100g: 12.8,
      fat_100g: 2.0,
      carbohydrates_100g: 70.9,
      sugars_100g: 3.5,
      fiber_100g: 3.0,
      "saturated-fat_100g": 0.5,
      sodium_100g: 0.005,
    },
  },
  {
    code: "4003310002102",
    product_name: "Alpro Haferdrink Ohne Zucker",
    brands: "Alpro",
    nutriments: {
      energy_kcal_100g: 40,
      proteins_100g: 0.2,
      fat_100g: 1.5,
      carbohydrates_100g: 5.6,
      sugars_100g: 0,
      fiber_100g: 0.8,
      "saturated-fat_100g": 0.1,
      sodium_100g: 0.04,
    },
  },
];

async function loadProducts(): Promise<OffProduct[]> {
  if (OFF_SOURCE_FILE) {
    const raw = await readFile(OFF_SOURCE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { products?: OffProduct[] } | OffProduct[];
    return Array.isArray(parsed) ? parsed : parsed.products ?? [];
  }

  if (OFF_SOURCE_URL) {
    const response = await fetch(OFF_SOURCE_URL);
    if (!response.ok) {
      throw new Error(`OFF fetch failed with ${response.status}`);
    }
    const parsed = (await response.json()) as { products?: OffProduct[] } | OffProduct[];
    return Array.isArray(parsed) ? parsed : parsed.products ?? [];
  }

  const pageSize = Math.max(1, Math.min(OFF_PAGE_SIZE, OFF_LIMIT));
  const totalPages = Math.ceil(OFF_LIMIT / pageSize);
  const allProducts: OffProduct[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const url = new URL("https://world.openfoodfacts.org/api/v2/search");
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("page", String(page));
    url.searchParams.set("countries_tags_contains", "en:germany");
    url.searchParams.set("fields", "code,product_name,product_name_de,brands,categories,countries_tags,nutriments,nutrition_data_per");

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`OFF page ${page} fetch failed with ${response.status}; stopping pagination`);
        break;
      }

      const payload = (await response.json()) as { products?: OffProduct[] };
      const pageProducts = payload.products ?? [];
      allProducts.push(...pageProducts);

      console.log(`  Fetched page ${page}/${totalPages} (${pageProducts.length} products)`);

      if (pageProducts.length < pageSize) break; // No more pages
      if (allProducts.length >= OFF_LIMIT) break;
    } catch (err) {
      console.warn(`OFF page ${page} error: ${err instanceof Error ? err.message : String(err)}; continuing`);
    }
  }

  if (allProducts.length === 0) {
    console.warn("No products fetched from OFF API; using sample fallback");
    return SAMPLE_PRODUCTS;
  }

  return allProducts.slice(0, OFF_LIMIT);
}

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePer100g(
  nutriments: OffProduct["nutriments"],
  nutritionDataPer?: string,
) {
  const normalized: Record<string, number> = {};
  const servingMultiplier =
    nutritionDataPer && nutritionDataPer.toLowerCase() === "serving" ? null : 1;

  for (const [key, rawValue] of Object.entries(nutriments ?? {})) {
    const value = toNumber(rawValue);
    if (value === null) continue;

    if (key.endsWith("_100g")) {
      normalized[key] = value;
      continue;
    }

    if (servingMultiplier !== 1) continue;

    if (
      key === "energy-kcal" ||
      key === "proteins" ||
      key === "fat" ||
      key === "carbohydrates" ||
      key === "sugars" ||
      key === "fiber" ||
      key === "sodium" ||
      key === "saturated-fat"
    ) {
      normalized[`${key}_100g`] = value;
    }
  }

  return normalized;
}

function scoreProduct(nutriments: Record<string, number>) {
  const presentKeys = [
    "energy_kcal_100g",
    "proteins_100g",
    "fat_100g",
    "carbohydrates_100g",
    "sugars_100g",
    "fiber_100g",
    "saturated-fat_100g",
    "sodium_100g",
  ];
  const presentCount = presentKeys.filter((key) => nutriments[key] !== undefined).length;
  return Math.round((presentCount / presentKeys.length) * 100);
}

function normalizeProduct(product: OffProduct): NormalizedProduct | null {
  const barcode = product.code?.trim();
  const productName = product.product_name_de?.trim() || product.product_name?.trim();

  if (!barcode || !productName) {
    return null;
  }

  const nutriments = normalizePer100g(product.nutriments, product.nutrition_data_per);
  const validationErrors: string[] = [];
  const dataQualityErrors: string[] = [];

  if (nutriments.energy_kcal_100g === undefined) {
    validationErrors.push("Missing energy_kcal_100g");
  }

  if (product.nutrition_data_per?.toLowerCase() === "serving") {
    dataQualityErrors.push("Source reports nutriments per serving only");
  }

  const macros = [
    nutriments.proteins_100g,
    nutriments.fat_100g,
    nutriments.carbohydrates_100g,
  ].filter((value): value is number => value !== undefined);
  const macroSum = macros.reduce((sum, value) => sum + value, 0);
  if (macroSum > 100.5) {
    validationErrors.push("Macros exceed 100g");
  } else if (macroSum > 95) {
    dataQualityErrors.push("Macro sum is near 100g; verify serving normalization");
  }

  if (!product.brands?.trim()) {
    dataQualityErrors.push("Missing brand");
  }

  return {
    barcode,
    productName,
    brands: product.brands?.trim() || null,
    categories: product.categories?.trim() || null,
    countriesTags: product.countries_tags ?? [],
    nutriments,
    validationErrors,
    dataQualityErrors,
    dataQualityScore: scoreProduct(nutriments),
  };
}

function mapNutrients(foodId: string, nutriments: Record<string, number>) {
  return [
    { food_id: foodId, nutrient_id: "energie", amount: nutriments.energy_kcal_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "eiweiss", amount: nutriments.proteins_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "fett", amount: nutriments.fat_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "kohlenhydrate", amount: nutriments.carbohydrates_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "zucker", amount: nutriments.sugars_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "ballaststoffe", amount: nutriments.fiber_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "gesaettigte_fettsaeuren", amount: nutriments["saturated-fat_100g"], per_amount: 100 },
    {
      food_id: foodId,
      nutrient_id: "natrium",
      amount: nutriments.sodium_100g !== undefined ? nutriments.sodium_100g * 1000 : undefined,
      per_amount: 100,
    },
  ].filter((row) => row.amount !== undefined);
}

async function stageProducts(products: OffProduct[]) {
  let staged = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const normalized = normalizeProduct(product);
    if (!normalized) continue;

    if ((i + 1) % 50 === 0) {
      console.log(`  Staging progress: ${i + 1}/${products.length}`);
    }

    const { error } = await supabase.from("off_staging").upsert(
      {
        barcode: normalized.barcode,
        product_name: normalized.productName,
        brands: normalized.brands,
        categories: normalized.categories,
        countries_tags: normalized.countriesTags,
        nutriments: normalized.nutriments,
        validated: normalized.validationErrors.length === 0,
        promoted: false,
        validation_errors: normalized.validationErrors.length > 0 ? normalized.validationErrors : null,
        data_quality_errors:
          normalized.dataQualityErrors.length > 0
            ? { issues: normalized.dataQualityErrors, score: normalized.dataQualityScore }
            : { score: normalized.dataQualityScore },
      },
      { onConflict: "barcode" },
    );

    if (error) {
      console.error(`Failed to stage ${normalized.barcode}: ${error.message}`);
      continue;
    }

    staged += 1;
  }

  return staged;
}

async function promoteValidatedProducts() {
  const { data: validatedRows, error } = await supabase
    .from("off_staging")
    .select("*")
    .eq("validated", true)
    .eq("promoted", false);

  if (error) {
    throw new Error(`Failed to fetch validated OFF staging rows: ${error.message}`);
  }

  let promotedCount = 0;

  for (const row of validatedRows ?? []) {
    const nutriments = (row.nutriments ?? {}) as Record<string, number>;
    const scorePayload = row.data_quality_errors as { score?: number } | null;
    const dataQualityScore = scorePayload?.score ?? scoreProduct(nutriments);

    const { data: promotedFood, error: foodError } = await supabase
      .from("foods")
      .upsert(
        {
          data_source_id: "off",
          source_food_id: row.barcode,
          source_version: "LIVE",
          name: row.product_name,
          manufacturer: row.brands,
          category_id: "cat_sonstiges",
          is_branded: true,
          tags: ["off", "validated"],
          data_quality_score: dataQualityScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "data_source_id,source_food_id" },
      )
      .select("id")
      .single();

    if (foodError) {
      console.error(`Failed to promote food ${row.barcode}: ${foodError.message}`);
      continue;
    }

    const nutrientRows = mapNutrients(promotedFood.id, nutriments);
    if (nutrientRows.length > 0) {
      const { error: nutrientError } = await supabase
        .from("food_nutrients")
        .upsert(nutrientRows, { onConflict: "food_id,nutrient_id" });

      if (nutrientError) {
        console.error(`Failed to promote nutrients for ${row.barcode}: ${nutrientError.message}`);
        continue;
      }
    }

    const { error: stagingError } = await supabase
      .from("off_staging")
      .update({ promoted: true })
      .eq("barcode", row.barcode);

    if (stagingError) {
      console.error(`Failed to mark ${row.barcode} as promoted: ${stagingError.message}`);
      continue;
    }

    promotedCount += 1;
  }

  return promotedCount;
}

async function updateSourceMetadata(recordCount: number) {
  const { error } = await supabase.from("data_sources").upsert(
    {
      id: "off",
      name: "Open Food Facts",
      version: "LIVE",
      imported_at: new Date().toISOString(),
      record_count: recordCount,
      license: "ODbL (attribution + share-alike)",
      url: "https://world.openfoodfacts.org/data",
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error(`Failed to update OFF data source metadata: ${error.message}`);
  }
}

async function main() {
  console.log("Starting Open Food Facts import...");
  const products = await loadProducts();
  console.log(`Loaded ${products.length} OFF products`);

  const staged = await stageProducts(products);
  console.log(`Staged ${staged} products`);

  const promoted = await promoteValidatedProducts();
  console.log(`Promoted ${promoted} validated products`);

  await updateSourceMetadata(promoted);
  console.log("Open Food Facts import complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
