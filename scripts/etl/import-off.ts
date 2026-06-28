import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

type NutrimentValue = number | string | undefined;

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  generic_name?: string;
  generic_name_de?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  labels_tags?: string[];
  allergens_tags?: string[];
  additives_tags?: string[];
  quantity?: string;
  lang?: string;
  url?: string;
  image_url?: string;
  image_front_url?: string;
  ingredients_text?: string;
  ingredients_text_de?: string;
  last_modified_t?: number | string;
  last_modified_datetime?: string;
  nutriscore_grade?: string;
  nova_group?: number | string;
  ecoscore_grade?: string;
  nutriments?: Record<string, NutrimentValue>;
  nutrition_data_per?: string;
};

type NormalizedProduct = {
  barcode: string;
  productName: string;
  nameLocale: string | null;
  brands: string | null;
  categories: string | null;
  countriesTags: string[];
  labelsTags: string[];
  allergensTags: string[];
  additivesTags: string[];
  quantity: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  ingredientsText: string | null;
  lastModifiedT: number | null;
  lastModifiedDatetime: string | null;
  nutriscoreGrade: string | null;
  novaGroup: number | null;
  ecoscoreGrade: string | null;
  nutriments: Record<string, number>;
  rawProduct: OffProduct;
  validationErrors: string[];
  dataQualityErrors: string[];
  dataQualityScore: number;
};

type ScanStats = {
  linesRead: number;
  parseErrors: number;
};

type StageReport = {
  scan: ScanStats;
  countrySkipped: number;
  droppedMissingFields: number;
  droppedNoNutrients: number;
  staged: number;
  promotable: number;
  blockedForReview: number;
  upsertErrors: number;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OFF_SOURCE_URL = process.env.OFF_SOURCE_URL;
const OFF_SOURCE_FILE = process.env.OFF_SOURCE_FILE;
const OFF_PAGE_SIZE = Number(process.env.OFF_PAGE_SIZE || "100");
const OFF_LIMIT = Number(process.env.OFF_LIMIT || "500");
const OFF_MIN_QUALITY_SCORE = Number(process.env.OFF_MIN_QUALITY_SCORE || "50");
const OFF_CHANGED_SINCE = Number(process.env.OFF_CHANGED_SINCE || "0");
const OFF_COUNTRY_TAG = process.env.OFF_COUNTRY_TAG || "en:germany";
const OFF_SKIP_EMPTY_NUTRITION = process.env.OFF_SKIP_EMPTY_NUTRITION !== "false";
const OFF_ALLOW_SAMPLE_FALLBACK = process.env.OFF_ALLOW_SAMPLE_FALLBACK === "true";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_SERVICE_ROLE_KEY && !DRY_RUN) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabase = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const SAMPLE_PRODUCTS: OffProduct[] = [
  {
    code: "8000300403759",
    product_name: "Barilla Spaghetti No. 5",
    brands: "Barilla",
    countries_tags: ["en:germany"],
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
    countries_tags: ["en:germany"],
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

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase client is unavailable without SUPABASE_SERVICE_ROLE_KEY");
  }
  return supabase;
}

function isJsonlPath(path: string) {
  return path.endsWith(".jsonl") || path.endsWith(".jsonl.gz") || path.endsWith(".ndjson");
}

function matchesCountryFilter(product: OffProduct) {
  if (OFF_COUNTRY_TAG === "all") return true;
  return product.countries_tags?.includes(OFF_COUNTRY_TAG) ?? false;
}

