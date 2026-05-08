import type { SupabaseClient } from "@supabase/supabase-js";

import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { isUuid } from "@/lib/data/local-records";
import { DIET_LINES } from "@/lib/reference-data/diet-lines";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DietLinePreset } from "@/lib/types";

interface DietLinePresetRow {
  id: string;
  name: string;
  description: string | null;
  user_id: string | null;
  diet_line_targets: DietLineTargetRow[] | null;
}

interface DietLineTargetRow {
  nutrient_id: string;
  label: string | null;
  min_value: number | string | null;
  max_value: number | string | null;
}

interface SaveDietLinePresetInput {
  id?: string;
  name: string;
  description: string;
  targets: DietLinePreset["targets"];
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

function getNutrientDefinition(nutrientId: string) {
  return NUTRIENT_DEFINITIONS.find((definition) => definition.id === nutrientId);
}

function numericValue(value: number | string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapPresetRow(row: DietLinePresetRow): DietLinePreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    userId: row.user_id ?? undefined,
    isSystem: row.user_id == null,
    targets: (row.diet_line_targets ?? []).map((target) => {
      const definition = getNutrientDefinition(target.nutrient_id);
      return {
        nutrientId: target.nutrient_id,
        label: target.label ?? definition?.shortName ?? definition?.name ?? target.nutrient_id,
        unit: definition?.unit ?? "",
        min: numericValue(target.min_value),
        max: numericValue(target.max_value),
      };
    }),
  };
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

export function getBundledDietLinePresets(): DietLinePreset[] {
  return DIET_LINES.map((preset) => ({
    ...preset,
    isSystem: true,
  }));
}

export async function fetchDietLinePresetsClient(
  supabase?: SupabaseClient,
): Promise<DietLinePreset[]> {
  const client = resolveBrowserClient(supabase);
  const { data, error } = await client
    .from("diet_line_presets")
    .select("id,name,description,user_id,diet_line_targets(nutrient_id,label,min_value,max_value)")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapPresetRow(row as DietLinePresetRow));
}

export async function saveDietLinePresetClient(
  input: SaveDietLinePresetInput,
  supabase?: SupabaseClient,
): Promise<DietLinePreset> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const id = input.id && isUuid(input.id) ? input.id : crypto.randomUUID();
  const targets = input.targets.filter(
    (target) =>
      target.nutrientId &&
      (typeof target.min === "number" || typeof target.max === "number"),
  );

  if (targets.length === 0) {
    throw new Error("TARGET_REQUIRED");
  }

  const { error: presetError } = await client
    .from("diet_line_presets")
    .upsert(
      {
        id,
        name: input.name,
        description: input.description,
        user_id: userId,
      },
      { onConflict: "id" },
    );

  if (presetError) {
    throw new Error(presetError.message);
  }

  const { error: deleteTargetsError } = await client
    .from("diet_line_targets")
    .delete()
    .eq("diet_line_id", id);

  if (deleteTargetsError) {
    throw new Error(deleteTargetsError.message);
  }

  const { error: insertTargetsError } = await client.from("diet_line_targets").insert(
    targets.map((target) => ({
      diet_line_id: id,
      nutrient_id: target.nutrientId,
      label: target.label,
      min_value: target.min ?? null,
      max_value: target.max ?? null,
    })),
  );

  if (insertTargetsError) {
    throw new Error(insertTargetsError.message);
  }

  const { data, error: reloadError } = await client
    .from("diet_line_presets")
    .select("id,name,description,user_id,diet_line_targets(nutrient_id,label,min_value,max_value)")
    .eq("id", id)
    .single();

  if (reloadError) {
    throw new Error(reloadError.message);
  }

  return mapPresetRow(data as DietLinePresetRow);
}

export async function deleteDietLinePresetClient(
  id: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isUuid(id)) {
    throw new Error("SYSTEM_PRESET");
  }

  const client = resolveBrowserClient(supabase);
  const { error } = await client.from("diet_line_presets").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
