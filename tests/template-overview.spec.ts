import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function testUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === "test@prodi.local");
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function createPatient(userId: string, lastName: string) {
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: "Vorlagen",
      last_name: lastName,
      date_of_birth: "1990-01-01",
      gender: "w",
      insurance_number: `TEMPLATE-${Math.random().toString(36).slice(2, 9)}`,
    })
    .select("id,first_name,last_name")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; first_name: string; last_name: string };
}

test.describe("Planvorlagen-Übersicht", () => {
  test.setTimeout(60_000);

  test("compares templates in place with a fair time basis and relative days", async ({ page }, testInfo) => {
    const userId = await testUserId();
    const suffix = Math.random().toString(36).slice(2, 9);
    let foodId: string | undefined;
    const names = [`Tagesvorlage ${suffix}`, `Wochenvorlage ${suffix}`, `Alternative Woche ${suffix}`];
    try {
      const { data: food, error: foodError } = await admin.from("foods")
        .insert({ name: `Vergleichsflocken ${suffix}`, data_source_id: "bls", source_food_id: `comparison-${suffix}` })
        .select("id").single();
      if (foodError) throw new Error(foodError.message);
      foodId = food.id;
      const { error: nutrientError } = await admin.from("food_nutrients").insert([
        { food_id: foodId, nutrient_id: "energie", amount: 200 },
        { food_id: foodId, nutrient_id: "eiweiss", amount: 10 },
      ]);
      if (nutrientError) throw new Error(nutrientError.message);
      const slots = (amount: number) => [{ type: "fruehstueck", entries: [{ id: `entry-${amount}`, type: "food", referenceId: foodId, amount }] }];
      const { error: templateError } = await admin.from("meal_plan_templates").insert([
        { user_id: userId, name: names[0], source_type: "personal", slots: slots(100) },
        { user_id: userId, name: names[1], source_type: "personal", slots: slots(200), day_blocks: [{ offsetDays: 0, slots: slots(200) }, { offsetDays: 6, slots: slots(200) }] },
        { user_id: userId, name: names[2], source_type: "personal", slots: slots(100), day_blocks: [{ offsetDays: 0, slots: slots(100) }, { offsetDays: 6, slots: slots(100) }] },
      ]);
      if (templateError) throw new Error(templateError.message);

      await page.goto("/ernaehrungsplan/bibliothek");
      const sidebar = page.locator("[data-slot='sidebar-container']");
      await expect(sidebar.getByRole("link", { name: "Austauschtabellen" })).toHaveAttribute("href", "/austauschtabellen");
      await expect(page.getByRole("link", { name: "Pläne vergleichen", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: `Vorlage ${names[0]} vergleichen`, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Zwei Pläne. Direkt nebeneinander." });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("combobox", { name: "Vorlage B" }).click();
      await expect(page.getByRole("option", { name: new RegExp(names[0]) })).toBeDisabled();
      await page.getByRole("option", { name: new RegExp(names[1]) }).click();
      await expect(dialog.getByText("Unterschiedliche Zeitspannen: 1 und 7 Tage.")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Gesamter Zeitraum" })).toBeDisabled();
      await expect(dialog.locator('[data-nutrient="energie"]')).toContainText("+200 kcal");
      await expect(dialog.locator('[data-nutrient="fett"]')).toContainText("Keine vollständigen Daten");
      await dialog.getByRole("combobox", { name: "Vergleichstag" }).click();
      await page.getByRole("option", { name: "Tag 7", exact: true }).click();
      await expect(dialog.getByText("Dieser Tag liegt außerhalb der Vorlage.")).toBeVisible();

      await dialog.getByRole("combobox", { name: "Vorlage A" }).click();
      await page.getByRole("option", { name: new RegExp(names[2]) }).click();
      await dialog.getByRole("button", { name: "Gesamter Zeitraum" }).click();
      await expect(dialog.locator('[data-nutrient="energie"]')).toContainText("+400 kcal");
      await dialog.screenshot({ path: testInfo.outputPath("template-comparison.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog.getByRole("combobox", { name: "Vorlage A" })).toBeVisible();
      const dialogBounds = await dialog.boundingBox();
      const pickerBounds = await dialog.getByRole("combobox", { name: "Vorlage A" }).boundingBox();
      expect(dialogBounds).not.toBeNull();
      expect(pickerBounds).not.toBeNull();
      expect(pickerBounds!.x + pickerBounds!.width).toBeLessThanOrEqual(dialogBounds!.x + dialogBounds!.width);
      await dialog.screenshot({ path: testInfo.outputPath("template-comparison-mobile.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(/\/ernaehrungsplan\/bibliothek$/);
    } finally {
      await admin.from("meal_plan_templates").delete().eq("user_id", userId).in("name", names);
      if (foodId) await admin.from("foods").delete().eq("id", foodId);
    }
  });

  test("persists newly created templates in the selected collection", async ({ page }) => {
    const userId = await testUserId();
    const suffix = Math.random().toString(36).slice(2, 9);
    const patient = await createPatient(userId, `Erstellen ${suffix}`);
    const templateNames = [`Neu allgemein ${suffix}`, `Neu Patient ${suffix}`];
    let foodId: string | undefined;

    try {
      const { data: food, error: foodError } = await admin.from("foods")
        .insert({ name: `Vorlagentest ${suffix}`, data_source_id: "bls", source_food_id: `template-overview-${suffix}` })
        .select("id").single();
      if (foodError) throw new Error(foodError.message);
      foodId = food.id;
      const { data: plan, error: planError } = await admin.from("daily_meal_plans")
        .insert({ user_id: userId, patient_id: patient.id, title: `Ausgangsplan ${suffix}`, date: "2040-02-03", status: "draft" })
        .select("id").single();
      if (planError) throw new Error(planError.message);
      const { error: entryError } = await admin.from("meal_entries").insert({
        meal_plan_id: plan.id, slot_type: "fruehstueck", entry_type: "food", reference_id: foodId, amount: 100, sort_order: 0,
      });
      if (entryError) throw new Error(entryError.message);

      for (const [index, scope] of ["general", "patient"].entries()) {
        // General must stay general even when retaining a planner's patient context.
        await page.goto(`/ernaehrungsplan/bibliothek?scope=${scope}&patientId=${patient.id}&returnDate=2040-02-03`);
        await page.getByRole("button", { name: "Vorlage erstellen" }).click();
        const dialog = page.getByRole("dialog", { name: "Vorlage erstellen" });
        await expect(dialog.getByRole("combobox", { name: "Geltungsbereich" })).toContainText(
          scope === "general" ? "Für alle meine Patienten" : "Nur für diesen Patienten",
        );
        await dialog.getByRole("combobox", { name: "Erster Planungstag" }).click();
        await page.getByRole("option", { name: new RegExp(`Ausgangsplan ${suffix}`) }).click();
        await dialog.getByLabel("Name", { exact: true }).fill(templateNames[index]);
        await dialog.getByRole("button", { name: "Vorlage speichern" }).click();
        await expect(dialog).not.toBeVisible();
        await expect.poll(async () => {
          const { data, error } = await admin.from("meal_plan_templates")
            .select("patient_id").eq("user_id", userId).eq("name", templateNames[index]).maybeSingle();
          if (error) throw new Error(error.message);
          return data;
        }).toEqual({ patient_id: scope === "general" ? null : patient.id });
        await page.reload();
        await expect(page.getByRole("link").filter({ has: page.getByText(templateNames[index], { exact: true }) })).toBeVisible();
      }
    } finally {
      await admin.from("meal_plan_templates").delete().eq("user_id", userId).in("name", templateNames);
      await admin.from("patients").delete().eq("id", patient.id);
      if (foodId) await admin.from("foods").delete().eq("id", foodId);
    }
  });

  test("keeps general and patient-specific scopes in URL context", async ({ page }, testInfo) => {
    const templateCard = (name: string) => page.getByRole("link").filter({ has: page.getByText(name, { exact: true }) });
    const userId = await testUserId();
    const suffix = Math.random().toString(36).slice(2, 9);
    const firstPatient = await createPatient(userId, `Auswahl A ${suffix}`);
    const secondPatient = await createPatient(userId, `Auswahl B ${suffix}`);
    const createdTemplateIds: string[] = [];

    try {
      const { data: templates, error } = await admin
        .from("meal_plan_templates")
        .insert([
          { user_id: userId, name: `Allgemein ${suffix}`, slots: [], source_type: "personal" },
          { user_id: userId, patient_id: firstPatient.id, name: `Patient A ${suffix}`, slots: [], source_type: "personal" },
          { user_id: userId, patient_id: secondPatient.id, name: `Patient B ${suffix}`, slots: [], source_type: "personal" },
        ])
        .select("id");
      if (error) throw new Error(error.message);
      createdTemplateIds.push(...(templates ?? []).map((template) => template.id as string));

      await page.goto("/dashboard");
      const sidebar = page.locator("[data-slot='sidebar-container']");
      const plansLink = sidebar.getByRole("link", { name: "Ernährungspläne" });
      await expect(plansLink).toHaveAttribute("href", "/ernaehrungsplan/bibliothek");
      await plansLink.click();
      await expect(page).toHaveURL(/\/ernaehrungsplan\/bibliothek$/);
      await expect(sidebar.getByRole("link", { name: "Ernährungspläne" })).toHaveAttribute("data-active", "true");

      await page.goto("/ernaehrungsplaene");
      await expect(page).toHaveURL(/\/ernaehrungsplan\/bibliothek$/);
      await expect(page.getByText("Allgemeine Vorlagen", { exact: false }).first()).toBeVisible();
      await expect(page.getByText("Patientenspezifische Vorlagen", { exact: false }).first()).toBeVisible();

      await page.getByRole("button", { name: /^Patientenspezifische Vorlagen/ }).click();
      await expect(page).toHaveURL(/scope=patient/);
      await expect(page.getByText("Wähle einen Patienten aus")).toBeVisible();
      await expect(page.getByRole("button", { name: "Vorlage erstellen" })).toBeDisabled();

      await page.getByRole("combobox", { name: "Patient" }).click();
      await page.getByRole("option", { name: `${firstPatient.last_name}, ${firstPatient.first_name}` }).click();
      await expect(page).toHaveURL(new RegExp(`scope=patient.*patientId=${firstPatient.id}`));
      await expect(templateCard(`Patient A ${suffix}`)).toBeVisible();
      await expect(templateCard(`Patient B ${suffix}`)).toHaveCount(0);
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`scope=patient.*patientId=${firstPatient.id}`));
      await expect(templateCard(`Patient A ${suffix}`)).toBeVisible();

      await page.getByRole("combobox", { name: "Patient" }).click();
      await page.getByRole("option", { name: `${secondPatient.last_name}, ${secondPatient.first_name}` }).click();
      await expect(templateCard(`Patient B ${suffix}`)).toBeVisible();
      await expect(templateCard(`Patient A ${suffix}`)).toHaveCount(0);

      await page.goto(`/ernaehrungsplan/bibliothek?scope=general&patientId=${firstPatient.id}&returnDate=2040-02-03`);
      await expect(templateCard(`Allgemein ${suffix}`)).toBeVisible();
      await expect(templateCard(`Patient A ${suffix}`)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("template-overview.png"), fullPage: true });
      await templateCard(`Allgemein ${suffix}`).click();
      await page.getByRole("link", { name: "Zu Planvorlagen" }).click();
      await expect(page).toHaveURL(new RegExp(`scope=general.*patientId=${firstPatient.id}.*returnDate=2040-02-03`));
    } finally {
      if (createdTemplateIds.length) {
        await admin.from("meal_plan_templates").delete().in("id", createdTemplateIds);
      }
      await admin.from("patients").delete().in("id", [firstPatient.id, secondPatient.id]);
    }
  });
});
