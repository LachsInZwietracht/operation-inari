/**
 * SFK Import Verification Script
 *
 * Compares the SFK source file against what was imported into Supabase.
 * Exits with code 1 if counts don't match.
 *
 * Usage:
 *   npx tsx scripts/etl/verify-sfk-import.ts --file=<path>
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  loadSfkWorkbook,
  SFK_NUTRIENT_MAP,
  parseNutrientValue,
} from "./sfk-shared";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is required.\n" +
      "For local dev, run `npx supabase status` to copy the service role key."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function parseArgs(): { filePath: string } {
  const args = process.argv.slice(2);
  let filePath = "";

  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      filePath = arg.slice(7);
    }
  }

  if (!filePath) {
    console.error("Error: --file=<path> is required.\n");
    console.error("Usage: npx tsx scripts/etl/verify-sfk-import.ts --file=<path>");
    process.exit(1);
  }

  return { filePath };
}

interface NutrientDefRow {
  id: string;
  group: string | null;
  sfk_column_name: string | null;
}

async function fetchExistingNutrientDefs(): Promise<NutrientDefRow[]> {
  const { data, error } = await supabase
    .from("nutrient_definitions")
    .select("id, group, sfk_column_name");
  if (error) {
    throw new Error(`Failed to read nutrient definitions: ${error.message}`);
  }
  return (data ?? []) as NutrientDefRow[];
}

/** Verify that SFK nutrient definitions exist and are grouped correctly */
function verifyNutrientDefinitions(defs: NutrientDefRow[]): string[] {
  const warnings: string[] = [];
  const defMap = new Map(defs.map((d) => [d.id, d]));

  // Check that each SFK nutrient mapping has a corresponding definition
  const missingDefs: string[] = [];
  const missingGroups: string[] = [];
  const missingSfkColumns: string[] = [];

  for (const mapping of SFK_NUTRIENT_MAP) {
    const def = defMap.get(mapping.nutrientId);
    if (!def) {
      missingDefs.push(mapping.nutrientId);
      continue;
    }
    if (!def.group) {
      missingGroups.push(mapping.nutrientId);
    }
    // For SFK-specific nutrients, the sfk_column_name should be set
    if (mapping.nutrientId.startsWith("sfk_") && !def.sfk_column_name) {
      missingSfkColumns.push(mapping.nutrientId);
    }
  }

  if (missingDefs.length > 0) {
    warnings.push(
      `Missing nutrient definitions for SFK mappings: ${missingDefs.join(", ")}`
    );
  }
  if (missingGroups.length > 0) {
    warnings.push(
      `Nutrient definitions without group assignment: ${missingGroups.join(", ")}`
    );
  }
  if (missingSfkColumns.length > 0) {
    warnings.push(
      `SFK nutrients without sfk_column_name: ${missingSfkColumns.join(", ")}`
    );
  }

  return warnings;
}

function computeExpectedCounts(
  rows: Record<string, unknown>[],
  headers: string[],
  nutrientIds: Set<string>
): { expectedFoods: number; expectedNutrients: number } {
  const sfkCodeHeader = headers.find(
    (h) => h === "SFK_Code" || h === "\uFEFFSFK_Code"
  );
  const nameHeader = headers.find((h) => h === "Lebensmittelbezeichnung");

  if (!sfkCodeHeader || !nameHeader) {
    throw new Error("Could not find required SFK columns (SFK_Code, Lebensmittelbezeichnung)");
  }

  const availableColumns = new Set(headers);
  let expectedFoods = 0;
  let expectedNutrients = 0;

  for (const row of rows) {
    const sfkCode = String(row[sfkCodeHeader] ?? "").trim();
    const name = String(row[nameHeader] ?? "").trim();
    if (!sfkCode || !name) continue;
    expectedFoods++;

    for (const mapping of SFK_NUTRIENT_MAP) {
      if (!nutrientIds.has(mapping.nutrientId)) continue;
      if (!availableColumns.has(mapping.sfkColumn)) continue;
      const value = parseNutrientValue(row[mapping.sfkColumn]);
      if (value === null) continue;
      expectedNutrients++;
    }
  }

  return { expectedFoods, expectedNutrients };
}

