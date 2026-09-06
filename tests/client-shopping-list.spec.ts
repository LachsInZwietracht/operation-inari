import { expect, test } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { addDays, format, startOfWeek } from "date-fns"
import { fetchClientShoppingList } from "@/lib/data/client-shopping-list"
import { todayIsoDate } from "@/lib/client-mode"
import { buildShoppingList } from "@/lib/shopping-list"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const password = "Shopping-test-2026!"
const users: { id: string; email: string }[] = []
let patientId: string
let foodId: string
let recipeId: string
const plans: string[] = []
const from = format(addDays(startOfWeek(new Date(`${todayIsoDate()}T12:00:00`), { weekStartsOn: 1 }), 7), "yyyy-MM-dd")
const to = format(addDays(new Date(`${from}T12:00:00`), 6), "yyyy-MM-dd")

test.use({ storageState: { cookies: [], origins: [] } })
test.beforeAll(async () => {
  for (const role of ["counselor", "client", "outsider"]) {
    const email = `shopping-${role}-${crypto.randomUUID()}@prodi.local`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    users.push({ id: data.user.id, email })
  }
  const patient = await admin.from("patients").insert({ user_id: users[0].id, first_name: "Einkauf", last_name: "Test", date_of_birth: "1990-01-01", gender: "w" }).select("id").single()
  if (patient.error) throw patient.error
  patientId = patient.data.id
  const link = await admin.from("client_links").insert({ patient_id: patientId, counselor_user_id: users[0].id, client_user_id: users[1].id, status: "active", invite_code: crypto.randomUUID(), consent_nutrition: true })
  if (link.error) throw link.error
  const food = await admin.from("foods").insert({ name: "Karotten", category_id: "cat_gemuese", data_source_id: "bls", source_food_id: crypto.randomUUID() }).select("id").single()
  if (food.error) throw food.error
  foodId = food.data.id
  const recipe = await admin.from("recipes").insert({ user_id: users[0].id, name: "Karottensuppe", servings: 2, category: "Hauptgericht" }).select("id").single()
  if (recipe.error) throw recipe.error
  recipeId = recipe.data.id
  const ingredient = await admin.from("recipe_ingredients").insert({ recipe_id: recipeId, food_id: foodId, amount: 600 })
  if (ingredient.error) throw ingredient.error
  for (const [i, status] of ["approved", "draft", "archived"].entries()) {
    const plan = await admin.from("daily_meal_plans").insert({ user_id: users[0].id, patient_id: patientId, date: format(addDays(new Date(`${from}T12:00:00`), i), "yyyy-MM-dd"), status }).select("id").single()
    if (plan.error) throw plan.error
    plans.push(plan.data.id)
    const entries = await admin.from("meal_entries").insert([
      { meal_plan_id: plan.data.id, slot_type: "mittagessen", entry_type: "recipe", reference_id: recipeId, amount: 1 },
      { meal_plan_id: plan.data.id, slot_type: "abendessen", entry_type: "food", reference_id: foodId, amount: 150 },
    ])
    if (entries.error) throw entries.error
  }
})
test.afterAll(async () => {
  if (plans.length) await admin.from("daily_meal_plans").delete().in("id", plans)
  if (patientId) { await admin.from("client_links").delete().eq("patient_id", patientId); await admin.from("patients").delete().eq("id", patientId) }
  if (recipeId) await admin.from("recipes").delete().eq("id", recipeId)
  if (foodId) await admin.from("foods").delete().eq("id", foodId)
  for (const user of users) await admin.auth.admin.deleteUser(user.id)
})

test("only released linked plans contribute, recipes scale and outsider/counselor get no client list", async () => {
  for (const index of [1, 2, 0]) {
    const client = createClient(url, anon, { auth: { persistSession: false } })
    const auth = await client.auth.signInWithPassword({ email: users[index].email, password })
    if (auth.error) throw auth.error
    const result = await fetchClientShoppingList(client, users[index].id, from, to)
    if (index === 1) {
      expect(result.dates).toEqual([from])
      expect(result.list.itemCount).toBe(1)
      expect(result.list.groups[0].items[0].totalGrams).toBe(450)
      expect(result.list.missing).toEqual([])
    } else expect(result.list.itemCount).toBe(0)
  }
})

test("mobile shopping persists checkmarks, supports undo, sources, share and week switch", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000)
  const client = createServerClient(url, anon, { cookies: { getAll: () => [], setAll: async cookies => {
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, domain: "localhost", path: "/" })))
  } } })
  const auth = await client.auth.signInWithPassword({ email: users[1].email, password })
  if (auth.error) throw auth.error
  await context.addCookies([{ name: "prodi_mode", value: "client", domain: "localhost", path: "/" }])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/klient/plan/einkaufsliste")
  await expect(page.getByRole("heading", { name: "Einkaufsliste", exact: true })).toBeVisible()
  await expect(page.getByText("1 von 7 Tagen mit Plan")).toBeVisible()
  const item = page.getByRole("checkbox", { name: "Karotten, 450 g" })
  await expect(item).toHaveAttribute("aria-checked", "false")
  await page.getByText("Wofür brauche ich das?").click()
  await expect(page.getByText(/Karottensuppe · 300 g/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true })
  await item.click()
  await expect(page.getByRole("heading", { name: "Alles erledigt" })).toBeVisible()
  await page.reload()
  await expect(item).toHaveAttribute("aria-checked", "true")
  // A changed planned quantity must not inherit the old checkmark.
  const changed = await admin.from("recipe_ingredients").update({ amount: 800 }).eq("recipe_id", recipeId)
  expect(changed.error).toBeNull()
  await page.reload()
  await expect(page.getByRole("checkbox", { name: "Karotten, 550 g" })).toHaveAttribute("aria-checked", "false")
  const restored = await admin.from("recipe_ingredients").update({ amount: 600 }).eq("recipe_id", recipeId)
  expect(restored.error).toBeNull()
  await page.reload()
  await expect(item).toHaveAttribute("aria-checked", "true")
  await item.click()
  await expect(page.getByRole("heading", { name: "1 noch einzukaufen" })).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => { document.body.dataset.shared = data.text } }) })
  await page.getByRole("button", { name: "Offene Zutaten teilen" }).click()
  await expect(page.locator("body")).toHaveAttribute("data-shared", /450 g Karotten/)
  await page.getByRole("link", { name: "Diese Woche", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Deine Woche ist noch offen" })).toBeVisible()
  await page.getByRole("link", { name: "Nächste Woche", exact: true }).click()
  await expect(item).toHaveAttribute("aria-checked", "false")
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true })
})

test("unresolvable and empty recipes are reported instead of silently omitted", () => {
  const result = buildShoppingList([{ id: "p", date: from, slots: [{ type: "mittagessen", entries: [{ id: "e", type: "recipe", referenceId: "r", amount: 1 }] }] }], new Map(), new Map([["r", { id: "r", name: "Leer", servings: 2, ingredients: [] }]]))
  expect(result.itemCount).toBe(0)
  expect(result.missing).toHaveLength(1)
})
