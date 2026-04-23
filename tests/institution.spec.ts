import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type InstitutionRecipeMap = {
  breakfastId: string;
  breakfastName: string;
  lunchSafeId: string;
  lunchSafeName: string;
  lunchBlockedId: string;
  lunchBlockedName: string;
};

type InstitutionFixture = {
  activeMenuId: string;
  activeMenuName: string;
  draftMenuName?: string;
  mariaName: string;
  annaName: string;
  station: string;
};

async function visitInstitutionPage(page: Page, path: string, heading: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
}

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function clearInstitutionData(userId: string) {
  await admin.from("meal_orders").delete().eq("user_id", userId);
  await admin.from("inpatient_stays").delete().eq("user_id", userId);
  await admin.from("institution_menus").delete().eq("user_id", userId);
}

async function clearInstitutionPatientsByPrefix(userId: string, prefix: string) {
  const { data: patients, error } = await admin
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .like("insurance_number", `${prefix}%`);

  if (error) throw new Error(error.message);

  const patientIds = (patients ?? []).map((patient) => patient.id as string);
  if (patientIds.length === 0) return;

  await admin.from("patient_allergens").delete().in("patient_id", patientIds);
  await admin.from("patients").delete().in("id", patientIds);
}

async function getInstitutionRecipes(): Promise<InstitutionRecipeMap> {
  const { data, error } = await admin
    .from("recipes")
    .select("id, name")
    .in("name", ["Haferbrei mit Beeren", "Linseneintopf", "Kartoffelsuppe"]);

  if (error) throw new Error(error.message);

  const rows = new Map((data ?? []).map((recipe) => [recipe.name as string, recipe.id as string]));
  const breakfastId = rows.get("Haferbrei mit Beeren");
  const lunchSafeId = rows.get("Linseneintopf");
  const lunchBlockedId = rows.get("Kartoffelsuppe");

  if (!breakfastId || !lunchSafeId || !lunchBlockedId) {
    throw new Error("Required seeded institution recipes are missing");
  }

  return {
    breakfastId,
    breakfastName: "Haferbrei mit Beeren",
    lunchSafeId,
    lunchSafeName: "Linseneintopf",
    lunchBlockedId,
    lunchBlockedName: "Kartoffelsuppe",
  };
}

async function createPatient(userId: string, input: {
  firstName: string;
  lastName: string;
  indication: string;
  insuranceNumber: string;
}) {
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: "1988-01-01",
      gender: "w",
      indication: input.indication,
      insurance_provider: "AOK Test",
      insurance_number: input.insuranceNumber,
    })
    .select("id, first_name, last_name")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string; first_name: string; last_name: string };
}

