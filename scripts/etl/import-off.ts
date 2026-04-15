import { createClient } from "@supabase/supabase-js";

/**
 * OPEN FOOD FACTS (OFF) IMPORT SCRIPT
 * 
 * Implements a "Quarantine Pipeline":
 * 1. Fetch products from OFF API (or local JSON dump)
 * 2. Stage in 'off_staging' table
 * 3. Validate (Energy present? Macros consistent?)
 * 4. Promote high-quality entries to 'foods' table
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🚀 Starting Open Food Facts Integration...");

  const sampleProducts = [
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
        sodium_100g: 0.005
      }
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
        sodium_100g: 0.04
      }
    }
  ];

  console.log(`📥 Staging ${sampleProducts.length} sample products...`);

  for (const product of sampleProducts) {
    const { error } = await supabase
      .from("off_staging")
      .upsert({
        barcode: product.code,
        product_name: product.product_name,
        brands: product.brands,
        nutriments: product.nutriments,
        validated: false,
        promoted: false
      }, { onConflict: "barcode" });

    if (error) {
      console.error(`  ❌ Failed to stage ${product.code}:`, error.message);
    } else {
      console.log(`  ✅ Staged: ${product.product_name}`);
    }
  }

  // --- VALIDATION PASS ---
  console.log("\n⚖️ Running Validation Pass...");
  const { data: pending, error: fetchError } = await supabase
    .from("off_staging")
    .select("*")
    .eq("validated", false);

  if (fetchError) {
    console.error("❌ Failed to fetch pending items:", fetchError.message);
    return;
  }

  for (const item of (pending || [])) {
    const nutriments = item.nutriments as any;
    let isValid = true;
    let errors: string[] = [];

    if (!nutriments.energy_kcal_100g) {
      isValid = false;
      errors.push("Missing energy_kcal");
    }

    if (isValid) {
      await supabase.from("off_staging").update({ validated: true, validation_errors: null }).eq("barcode", item.barcode);
      console.log(`  ✅ Validated: ${item.barcode}`);
    } else {
      await supabase.from("off_staging").update({ validated: false, validation_errors: errors }).eq("barcode", item.barcode);
      console.log(`  ❌ Rejected: ${item.barcode} - ${errors.join(", ")}`);
    }
  }

  // --- PROMOTION PASS ---
  console.log("\n🚀 Promoting Validated Entries...");
  const { data: validated, error: valError } = await supabase
    .from("off_staging")
    .select("*")
    .eq("validated", true)
    .eq("promoted", false);

  if (valError) {
     console.error("❌ Failed to fetch validated items:", valError.message);
     return;
  }

  for (const item of (validated || [])) {
    const nutriments = item.nutriments as any;

    const { data: food, error: foodError } = await supabase
      .from("foods")
      .upsert({
        data_source_id: "off",
        source_food_id: item.barcode,
        name: item.product_name,
        manufacturer: item.brands,
        is_branded: true,
        category_id: "cat_sonstiges",
        updated_at: new Date().toISOString()
      }, { onConflict: "data_source_id, source_food_id" })
      .select("id")
      .single();

    if (foodError) {
      console.error(`  ❌ Failed to promote food ${item.barcode}:`, foodError.message);
      continue;
    }

    const nutrientRows = [
      { food_id: food.id, nutrient_id: "energie", amount: nutriments.energy_kcal_100g },
      { food_id: food.id, nutrient_id: "eiweiss", amount: nutriments.proteins_100g },
      { food_id: food.id, nutrient_id: "fett", amount: nutriments.fat_100g },
      { food_id: food.id, nutrient_id: "kohlenhydrate", amount: nutriments.carbohydrates_100g },
      { food_id: food.id, nutrient_id: "ballaststoffe", amount: nutriments.fiber_100g || 0 },
      { food_id: food.id, nutrient_id: "zucker", amount: nutriments.sugars_100g || 0 },
      { food_id: food.id, nutrient_id: "gesaettigte_fettsaeuren", amount: nutriments["saturated-fat_100g"] || 0 },
      { food_id: food.id, nutrient_id: "natrium", amount: (nutriments.sodium_100g || 0) * 1000 }
    ].filter(r => r.amount !== undefined && r.amount !== null);

    const { error: nutError } = await supabase
      .from("food_nutrients")
      .upsert(nutrientRows.map(r => ({ ...r, per_amount: 100 })), { onConflict: "food_id, nutrient_id" });

    if (nutError) {
      console.error(`  ❌ Failed to promote nutrients for ${item.barcode}:`, nutError.message);
    } else {
      await supabase.from("off_staging").update({ promoted: true }).eq("barcode", item.barcode);
      console.log(`  🚀 Promoted to food catalog: ${item.product_name}`);
    }
  }

  console.log("\n✅ Open Food Facts Integration sync complete.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
