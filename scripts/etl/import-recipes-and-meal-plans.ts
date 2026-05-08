import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { RECIPES } from "@/lib/mock-data/recipes";
import { MEAL_PLANS } from "@/lib/mock-data/meal-plans";
import { MEAL_PLAN_TEMPLATES } from "@/lib/mock-data/meal-plan-templates";
import { FOODS } from "@/lib/mock-data";
import type { Recipe, MealEntry, MealSlot, DailyMealPlan, MealPlanTemplate } from "@/lib/types";

/**
 * Inline legacy mock-ID-to-BLS-code map. Only needed at seed time to resolve
 * mock food references (e.g., "food_apfel") to real BLS codes.
 */
const LEGACY_FOOD_ID_TO_BLS_CODE: Record<string, string> = FOODS.reduce(
  (acc, food) => {
    if (food.id && food.blsCode) {
      acc[food.id] = food.blsCode;
    }
    return acc;
  },
  {} as Record<string, string>,
);

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is required.\n" +
      "Run `npx supabase status` to copy it for local development."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function resolveBlsCode(referenceId: string): string | null {
  const legacy = LEGACY_FOOD_ID_TO_BLS_CODE[referenceId];
  if (legacy) {
    return normalizeCode(legacy);
  }
  if (/^[A-Za-z]\d{3,}$/.test(referenceId)) {
    return normalizeCode(referenceId);
  }
  return null;
}

function collectRequiredFoodCodes(): Set<string> {
  const codes = new Set<string>();

  const addFromRecipe = (recipe: Recipe) => {
    for (const ingredient of recipe.ingredients) {
      const code = resolveBlsCode(ingredient.foodId);
      if (code) {
        codes.add(code);
      }
    }
  };

  const addFromSlot = (slot: MealSlot) => {
    for (const entry of slot.entries) {
      if (entry.type === "food") {
        const code = resolveBlsCode(entry.referenceId);
        if (code) {
          codes.add(code);
        }
      }
    }
  };

  for (const recipe of RECIPES) {
    addFromRecipe(recipe);
  }
  for (const plan of MEAL_PLANS) {
    for (const slot of plan.slots) {
      addFromSlot(slot);
    }
  }
  for (const template of MEAL_PLAN_TEMPLATES) {
    for (const slot of template.slots) {
      addFromSlot(slot);
    }
  }

  return codes;
}

async function fetchFoodIdMap(requiredCodes: Set<string>): Promise<Map<string, string>> {
  const codeToId = new Map<string, string>();
  if (requiredCodes.size === 0) {
    return codeToId;
  }

  const codes = Array.from(requiredCodes);
  const chunkSize = 500;
  for (let index = 0; index < codes.length; index += chunkSize) {
    const chunk = codes.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("foods")
      .select("id, bls_code")
      .in("bls_code", chunk);
    if (error) {
      throw new Error(`Failed to fetch foods for codes ${chunk.join(", ")}: ${error.message}`);
    }
    for (const row of data ?? []) {
      if (row.bls_code) {
        codeToId.set(normalizeCode(row.bls_code), row.id);
      }
    }
  }

  return codeToId;
}

function resolveFoodId(referenceId: string, codeToFoodId: Map<string, string>): string {
  if (isUuid(referenceId)) {
    return referenceId;
  }
  const code = resolveBlsCode(referenceId);
  if (!code) {
    throw new Error(`Cannot resolve food reference "${referenceId}" — add its BLS code mapping.`);
  }
  const foodId = codeToFoodId.get(code);
  if (!foodId) {
    throw new Error(
      `Food with BLS code ${code} (from reference ${referenceId}) not found. Run the BLS ETL before importing recipes.`
    );
  }
  return foodId;
}

