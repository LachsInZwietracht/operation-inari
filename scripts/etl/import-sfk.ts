/**
 * SFK (Souci-Fachmann-Kraut) ETL Script
 *
 * Imports the SFK food composition data into Supabase.
 * Reads an .xlsx or .csv file, extracts food items and their nutrient values,
 * and inserts them into the `foods` and `food_nutrients` tables.
 *
 * Usage:
 *   npx tsx scripts/etl/import-sfk.ts --file=<path>
 *   npx tsx scripts/etl/import-sfk.ts --file=<path> --dry-run
 *   npx tsx scripts/etl/import-sfk.ts --file=<path> --version=2024
 *
 * Prerequisites:
 *   - Supabase running locally or remote project
 *   - Migrations applied (including SFK nutrient definitions)
 *   - Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Commercial SFK data file
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  loadSfkWorkbook,
  SFK_NUTRIENT_MAP,
  deriveSfkFoodGroup,
  parseNutrientValue,
} from "./sfk-shared";
import { revalidateAllFoods } from "../../lib/data/foods";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

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

const FOOD_BATCH_SIZE = 200;
const NUTRIENT_BATCH_SIZE = 2000;

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------

function parseArgs(): { filePath: string; dryRun: boolean; version: string } {
  const args = process.argv.slice(2);
  let filePath = "";
  let dryRun = false;
  let version = "2024";

  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      filePath = arg.slice(7);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--version=")) {
      version = arg.slice(10);
    }
  }

  if (!filePath) {
    console.error("Error: --file=<path> is required.\n");
    console.error("Usage: npx tsx scripts/etl/import-sfk.ts --file=<path> [--dry-run] [--version=2024]");
    process.exit(1);
  }

  return { filePath, dryRun, version };
}

// ---------------------------------------------------------------------------
// Main ETL
// ---------------------------------------------------------------------------

async function main() {
  const { filePath, dryRun, version } = parseArgs();

  console.log("=== SFK Import ===\n");

  // 1. Load workbook
  console.log(`Reading ${filePath}...`);
  let workbookData;
  try {
    workbookData = loadSfkWorkbook(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }

  const { rows, headers } = workbookData;
  console.log(`Found ${rows.length} food entries`);
  console.log(`Total columns: ${headers.length}\n`);

  // 2. Validate headers — check expected SFK nutrient columns
  let mappingWarnings = 0;
  const availableColumns = new Set(headers);
  for (const mapping of SFK_NUTRIENT_MAP) {
    if (!availableColumns.has(mapping.sfkColumn)) {
      console.warn(`WARNING: SFK column "${mapping.sfkColumn}" (→ ${mapping.nutrientId}) not found in file`);
      mappingWarnings++;
    }
  }

  // Check required identification columns
  const sfkCodeHeader = headers.find(
    (h) => h === "SFK_Code" || h === "\uFEFFSFK_Code"
  );
  const nameHeader = headers.find((h) => h === "Lebensmittelbezeichnung");
  const groupHeader = headers.find((h) => h === "Gruppe");

  if (!sfkCodeHeader || !nameHeader) {
    console.error("Could not find SFK_Code or Lebensmittelbezeichnung column");
    console.error("First 5 headers:", headers.slice(0, 5));
    process.exit(1);
  }

  if (mappingWarnings > 0) {
    console.log(`${mappingWarnings} mapping warning(s) — these nutrients will be skipped\n`);
  }

  if (dryRun) {
    console.log("[DRY RUN] Parsing complete. No database writes will be made.\n");
    console.log(`Would import ${rows.length} foods with up to ${SFK_NUTRIENT_MAP.length} nutrients each.`);

    // Show a sample of the first food
    if (rows.length > 0) {
      const firstRow = rows[0];
      console.log(`\nSample food: ${String(firstRow[nameHeader])}`);
      console.log(`  SFK Code: ${String(firstRow[sfkCodeHeader!])}`);
      if (groupHeader) console.log(`  Group: ${String(firstRow[groupHeader])}`);

      let sampleNutrients = 0;
      for (const mapping of SFK_NUTRIENT_MAP) {
        if (!availableColumns.has(mapping.sfkColumn)) continue;
        const value = parseNutrientValue(firstRow[mapping.sfkColumn]);
        if (value !== null) sampleNutrients++;
      }
      console.log(`  Nutrient values found: ${sampleNutrients}`);
    }
    return;
  }

  // 3. Upsert data source
  const { error: sourceError } = await supabase
    .from("data_sources")
    .upsert({
      id: "sfk",
      name: "Souci-Fachmann-Kraut",
      version,
      imported_at: new Date().toISOString(),
      record_count: rows.length,
      nutrient_count: SFK_NUTRIENT_MAP.length,
      license: "Commercial license required",
      url: "https://www.wissenschaftliche-verlagsgesellschaft.de/",
    });

  if (sourceError) {
    console.error("Failed to upsert data source:", sourceError.message);
    process.exit(1);
  }

  // 4. Check nutrient definitions
  const { data: existingNutrients } = await supabase
    .from("nutrient_definitions")
    .select("id");
  const existingIds = new Set((existingNutrients ?? []).map((n) => n.id));

  const missingNutrients = SFK_NUTRIENT_MAP.filter(
    (m) => !existingIds.has(m.nutrientId)
  );
  if (missingNutrients.length > 0) {
    console.warn(
      `WARNING: ${missingNutrients.length} nutrient definition(s) missing from database:`,
      missingNutrients.map((m) => m.nutrientId).join(", ")
    );
    console.warn("Run the SFK nutrient definitions migration first.\n");
  }

  // 5. Process foods
  console.log("Preparing food records...\n");

  const foodRecords: Array<{
    name: string;
    data_source_id: string;
    source_food_id: string;
    source_version: string;
    food_group_id: string | null;
    category_id: string | null;
    is_branded: boolean;
    is_custom: boolean;
  }> = [];

  const nutrientsBySfkCode = new Map<
    string,
    Array<{ nutrient_id: string; amount: number }>
  >();

  let skippedFoods = 0;

  for (const row of rows) {
    const sfkCode = String(row[sfkCodeHeader] ?? "").trim();
    const name = String(row[nameHeader] ?? "").trim();

    if (!sfkCode || !name) {
      skippedFoods++;
      continue;
    }

    const groupName = groupHeader ? String(row[groupHeader] ?? "").trim() : "";
    const { foodGroupId, categoryId } = deriveSfkFoodGroup(groupName);

    foodRecords.push({
      name,
      data_source_id: "sfk",
      source_food_id: sfkCode,
      source_version: version,
      food_group_id: foodGroupId,
      category_id: categoryId,
      is_branded: false,
      is_custom: false,
    });

    // Extract nutrient values
    const nutrients: Array<{ nutrient_id: string; amount: number }> = [];

    for (const mapping of SFK_NUTRIENT_MAP) {
      if (!availableColumns.has(mapping.sfkColumn)) continue;

      let value = parseNutrientValue(row[mapping.sfkColumn]);
      if (value === null) continue;

      if (mapping.conversionFactor) {
        value *= mapping.conversionFactor;
      }

      nutrients.push({
        nutrient_id: mapping.nutrientId,
        amount: value,
      });
    }

    if (nutrients.length > 0) {
      nutrientsBySfkCode.set(sfkCode, nutrients);
    }
  }

  console.log(`Prepared ${foodRecords.length} foods (${skippedFoods} skipped)\n`);

  // 6. Insert foods in batches
  console.log("Inserting foods into database...");

  const sfkCodeToUuid = new Map<string, string>();
  let totalFoods = 0;

  for (let i = 0; i < foodRecords.length; i += FOOD_BATCH_SIZE) {
    const batch = foodRecords.slice(i, i + FOOD_BATCH_SIZE);

    const { data: inserted, error } = await supabase
      .from("foods")
      .upsert(batch, { onConflict: "data_source_id,source_food_id" })
      .select("id, source_food_id");

    if (error) {
      console.error(`Food batch ${Math.floor(i / FOOD_BATCH_SIZE) + 1} failed:`, error.message);
      continue;
    }

    for (const food of inserted ?? []) {
      sfkCodeToUuid.set(food.source_food_id, food.id);
      totalFoods++;
    }

    process.stdout.write(
      `  Foods: ${totalFoods}/${foodRecords.length}\r`
    );
  }

  console.log(`\nInserted ${totalFoods} foods\n`);

  // 7. Insert nutrients in batches
  console.log("Inserting nutrient values...");

  const allNutrientRows: Array<{
    food_id: string;
    nutrient_id: string;
    amount: number;
    per_amount: number;
  }> = [];

  for (const [sfkCode, nutrients] of nutrientsBySfkCode) {
    const foodId = sfkCodeToUuid.get(sfkCode);
    if (!foodId) continue;

    for (const n of nutrients) {
      if (!existingIds.has(n.nutrient_id)) continue;

      allNutrientRows.push({
        food_id: foodId,
        nutrient_id: n.nutrient_id,
        amount: n.amount,
        per_amount: 100,
      });
    }
  }

  let totalNutrients = 0;

  for (let i = 0; i < allNutrientRows.length; i += NUTRIENT_BATCH_SIZE) {
    const batch = allNutrientRows.slice(i, i + NUTRIENT_BATCH_SIZE);

    const { error } = await supabase
      .from("food_nutrients")
      .upsert(batch, { onConflict: "food_id,nutrient_id" });

    if (error) {
      console.error(
        `Nutrient batch ${Math.floor(i / NUTRIENT_BATCH_SIZE) + 1} failed:`,
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

  // 8. Generate German synonyms for SFK foods
  console.log("Inserting SFK food name synonyms...");

  const synonyms: Array<{
    food_id: string;
    name: string;
    locale: string;
    source: string;
  }> = [];

  // Add common alternative names for SFK foods
  for (const row of rows) {
    const sfkCode = String(row[sfkCodeHeader] ?? "").trim();
    const name = String(row[nameHeader] ?? "").trim();
    const foodId = sfkCodeToUuid.get(sfkCode);
    if (!foodId || !name) continue;

    // Strip parenthetical qualifiers as a synonym
    const parenthesisIdx = name.indexOf("(");
    if (parenthesisIdx > 2) {
      const baseName = name.substring(0, parenthesisIdx).trim();
      if (baseName.length > 2 && baseName !== name) {
        synonyms.push({
          food_id: foodId,
          name: baseName,
          locale: "de-DE",
          source: "sfk_derived",
        });
      }
    }
  }

  if (synonyms.length > 0) {
    let synonymCount = 0;
    for (let i = 0; i < synonyms.length; i += NUTRIENT_BATCH_SIZE) {
      const batch = synonyms.slice(i, i + NUTRIENT_BATCH_SIZE);
      const { error } = await supabase
        .from("food_synonyms")
        .upsert(batch, {
          onConflict: "food_id,name,locale,source",
        });

      if (error) {
        console.error("Synonym batch failed:", error.message);
        continue;
      }
      synonymCount += batch.length;
    }
    console.log(`Inserted ${synonymCount} synonyms\n`);
  } else {
    console.log("No synonyms generated\n");
  }

  // 9. Summary
  console.log("=== Import Complete ===");
  console.log(`  Foods:     ${totalFoods}`);
  console.log(`  Nutrients: ${totalNutrients}`);
  console.log(
    `  Avg nutrients/food: ${totalFoods > 0 ? Math.round(totalNutrients / totalFoods) : 0}`
  );
  console.log(`  Skipped:   ${skippedFoods}`);
  console.log(`  Synonyms:  ${synonyms.length}`);

  // 10. Purge cache
  console.log("\nPurging server cache...");
  try {
    await revalidateAllFoods();
    console.log("Cache purged successfully");
  } catch (error) {
    console.warn(
      "Could not purge cache (expected if running outside Next.js context):",
      error instanceof Error ? error.message : String(error)
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