async function* iterateSourceProducts(scan: ScanStats): AsyncGenerator<OffProduct> {
  if (OFF_SOURCE_FILE) {
    if (isJsonlPath(OFF_SOURCE_FILE)) {
      yield* iterateJsonlFile(OFF_SOURCE_FILE, scan);
      return;
    }

    const raw = await readFile(OFF_SOURCE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { products?: OffProduct[] } | OffProduct[];
    const products = Array.isArray(parsed) ? parsed : parsed.products ?? [];
    for (const product of products) yield product;
    return;
  }

  if (OFF_SOURCE_URL) {
    const response = await fetch(OFF_SOURCE_URL);
    if (!response.ok) {
      throw new Error(`OFF fetch failed with ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("jsonl") || OFF_SOURCE_URL.endsWith(".jsonl")) {
      yield* iterateJsonlResponse(response, scan);
      return;
    }
    const parsed = (await response.json()) as { products?: OffProduct[] } | OffProduct[];
    const products = Array.isArray(parsed) ? parsed : parsed.products ?? [];
    for (const product of products) yield product;
    return;
  }

  yield* fetchGermanProductsFromApi();
}

function parseJsonlLine(trimmed: string, scan: ScanStats): OffProduct | null {
  scan.linesRead += 1;
  try {
    return JSON.parse(trimmed) as OffProduct;
  } catch {
    // A single malformed line must never abort a multi-million-line import.
    scan.parseErrors += 1;
    if (scan.parseErrors <= 5) {
      console.warn(`  Skipping unparseable JSONL line #${scan.linesRead}`);
    }
    return null;
  }
}

async function* iterateJsonlFile(path: string, scan: ScanStats): AsyncGenerator<OffProduct> {
  if (path.endsWith(".gz")) {
    throw new Error("Gzipped OFF JSONL files must be decompressed before import.");
  }

  const input = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({
    input,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const product = parseJsonlLine(trimmed, scan);
      if (product) yield product;
    }
  } finally {
    rl.close();
    input.destroy();
  }
}

async function* iterateJsonlResponse(response: Response, scan: ScanStats): AsyncGenerator<OffProduct> {
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const product = parseJsonlLine(trimmed, scan);
      if (product) yield product;
    }
  }

  if (buffer.trim()) {
    const product = parseJsonlLine(buffer.trim(), scan);
    if (product) yield product;
  }
}

async function* fetchGermanProductsFromApi(): AsyncGenerator<OffProduct> {
  const pageSize = Math.max(1, Math.min(OFF_PAGE_SIZE, OFF_LIMIT));
  const totalPages = Math.ceil(OFF_LIMIT / pageSize);
  let fetchedAny = false;

  for (let page = 1; page <= totalPages; page++) {
    const url = new URL("https://world.openfoodfacts.org/api/v2/search");
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("page", String(page));
    url.searchParams.set("countries_tags_contains", "en:germany");
    url.searchParams.set(
      "fields",
      [
        "code",
        "product_name",
        "product_name_de",
        "generic_name",
        "generic_name_de",
        "brands",
        "categories",
        "categories_tags",
        "countries_tags",
        "labels_tags",
        "allergens_tags",
        "additives_tags",
        "quantity",
        "lang",
        "url",
        "image_url",
        "image_front_url",
        "ingredients_text",
        "ingredients_text_de",
        "last_modified_t",
        "last_modified_datetime",
        "nutriscore_grade",
        "nova_group",
        "ecoscore_grade",
        "nutriments",
        "nutrition_data_per",
      ].join(","),
    );
    if (OFF_CHANGED_SINCE > 0) {
      url.searchParams.set("last_modified_t", String(OFF_CHANGED_SINCE));
    }

    const response = await fetch(url);
    if (!response.ok) {
      if (OFF_ALLOW_SAMPLE_FALLBACK) {
        console.warn(`OFF page ${page} fetch failed with ${response.status}; using sample fallback`);
        break;
      }
      throw new Error(`OFF page ${page} fetch failed with ${response.status}`);
    }

    const payload = (await response.json()) as { products?: OffProduct[] };
    const pageProducts = payload.products ?? [];
    fetchedAny = fetchedAny || pageProducts.length > 0;

    console.log(`  Fetched page ${page}/${totalPages} (${pageProducts.length} products)`);

    for (const product of pageProducts) yield product;

    if (pageProducts.length < pageSize) break;
  }

  if (!fetchedAny && OFF_ALLOW_SAMPLE_FALLBACK) {
    console.warn("No products fetched from OFF API; using sample fallback because OFF_ALLOW_SAMPLE_FALLBACK=true");
    for (const product of SAMPLE_PRODUCTS) yield product;
  }
}

