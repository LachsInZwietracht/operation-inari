import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KitchenProductionBatch, MealSlotType, ProductionBatchStatus } from "@/lib/types";

interface PersistKitchenProductionBatchInput {
  menuId: string;
  weekNumber: number;
  dayOfWeek: number;
  serviceDate: string;
  mealSlot: MealSlotType;
  dietFormId: string;
  recipeId: string;
  recipeName: string;
  portionCount: number;
  status: ProductionBatchStatus;
}

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

function resolveBrowserClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
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

export async function persistKitchenProductionBatchStatus(
  input: PersistKitchenProductionBatchInput,
  supabase?: SupabaseClient,
): Promise<KitchenProductionBatch> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);
  if (!userId) throw new Error("AUTH_REQUIRED");

  const { data: previous, error: previousError } = await client
    .from("kitchen_production_batches")
    .select("id,status")
    .eq("user_id", userId)
    .eq("menu_id", input.menuId)
    .eq("week_number", input.weekNumber)
    .eq("day_of_week", input.dayOfWeek)
    .eq("meal_slot", input.mealSlot)
    .eq("diet_form_id", input.dietFormId)
    .eq("recipe_id", input.recipeId)
    .maybeSingle();
  if (previousError) throw new Error(previousError.message);

  const { data, error } = await client
    .from("kitchen_production_batches")
    .upsert(
      {
        user_id: userId,
        menu_id: input.menuId,
        week_number: input.weekNumber,
        day_of_week: input.dayOfWeek,
        service_date: input.serviceDate,
        meal_slot: input.mealSlot,
        diet_form_id: input.dietFormId,
        recipe_id: input.recipeId,
        recipe_name: input.recipeName,
        portion_count: input.portionCount,
        status: input.status,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,menu_id,week_number,day_of_week,meal_slot,diet_form_id,recipe_id",
      },
    )
    .select("id,menu_id,week_number,day_of_week,service_date,meal_slot,diet_form_id,recipe_id,recipe_name,portion_count,status,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);

  const row = data as KitchenProductionBatchRow;
  const previousStatus = (previous as { status?: ProductionBatchStatus } | null)?.status;

  const { error: eventError } = await client.from("kitchen_production_events").insert({
    batch_id: row.id,
    user_id: userId,
    menu_id: input.menuId,
    previous_status: previousStatus ?? null,
    next_status: input.status,
    metadata: {
      weekNumber: input.weekNumber,
      dayOfWeek: input.dayOfWeek,
      serviceDate: input.serviceDate,
      mealSlot: input.mealSlot,
      dietFormId: input.dietFormId,
      recipeId: input.recipeId,
      recipeName: input.recipeName,
      portionCount: input.portionCount,
    },
  });
  if (eventError) throw new Error(eventError.message);

  await writeAccessAuditLog(client, {
    action: "kitchen_production_batch_status_changed",
    targetType: "kitchen_production_batch",
    targetId: row.id,
    metadata: {
      menuId: input.menuId,
      serviceDate: input.serviceDate,
      mealSlot: input.mealSlot,
      dietFormId: input.dietFormId,
      recipeId: input.recipeId,
      recipeName: input.recipeName,
      previousStatus,
      nextStatus: input.status,
    },
  });

  return mapKitchenProductionBatch(row);
}
