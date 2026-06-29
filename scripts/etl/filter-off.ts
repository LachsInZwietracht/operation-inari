import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
  nutrition_data_per?: string;
};

const SOURCE_FILE = process.env.OFF_FILTER_SOURCE_FILE || process.env.OFF_SOURCE_FILE;
const OUTPUT_FILE = process.env.OFF_FILTER_OUTPUT_FILE || "data/off-germany-nutrition-sample.jsonl";
const LIMIT = Number(process.env.OFF_FILTER_LIMIT || "1000");
const COUNTRY_TAG = process.env.OFF_COUNTRY_TAG || "en:germany";
const MAX_LINES = Number(process.env.OFF_FILTER_MAX_LINES || "0");
const PROGRESS_EVERY = Number(process.env.OFF_FILTER_PROGRESS_EVERY || "250000");

const NUTRITION_MARKERS = [
  '"energy-kcal_100g"',
  '"energy_kcal_100g"',
  '"energy-kj_100g"',
  '"energy_kj_100g"',
  '"proteins_100g"',
  '"fat_100g"',
  '"carbohydrates_100g"',
];

const REQUIRED_NUTRIENT_KEYS = [
  "energy-kcal_100g",
  "energy_kcal_100g",
  "energy-kj_100g",
  "energy_kj_100g",
];

if (!SOURCE_FILE) {
  console.error("OFF_FILTER_SOURCE_FILE or OFF_SOURCE_FILE is required.");
  process.exit(1);
}

const sourceFile = SOURCE_FILE;

function hasNutritionMarker(line: string) {
  return NUTRITION_MARKERS.some((marker) => line.includes(marker));
}

function hasRequiredNutrients(product: OffProduct) {
  const nutriments = product.nutriments ?? {};
  return REQUIRED_NUTRIENT_KEYS.some((key) => nutriments[key] !== undefined);
}

function matchesCountry(product: OffProduct) {
  if (COUNTRY_TAG === "all") return true;
  return product.countries_tags?.includes(COUNTRY_TAG) ?? false;
}

function hasName(product: OffProduct) {
  return Boolean(product.product_name_de?.trim() || product.product_name?.trim());
}

function hasBarcode(product: OffProduct) {
  const barcode = product.code?.trim();
  if (!barcode || !/^\d{8,14}$/.test(barcode)) return false;
  if (/^(\d)\1+$/.test(barcode)) return false;
  if (/^0{5,}/.test(barcode)) return false;
  if (/^97[89]/.test(barcode)) return false;
  return true;
}

async function main() {
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });

  const input = createReadStream(sourceFile, { encoding: "utf8" });
  const output = createWriteStream(OUTPUT_FILE, { encoding: "utf8" });
  const rl = createInterface({ input, crlfDelay: Infinity });

  let scanned = 0;
  let countryCandidates = 0;
  let parsed = 0;
  let kept = 0;
  let skippedInvalidJson = 0;

  console.log("Filtering Open Food Facts export...");
  console.log(
    `Config: source=${sourceFile}, output=${OUTPUT_FILE}, limit=${LIMIT}, country=${COUNTRY_TAG}, maxLines=${MAX_LINES || "none"}`,
  );

  try {
    for await (const line of rl) {
      scanned += 1;

      if (MAX_LINES > 0 && scanned > MAX_LINES) break;
      if (!line.includes(COUNTRY_TAG) || !hasNutritionMarker(line)) {
        if (PROGRESS_EVERY > 0 && scanned % PROGRESS_EVERY === 0) {
          console.log(`  scanned=${scanned}, parsed=${parsed}, kept=${kept}`);
        }
        continue;
      }

      let product: OffProduct;
      try {
        product = JSON.parse(line) as OffProduct;
        parsed += 1;
      } catch {
        skippedInvalidJson += 1;
        continue;
      }

      if (!matchesCountry(product)) continue;
      countryCandidates += 1;
      if (!hasBarcode(product) || !hasName(product) || !hasRequiredNutrients(product)) continue;

      output.write(`${line}\n`);
      kept += 1;

      if (kept % 100 === 0) {
        console.log(`  kept=${kept}, scanned=${scanned}, parsed=${parsed}`);
      }

      if (kept >= LIMIT) break;
    }
  } finally {
    rl.close();
    input.destroy();
    output.end();
  }

  console.log(
    JSON.stringify(
      {
        outputFile: OUTPUT_FILE,
        scanned,
        parsed,
        countryCandidates,
        kept,
        skippedInvalidJson,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
