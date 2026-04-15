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
      "For local dev, run `npx supabase status` to copy the service role key."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

interface VerificationResult {
  expectedFoods: number;
  expectedNutrients: number;
}

function computeExpectedCounts(
  rows: Record<string, unknown>[],
  headers: string[],
  codeToHeader: Map<string, string>,
  nutrientIds: Set<string>
): VerificationResult {
  const blsCodeHeader = headers.find(
    (h) => h === "BLS Code" || h === "\uFEFFBLS Code"
  );
  const nameDeHeader = headers.find((h) => h === "Lebensmittelbezeichnung");

  if (!blsCodeHeader || !nameDeHeader) {
    throw new Error("Could not find the required BLS columns (BLS Code, Lebensmittelbezeichnung)");
  }

  let expectedFoods = 0;
  let expectedNutrients = 0;
  const famsHeader = codeToHeader.get(FAMS_CODE);
  const fapuHeader = codeToHeader.get(FAPU_CODE);

  for (const row of rows) {
    const blsCode = String(row[blsCodeHeader] ?? "").trim();
    const nameDe = String(row[nameDeHeader] ?? "").trim();
    if (!blsCode || !nameDe) continue;
    expectedFoods++;

    for (const mapping of NUTRIENT_MAP) {
      if (!nutrientIds.has(mapping.nutrientId)) continue;
      const header = codeToHeader.get(mapping.blsCode);
      if (!header) continue;
      const value = parseNutrientValue(row[header]);
      if (value === null) continue;
      expectedNutrients++;
    }

    if (famsHeader && fapuHeader) {
      const famsVal = parseNutrientValue(row[famsHeader]);
      const fapuVal = parseNutrientValue(row[fapuHeader]);
      if (famsVal !== null || fapuVal !== null) {
        expectedNutrients++;
      }
    }
  }

  return { expectedFoods, expectedNutrients };
}

async function fetchExistingNutrientIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("nutrient_definitions")
    .select("id");
  if (error) {
    throw new Error(`Failed to read nutrient definitions: ${error.message}`);
  }
  return new Set((data ?? []).map((row) => row.id));
}

async function fetchFoodCounts() {
  const { count, error } = await supabase
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("data_source_id", "bls");
  if (error) {
    throw new Error(`Failed to count foods: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchNutrientCounts() {
  const { count, error } = await supabase
    .from("food_nutrients")
    .select("food_id, foods!inner(data_source_id)", { count: "exact" })
    .eq("foods.data_source_id", "bls")
    .limit(1);
  if (error) {
    throw new Error(`Failed to count nutrient rows: ${error.message}`);
  }
  return count ?? 0;
}

async function main() {
  console.log("=== Verify BLS Import ===\n");
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
  const nutrientIds = await fetchExistingNutrientIds();
  const { expectedFoods, expectedNutrients } = computeExpectedCounts(
    rows,
    headers,
    codeToHeader,
    nutrientIds
  );

  const [foodCount, nutrientCount] = await Promise.all([
    fetchFoodCounts(),
    fetchNutrientCounts(),
  ]);

  const foodsMatch = foodCount === expectedFoods;
  const nutrientsMatch = nutrientCount === expectedNutrients;

  console.log("\n=== Results ===");
  console.log(
    `${foodsMatch ? "✅" : "⚠️"} Foods: database has ${foodCount.toLocaleString()} rows, expected ${expectedFoods.toLocaleString()}`
  );
  console.log(
    `${nutrientsMatch ? "✅" : "⚠️"} Nutrients: database has ${nutrientCount.toLocaleString()} rows, expected ${expectedNutrients.toLocaleString()}`
  );

  if (!foodsMatch || !nutrientsMatch) {
    console.log("\nMismatch detected. Rerun the importer or inspect the Supabase logs.");
    process.exit(1);
  }

  console.log("\nBLS import looks healthy.\n");
}

main().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
