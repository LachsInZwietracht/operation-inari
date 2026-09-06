import { expect, test } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS for the plan module.
 *
 * Plan visibility runs opposite to the food log: the counselor wrote the plan
 * *for* this person, so it hangs on an active link rather than on a consent
 * flag. Drafts must stay invisible, and an unrelated account must see nothing
 * at all.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "prodi-test-passwort-2026";

interface TestUser {
  id: string;
  email: string;
}

async function createUser(label: string): Promise<TestUser> {
  const email = `plan-${label}-${Math.random().toString(36).slice(2, 8)}@prodi.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return { id: data.user.id, email };
}

async function signedInClient(user: TestUser) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
  });
  if (error) throw new Error(error.message);
  return client;
}

// Shared fixtures, and the last test flips the link's status: these must not
// be spread across workers by the suite's fullyParallel default.
test.describe.configure({ mode: "serial" });

test.describe("client plan messages", () => {
  let counselor: TestUser;
  let clientUser: TestUser;
  let outsider: TestUser;
  let patientId: string;
  let linkId: string;
  let approvedPlanId: string;
  let draftPlanId: string;
  let approvedEntryId: string;
  let foodId: string;
  const recipeIds: string[] = [];

  test.beforeAll(async () => {
    counselor = await createUser("counselor");
    clientUser = await createUser("client");
    outsider = await createUser("outsider");

    const { data: food, error: foodError } = await admin
      .from("foods")
      .insert({
        name: "Plan-RLS Testfood",
        data_source_id: "bls",
        source_food_id: `plan-rls-${Math.random().toString(36).slice(2, 10)}`,
      })
      .select("id")
      .single();
    if (foodError) throw new Error(foodError.message);
    foodId = food.id;

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        user_id: counselor.id,
        first_name: "Plan",
        last_name: `RLS ${Math.random().toString(36).slice(2, 6)}`,
        date_of_birth: "1988-02-02",
        gender: "m",
      })
      .select("id")
      .single();
    if (patientError) throw new Error(patientError.message);
    patientId = patient.id;

    const { data: link, error: linkError } = await admin
      .from("client_links")
      .insert({
        patient_id: patientId,
        counselor_user_id: counselor.id,
        client_user_id: clientUser.id,
        invite_code: `P${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        status: "active",
        consent_nutrition: true,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);
    linkId = link.id;

    const { data: approved, error: approvedError } = await admin
      .from("daily_meal_plans")
      .insert({
        user_id: counselor.id,
        patient_id: patientId,
        date: "2026-08-05",
        status: "approved",
        title: "Freigegebener Tag",
      })
      .select("id")
      .single();
    if (approvedError) throw new Error(approvedError.message);
    approvedPlanId = approved.id;

    const { data: entry, error: entryError } = await admin
      .from("meal_entries")
      .insert({
        meal_plan_id: approvedPlanId,
        slot_type: "fruehstueck",
        entry_type: "food",
        reference_id: foodId,
        amount: 80,
      })
      .select("id")
      .single();
    if (entryError) throw new Error(entryError.message);
    approvedEntryId = entry.id;

    const { data: draft, error: draftError } = await admin
      .from("daily_meal_plans")
      .insert({
        user_id: counselor.id,
        patient_id: patientId,
        date: "2026-08-06",
        status: "draft",
        title: "Entwurf",
      })
      .select("id")
      .single();
    if (draftError) throw new Error(draftError.message);
    draftPlanId = draft.id;
  });

  test.afterAll(async () => {
    await admin.from("client_meal_completions").delete().eq("client_user_id", clientUser.id);
    await admin
      .from("daily_meal_plans")
      .delete()
      .in("id", [approvedPlanId, draftPlanId]);
    await admin.from("client_links").delete().eq("id", linkId);
    await admin.from("patients").delete().eq("id", patientId);
    if (recipeIds.length) await admin.from("recipes").delete().in("id", recipeIds);
    await admin.from("foods").delete().eq("id", foodId);
    for (const user of [counselor, clientUser, outsider]) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  });


  test("persists requests, deduplicates concurrent clicks and restricts replies", async () => {
    const client = await signedInClient(clientUser);
    const owner = await signedInClient(counselor);
    const other = await signedInClient(outsider);
    const input = { p_plan_id: approvedPlanId, p_body: "Bitte ohne Milch", p_entry_id: approvedEntryId };
    const targets = await client.rpc("get_client_plan_targets", { p_plan_id: approvedPlanId });
    expect(targets.error).toBeNull();
    expect(targets.data).toEqual([{ entry_id: approvedEntryId, label: "Plan-RLS Testfood", ingredients: [] }]);
    expect((await other.rpc("get_client_plan_targets", { p_plan_id: approvedPlanId })).error).not.toBeNull();
    expect((await client.rpc("get_client_plan_targets", { p_plan_id: draftPlanId })).error).not.toBeNull();
    const results = await Promise.all([client.rpc("send_client_plan_message", input), client.rpc("send_client_plan_message", input)]);
    for (const result of results) expect(result.error).toBeNull();
    expect(results[0].data).toBe(results[1].data);
    const id = results[0].data;
    const { data: rows, error } = await owner.from("client_plan_messages").select("*").eq("id", id);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ target_label: "Plan-RLS Testfood", plan_date: "2026-08-05", revision_number: 1, status: "open" });
    expect((await other.from("client_plan_messages").select("id")).data).toEqual([]);
    expect((await other.rpc("send_client_plan_message", input)).error).not.toBeNull();
    expect((await client.rpc("resolve_client_plan_message", { p_id: id, p_response: "Selbst erledigt" })).error).not.toBeNull();
    expect((await other.rpc("resolve_client_plan_message", { p_id: id, p_response: "Fremder Zugriff" })).error).not.toBeNull();
    expect((await owner.rpc("resolve_client_plan_message", { p_id: id, p_response: "" })).error).not.toBeNull();
    expect((await client.from("client_plan_messages").update({ status: "resolved" }).eq("id", id)).error).not.toBeNull();
    expect((await owner.rpc("resolve_client_plan_message", { p_id: id, p_response: "Alternative in nächster Revision vereinbart." })).error).toBeNull();
    const saved = await client.from("client_plan_messages").select("status,response").eq("id", id).single();
    expect(saved.data?.status).toBe("resolved");
    expect(saved.data?.response).toContain("Revision");
  });

  test("validates draft, entry, ingredient and feedback boundaries", async () => {
    const client = await signedInClient(clientUser);
    for (const input of [
      { p_plan_id: draftPlanId, p_body: "Entwurf" },
      { p_plan_id: approvedPlanId, p_body: "" },
      { p_plan_id: approvedPlanId, p_body: "x".repeat(3001) },
      { p_plan_id: approvedPlanId, p_body: "Falsche Zeile", p_entry_id: crypto.randomUUID() },
      { p_plan_id: approvedPlanId, p_body: "Falsche Zutat", p_entry_id: approvedEntryId, p_ingredient_id: crypto.randomUUID() },
    ]) expect((await client.rpc("send_client_plan_message", input)).error).not.toBeNull();
    const result = await client.rpc("send_client_plan_message", { p_plan_id: approvedPlanId, p_body: "Das hat geklappt: Frühstück" });
    expect(result.error).toBeNull();
    const saved = await client.from("client_plan_messages").select("kind,body").eq("id", result.data).single();
    expect(saved.data).toEqual({ kind: "feedback", body: "Das hat geklappt: Frühstück" });
  });

  test("recipe ingredients are scoped to the actual recipe and snapshots survive changes", async () => {
    const client = await signedInClient(clientUser);
    const recipe = await admin.from("recipes").insert({ name: "Testgericht", user_id: counselor.id }).select("id").single();
    expect(recipe.error).toBeNull();
    recipeIds.push(recipe.data!.id);
      const ingredient = await admin.from("recipe_ingredients").insert({ recipe_id: recipe.data!.id, food_id: foodId, amount: 30 }).select("id").single();
      const entry = await admin.from("meal_entries").insert({ meal_plan_id: approvedPlanId, slot_type: "mittagessen", entry_type: "recipe", reference_id: recipe.data!.id, amount: 1 }).select("id").single();
      expect(entry.error).toBeNull();
      // Private ingredients remain visible by label only through the released plan.
      expect((await admin.from("foods").update({ is_custom: true, user_id: counselor.id }).eq("id", foodId)).error).toBeNull();
      const targets = await client.rpc("get_client_plan_targets", { p_plan_id: approvedPlanId });
      expect(targets.error).toBeNull();
      expect(targets.data.find((row: { entry_id: string }) => row.entry_id === entry.data!.id).ingredients).toEqual([{ id: ingredient.data!.id, name: "Plan-RLS Testfood" }]);
      await admin.from("foods").update({ is_custom: false, user_id: null }).eq("id", foodId);
      const input = { p_plan_id: approvedPlanId, p_body: "Mag ich nicht", p_entry_id: entry.data!.id, p_ingredient_id: ingredient.data!.id };
      const sent = await client.rpc("send_client_plan_message", input);
      expect(sent.error).toBeNull();
      expect((await client.rpc("send_client_plan_message", { ...input, p_ingredient_id: crypto.randomUUID() })).error).not.toBeNull();
      await admin.from("recipes").update({ name: "Neuer Rezeptname" }).eq("id", recipe.data!.id);
      const saved = await client.from("client_plan_messages").select("target_label").eq("id", sent.data).single();
      expect(saved.data?.target_label).toBe("Testgericht · Zutat: Plan-RLS Testfood");
      // Replaced releases retain request context; sending against them is forbidden.
      await admin.from("daily_meal_plans").update({ status: "archived", replaced_at: new Date().toISOString() }).eq("id", approvedPlanId);
      expect((await client.rpc("send_client_plan_message", input)).error).not.toBeNull();
      expect((await client.from("client_plan_messages").select("id").eq("id", sent.data)).data).toHaveLength(1);
      await admin.from("daily_meal_plans").update({ status: "approved", replaced_at: null }).eq("id", approvedPlanId);

  });

  test("client and counselor can send and answer through their real pages", async ({ browser }) => {
    test.setTimeout(180000);
    const baseURL = process.env.PLAN_MESSAGES_TEST_URL ?? "http://localhost:3000";
    async function openAs(user: TestUser, mode: string) {
      const cookies: { name: string; value: string }[] = [];
      const auth = createServerClient(supabaseUrl, anonKey, { cookies: {
        getAll: () => cookies,
        setAll: values => { cookies.splice(0, cookies.length, ...values); },
      } });
      expect((await auth.auth.signInWithPassword({ email: user.email, password: PASSWORD })).error).toBeNull();
      const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
      await context.addCookies([...cookies, { name: "prodi_mode", value: mode }].map(cookie => ({ ...cookie, url: baseURL })));
      return context;
    }
    const clientContext = await openAs(clientUser, "client");
    const counselorContext = await openAs(counselor, "counselor");
    try {
      const page = await clientContext.newPage();
      await page.goto("/klient/plan?datum=2026-08-05");
      await page.getByText("Alternative anfragen", { exact: true }).first().click();
      await page.getByRole("textbox", { name: "Grund für die Alternative (optional)" }).first().fill("Bitte eine alltagstaugliche Alternative");
      await page.getByRole("button", { name: "Anfrage senden", exact: true }).first().click();
      await expect(page.getByRole("button", { name: "Austausch angefragt", exact: true }).first()).toBeVisible();
      await page.getByLabel("Das war schwierig", { exact: true }).fill("Mittags fehlt Zeit zum Kochen");
      await page.getByRole("button", { name: "Feedback senden", exact: true }).click();
      await expect(page.getByText("Das war schwierig: Mittags fehlt Zeit zum Kochen", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText("Das war schwierig: Mittags fehlt Zeit zum Kochen", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const counselorPage = await counselorContext.newPage();
      await counselorPage.goto("/dashboard");
      await expect(counselorPage.getByText("Bitte eine alltagstaugliche Alternative", { exact: true })).toBeVisible();
      await counselorPage.getByRole("link", { name: /Ernährungspläne öffnen/ }).first().click();
      await expect(counselorPage.getByText("Das war schwierig: Mittags fehlt Zeit zum Kochen", { exact: true })).toBeVisible({ timeout: 60000 });
      const request = counselorPage.locator("div.space-y-2").filter({ has: counselorPage.getByText("Bitte eine alltagstaugliche Alternative", { exact: true }) }).last();
      await request.getByText("Antworten & abschließen", { exact: true }).click();
      await request.getByRole("textbox", { name: "Antwort der Beratung" }).fill("Wir haben eine schnelle Alternative vereinbart.");
      await request.getByRole("button", { name: "Antwort senden & abschließen" }).click();
      await expect(request.getByText("Wir haben eine schnelle Alternative vereinbart.", { exact: false })).toBeVisible();
      await page.reload();
      await page.getByText("Alternative anfragen", { exact: true }).first().click();
      await expect(page.getByText("Wir haben eine schnelle Alternative vereinbart.", { exact: false })).toBeVisible();
      await page.screenshot({ path: "/tmp/prodi-plan-messages-client.png", fullPage: true });
      expect((await admin.from("daily_meal_plans").update({ notes: "VERTRAULICHE INTERNE NOTIZ" }).eq("id", draftPlanId)).error).toBeNull();
      expect((await admin.from("meal_entries").insert({ meal_plan_id: draftPlanId, slot_type: "fruehstueck", entry_type: "food", reference_id: foodId, amount: 75 })).error).toBeNull();
      await counselorPage.goto(`/patienten/${patientId}?tab=ernaehrungsplan&planView=week&planDate=2026-08-06`);
      await counselorPage.getByRole("button", { name: "Woche prüfen & freigeben", exact: true }).click();
      const dialog = counselorPage.getByRole("dialog");
      await dialog.getByText("Vorschau aus Klientensicht", { exact: true }).click();
      await dialog.getByLabel("Tag auswählen").selectOption("2026-08-06");
      await expect(dialog.getByText("Plan-RLS Testfood", { exact: true })).toBeVisible();
      await expect(dialog.getByText("75 g", { exact: true })).toBeVisible();
      await expect(dialog.getByText("VERTRAULICHE INTERNE NOTIZ", { exact: true })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Gegessen", exact: true })).toHaveCount(0);
      await expect(dialog.getByText("Alternative anfragen", { exact: true })).toHaveCount(0);
      expect((await admin.from("daily_meal_plans").select("status").eq("id", draftPlanId).single()).data?.status).toBe("draft");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await dialog.getByText("75 g", { exact: true }).scrollIntoViewIfNeeded();
      await counselorPage.screenshot({ path: "/tmp/prodi-plan-messages-preview.png" });

    } finally { await clientContext.close(); await counselorContext.close(); }
  });

  test("withdrawn consent and revoked links remove read and write access for both roles", async () => {
    const client = await signedInClient(clientUser);
    const owner = await signedInClient(counselor);
    const { data: rows } = await owner.from("client_plan_messages").select("id");
    for (const change of [{ consent_nutrition: false }, { consent_nutrition: true, status: "revoked" }]) {
      expect((await admin.from("client_links").update(change).eq("id", linkId)).error).toBeNull();
      if (change.status === "revoked") expect((await client.rpc("get_client_plan_targets", { p_plan_id: approvedPlanId })).error).not.toBeNull();
      for (const actor of [client, owner]) expect((await actor.from("client_plan_messages").select("id")).data).toEqual([]);
      expect((await client.rpc("send_client_plan_message", { p_plan_id: approvedPlanId, p_body: "Nicht erlaubt" })).error).not.toBeNull();
      expect((await owner.rpc("resolve_client_plan_message", { p_id: rows![0].id, p_response: "Nicht erlaubt" })).error).not.toBeNull();
    }
  });
});
