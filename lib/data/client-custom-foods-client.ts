import type { SupabaseClient } from "@supabase/supabase-js";

import { CLIENT_NUTRIENT_IDS } from "@/lib/client-food-log";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Food, NutrientValue } from "@/lib/types";

/**
 * Products the catalog does not know, stored as real foods owned by the client.
 *
 * They used to live as an inline copy on the log row, which meant scanning the
 * same bar twice produced two unrelated products, a correction fixed only one
 * of them, and "my products" was not a list anyone could show. A row in `foods`
 * with `is_custom = TRUE` costs nothing extra — RLS already scopes those to
 * their owner, and `search_foods` already finds them — and it makes the second
 * scan land on the first one.
 *
 * The key carries the owner because `foods` is unique on
 * `(data_source_id, source_food_id)`: two clients scanning the same product
 * must not collide, and neither may overwrite the other's nutrients.
 */

const SOURCE_ID = "custom";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Stable identity for a client's product. A barcode identifies it exactly; a
 * hand-entered product falls back to its name, so typing "Omas Auflauf" twice
 * corrects the first one instead of adding a second.
 */
export function clientCustomFoodKey(
  userId: string,
  input: { barcode?: string; name: string },
): string {
  return input.barcode
    ? `client:${userId}:ean:${input.barcode}`
    : `client:${userId}:name:${slug(input.name)}`;
}

export interface ClientCustomFoodInput {
  name: string;
  /** Per 100 g, the same convention as `foods.baseAmount`. */
  nutrients: NutrientValue[];
  manufacturer?: string;
  barcode?: string;
}

/**
 * Returns the id of the client's product, creating or updating it in place.
 *
 * Nutrients are replaced rather than merged: the newest scan is the better
 * reading of the label, and a half-updated product would be worse than either
 * version of it.
 */
export async function ensureClientCustomFood(
  input: ClientCustomFoodInput,
  supabase?: SupabaseClient,
): Promise<string> {
  const client = resolveClient(supabase);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("AUTH_REQUIRED");

  const sourceFoodId = clientCustomFoodKey(user.id, input);

  const { data: food, error: foodError } = await client
    .from("foods")
    .upsert(
      {
        name: input.name.trim(),
        data_source_id: SOURCE_ID,
        source_food_id: sourceFoodId,
        manufacturer: input.manufacturer ?? null,
        is_custom: true,
        is_branded: Boolean(input.barcode),
        user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "data_source_id,source_food_id" },
    )
    .select("id")
    .single();
  if (foodError) throw new Error(foodError.message);

  const { error: clearError } = await client
    .from("food_nutrients")
    .delete()
    .eq("food_id", food.id);
  if (clearError) throw new Error(clearError.message);

  if (input.nutrients.length > 0) {
    const { error: insertError } = await client.from("food_nutrients").insert(
      input.nutrients.map((nutrient) => ({
        food_id: food.id,
        nutrient_id: nutrient.nutrientId,
        amount: nutrient.amount,
        per_amount: 100,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  return food.id as string;
}

/** The client's own products, for the "Meine" filter and for hydration. */
export async function fetchClientCustomFoods(
  supabase?: SupabaseClient,
): Promise<{ id: string; name: string; nutrients: NutrientValue[] }[]> {
  const client = resolveClient(supabase);
  const { data, error } = await client
    .from("foods")
    .select("id,name,food_nutrients(nutrient_id,amount)")
    .eq("is_custom", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    name: string;
    food_nutrients: { nutrient_id: string; amount: number }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    nutrients: (row.food_nutrients ?? []).map((nutrient) => ({
      nutrientId: nutrient.nutrient_id,
      amount: Number(nutrient.amount),
    })),
  }));
}

/**
 * Nutrients for a mixed set of food ids.
 *
 * `/api/foods/by-ids` deliberately strips custom rows — they are tenant-scoped
 * and must not be fetchable cross-tenant by id — so a client's own products
 * would come back empty from it and render as a nameless zero-calorie line.
 * They are read separately here, through RLS, and merged.
 */
export async function hydrateClientFoods(
  ids: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, Food>> {
  const byId = new Map<string, Food>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return byId;

  const client = resolveClient(supabase);

  const [catalog, own] = await Promise.allSettled([
    fetch("/api/foods/by-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unique, nutrientIds: CLIENT_NUTRIENT_IDS }),
    }).then((response) => (response.ok ? (response.json() as Promise<Food[]>) : [])),
    client
      .from("foods")
      .select("id,name,manufacturer,data_source_id,food_nutrients(nutrient_id,amount,per_amount)")
      .in("id", unique)
      .eq("is_custom", true),
  ]);

  if (catalog.status === "fulfilled") {
    for (const food of catalog.value) byId.set(food.id, food);
  }

  if (own.status === "fulfilled" && own.value.data) {
    type OwnRow = {
      id: string;
      name: string;
      manufacturer: string | null;
      data_source_id: string | null;
      food_nutrients: { nutrient_id: string; amount: number; per_amount: number }[] | null;
    };
    for (const row of own.value.data as unknown as OwnRow[]) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        manufacturer: row.manufacturer ?? undefined,
        sourceId: (row.data_source_id ?? "custom") as Food["sourceId"],
        nutrients: (row.food_nutrients ?? []).map((nutrient) => ({
          nutrientId: nutrient.nutrient_id,
          amount: Number(nutrient.amount),
        })),
        baseAmount: Number(row.food_nutrients?.[0]?.per_amount ?? 100),
        isCustom: true,
      } as Food);
    }
  }

  return byId;
}