async function createInstitutionFixture(options: {
  includeDraftMenu?: boolean;
  includePendingOrder?: boolean;
} = {}): Promise<InstitutionFixture> {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const prefix = `INST-${suffix}`;

  await clearInstitutionData(userId);
  await clearInstitutionPatientsByPrefix(userId, prefix);

  const recipes = await getInstitutionRecipes();
  const maria = await createPatient(userId, {
    firstName: "Maria",
    lastName: `Schneider ${suffix}`,
    indication: "Adipositas",
    insuranceNumber: `${prefix}-MARIA`,
  });
  const anna = await createPatient(userId, {
    firstName: "Anna",
    lastName: `Müller ${suffix}`,
    indication: "Nahrungsmittelallergie",
    insuranceNumber: `${prefix}-ANNA`,
  });

  const activeMenuId = crypto.randomUUID();
  const activeMenuName = `Stationsplan ${suffix}`;
  const draftMenuName = `Entwurfsplan ${suffix}`;
  const serviceDate = "2026-04-06";
  const station = `Station ${suffix.toUpperCase()}`;

  const { error: menuError } = await admin.from("institution_menus").insert({
    id: activeMenuId,
    user_id: userId,
    name: activeMenuName,
    cycle_length: 1,
    start_date: serviceDate,
    diet_form_ids: ["diet_vollkost", "diet_diabetes"],
    status: "active",
  });
  if (menuError) throw new Error(menuError.message);

  const { error: slotError } = await admin.from("institution_menu_slots").insert([
    {
      menu_id: activeMenuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diet_vollkost",
      slot_type: "fruehstueck",
      recipe_id: recipes.breakfastId,
      portion_count: 12,
    },
    {
      menu_id: activeMenuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diet_diabetes",
      slot_type: "fruehstueck",
      recipe_id: recipes.breakfastId,
      portion_count: 8,
    },
    {
      menu_id: activeMenuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diet_vollkost",
      slot_type: "mittagessen",
      recipe_id: recipes.lunchBlockedId,
      portion_count: 16,
    },
    {
      menu_id: activeMenuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diet_diabetes",
      slot_type: "mittagessen",
      recipe_id: recipes.lunchSafeId,
      portion_count: 10,
    },
    {
      menu_id: activeMenuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diet_vollkost",
      slot_type: "abendessen",
      recipe_id: recipes.lunchSafeId,
      portion_count: 14,
    },
  ]);
  if (slotError) throw new Error(slotError.message);

  if (options.includeDraftMenu) {
    const { error: draftError } = await admin.from("institution_menus").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name: draftMenuName,
      cycle_length: 2,
      start_date: "2026-04-13",
      diet_form_ids: ["diet_vollkost"],
      status: "draft",
    });
    if (draftError) throw new Error(draftError.message);
  }

  const { data: stays, error: stayError } = await admin
    .from("inpatient_stays")
    .insert([
      {
        user_id: userId,
        patient_id: maria.id,
        station,
        room: "101",
        bed: "A",
        status: "active",
        admission_date: serviceDate,
        diet_form_ids: ["diet_vollkost"],
      },
      {
        user_id: userId,
        patient_id: anna.id,
        station,
        room: "101",
        bed: "B",
        status: "active",
        admission_date: serviceDate,
        diet_form_ids: ["diet_vollkost"],
      },
    ])
    .select("id, patient_id");
  if (stayError) throw new Error(stayError.message);

  const mariaStay = (stays ?? []).find((stay) => stay.patient_id === maria.id);
  if (!mariaStay) throw new Error("Maria stay not created");

  const { error: allergenError } = await admin.from("patient_allergens").insert({
    user_id: userId,
    patient_id: anna.id,
    allergen_id: "sellerie",
    type: "allergy",
    severity: "severe",
  });
  if (allergenError) throw new Error(allergenError.message);

  if (options.includePendingOrder) {
    const { error: orderError } = await admin.from("meal_orders").insert({
      user_id: userId,
      inpatient_stay_id: mariaStay.id,
      patient_id: maria.id,
      patient_name: `${maria.first_name} ${maria.last_name}`,
      station,
      room: "101",
      bed: "A",
      service_date: serviceDate,
      meal_slot: "mittagessen",
      recipe_id: recipes.lunchBlockedId,
      recipe_name: recipes.lunchBlockedName,
      diet_form_ids_snapshot: ["diet_vollkost"],
      allergen_ids_snapshot: [],
      restriction_summary: ["Vollkost"],
      status: "pending",
    });
    if (orderError) throw new Error(orderError.message);
  }

  return {
    activeMenuId,
    activeMenuName,
    draftMenuName: options.includeDraftMenu ? draftMenuName : undefined,
    mariaName: `${maria.first_name} ${maria.last_name}`,
    annaName: `${anna.first_name} ${anna.last_name}`,
    station,
  };
}

async function cleanupInstitutionFixture() {
  const userId = await getTestUserId();
  await clearInstitutionData(userId);
}