async function fetchFoodCount(): Promise<number> {
  const { count, error } = await supabase
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("data_source_id", "sfk");
  if (error) {
    throw new Error(`Failed to count SFK foods: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchNutrientCount(): Promise<number> {
  const { count, error } = await supabase
    .from("food_nutrients")
    .select("food_id, foods!inner(data_source_id)", { count: "exact" })
    .eq("foods.data_source_id", "sfk")
    .limit(1);
  if (error) {
    throw new Error(`Failed to count SFK nutrient rows: ${error.message}`);
  }
  return count ?? 0;
}

async function main() {
  const { filePath } = parseArgs();

  console.log("=== Verify SFK Import ===\n");
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
  const nutrientDefs = await fetchExistingNutrientDefs();
  const nutrientIds = new Set(nutrientDefs.map((d) => d.id));

  // --- Nutrient definition checks ---
  console.log("\n=== Nutrient Definition Checks ===");
  const defWarnings = verifyNutrientDefinitions(nutrientDefs);
  if (defWarnings.length === 0) {
    console.log("All SFK nutrient mappings have valid definitions with groups.");
  } else {
    for (const w of defWarnings) {
      console.log(`  Warning: ${w}`);
    }
  }

  // --- Source file column coverage ---
  console.log("\n=== Column Coverage ===");
  const availableColumns = new Set(headers);
  const mappedColumns = SFK_NUTRIENT_MAP.filter((m) => availableColumns.has(m.sfkColumn));
  const unmappedColumns = SFK_NUTRIENT_MAP.filter((m) => !availableColumns.has(m.sfkColumn));
  console.log(
    `Mapped: ${mappedColumns.length}/${SFK_NUTRIENT_MAP.length} SFK nutrient columns found in source file`
  );
  if (unmappedColumns.length > 0) {
    console.log(
      `  Missing columns: ${unmappedColumns.map((m) => m.sfkColumn).join(", ")}`
    );
  }

  // --- Row / nutrient count verification ---
  const { expectedFoods, expectedNutrients } = computeExpectedCounts(
    rows,
    headers,
    nutrientIds
  );

  const [foodCount, nutrientCount] = await Promise.all([
    fetchFoodCount(),
    fetchNutrientCount(),
  ]);

  const foodsMatch = foodCount === expectedFoods;
  const nutrientsMatch = nutrientCount === expectedNutrients;

  console.log("\n=== Row Count Results ===");
  console.log(
    `${foodsMatch ? "OK" : "WARN"} Foods: database has ${foodCount.toLocaleString()} rows, expected ${expectedFoods.toLocaleString()}`
  );
  console.log(
    `${nutrientsMatch ? "OK" : "WARN"} Nutrients: database has ${nutrientCount.toLocaleString()} rows, expected ${expectedNutrients.toLocaleString()}`
  );

  // --- data_sources metadata check ---
  console.log("\n=== Source Metadata ===");
  const { data: sourceMeta, error: sourceError } = await supabase
    .from("data_sources")
    .select("id, version, record_count, nutrient_count")
    .eq("id", "sfk")
    .maybeSingle();
  if (sourceError) {
    console.log(`  Warning: Could not read data_sources: ${sourceError.message}`);
  } else if (!sourceMeta) {
    console.log("  Warning: No 'sfk' entry in data_sources. Run the import with --update-source.");
  } else {
    console.log(`  Source version: ${sourceMeta.version ?? "not set"}`);
    const recordCountMatch = sourceMeta.record_count === foodCount;
    console.log(
      `  ${recordCountMatch ? "OK" : "WARN"} record_count: ${sourceMeta.record_count ?? "null"} (database: ${foodCount})`
    );
    const nutrientCountMatch = sourceMeta.nutrient_count === nutrientCount;
    console.log(
      `  ${nutrientCountMatch ? "OK" : "WARN"} nutrient_count: ${sourceMeta.nutrient_count ?? "null"} (database: ${nutrientCount})`
    );
  }

  // --- Final verdict ---
  const hasErrors = !foodsMatch || !nutrientsMatch;
  const hasWarnings = defWarnings.length > 0 || unmappedColumns.length > 0;

  if (hasErrors) {
    console.log("\nRow count mismatch detected. Rerun the importer or inspect the Supabase logs.");
    process.exit(1);
  }

  if (hasWarnings) {
    console.log("\nSFK import counts match, but there are warnings above to review.\n");
  } else {
    console.log("\nSFK import looks healthy.\n");
  }
}

main().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
