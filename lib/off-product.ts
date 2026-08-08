import type { NutrientValue } from "@/lib/types";

/**
 * Open Food Facts product handling, shared by two callers with different
 * stakes:
 *
 *   scripts/etl/import-off.ts   bulk import into the curated catalog
 *   app/api/foods/barcode/…     live lookup for a barcode a client just scanned
 *
 * The parsing and plausibility rules are identical for both — a product whose
 * macros exceed 100 g is wrong no matter who asks. What differs is the bar for
 * acceptance, and that lives in `toLiveOffProduct` below rather than here.
 */

export type NutrimentValue = number | string | undefined;

export type OffProduct = {
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

function toNumber(value: NutrimentValue) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toInteger(value: number | string | undefined) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export function normalizePer100g(
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

export function scoreProduct(nutriments: Record<string, number>) {
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

// Non-Latin scripts that indicate a non-target-market product name
// (Cyrillic, Greek, Hebrew, Arabic, CJK, Kana). Matched against the name only.
const NON_LATIN_NAME = /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿ぀-ヿ一-鿿]/;

/**
 * Flags obviously low-quality product names so they are staged for review but
 * not auto-promoted. Mirrors the one-off catalog cleanup (2026-07) that removed
 * ALL-CAPS, non-Latin, barcode-in-name, over-long dump, and stub names. False
 * positives only land in the review queue, so the rules can be lenient-strict.
 */
export function isJunkName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return true;
  if (trimmed.length >= 55) return true;
  if (/\d{4,}/.test(trimmed)) return true; // embedded barcode/EAN
  if (NON_LATIN_NAME.test(trimmed)) return true;
  // Fully upper-cased names with at least one cased letter ("SPAM", "MIX").
  if (/[a-zA-ZÀ-ÿ]/.test(trimmed) && trimmed === trimmed.toUpperCase()) return true;
  return false;
}

export function selectProductName(product: OffProduct) {
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

export function validateNutrients(product: OffProduct, nutriments: Record<string, number>) {
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

// ============================================================================
// Live lookup
// ============================================================================

/** OFF asks integrators to identify themselves; anonymous traffic gets throttled. */
const OFF_USER_AGENT = "OperationProdi/1.0 (Ernaehrungsberatung; +https://github.com/)";
const OFF_TIMEOUT_MS = 4000;

export interface LiveOffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  /** Per 100 g, in our own nutrient ids — ready for `custom_nutrients`. */
  nutrients: NutrientValue[];
  /** Share of the eight tracked nutrients OFF actually knows (0–100). */
  dataQualityScore: number;
}

/** OFF per-100g keys → our nutrient ids. Mirrors `mapNutrients` in the ETL. */
function toNutrientValues(nutriments: Record<string, number>): NutrientValue[] {
  const mapped: Array<[string, number | undefined]> = [
    ["energie", nutriments.energy_kcal_100g],
    ["energie_kj", nutriments["energy-kj_100g"]],
    ["eiweiss", nutriments.proteins_100g],
    ["fett", nutriments.fat_100g],
    ["kohlenhydrate", nutriments.carbohydrates_100g],
    ["zucker", nutriments.sugars_100g],
    ["ballaststoffe", nutriments.fiber_100g],
    ["gesaettigte_fettsaeuren", nutriments["saturated-fat_100g"]],
    ["natrium", nutriments.sodium_100g === undefined ? undefined : nutriments.sodium_100g * 1000],
    ["salz", nutriments.salt_100g],
  ];

  return mapped
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([nutrientId, amount]) => ({ nutrientId, amount }));
}

/**
 * Turns an OFF payload into something a client may log, or null.
 *
 * The bar is deliberately lower than the catalog's `OFF_MIN_QUALITY_SCORE` of
 * 90: someone holding the product has better evidence it exists than any
 * import heuristic, so this only insists the entry can be *counted* — energy
 * plus the three macros — and that the numbers survive the same plausibility
 * checks the ETL applies. Without that gate a product like the Saudi "nutella"
 * record, which carries no nutriments at all, would enter a diary as 0 kcal
 * and silently corrupt the day's total.
 *
 * `isJunkName` is deliberately NOT applied here. An all-caps or oddly
 * formatted name blocks automatic catalog promotion, where nobody is looking;
 * in a scan the person sees the name and confirms it, so rejecting the product
 * over its spelling would help no one.
 */
export function toLiveOffProduct(product: OffProduct): LiveOffProduct | null {
  const barcode = product.code?.trim();
  const { name } = selectProductName(product);
  if (!barcode || !name) return null;

  const nutriments = normalizePer100g(product.nutriments, product.nutrition_data_per);
  const { validationErrors } = validateNutrients(product, nutriments);
  if (validationErrors.length > 0) return null;

  const hasCountableMacros =
    nutriments.proteins_100g !== undefined &&
    nutriments.fat_100g !== undefined &&
    nutriments.carbohydrates_100g !== undefined;
  if (!hasCountableMacros) return null;

  return {
    barcode,
    name,
    brand: product.brands?.trim() || null,
    quantity: product.quantity?.trim() || null,
    nutrients: toNutrientValues(nutriments),
    dataQualityScore: scoreProduct(nutriments),
  };
}

/**
 * One product by code from the OFF API.
 *
 * Only the by-code endpoint is used. OFF's search endpoint is markedly less
 * reliable — it was returning "Page temporarily unavailable" while this was
 * written, with by-code answering in ~120 ms — so a scan must never depend on
 * it. Any failure resolves to null: an unreachable OFF is the same outcome for
 * the user as an unknown product, and neither should surface as an error.
 */
export async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  const fields = [
    "code",
    "product_name",
    "product_name_de",
    "generic_name",
    "generic_name_de",
    "brands",
    "quantity",
    "lang",
    "nutriments",
    "nutrition_data_per",
  ].join(",");
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    // A missing product still answers 200 with status 0, and an outage answers
    // 200 with an HTML error page — so neither the status code nor a parsed
    // body is on its own proof of a product.
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;

    const body = (await response.json()) as { status?: number; product?: OffProduct };
    if (body.status !== 1 || !body.product) return null;
    return body.product;
  } catch {
    return null;
  }
}