test.describe("Institution Features", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await cleanupInstitutionFixture();
  });

  test("shows an explicit empty state for menu planning without runtime mock data", async ({ page }) => {
    const userId = await getTestUserId();
    await clearInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    await expect(page.getByText("Noch keine Menüpläne vorhanden.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Neuer Menüplan/i })).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toHaveCount(0);
  });

  test("creates the first menu plan from the empty state", async ({ page }) => {
    const userId = await getTestUserId();
    await clearInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");
    await expect(page.getByText("Noch keine Menüpläne vorhanden.")).toBeVisible();

    await page.getByRole("button", { name: /Neuer Menüplan/i }).click();
    await page.getByLabel("Name").fill("Testplan Woche 42");
    await page.getByLabel("Zykluslänge").click();
    await page.getByRole("option", { name: "2 Wochen" }).click();
    await page.getByRole("button", { name: "Erstellen" }).click();

    await expect(page.getByText("Testplan Woche 42").first()).toBeVisible();
    await expect(page.getByText("2-Wochen-Zyklus").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /Wochenplan/i })).toBeVisible();
  });

  test("renders populated menu planning and production views from explicit fixtures", async ({ page }) => {
    const fixture = await createInstitutionFixture({ includeDraftMenu: true });

    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    await expect(page.getByText(fixture.activeMenuName).first()).toBeVisible();
    await expect(page.getByText(fixture.draftMenuName!)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Vollkost", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Diabeteskost" })).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    await page.getByRole("tab", { name: "Diabeteskost" }).click();
    await expect(page.getByText("Linseneintopf").first()).toBeVisible();

    await page.getByRole("tab", { name: /Produktion/i }).click();
    await expect(page.getByText(/Mo \(Tag 1\)/)).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    await page.getByRole("tab", { name: /Einkauf/i }).click();
    await expect(page.getByText(/Positionen/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /CSV exportieren/i })).toBeVisible();
  });

  test("shows empty analytics states when no institution data exists", async ({ page }) => {
    const userId = await getTestUserId();
    await clearInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/compliance", "Nährstoff-Compliance");
    await expect(page.getByText("Es gibt noch keinen aktiven Menüzyklus mit berechenbaren Nährstoffdaten.")).toBeVisible();

    await visitInstitutionPage(page, "/institution/statistiken", "Einrichtungsstatistiken");
    await expect(page.getByText("Es gibt noch keinen aktiven Menüzyklus für institutionelle Kennzahlen.")).toBeVisible();
  });

  test("renders compliance and statistics from real institution fixtures", async ({ page }) => {
    const fixture = await createInstitutionFixture({ includePendingOrder: true });

    await visitInstitutionPage(page, "/institution/compliance", "Nährstoff-Compliance");
    await expect(page.getByText(fixture.activeMenuName)).toBeVisible();
    await expect(page.getByText("Energie").first()).toBeVisible();
    await expect(page.getByText("Eiweiß").first()).toBeVisible();

    await visitInstitutionPage(page, "/institution/statistiken", "Einrichtungsstatistiken");
    await expect(page.getByText("Belegungsrate").first()).toBeVisible();
    await expect(page.getByText("Compliance-Rate").first()).toBeVisible();
    await page.getByRole("tab", { name: "Menüwahl" }).click();
    await expect(page.getByText("Auftragsstatus im Zyklus")).toBeVisible();
    await expect(page.getByText("Ausstehend").first()).toBeVisible();
  });

  test("shows empty hospital and production states without active institution data", async ({ page }) => {
    const userId = await getTestUserId();
    await clearInstitutionData(userId);

    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");
    await expect(page.getByText("Kein aktiver Menüplan verfügbar. Bitte zuerst einen Menüplan aktivieren.")).toBeVisible();
    await expect(page.getByText("Keine aktiven Belegungen für den aktuellen Filter.")).toBeVisible();

    await visitInstitutionPage(page, "/institution/produktion", "Produktionsmanagement");
    await expect(page.getByText("Kein aktiver Menüplan vorhanden. Erstellen und aktivieren Sie einen Menüplan unter Menüplanung.")).toBeVisible();
  });

  test("runs the hospital meal workflow from explicit fixtures", async ({ page }) => {
    const fixture = await createInstitutionFixture();

    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");

    const mariaCard = page.locator("[data-slot='card']").filter({ hasText: fixture.mariaName }).first();
    await expect(mariaCard).toBeVisible();
    await mariaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();

    await expect(page.getByRole("dialog")).toContainText("Sichere Menüauswahl");
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText("Sicher auswählbar")).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: /Kartoffelsuppe/i }).click();
    await page.getByLabel("Besondere Hinweise").fill("Bitte ohne Petersilie anrichten");
    await page.getByRole("button", { name: /Bestellung speichern/i }).click();

    await page.getByRole("tab", { name: /Bestellungen/i }).click();
    await expect(page.getByText(fixture.mariaName)).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();

    await page.getByRole("button", { name: /Bestätigen/i }).click();
    await expect(page.getByText("Bestätigt").first()).toBeVisible();

    await page.goto(`/institution/krankenhaus/tablettenkarten?date=2026-04-06&mealSlot=mittagessen&station=${encodeURIComponent(fixture.station)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Tablettenkarten" })).toBeVisible();
    await expect(page.getByText(fixture.mariaName)).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
  });

  test("blocks unsafe hospital meal options without falling back to canned recipes", async ({ page }) => {
    const fixture = await createInstitutionFixture();

    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");

    const annaCard = page.locator("[data-slot='card']").filter({ hasText: fixture.annaName }).first();
    await expect(annaCard).toBeVisible();
    await annaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();

    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText(/Allergenkonflikt: Sellerie/i)).toBeVisible();
    await expect(page.getByText("Geblockt").first()).toBeVisible();
    await page.getByRole("button", { name: /Abbrechen/i }).click();
  });
});
