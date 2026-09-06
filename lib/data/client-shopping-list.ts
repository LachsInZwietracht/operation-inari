import type { SupabaseClient } from "@supabase/supabase-js"
import { buildShoppingList } from "@/lib/shopping-list"
import type { DailyMealPlan } from "@/lib/types"

/** Only the signed-in client's linked, released plans; never counselor-owned drafts. */
export async function fetchClientShoppingList(client: SupabaseClient, userId: string, from: string, to: string) {
  const { data: links, error: linkError } = await client.from("client_links")
    .select("patient_id").eq("client_user_id", userId).eq("status", "active")
  if (linkError) throw linkError
  const patientIds = (links ?? []).map(link => link.patient_id)
  const plans: DailyMealPlan[] = []
  if (patientIds.length) {
    const { data, error } = await client.from("daily_meal_plans")
      .select("id,date,title,meal_entries(id,slot_type,entry_type,reference_id,amount)")
      .in("patient_id", patientIds).in("status", ["active", "approved"]).is("replaced_at", null)
      .gte("date", from).lte("date", to)
    if (error) throw error
    for (const plan of data ?? []) plans.push({ id: plan.id, date: plan.date, title: plan.title ?? undefined,
      slots: plan.meal_entries.map(entry => ({ type: entry.slot_type, entries: [{ id: entry.id, type: entry.entry_type, referenceId: entry.reference_id, amount: Number(entry.amount) }] })) })
  }
  const entries = plans.flatMap(plan => plan.slots.flatMap(slot => slot.entries))
  const recipeIds = [...new Set(entries.filter(entry => entry.type === "recipe").map(entry => entry.referenceId))]
  const recipes = new Map<string, { id: string; name: string; servings: number; ingredients: { foodId: string; amount: number }[] }>()
  if (recipeIds.length) {
    const { data, error } = await client.from("recipes").select("id,name,servings,recipe_ingredients(food_id,amount)").in("id", recipeIds)
    if (error) throw error
    for (const recipe of data ?? []) recipes.set(recipe.id, { id: recipe.id, name: recipe.name, servings: Number(recipe.servings),
      ingredients: recipe.recipe_ingredients.map(ingredient => ({ foodId: ingredient.food_id, amount: Number(ingredient.amount) })) })
  }
  const foodIds = [...new Set([...entries.filter(entry => entry.type === "food").map(entry => entry.referenceId),
    ...[...recipes.values()].flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.foodId))])]
  const foods = new Map<string, { id: string; name: string; categoryId: string }>()
  // Bounded ID queries, no catalog sort or nutrient embed; the session's RLS also protects custom foods.
  for (let offset = 0; offset < foodIds.length; offset += 200) {
    const { data, error } = await client.from("foods").select("id,name,category_id").in("id", foodIds.slice(offset, offset + 200))
    if (error) throw error
    for (const food of data ?? []) foods.set(food.id, { id: food.id, name: food.name, categoryId: food.category_id ?? "" })
  }
  return { list: buildShoppingList(plans, foods, recipes), dates: [...new Set(plans.filter(plan => plan.slots.some(slot => slot.entries.length)).map(plan => plan.date))] }
}
