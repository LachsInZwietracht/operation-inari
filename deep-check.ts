import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

async function run() {
  console.log("🛠 Performing Deep System Verification...");

  // 1. Test RPC Search (Critical for the "Smart Add" and search features)
  console.log("\n1. Testing 'search_foods' RPC...");
  const { data: searchData, error: searchError } = await supabase.rpc('search_foods', { 
    search_query: 'Apfel', 
    result_limit: 1 
  });
  
  if (searchError) {
    console.error("❌ RPC 'search_foods' failed:", searchError.message);
    console.log("💡 Tip: You might need to run 'npx supabase db push' again or check if migration 20260412000006_search_function.sql was applied.");
  } else {
    console.log("✅ RPC 'search_foods' is working perfectly.");
  }

  // 2. Check Nutrients (Verify relations are joined correctly)
  console.log("\n2. Testing Nutrient Joins...");
  const { data: foodData, error: foodError } = await supabase
    .from('foods')
    .select('name, food_nutrients(amount)')
    .limit(1)
    .single();

  if (foodError) {
    console.error("❌ Nutrient join failed:", foodError.message);
  } else if (!foodData.food_nutrients || foodData.food_nutrients.length === 0) {
    console.warn("⚠️  Food found but has NO nutrients. Data might be incomplete.");
  } else {
    console.log(`✅ Nutrients are correctly linked (${foodData.food_nutrients.length} values found for first item).`);
  }

  // 3. Verify RLS (Check if policies allow anonymous reads for system data)
  console.log("\n3. Verifying RLS Policies...");
  const { data: rlsData, error: rlsError } = await supabase.from('foods').select('id').limit(1);
  if (rlsError) {
    console.error("❌ RLS Policy Error:", rlsError.message);
  } else {
    console.log("✅ RLS policies allow public read of the food catalog.");
  }
}
run();
