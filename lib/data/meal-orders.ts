import { cache } from "react";

import type { MealOrder } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

interface MealOrderRow {
  id: string;
  legacy_id: string | null;
  inpatient_stay_id: string;
  patient_id: string;
  patient_name: string;
  station: string;
  room: string;
  bed: string;
  service_date: string;
  meal_slot: MealOrder["mealSlot"];
  recipe_id: string;
  recipe_name: string;
  diet_form_ids_snapshot: string[] | null;
  allergen_ids_snapshot: string[] | null;
  restriction_summary: string[] | null;
  special_instructions: string | null;
  status: MealOrder["status"];
  created_at: string;
  updated_at: string;
}

function mapMealOrderRow(row: MealOrderRow): MealOrder {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    inpatientStayId: row.inpatient_stay_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    station: row.station,
    room: row.room,
    bed: row.bed,
    date: row.service_date,
    mealSlot: row.meal_slot,
    recipeId: row.recipe_id,
    recipeName: row.recipe_name,
    dietFormIdsSnapshot: row.diet_form_ids_snapshot ?? [],
    allergenIdsSnapshot: row.allergen_ids_snapshot ?? [],
    restrictionSummary: row.restriction_summary ?? [],
    specialInstructions: row.special_instructions ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const fetchMealOrders = cache(async (): Promise<MealOrder[]> => {
  try {
    const client = await createClient();
    const { data, error } = await withTimeout(
      client.from("meal_orders").select("*").order("service_date", { ascending: false }),
      5000,
      "Supabase meal orders request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as MealOrderRow[];
    return rows.map((row) => mapMealOrderRow(row));
  } catch (error) {
    console.warn("Failed to fetch meal orders from Supabase:", error);
    return [];
  }
});
