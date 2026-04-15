import { FOODS } from "@/lib/mock-data";

/**
 * Maps legacy mock food IDs (e.g., "food_apfel") to their BLS code so
 * we can resolve older references against the Supabase catalog.
 */
export const LEGACY_FOOD_ID_TO_BLS_CODE: Record<string, string> = FOODS.reduce(
  (acc, food) => {
    if (food.id && food.blsCode) {
      acc[food.id] = food.blsCode;
    }
    return acc;
  },
  {} as Record<string, string>
);
