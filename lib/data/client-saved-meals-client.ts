import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ClientSavedMeal, ClientSavedMealItem, NutrientValue } from "@/lib/types";

/**
 * "Mein übliches Frühstück" — a named set of foods, logged again with one tap.
 *
 * The item shape mirrors a food log entry exactly, so saving is a copy out and
 * using one is a copy back. Private to the client: nothing here is a record
 * about them, and whatever they log from it shows up in the diary anyway.
 */

interface MealRow {
  id: string;
  name: string;
  created_at: string;
  client_saved_meal_items: ItemRow[] | null;
}

interface ItemRow {
  id: string;
  source_type: ClientSavedMealItem["sourceType"];
  food_id: string | null;
  custom_name: string | null;
  custom_nutrients: NutrientValue[] | null;
  amount: number;
  sort_order: number;
}

const MEAL_COLUMNS =
  "id,name,created_at," +
  "client_saved_meal_items(id,source_type,food_id,custom_name,custom_nutrients,amount,sort_order)";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

function mapItemRow(row: ItemRow): ClientSavedMealItem {
  return {
    id: row.id,
    sourceType: row.source_type,
    foodId: row.food_id ?? undefined,
    customName: row.custom_name ?? undefined,
    customNutrients: row.custom_nutrients ?? undefined,
    amount: Number(row.amount ?? 0),
    sortOrder: row.sort_order ?? 0,
  };
}

function mapMealRow(row: MealRow): ClientSavedMeal {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    items: (row.client_saved_meal_items ?? [])
      .map(mapItemRow)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export async function fetchClientSavedMeals(
  supabase?: SupabaseClient,
): Promise<ClientSavedMeal[]> {
  const client = resolveClient(supabase);
  const { data, error } = await client
    .from("client_saved_meals")
    .select(MEAL_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MealRow[]).map(mapMealRow);
}

/**
 * Saves a slot's entries under a name. Replaces the items of an existing meal
 * of the same name rather than erroring — "save my breakfast" twice is a
 * correction, not a mistake.
 */
export async function saveClientMeal(
  input: {
    name: string;
    items: Pick<
      ClientSavedMealItem,
      "sourceType" | "foodId" | "customName" | "customNutrients" | "amount"
    >[];
  },
  supabase?: SupabaseClient,
): Promise<ClientSavedMeal> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);
  const name = input.name.trim();

  const { data: meal, error: mealError } = await client
    .from("client_saved_meals")
    .upsert(
      { client_user_id: userId, name, updated_at: new Date().toISOString() },
      { onConflict: "client_user_id,name" },
    )
    .select("id")
    .single();
  if (mealError) throw new Error(mealError.message);

  const { error: clearError } = await client
    .from("client_saved_meal_items")
    .delete()
    .eq("saved_meal_id", meal.id);
  if (clearError) throw new Error(clearError.message);

  if (input.items.length > 0) {
    const { error: itemError } = await client.from("client_saved_meal_items").insert(
      input.items.map((item, index) => ({
        saved_meal_id: meal.id,
        client_user_id: userId,
        source_type: item.sourceType,
        food_id: item.foodId ?? null,
        custom_name: item.customName ?? null,
        custom_nutrients: item.customNutrients ?? null,
        amount: item.amount,
        sort_order: index,
      })),
    );
    if (itemError) throw new Error(itemError.message);
  }

  const { data, error } = await client
    .from("client_saved_meals")
    .select(MEAL_COLUMNS)
    .eq("id", meal.id)
    .single();
  if (error) throw new Error(error.message);
  return mapMealRow(data as unknown as MealRow);
}

export async function deleteClientSavedMeal(
  mealId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const { error } = await client.from("client_saved_meals").delete().eq("id", mealId);
  if (error) throw new Error(error.message);
}
