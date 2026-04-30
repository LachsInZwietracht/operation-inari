import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

export interface DataSourceEvent {
  id: string;
  dataSourceId: string;
  eventType: "import" | "version_update" | "nutrient_mapping" | "license" | "change_note";
  version: string | null;
  title: string;
  summary: string;
  recordCount: number | null;
  nutrientCount: number | null;
  createdAt: string;
}

export interface FoodReferenceReplacement {
  id: string;
  sourceFoodId: string;
  targetFoodId: string;
  sourceFoodName: string | null;
  targetFoodName: string | null;
  reason: string | null;
  recipeIngredientsUpdated: number;
  mealEntriesUpdated: number;
  protocolEntriesUpdated: number;
  createdAt: string;
}

export interface FoodReferenceReplacementResult {
  replacementId: string;
  recipeIngredientsUpdated: number;
  mealEntriesUpdated: number;
  protocolEntriesUpdated: number;
}

interface DataSourceEventRow {
  id: string;
  data_source_id: string;
  event_type: DataSourceEvent["eventType"];
  version: string | null;
  title: string;
  summary: string;
  record_count: number | null;
  nutrient_count: number | null;
  created_at: string;
}

interface ReplacementRow {
  id: string;
  source_food_id: string;
  target_food_id: string;
  reason: string | null;
  recipe_ingredients_updated: number;
  meal_entries_updated: number;
  protocol_entries_updated: number;
  created_at: string;
  source_food: { name: string | null } | null;
  target_food: { name: string | null } | null;
}

interface ReplacementRpcRow {
  replacement_id: string;
  recipe_ingredients_updated: number;
  meal_entries_updated: number;
  protocol_entries_updated: number;
}

function mapEvent(row: DataSourceEventRow): DataSourceEvent {
  return {
    id: row.id,
    dataSourceId: row.data_source_id,
    eventType: row.event_type,
    version: row.version,
    title: row.title,
    summary: row.summary,
    recordCount: row.record_count,
    nutrientCount: row.nutrient_count,
    createdAt: row.created_at,
  };
}

function mapReplacement(row: ReplacementRow): FoodReferenceReplacement {
  return {
    id: row.id,
    sourceFoodId: row.source_food_id,
    targetFoodId: row.target_food_id,
    sourceFoodName: row.source_food?.name ?? null,
    targetFoodName: row.target_food?.name ?? null,
    reason: row.reason,
    recipeIngredientsUpdated: row.recipe_ingredients_updated,
    mealEntriesUpdated: row.meal_entries_updated,
    protocolEntriesUpdated: row.protocol_entries_updated,
    createdAt: row.created_at,
  };
}

export const fetchDataSourceEvents = cache(async (): Promise<{
  events: DataSourceEvent[];
  error: string | null;
}> => {
  try {
    const client = await createServiceClient();
    const { data, error } = await withTimeout(
      client
        .from("data_source_events")
        .select("id,data_source_id,event_type,version,title,summary,record_count,nutrient_count,created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      5000,
      "Supabase data source event request timed out",
    );

    if (error) throw new Error(error.message);

    return {
      events: ((data ?? []) as DataSourceEventRow[]).map(mapEvent),
      error: null,
    };
  } catch (error) {
    console.warn("Unable to load data source events:", error);
    return {
      events: [],
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der Datenbankhistorie.",
    };
  }
});

export async function fetchFoodReferenceReplacements(supabase?: SupabaseClient): Promise<{
  replacements: FoodReferenceReplacement[];
  error: string | null;
}> {
  try {
    const client = supabase ?? await createClient();
    const { data, error } = await withTimeout(
      client
        .from("food_reference_replacements")
        .select(
          [
            "id",
            "source_food_id",
            "target_food_id",
            "reason",
            "recipe_ingredients_updated",
            "meal_entries_updated",
            "protocol_entries_updated",
            "created_at",
            "source_food:foods!food_reference_replacements_source_food_id_fkey(name)",
            "target_food:foods!food_reference_replacements_target_food_id_fkey(name)",
          ].join(","),
        )
        .order("created_at", { ascending: false })
        .limit(8),
      5000,
      "Supabase food replacement request timed out",
    );

    if (error) throw new Error(error.message);

    return {
      replacements: ((data ?? []) as unknown as ReplacementRow[]).map(mapReplacement),
      error: null,
    };
  } catch (error) {
    console.warn("Unable to load food reference replacements:", error);
    return {
      replacements: [],
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der Ersetzungsprotokolle.",
    };
  }
}

export async function replaceFoodReferences(params: {
  sourceFoodId: string;
  targetFoodId: string;
  reason?: string;
  scope?: "user_workspace" | "organization";
  supabase?: SupabaseClient;
}): Promise<FoodReferenceReplacementResult> {
  const client = params.supabase ?? await createClient();
  const { data, error } = await client.rpc("replace_food_references", {
    p_source_food_id: params.sourceFoodId,
    p_target_food_id: params.targetFoodId,
    p_reason: params.reason ?? null,
    p_scope: params.scope ?? "user_workspace",
  });

  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as ReplacementRpcRow | null;
  if (!row) {
    throw new Error("Die Ersetzung wurde nicht bestaetigt.");
  }

  return {
    replacementId: row.replacement_id,
    recipeIngredientsUpdated: row.recipe_ingredients_updated,
    mealEntriesUpdated: row.meal_entries_updated,
    protocolEntriesUpdated: row.protocol_entries_updated,
  };
}