async function upsertRecipes(codeToFoodId: Map<string, string>): Promise<Map<string, string>> {
  if (RECIPES.length === 0) {
    return new Map();
  }

  const now = new Date().toISOString();
  const rows = RECIPES.map((recipe) => ({
    legacy_id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    servings: recipe.servings,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    instructions: recipe.instructions,
    image_url: recipe.imageUrl ?? null,
    allergens: recipe.allergens ?? [],
    additives: recipe.additives ?? [],
    tags: recipe.tags ?? [],
    prod_score: recipe.prodScore ?? null,
    co2_per_portion: recipe.co2PerPortion ?? null,
    source_type: recipe.sourceType ?? "community",
    teaching_kitchen_notes: recipe.teachingKitchenNotes ?? null,
    created_at: recipe.createdAt ?? now,
    updated_at: recipe.updatedAt ?? now,
  }));

  console.log(`Upserting ${rows.length} recipes...`);
  const { error: recipeError } = await supabase
    .from("recipes")
    .upsert(rows, { onConflict: "legacy_id" });
  if (recipeError) {
    throw new Error(`Failed to upsert recipes: ${recipeError.message}`);
  }

  const legacyIds = RECIPES.map((recipe) => recipe.id);
  const { data: recipeIdRows, error: recipeIdError } = await supabase
    .from("recipes")
    .select("id, legacy_id")
    .in("legacy_id", legacyIds);
  if (recipeIdError) {
    throw new Error(`Failed to fetch recipe IDs: ${recipeIdError.message}`);
  }

  const recipeIdMap = new Map<string, string>();
  for (const row of recipeIdRows ?? []) {
    if (row.legacy_id) {
      recipeIdMap.set(row.legacy_id, row.id);
    }
  }

  if (recipeIdMap.size !== legacyIds.length) {
    throw new Error("Recipe ID lookup incomplete — ensure legacy IDs remain unique.");
  }

  const recipeIds = Array.from(recipeIdMap.values());
  const { error: deleteIngredientsError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .in("recipe_id", recipeIds);
  if (deleteIngredientsError) {
    throw new Error(`Failed to clear old recipe ingredients: ${deleteIngredientsError.message}`);
  }

  const ingredientRows = RECIPES.flatMap((recipe) => {
    const recipeId = recipeIdMap.get(recipe.id);
    if (!recipeId) return [];
    return recipe.ingredients.map((ingredient, index) => ({
      recipe_id: recipeId,
      food_id: resolveFoodId(ingredient.foodId, codeToFoodId),
      amount: ingredient.amount,
      sort_order: index,
    }));
  });

  console.log(`Inserting ${ingredientRows.length} recipe ingredients...`);
  if (ingredientRows.length > 0) {
    const { error: insertIngredientsError } = await supabase
      .from("recipe_ingredients")
      .insert(ingredientRows);
    if (insertIngredientsError) {
      throw new Error(`Failed to insert recipe ingredients: ${insertIngredientsError.message}`);
    }
  }

  return recipeIdMap;
}

function flattenEntries(plan: DailyMealPlan): Array<{ slot: MealSlot; entry: MealEntry; entryIndex: number }> {
  const items: Array<{ slot: MealSlot; entry: MealEntry; entryIndex: number }> = [];
  for (const slot of plan.slots) {
    slot.entries.forEach((entry, index) => {
      items.push({ slot, entry, entryIndex: index });
    });
  }
  return items;
}

async function upsertMealPlans(
  codeToFoodId: Map<string, string>,
  recipeIdMap: Map<string, string>
) {
  if (MEAL_PLANS.length === 0) {
    return;
  }

  const planRows = MEAL_PLANS.map((plan) => ({
    legacy_id: plan.id,
    date: plan.date,
    user_id: null,
  }));

  console.log(`Upserting ${planRows.length} meal plans...`);
  const { error: upsertPlansError } = await supabase
    .from("daily_meal_plans")
    .upsert(planRows, { onConflict: "legacy_id" });
  if (upsertPlansError) {
    throw new Error(`Failed to upsert meal plans: ${upsertPlansError.message}`);
  }

  const legacyIds = MEAL_PLANS.map((plan) => plan.id);
  const { data: planIdRows, error: planIdError } = await supabase
    .from("daily_meal_plans")
    .select("id, legacy_id")
    .in("legacy_id", legacyIds);
  if (planIdError) {
    throw new Error(`Failed to fetch meal plan IDs: ${planIdError.message}`);
  }

  const planIdMap = new Map<string, string>();
  for (const row of planIdRows ?? []) {
    if (row.legacy_id) {
      planIdMap.set(row.legacy_id, row.id);
    }
  }

  if (planIdMap.size !== legacyIds.length) {
    throw new Error("Meal plan lookup incomplete");
  }

  const planIds = Array.from(planIdMap.values());
  const { error: deleteEntriesError } = await supabase
    .from("meal_entries")
    .delete()
    .in("meal_plan_id", planIds);
  if (deleteEntriesError) {
    throw new Error(`Failed to remove previous meal entries: ${deleteEntriesError.message}`);
  }

  const entryRows = MEAL_PLANS.flatMap((plan) => {
    const planId = planIdMap.get(plan.id);
    if (!planId) return [];
    return flattenEntries(plan).map(({ slot, entry, entryIndex }) => {
      const referenceId =
        entry.type === "food"
          ? resolveFoodId(entry.referenceId, codeToFoodId)
          : recipeIdMap.get(entry.referenceId);
      if (!referenceId) {
        throw new Error(
          `Unknown recipe reference ${entry.referenceId} in meal plan ${plan.id}`
        );
      }
      return {
        meal_plan_id: planId,
        slot_type: slot.type,
        entry_type: entry.type,
        reference_id: referenceId,
        amount: entry.amount,
        sort_order: entryIndex,
      };
    });
  });

  console.log(`Inserting ${entryRows.length} meal entries...`);
  if (entryRows.length > 0) {
    const { error: insertEntriesError } = await supabase
      .from("meal_entries")
      .insert(entryRows);
    if (insertEntriesError) {
      throw new Error(`Failed to insert meal entries: ${insertEntriesError.message}`);
    }
  }
}

async function upsertMealPlanTemplates(
  codeToFoodId: Map<string, string>,
  recipeIdMap: Map<string, string>,
) {
  if (MEAL_PLAN_TEMPLATES.length === 0) {
    return;
  }

  const rows = MEAL_PLAN_TEMPLATES.map((template: MealPlanTemplate) => {
    const slots = template.slots.map((slot) => ({
      type: slot.type,
      entries: slot.entries.map((entry, entryIndex) => {
        const referenceId =
          entry.type === "food"
            ? resolveFoodId(entry.referenceId, codeToFoodId)
            : recipeIdMap.get(entry.referenceId);
        if (!referenceId) {
          throw new Error(
            `Unknown ${entry.type} reference ${entry.referenceId} in meal plan template ${template.id}`,
          );
        }
        return {
          id: entry.id ?? `tplentry_${template.id}_${slot.type}_${entryIndex}`,
          type: entry.type,
          referenceId,
          amount: entry.amount,
        };
      }),
    }));

    return {
      legacy_id: template.id,
      user_id: null,
      name: template.name,
      description: template.description,
      indication: template.indication ?? null,
      diet_line_id: template.dietLineId ?? null,
      target_profile_id: template.targetProfileId ?? null,
      slots,
      notes: template.notes ?? null,
      source_type: "system",
    };
  });

  console.log(`Upserting ${rows.length} meal plan templates...`);
  const { error } = await supabase
    .from("meal_plan_templates")
    .upsert(rows, { onConflict: "legacy_id" });
  if (error) {
    throw new Error(`Failed to upsert meal plan templates: ${error.message}`);
  }
}

async function main() {
  const codes = collectRequiredFoodCodes();
  console.log(`Resolving ${codes.size} unique BLS food codes...`);
  const codeToFoodId = await fetchFoodIdMap(codes);
  if (codeToFoodId.size !== codes.size) {
    const missing = Array.from(codes).filter((code) => !codeToFoodId.has(code));
    if (missing.length) {
      throw new Error(
        `Missing ${missing.length} BLS foods: ${missing.join(", ")}. Run npm run etl:bls first.`
      );
    }
  }

  const recipeIdMap = await upsertRecipes(codeToFoodId);
  await upsertMealPlans(codeToFoodId, recipeIdMap);
  await upsertMealPlanTemplates(codeToFoodId, recipeIdMap);

  const { writeDataSourceEvent } = await import("./etl-event");
  await writeDataSourceEvent({
    dataSourceId: "bls",
    eventType: "import",
    title: "Rezepte & Tagesplaene Seed",
    summary: `${RECIPES.length} Rezepte, ${MEAL_PLANS.length} Tagesplaene und ${MEAL_PLAN_TEMPLATES.length} Vorlagen importiert.`,
    recordCount: RECIPES.length + MEAL_PLANS.length + MEAL_PLAN_TEMPLATES.length,
    metadata: {
      recipes: RECIPES.length,
      mealPlans: MEAL_PLANS.length,
      mealPlanTemplates: MEAL_PLAN_TEMPLATES.length,
    },
  });

  console.log("Recipe + meal plan import completed.");
}

main().catch((error) => {
  console.error("Fatal recipe import error:", error);
  process.exit(1);
});
