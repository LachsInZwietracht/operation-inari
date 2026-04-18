
import { revalidateAllFoods } from "../lib/data/foods";

async function main() {
  console.log("🚀 Manually purging food database cache...");
  try {
    await revalidateAllFoods();
    console.log("✅ Cache purged successfully. The food list should now refresh on next visit.");
  } catch (error) {
    console.error("❌ Failed to purge cache:", error);
    process.exit(1);
  }
}

main();
