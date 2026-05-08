import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";
import type { KitchenProductionBatch, MealSlotType, ProductionBatchStatus } from "@/lib/types";

interface KitchenProductionBatchRow {
  id: string;
  menu_id: string;
  week_number: number;
  day_of_week: number;
  service_date: string;
  meal_slot: MealSlotType;
  diet_form_id: string;
  recipe_id: string;
  recipe_name: string;
  portion_count: number;
  status: ProductionBatchStatus;
  created_at: string;
  updated_at: string;
}

function mapKitchenProductionBatch(row: KitchenProductionBatchRow): KitchenProductionBatch {
  return {
    id: row.id,
    menuId: row.menu_id,
    weekNumber: row.week_number,
    dayOfWeek: row.day_of_week,
    serviceDate: row.service_date,
    mealSlot: row.meal_slot,
    dietFormId: row.diet_form_id,
    recipeId: row.recipe_id,
    recipeName: row.recipe_name,
    portionCount: row.portion_count,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const fetchKitchenProductionBatches = cache(async (): Promise<KitchenProductionBatch[]> => {
  try {
    const client = await createClient();
    const { data, error } = await withTimeout(
      client
        .from("kitchen_production_batches")
        .select("id,menu_id,week_number,day_of_week,service_date,meal_slot,diet_form_id,recipe_id,recipe_name,portion_count,status,created_at,updated_at")
        .order("service_date", { ascending: false })
        .order("meal_slot", { ascending: true }),
      5000,
      "Supabase kitchen production batches request timed out",
    );

    if (error) throw new Error(error.message);
    return ((data ?? []) as KitchenProductionBatchRow[]).map(mapKitchenProductionBatch);
  } catch (error) {
    console.warn("Failed to fetch kitchen production batches from Supabase:", error);
    return [];
  }
});