function toNumber(value: NutrimentValue) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toInteger(value: number | string | undefined) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function normalizePer100g(
  nutriments: OffProduct["nutriments"],
  nutritionDataPer?: string,
) {
  const normalized: Record<string, number> = {};
  const hasOnlyServingData =
    nutritionDataPer && nutritionDataPer.toLowerCase() === "serving";

  for (const [key, rawValue] of Object.entries(nutriments ?? {})) {
    const value = toNumber(rawValue);
    if (value === null) continue;

    if (key.endsWith("_100g")) {
      const canonicalKey = canonicalNutrimentKey(key);
      if (canonicalKey) {
        normalized[canonicalKey] = value;
      }
      continue;
    }

    if (hasOnlyServingData) continue;

    if (
      key === "energy-kcal" ||
      key === "energy-kj" ||
      key === "proteins" ||
      key === "fat" ||
      key === "carbohydrates" ||
      key === "sugars" ||
      key === "fiber" ||
      key === "sodium" ||
      key === "salt" ||
      key === "saturated-fat"
    ) {
      normalized[`${key}_100g`] = value;
    }
  }

  if (normalized.energy_kcal_100g === undefined && normalized["energy-kj_100g"] !== undefined) {
    normalized.energy_kcal_100g = Math.round((normalized["energy-kj_100g"] / 4.184) * 10) / 10;
  }

  if (normalized.sodium_100g === undefined && normalized.salt_100g !== undefined) {
    normalized.sodium_100g = normalized.salt_100g / 2.5;
  }

  return normalized;
}

