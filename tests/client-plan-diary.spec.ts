import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { todayIsoDate } from "@/lib/client-mode";

/**
 * The plan and the diary as one day.
 *
 * Two things are being checked. That the client can actually *price* a planned
 * recipe — the ingredient read policy is new, and without it a recipe entry
 * would render with a name and no calories. And that ticking a planned meal
 * off moves the day's totals, which is the whole reason any of this exists.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "test@prodi.local";
const FOOD_NAME = "Plandiary Haferflocken";
const RECIPE_NAME = "Plandiary Linsensuppe";

let userId: string;
let patientId: string;
let foodId: string;
let recipeId: string;
let planId: string;
let foodEntryId: string;
let recipeEntryId: string;

// The app's day boundary is Europe/Berlin, not UTC. Seeding with the UTC date
// puts the plan on yesterday for part of every night.
function today(): string {
  return todayIsoDate();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: users, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) throw new Error(usersError.message);
  const user = users.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  userId = user.id;

  // 350 kcal / 100 g.
  const { data: food, error: foodError } = await admin
    .from("foods")
    .insert({
      name: FOOD_NAME,
      data_source_id: "bls",
      source_food_id: `plandiary-${Date.now()}`,
      category_id: "cat_getreide",
    })
    .select("id")
    .single();
  if (foodError) throw new Error(foodError.message);
  foodId = food.id;

  const { error: nutrientError } = await admin.from("food_nutrients").insert([
    { food_id: foodId, nutrient_id: "energie", amount: 350 },
    { food_id: foodId, nutrient_id: "eiweiss", amount: 13 },
    { food_id: foodId, nutrient_id: "fett", amount: 7 },
    { food_id: foodId, nutrient_id: "kohlenhydrate", amount: 59 },
  ]);
  if (nutrientError) throw new Error(nutrientError.message);

  // A personal recipe of the counselor's: 200 g of that food, two servings.
  const { data: recipe, error: recipeError } = await admin
    .from("recipes")
    .insert({
      user_id: userId,
      name: RECIPE_NAME,
      servings: 2,
      category: "Hauptgericht",
    })
    .select("id")
    .single();
  if (recipeError) throw new Error(recipeError.message);
  recipeId = recipe.id;

  const { error: ingredientError } = await admin
    .from("recipe_ingredients")
    .insert({ recipe_id: recipeId, food_id: foodId, amount: 200 });
  if (ingredientError) throw new Error(ingredientError.message);

  const { data: patient, error: patientError } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: "Plan",
      last_name: `Tagebuch ${Math.random().toString(36).slice(2, 6)}`,
      date_of_birth: "1990-05-05",
      gender: "w",
      daily_calorie_goal: 2000,
      macro_preset: "balanced",
    })
    .select("id")
    .single();
  if (patientError) throw new Error(patientError.message);
  patientId = patient.id;

  // Self-link: one account plays both roles, which the schema supports.
  const { error: linkError } = await admin.from("client_links").insert({
    patient_id: patientId,
    counselor_user_id: userId,
    client_user_id: userId,
    invite_code: `P${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
    status: "active",
    consent_nutrition: true,
    consent_training: true,
    consented_at: new Date().toISOString(),
  });
  if (linkError) throw new Error(linkError.message);

  const { data: plan, error: planError } = await admin
    .from("daily_meal_plans")
    .insert({
      user_id: userId,
      patient_id: patientId,
      date: today(),
      status: "active",
      title: "Plandiary Testtag",
    })
    .select("id")
    .single();
  if (planError) throw new Error(planError.message);
  planId = plan.id;

  const { data: entries, error: entryError } = await admin
    .from("meal_entries")
    .insert([
      {
        meal_plan_id: planId,
        slot_type: "fruehstueck",
        entry_type: "food",
        reference_id: foodId,
        amount: 60,
        sort_order: 0,
      },
      {
        meal_plan_id: planId,
        slot_type: "mittagessen",
        entry_type: "recipe",
        reference_id: recipeId,
        amount: 1,
        sort_order: 0,
      },
    ])
    .select("id,entry_type");
  if (entryError) throw new Error(entryError.message);
  foodEntryId = entries.find((row) => row.entry_type === "food")!.id;
  recipeEntryId = entries.find((row) => row.entry_type === "recipe")!.id;
});

test.afterAll(async () => {
  await admin.from("client_meal_completions").delete().eq("client_user_id", userId);
  await admin.from("client_food_log_days").delete().eq("client_user_id", userId);
  await admin.from("daily_meal_plans").delete().eq("id", planId);
  await admin.from("client_links").delete().eq("patient_id", patientId);
  await admin.from("patients").delete().eq("id", patientId);
  await admin.from("recipes").delete().eq("id", recipeId);
  await admin.from("foods").delete().eq("id", foodId);
});

test("a planned recipe can be priced, not just named", async () => {
  // Before migration 78 the client could read the recipe's name and nothing
  // else, so the entry rendered as a line with no calories behind it.
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: "test-password-123!",
  });
  if (signInError) throw new Error(signInError.message);

  const { data, error } = await client
    .from("recipes")
    .select("id,name,servings,recipe_ingredients(food_id,amount)")
    .eq("id", recipeId)
    .single();

  expect(error).toBeNull();
  expect(data!.name).toBe(RECIPE_NAME);
  expect(data!.recipe_ingredients).toHaveLength(1);
  expect(Number(data!.recipe_ingredients[0].amount)).toBe(200);
});

test.describe("in the diary", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "prodi_mode", value: "client", domain: "localhost", path: "/" },
    ]);
    await admin.from("client_meal_completions").delete().eq("client_user_id", userId);
  });

  test("planned meals appear in their slot and count once ticked off", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/klient");

    const breakfast = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Frühstück" })
      .first();
    // The plan is drawn into the slot itself: one list, the planned row not
    // yet answered, which `aria-pressed` carries rather than the grey alone.
    // The row itself, not its menu trigger — that carries the same name on
    // purpose, so a screen reader knows which row the menu belongs to.
    const planned = breakfast
      .getByRole("button", { name: new RegExp(FOOD_NAME) })
      .first();
    await expect(planned).toHaveAttribute("aria-pressed", "false");
    // 60 g of a 350 kcal/100 g food.
    await expect(breakfast.getByText(/60 g · 210 kcal/)).toBeVisible();

    // Nothing is eaten yet, so the day is still empty.
    // Identified by content, not by position: the check-in card sits above the
    // totals in the diary, so "the first card" is no longer this one.
    const totals = page.locator("[data-slot=card]").filter({ hasText: "Eiweiß" }).first();
    await expect(totals.getByText("0", { exact: true })).toBeVisible();

    // One tap is the whole answer.
    await planned.click();
    await expect(page.getByText("210", { exact: true })).toBeVisible();

    // The recipe: 200 g at 350 kcal/100 g over two servings = 350 kcal each.
    const lunch = page.locator("[data-slot=card]").filter({ hasText: "Mittagessen" }).first();
    await expect(lunch.getByText(/1 Portion · 350 kcal/)).toBeVisible();
    await lunch.getByRole("button", { name: new RegExp(RECIPE_NAME) }).first().click();

    await expect(page.getByText("560", { exact: true })).toBeVisible();
  });

  test("the reference comes from the plan, not from the standing goal", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/klient");

    // The patient's daily_calorie_goal is 2000; the plan for today is 560.
    await expect(page.getByText(/Richtwert 560 kcal \(dein Plan für heute\)/)).toBeVisible();
  });

  test("a skipped meal is struck through and stays out of the totals", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/klient");

    const breakfast = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Frühstück" })
      .first();
    // Skipping is a secondary action now — the fast path is the tap that says
    // you ate it, and everything else lives behind the row's menu.
    await breakfast.getByRole("button", { name: /mehr$/ }).first().click();
    await page.getByRole("menuitem", { name: "Nicht gegessen" }).click();

    await expect(breakfast.locator(".line-through")).toBeVisible();
    // Identified by content, not by position: the check-in card sits above the
    // totals in the diary, so "the first card" is no longer this one.
    const totals = page.locator("[data-slot=card]").filter({ hasText: "Eiweiß" }).first();
    await expect(totals.getByText("0", { exact: true })).toBeVisible();
  });
});

test("the completion carries the corrected amount", async () => {
  // The UI path is a dialog; the contract worth pinning is that the stored row
  // distinguishes "one and a half portions" from "as planned".
  await admin.from("client_meal_completions").delete().eq("client_user_id", userId);

  const { error } = await admin.from("client_meal_completions").insert({
    client_user_id: userId,
    meal_plan_id: planId,
    meal_entry_id: recipeEntryId,
    skipped: false,
    amount: 1.5,
  });
  expect(error).toBeNull();

  const { data } = await admin
    .from("client_meal_completions")
    .select("amount")
    .eq("meal_entry_id", recipeEntryId)
    .single();
  expect(Number(data!.amount)).toBe(1.5);

  // And "as planned" stays NULL rather than being filled with the plan's number.
  const { error: plainError } = await admin.from("client_meal_completions").insert({
    client_user_id: userId,
    meal_plan_id: planId,
    meal_entry_id: foodEntryId,
    skipped: false,
  });
  expect(plainError).toBeNull();

  const { data: plain } = await admin
    .from("client_meal_completions")
    .select("amount")
    .eq("meal_entry_id", foodEntryId)
    .single();
  expect(plain!.amount).toBeNull();
});
