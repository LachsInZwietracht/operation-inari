/**
 * Food Portion Size ETL
 *
 * Imports curated German portion sizes for BLS foods into food_portions.
 * Matches foods by specific BLS code, BLS prefix, or food group.
 *
 * Usage: npm run etl:portions
 */

import { createClient } from "@supabase/supabase-js";
import { PORTION_TEMPLATES } from "../../lib/reference-data/food-portions";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 2000;

interface BlsFood {
  id: string;
  bls_code: string | null;
  food_group_id: string | null;
}

async function main() {
  console.log("=== Food Portion Size Import ===\n");

  // 1. Fetch all BLS foods
  console.log("Fetching BLS foods...");
  const { data: foods, error } = await supabase
    .from("foods")
    .select("id, source_food_id, food_group_id")
    .eq("data_source_id", "bls");

  if (error) {
    throw new Error(`Failed to fetch BLS foods: ${error.message}`);
  }

  if (!foods || foods.length === 0) {
    console.log("No BLS foods found. Run etl:bls first.");
    process.exit(0);
  }

  const blsFoods: BlsFood[] = foods.map((f) => ({
    id: f.id,
    bls_code: f.source_food_id,
    food_group_id: f.food_group_id,
  }));

  console.log(`Found ${blsFoods.length} BLS foods\n`);

  // 2. Match foods against portion templates
  const portionRows: Array<{
    food_id: string;
    label: string;
    amount_grams: number;
    source: string;
  }> = [];

  for (const food of blsFoods) {
    const matchedPortions = new Map<string, number>();

    for (const template of PORTION_TEMPLATES) {
      let matches = false;

      // Specific BLS code match (highest priority)
      if (template.match.blsCode && food.bls_code === template.match.blsCode) {
        matches = true;
      }
      // BLS prefix match
      else if (
        template.match.blsPrefix &&
        food.bls_code?.startsWith(template.match.blsPrefix)
      ) {
        matches = true;
      }
      // Food group match (lowest priority)
      else if (
        template.match.foodGroupId &&
        food.food_group_id === template.match.foodGroupId
      ) {
        matches = true;
      }

      if (matches) {
        for (const portion of template.portions) {
          // More specific matches override less specific ones
          if (!matchedPortions.has(portion.label)) {
            matchedPortions.set(portion.label, portion.amountGrams);
          }
        }
      }
    }

    for (const [label, amountGrams] of matchedPortions) {
      portionRows.push({
        food_id: food.id,
        label,
        amount_grams: amountGrams,
        source: "system",
      });
    }
  }

  console.log(`Generated ${portionRows.length} portion rows\n`);

  if (portionRows.length === 0) {
    console.log("No portions to insert.");
    return;
  }

  // 3. Delete existing system portions for BLS foods (idempotent)
  console.log("Deleting existing system portions for BLS foods...");
  const foodIds = [...new Set(portionRows.map((r) => r.food_id))];

  // Delete in batches to avoid overly long IN clauses
  for (let i = 0; i < foodIds.length; i += 500) {
    const batch = foodIds.slice(i, i + 500);
    const { error: deleteError } = await supabase
      .from("food_portions")
      .delete()
      .in("food_id", batch)
      .eq("source", "system");

    if (deleteError) {
      console.error(`Delete batch failed: ${deleteError.message}`);
    }
  }

  // 4. Batch insert new portions
  let inserted = 0;
  for (let i = 0; i < portionRows.length; i += BATCH_SIZE) {
    const batch = portionRows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from("food_portions")
      .insert(batch);

    if (insertError) {
      console.error(
        `Insert batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${insertError.message}`
      );
      continue;
    }

    inserted += batch.length;
    process.stdout.write(
      `  Progress: ${inserted}/${portionRows.length}\r`
    );
  }

  console.log(`\nInserted ${inserted} portion sizes`);

  console.log("=== Portion import complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