function canonicalNutrimentKey(key: string) {
  const mapping: Record<string, string> = {
    energy_kcal_100g: "energy_kcal_100g",
    "energy-kcal_100g": "energy_kcal_100g",
    energy_kj_100g: "energy-kj_100g",
    "energy-kj_100g": "energy-kj_100g",
    proteins_100g: "proteins_100g",
    protein_100g: "proteins_100g",
    fat_100g: "fat_100g",
    carbohydrates_100g: "carbohydrates_100g",
    sugars_100g: "sugars_100g",
    fiber_100g: "fiber_100g",
    fibre_100g: "fiber_100g",
    sodium_100g: "sodium_100g",
    salt_100g: "salt_100g",
    "saturated-fat_100g": "saturated-fat_100g",
    saturated_fat_100g: "saturated-fat_100g",
  };

  return mapping[key] ?? null;
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

function selectProductName(product: OffProduct) {
  const candidates = [
    { value: product.product_name_de, locale: "de" },
    { value: product.product_name, locale: product.lang ?? null },
    { value: product.generic_name_de, locale: "de" },
    { value: product.generic_name, locale: product.lang ?? null },
  ];
  const selected = candidates.find((candidate) => candidate.value?.trim());
  return {
    name: selected?.value?.trim() ?? null,
    locale: selected?.locale ?? null,
  };
}

function validateNutrients(product: OffProduct, nutriments: Record<string, number>) {
  const validationErrors: string[] = [];
  const dataQualityErrors: string[] = [];

  if (nutriments.energy_kcal_100g === undefined) {
    validationErrors.push("Missing energy_kcal_100g");
  }

  if (product.nutrition_data_per?.toLowerCase() === "serving") {
    validationErrors.push("Source reports nutriments per serving only");
  }

  if (nutriments.energy_kcal_100g !== undefined && nutriments.energy_kcal_100g > 900) {
    validationErrors.push("Energy exceeds plausible per-100g bound");
  }

  const per100gUpperBounds: Array<[string, number]> = [
    ["proteins_100g", 100],
    ["fat_100g", 100],
    ["carbohydrates_100g", 100],
    ["sugars_100g", 100],
    ["fiber_100g", 100],
    ["saturated-fat_100g", 100],
    ["salt_100g", 100],
    ["sodium_100g", 40],
  ];

  for (const [key, value] of Object.entries(nutriments)) {
    if (value < 0) {
      validationErrors.push(`${key} is negative`);
    }
  }

  for (const [key, max] of per100gUpperBounds) {
    const value = nutriments[key];
    if (value !== undefined && value > max) {
      validationErrors.push(`${key} exceeds plausible per-100g bound`);
    }
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

  if (
    nutriments.sugars_100g !== undefined &&
    nutriments.carbohydrates_100g !== undefined &&
    nutriments.sugars_100g > nutriments.carbohydrates_100g + 0.5
  ) {
    validationErrors.push("Sugars exceed carbohydrates");
  }

  if (
    nutriments["saturated-fat_100g"] !== undefined &&
    nutriments.fat_100g !== undefined &&
    nutriments["saturated-fat_100g"] > nutriments.fat_100g + 0.5
  ) {
    validationErrors.push("Saturated fat exceeds total fat");
  }

  if (nutriments.energy_kcal_100g !== undefined && macros.length > 0) {
    const macroEnergy =
      (nutriments.proteins_100g ?? 0) * 4 +
      (nutriments.carbohydrates_100g ?? 0) * 4 +
      (nutriments.fat_100g ?? 0) * 9;
    const delta = Math.abs(nutriments.energy_kcal_100g - macroEnergy);
    if (delta > 150 && delta > nutriments.energy_kcal_100g * 0.6) {
      validationErrors.push("Energy is implausible compared with macronutrients");
    } else if (delta > 80 && delta > nutriments.energy_kcal_100g * 0.35) {
      validationErrors.push("Energy differs noticeably from macronutrient estimate");
    }
  }

  if (!product.brands?.trim()) {
    dataQualityErrors.push("Missing brand");
  }

  return { validationErrors, dataQualityErrors };
}

function isPlausibleBarcode(barcode: string) {
  if (!/^\d{8,14}$/.test(barcode)) return false;
  if (/^(\d)\1+$/.test(barcode)) return false;
  if (/^0{5,}/.test(barcode)) return false;
  if (/^97[89]/.test(barcode)) return false;
  return true;
}

function normalizeProduct(product: OffProduct): NormalizedProduct | null {
  const barcode = product.code?.trim();
  const selectedName = selectProductName(product);

  if (!barcode || !selectedName.name) {
    return null;
  }

  const nutriments = normalizePer100g(product.nutriments, product.nutrition_data_per);
  const { validationErrors, dataQualityErrors } = validateNutrients(product, nutriments);

  // An implausible barcode blocks automatic promotion but should still be
  // visible in the review list with an explicit reason, not silently dropped.
  if (!isPlausibleBarcode(barcode)) {
    validationErrors.push("Implausible barcode");
  }
  const lastModifiedT = toInteger(product.last_modified_t);
  const sourceUrl = product.url?.trim() || `https://world.openfoodfacts.org/product/${barcode}`;
  const dataQualityScore = scoreProduct(nutriments);

  if (dataQualityScore < OFF_MIN_QUALITY_SCORE) {
    dataQualityErrors.push(`Data quality score below promotion threshold (${OFF_MIN_QUALITY_SCORE})`);
  }

  return {
    barcode,
    productName: selectedName.name,
    nameLocale: selectedName.locale,
    brands: product.brands?.trim() || null,
    categories: product.categories?.trim() || null,
    countriesTags: product.countries_tags ?? [],
    labelsTags: product.labels_tags ?? [],
    allergensTags: product.allergens_tags ?? [],
    additivesTags: product.additives_tags ?? [],
    quantity: product.quantity?.trim() || null,
    sourceUrl,
    imageUrl: product.image_front_url?.trim() || product.image_url?.trim() || null,
    ingredientsText: product.ingredients_text_de?.trim() || product.ingredients_text?.trim() || null,
    lastModifiedT,
    lastModifiedDatetime: product.last_modified_datetime ?? null,
    nutriscoreGrade: product.nutriscore_grade?.trim() || null,
    novaGroup: toInteger(product.nova_group),
    ecoscoreGrade: product.ecoscore_grade?.trim() || null,
    nutriments,
    rawProduct: product,
    validationErrors,
    dataQualityErrors,
    dataQualityScore,
  };
}

function mapNutrients(foodId: string, nutriments: Record<string, number>) {
  return [
    { food_id: foodId, nutrient_id: "energie", amount: nutriments.energy_kcal_100g, per_amount: 100 },
    { food_id: foodId, nutrient_id: "energie_kj", amount: nutriments["energy-kj_100g"], per_amount: 100 },
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
    { food_id: foodId, nutrient_id: "salz", amount: nutriments.salt_100g, per_amount: 100 },
  ].filter((row): row is { food_id: string; nutrient_id: string; amount: number; per_amount: number } => row.amount !== undefined);
}

async function stageProducts(): Promise<StageReport> {
  const client = DRY_RUN ? null : requireSupabase();
  const report: StageReport = {
    scan: { linesRead: 0, parseErrors: 0 },
    countrySkipped: 0,
    droppedMissingFields: 0,
    droppedNoNutrients: 0,
    staged: 0,
    promotable: 0,
    blockedForReview: 0,
    upsertErrors: 0,
  };

  for await (const product of iterateSourceProducts(report.scan)) {
    if (report.staged >= OFF_LIMIT) break;

    if (!matchesCountryFilter(product)) {
      report.countrySkipped += 1;
      continue;
    }

    // Staging gate (lenient): a product reaches the review list when it has a
    // barcode, a name, and at least one real per-100g nutrient. Plausibility and
    // per-serving issues are recorded as blocking reasons, not exclusions.
    const normalized = normalizeProduct(product);
    if (!normalized) {
      report.droppedMissingFields += 1;
      continue;
    }

    if (OFF_SKIP_EMPTY_NUTRITION && Object.keys(normalized.nutriments).length === 0) {
      report.droppedNoNutrients += 1;
      continue;
    }

    // Promotion gate (strict): only products that pass every validation check and
    // clear the quality threshold are auto-promoted into the shared foods table.
    const promotable =
      normalized.validationErrors.length === 0 &&
      normalized.dataQualityScore >= OFF_MIN_QUALITY_SCORE;

    if (DRY_RUN) {
      report.staged += 1;
      if (promotable) report.promotable += 1;
      else report.blockedForReview += 1;
      if (report.staged % 100 === 0) {
        console.log(`  Staging progress (dry run): ${report.staged} staged`);
      }
      continue;
    }

    const { error } = await client!.from("off_staging").upsert(
      {
        barcode: normalized.barcode,
        product_name: normalized.productName,
        brands: normalized.brands,
        categories: normalized.categories,
        countries_tags: normalized.countriesTags,
        nutriments: normalized.nutriments,
        validated: promotable,
        promoted: false,
        validation_errors: normalized.validationErrors.length > 0 ? normalized.validationErrors : null,
        data_quality_errors:
          normalized.dataQualityErrors.length > 0
            ? { issues: normalized.dataQualityErrors, score: normalized.dataQualityScore }
            : { score: normalized.dataQualityScore },
        data_quality_score: normalized.dataQualityScore,
        raw_product: normalized.rawProduct,
        source_url: normalized.sourceUrl,
        selected_name_locale: normalized.nameLocale,
        quantity: normalized.quantity,
        image_url: normalized.imageUrl,
        last_modified_t: normalized.lastModifiedT,
        last_modified_datetime: normalized.lastModifiedDatetime,
        nutriscore_grade: normalized.nutriscoreGrade,
        nova_group: normalized.novaGroup,
        ecoscore_grade: normalized.ecoscoreGrade,
        allergens_tags: normalized.allergensTags,
        additives_tags: normalized.additivesTags,
        labels_tags: normalized.labelsTags,
        ingredients_text: normalized.ingredientsText,
      },
      { onConflict: "barcode" },
    );

    if (error) {
      console.error(`Failed to stage ${normalized.barcode}: ${error.message}`);
      report.upsertErrors += 1;
      continue;
    }

    report.staged += 1;
    if (promotable) report.promotable += 1;
    else report.blockedForReview += 1;

    if (report.staged % 100 === 0) {
      console.log(`  Staging progress: ${report.staged} staged (${report.promotable} promotable)`);
    }
  }

  return report;
}

interface OffStagingPromotionRow {
  barcode: string;
  product_name: string;
  brands: string | null;
  last_modified_t: number | null;
  allergens_tags: string[] | null;
  additives_tags: string[] | null;
  labels_tags: string[] | null;
  data_quality_score: number | null;
  nutriments: Record<string, number> | null;
}

// Promote a single staged row into `foods` + `food_nutrients` and flag it.
// Returns true only if the row was fully promoted and marked, so the caller
// can detect a batch that made no progress and stop instead of looping.
async function promoteStagingRow(
  client: ReturnType<typeof requireSupabase>,
  row: OffStagingPromotionRow,
): Promise<boolean> {
  const nutriments = (row.nutriments ?? {}) as Record<string, number>;
  const dataQualityScore = Number(row.data_quality_score ?? scoreProduct(nutriments));

  const { data: promotedFood, error: foodError } = await client
    .from("foods")
    .upsert(
      {
        data_source_id: "off",
        source_food_id: row.barcode,
        source_version: row.last_modified_t ? `OFF ${row.last_modified_t}` : "LIVE",
        name: row.product_name,
        manufacturer: row.brands,
        category_id: "cat_sonstiges",
        is_branded: true,
        allergens: row.allergens_tags ?? null,
        additives: row.additives_tags ?? null,
        tags: [
          "off",
          "validated",
          ...(Array.isArray(row.labels_tags) ? row.labels_tags.slice(0, 12) : []),
        ],
        data_quality_score: dataQualityScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "data_source_id,source_food_id" },
    )
    .select("id")
    .single();

  if (foodError) {
    console.error(`Failed to promote food ${row.barcode}: ${foodError.message}`);
    return false;
  }

  const nutrientRows = mapNutrients(promotedFood.id, nutriments);
  if (nutrientRows.length > 0) {
    const { error: nutrientError } = await client
      .from("food_nutrients")
      .upsert(nutrientRows, { onConflict: "food_id,nutrient_id" });

    if (nutrientError) {
      console.error(`Failed to promote nutrients for ${row.barcode}: ${nutrientError.message}`);
      return false;
    }
  }

  const { error: stagingError } = await client
    .from("off_staging")
    .update({ promoted: true })
    .eq("barcode", row.barcode);

  if (stagingError) {
    console.error(`Failed to mark ${row.barcode} as promoted: ${stagingError.message}`);
    return false;
  }

  return true;
}

async function promoteValidatedProducts() {
  const client = requireSupabase();
  const PROMOTE_BATCH = 1000;
  let promotedCount = 0;

  // Process in batches: each promoted row flips promoted=true, so re-querying
  // for the next unpromoted batch advances on its own. A single unbounded
  // select is capped by PostgREST's max-rows (10k), which previously left every
  // candidate beyond the first 10k staged-but-unpromoted.
  for (;;) {
    const { data, error } = await client
      .from("off_staging")
      .select("*")
      .eq("validated", true)
      .eq("promoted", false)
      .gte("data_quality_score", OFF_MIN_QUALITY_SCORE)
      .limit(PROMOTE_BATCH);

    if (error) {
      throw new Error(`Failed to fetch validated OFF staging rows: ${error.message}`);
    }

    const batch = (data ?? []) as OffStagingPromotionRow[];
    if (batch.length === 0) break;

    let promotedThisBatch = 0;
    for (const row of batch) {
      if (await promoteStagingRow(client, row)) {
        promotedCount += 1;
        promotedThisBatch += 1;
      }
    }

    // Guard against an infinite loop: if a whole batch failed to flip
    // promoted=true (e.g. a persistent upsert error), stop making no progress.
    if (promotedThisBatch === 0) {
      console.error(
        `Promote made no progress on ${batch.length} rows; stopping to avoid a loop.`,
      );
      break;
    }
  }

  return promotedCount;
}

async function updateSourceMetadata(promotedThisRun: number) {
  const client = requireSupabase();
  const { count, error: countError } = await client
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("data_source_id", "off");

  if (countError) {
    console.warn(`Could not count promoted OFF foods: ${countError.message}`);
  }

  const { error } = await client.from("data_sources").upsert(
    {
      id: "off",
      name: "Open Food Facts",
      version: OFF_CHANGED_SINCE > 0 ? `delta since ${OFF_CHANGED_SINCE}` : "LIVE",
      imported_at: new Date().toISOString(),
      record_count: count ?? promotedThisRun,
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
  console.log(
    `Config: limit=${OFF_LIMIT}, pageSize=${OFF_PAGE_SIZE}, minQuality=${OFF_MIN_QUALITY_SCORE}, country=${OFF_COUNTRY_TAG}, skipEmptyNutrition=${OFF_SKIP_EMPTY_NUTRITION}, dryRun=${DRY_RUN}`,
  );

  const report = await stageProducts();
  console.log("OFF scan report:");
  console.log(
    JSON.stringify(
      {
        linesRead: report.scan.linesRead,
        parseErrors: report.scan.parseErrors,
        countrySkipped: report.countrySkipped,
        droppedMissingFields: report.droppedMissingFields,
        droppedNoNutrients: report.droppedNoNutrients,
        staged: report.staged,
        promotable: report.promotable,
        blockedForReview: report.blockedForReview,
        upsertErrors: report.upsertErrors,
        limit: OFF_LIMIT,
        hitLimit: report.staged >= OFF_LIMIT,
      },
      null,
      2,
    ),
  );

  if (report.staged >= OFF_LIMIT) {
    console.warn(
      `Reached OFF_LIMIT (${OFF_LIMIT}). Raise OFF_LIMIT to scan the whole file for the true candidate count.`,
    );
  }

  if (DRY_RUN) {
    console.log("Dry run complete. No rows were written or promoted.");
    return;
  }

  const promoted = await promoteValidatedProducts();
  console.log(`Promoted ${promoted} validated products`);

  await updateSourceMetadata(promoted);

  console.log("Open Food Facts import complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
