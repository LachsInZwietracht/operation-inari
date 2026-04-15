/**
 * BLS 4.0 ETL Script
 *
 * Imports the Bundeslebensmittelschlüssel 4.0 Excel file into Supabase.
 * Reads the .xlsx file, extracts food items and their nutrient values,
 * and inserts them into the `foods` and `food_nutrients` tables.
 *
 * Usage:
 *   npx tsx scripts/etl/import-bls.ts
 *
 * Prerequisites:
 *   - Supabase running locally (`npx supabase start`) or remote project
 *   - Migrations applied (`npx supabase db reset` or `npx supabase migration up`)
 *   - Environment variables set:
 *     SUPABASE_URL (defaults to http://127.0.0.1:54321)
 *     SUPABASE_SERVICE_ROLE_KEY (required — uses service role to bypass RLS)
 *
 * Data source:
 *   data/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as path from "path";
import {
  BLS_FILE,
  FAMS_CODE,
  FAPU_CODE,
  loadBlsWorkbook,
  NUTRIENT_MAP,
  parseNutrientValue,
} from "./bls-shared";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is required.\n" +
      "For local dev, find it with: npx supabase status"
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Batch size for inserts (Supabase has payload limits)
const FOOD_BATCH_SIZE = 200;
const NUTRIENT_BATCH_SIZE = 2000;

// ---------------------------------------------------------------------------
// BLS Code → food_group_id mapping
// First letter of BLS code indicates the main food group
// ---------------------------------------------------------------------------

const BLS_LETTER_TO_FOOD_GROUP: Record<string, string> = {
  B: "fg_B", // Brot
  C: "fg_C", // Cerealien/Getreide
  D: "fg_D", // Kuchen/Gebäck
  E: "fg_E", // Eier
  F: "fg_F", // Fette/Öle
  G: "fg_G", // Gemüse
  H: "fg_H", // Getränke
  K: "fg_K", // Kartoffeln
  M: "fg_M", // Milch
  N: "fg_N", // Nüsse/Samen
  O: "fg_O", // Obst
  R: "fg_R", // Fleisch
  S: "fg_S", // Süßwaren
  T: "fg_T", // Fisch
  W: "fg_W", // Gewürze
};

// Map food groups to UI categories (must match IDs in lib/mock-data/categories.ts)
// Groups without a matching category → null (no category_id set)
const FOOD_GROUP_TO_CATEGORY: Record<string, string | null> = {
  fg_B: "cat_getreide",
  fg_C: "cat_getreide",
  fg_D: "cat_snacks",
  fg_E: "cat_eier",
  fg_F: "cat_oele",
  fg_G: "cat_gemuese",
  fg_G6: "cat_huelsenfruechte",
  fg_H: "cat_getraenke",
  fg_K: "cat_gemuese",
  fg_M: "cat_milch",
  fg_N: "cat_nuesse",
  fg_O: "cat_obst",
  fg_R: "cat_fleisch",
  fg_S: "cat_snacks",
  fg_T: "cat_fisch",
  fg_W: "cat_gewuerze",
};

function deriveFoodGroupFromBlsCode(blsCode: string): {
  foodGroupId: string | null;
  categoryId: string | null;
} {
  if (!blsCode) {
    return { foodGroupId: null, categoryId: null };
  }

  const firstLetter = blsCode.charAt(0).toUpperCase();
  const mainGroupId = BLS_LETTER_TO_FOOD_GROUP[firstLetter] ?? null;
  const subgroupDigit = blsCode.charAt(1);
  const subgroupId = /\d/.test(subgroupDigit)
    ? `fg_${firstLetter}${subgroupDigit}`
    : null;

  const resolvedGroupId = subgroupId ?? mainGroupId;
  const categoryId =
    (resolvedGroupId && FOOD_GROUP_TO_CATEGORY[resolvedGroupId]) ??
    (mainGroupId && FOOD_GROUP_TO_CATEGORY[mainGroupId]) ??
    null;

  return { foodGroupId: resolvedGroupId, categoryId };
}

// ---------------------------------------------------------------------------
// Main ETL
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== BLS 4.0 Import ===\n");

  console.log(`Reading ${path.basename(BLS_FILE)}...`);
  let workbookData;
  try {
    workbookData = loadBlsWorkbook();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }

  const { rows, headers, codeToHeader } = workbookData;
  console.log(`Found ${rows.length} food entries\n`);
  console.log(`Total columns: ${headers.length}`);
  console.log(`Mapped ${codeToHeader.size} nutrient value columns\n`);

  // Verify all our mapped nutrients can be found
  let mappingWarnings = 0;
  for (const mapping of NUTRIENT_MAP) {
    if (!codeToHeader.has(mapping.blsCode)) {
      console.warn(`WARNING: BLS code "${mapping.blsCode}" (→ ${mapping.nutrientId}) not found in Excel headers`);
      mappingWarnings++;
    }
  }
  // Also check FAMS and FAPU for computed unsaturated fats
  if (!codeToHeader.has(FAMS_CODE)) {
    console.warn(`WARNING: BLS code "${FAMS_CODE}" (for unsaturated fats) not found`);
    mappingWarnings++;
  }
  if (!codeToHeader.has(FAPU_CODE)) {
    console.warn(`WARNING: BLS code "${FAPU_CODE}" (for unsaturated fats) not found`);
    mappingWarnings++;
  }

  if (mappingWarnings > 0) {
    console.log(`\n${mappingWarnings} mapping warning(s) — these nutrients will be skipped\n`);
  }

  // 4. Ensure the 'bls' data source exists
  const { error: sourceError } = await supabase
    .from("data_sources")
    .upsert({
      id: "bls",
      name: "BLS (Bundeslebensmittelschlüssel)",
      version: "4.0",
      imported_at: new Date().toISOString(),
      record_count: rows.length,
      nutrient_count: 138,
      license: "Free (MRI)",
      url: "https://www.blsdb.de/",
    });

  if (sourceError) {
    console.error("Failed to upsert data source:", sourceError.message);
    process.exit(1);
  }

  // 5. Ensure all nutrient definitions exist
  // Fetch existing definitions to know which ones we need to add
  const { data: existingNutrients } = await supabase
    .from("nutrient_definitions")
    .select("id");
  const existingIds = new Set((existingNutrients ?? []).map((n) => n.id));

  // Check if any mapped nutrients are missing from the database
  const missingNutrients = NUTRIENT_MAP.filter(
    (m) => !existingIds.has(m.nutrientId)
  );
  if (missingNutrients.length > 0) {
    console.warn(
      `WARNING: ${missingNutrients.length} nutrient definition(s) missing from database:`,
      missingNutrients.map((m) => m.nutrientId).join(", ")
    );
    console.warn("Run seed.sql first or add missing nutrient definitions.\n");
  }

  // 6. Process foods in batches
  console.log("Importing foods...\n");

  // Identify the three identification columns
  const blsCodeHeader = headers.find(
    (h) => h === "BLS Code" || h === "\uFEFFBLS Code" // handle BOM
  );
  const nameDeHeader = headers.find((h) => h === "Lebensmittelbezeichnung");
  const nameEnHeader = headers.find((h) => h === "Food name");

  if (!blsCodeHeader || !nameDeHeader) {
    console.error("Could not find BLS Code or Lebensmittelbezeichnung column");
    console.error("First 5 headers:", headers.slice(0, 5));
    process.exit(1);
  }

  let totalFoods = 0;
  let totalNutrients = 0;
  let skippedFoods = 0;

  // Collect all food records and nutrient records
  const foodRecords: Array<{
    name: string;
    data_source_id: string;
    source_food_id: string;
    source_version: string;
    bls_code: string;
    food_group_id: string | null;
    category_id: string | null;
    is_branded: boolean;
    is_custom: boolean;
  }> = [];

  // Map BLS code → array of nutrient values (to be inserted after foods)
  const nutrientsByBlsCode = new Map<
    string,
    Array<{ nutrient_id: string; amount: number }>
  >();

  for (const row of rows) {
    const blsCode = String(row[blsCodeHeader]).trim();
    const nameDe = String(row[nameDeHeader]).trim();

    if (!blsCode || !nameDe) {
      skippedFoods++;
      continue;
    }

    const { foodGroupId, categoryId } = deriveFoodGroupFromBlsCode(blsCode);

    foodRecords.push({
      name: nameDe,
      data_source_id: "bls",
      source_food_id: blsCode,
      source_version: "4.0",
      bls_code: blsCode,
      food_group_id: foodGroupId,
      category_id: categoryId,
      is_branded: false,
      is_custom: false,
    });

    // Extract nutrient values
    const nutrients: Array<{ nutrient_id: string; amount: number }> = [];

    for (const mapping of NUTRIENT_MAP) {
      const header = codeToHeader.get(mapping.blsCode);
      if (!header) continue;

      let value = parseNutrientValue(row[header]);
      if (value === null) continue;

      // Apply unit conversion if needed (e.g., VITB6: µg → mg)
      if (mapping.conversionFactor) {
        value *= mapping.conversionFactor;
      }

      nutrients.push({
        nutrient_id: mapping.nutrientId,
        amount: value,
      });
    }

    // Compute "ungesättigte Fettsäuren" = FAMS + FAPU
    const famsHeader = codeToHeader.get(FAMS_CODE);
    const fapuHeader = codeToHeader.get(FAPU_CODE);
    if (famsHeader && fapuHeader) {
      const famsVal = parseNutrientValue(row[famsHeader]);
      const fapuVal = parseNutrientValue(row[fapuHeader]);
      if (famsVal !== null || fapuVal !== null) {
        nutrients.push({
          nutrient_id: "ungesaettigte_fettsaeuren",
          amount: (famsVal ?? 0) + (fapuVal ?? 0),
        });
      }
    }

    if (nutrients.length > 0) {
      nutrientsByBlsCode.set(blsCode, nutrients);
    }
  }

  console.log(`Prepared ${foodRecords.length} foods (${skippedFoods} skipped)\n`);

  // 7. Insert foods in batches
  console.log("Inserting foods into database...");

  // Map to track BLS code → UUID after insert
  const blsCodeToUuid = new Map<string, string>();

  for (let i = 0; i < foodRecords.length; i += FOOD_BATCH_SIZE) {
    const batch = foodRecords.slice(i, i + FOOD_BATCH_SIZE);

    const { data: inserted, error } = await supabase
      .from("foods")
      .upsert(batch, { onConflict: "data_source_id,source_food_id" })
      .select("id, source_food_id");

    if (error) {
      console.error(`Food batch ${i / FOOD_BATCH_SIZE + 1} failed:`, error.message);
      // Continue with next batch
      continue;
    }

    for (const food of inserted ?? []) {
      blsCodeToUuid.set(food.source_food_id, food.id);
      totalFoods++;
    }

    process.stdout.write(
      `  Foods: ${totalFoods}/${foodRecords.length}\r`
    );
  }

  console.log(`\nInserted ${totalFoods} foods\n`);

  // 8. Insert nutrients in batches
  console.log("Inserting nutrient values...");

  const allNutrientRows: Array<{
    food_id: string;
    nutrient_id: string;
    amount: number;
    per_amount: number;
  }> = [];

  for (const [blsCode, nutrients] of nutrientsByBlsCode) {
    const foodId = blsCodeToUuid.get(blsCode);
    if (!foodId) continue;

    for (const n of nutrients) {
      // Skip nutrients that don't exist in the database
      if (!existingIds.has(n.nutrient_id)) continue;

      allNutrientRows.push({
        food_id: foodId,
        nutrient_id: n.nutrient_id,
        amount: n.amount,
        per_amount: 100,
      });
    }
  }

  for (let i = 0; i < allNutrientRows.length; i += NUTRIENT_BATCH_SIZE) {
    const batch = allNutrientRows.slice(i, i + NUTRIENT_BATCH_SIZE);

    const { error } = await supabase
      .from("food_nutrients")
      .upsert(batch, { onConflict: "food_id,nutrient_id" });

    if (error) {
      console.error(
        `Nutrient batch ${i / NUTRIENT_BATCH_SIZE + 1} failed:`,
        error.message
      );
      continue;
    }

    totalNutrients += batch.length;
    process.stdout.write(
      `  Nutrients: ${totalNutrients}/${allNutrientRows.length}\r`
    );
  }

  console.log(`\nInserted ${totalNutrients} nutrient values\n`);

  // 9. Insert English food names as synonyms
  if (nameEnHeader) {
    console.log("Inserting English food name synonyms...");

    const synonyms: Array<{
      food_id: string;
      name: string;
      locale: string;
      source: string;
    }> = [];

    for (const row of rows) {
      const blsCode = String(row[blsCodeHeader]).trim();
      const nameEn = String(row[nameEnHeader]).trim();
      const foodId = blsCodeToUuid.get(blsCode);

      if (!foodId || !nameEn) continue;

      synonyms.push({
        food_id: foodId,
        name: nameEn,
        locale: "en-US",
        source: "system",
      });
    }

    let synonymCount = 0;
    for (let i = 0; i < synonyms.length; i += NUTRIENT_BATCH_SIZE) {
      const batch = synonyms.slice(i, i + NUTRIENT_BATCH_SIZE);
      const { error } = await supabase
        .from("food_synonyms")
        .upsert(batch, {
          onConflict: "food_id,name,locale,source",
        });

      if (error) {
        console.error(`Synonym batch failed:`, error.message);
        continue;
      }
      synonymCount += batch.length;
    }

    console.log(`Inserted ${synonymCount} English synonyms\n`);
  }

  // 10. Summary
  console.log("=== Import Complete ===");
  console.log(`  Foods:     ${totalFoods}`);
  console.log(`  Nutrients: ${totalNutrients}`);
  console.log(
    `  Avg nutrients/food: ${totalFoods > 0 ? Math.round(totalNutrients / totalFoods) : 0}`
  );
  console.log(`  Skipped:   ${skippedFoods}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
