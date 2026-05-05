import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadLocalEnv(path = ".env.local") {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const existingValue = process.env[key];
    if (existingValue !== undefined) continue;

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD;
const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

const DRY_RUN = process.argv.includes("--dry-run");
const REPORT_BUCKET = "patient-report-files";
const DEMO_TAG = "clinic-demo";
const TODAY = "2026-05-04";
const TOMORROW = "2026-05-05";
const PLAN_DATE_CANDIDATES = [
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-23",
  "2026-05-24",
];

type AnySupabaseClient = SupabaseClient<any, "public", any>;
type JsonRecord = Record<string, unknown>;

interface DemoUser {
  id: string;
  email: string;
}

interface DemoFood {
  id: string;
  name: string;
}

interface DemoRecipe {
  legacyId: string;
  name: string;
  description: string;
  category: string;
  allergens: string[];
  tags: string[];
  ingredients: Array<{ foodId: string; amount: number }>;
}

interface SeedContext {
  supabase: AnySupabaseClient;
  user: DemoUser;
  foods: DemoFood[];
  recipeIds: Map<string, string>;
  patientIds: Map<string, string>;
  protocolId?: string;
  reportId?: string;
  reportVersionId?: string;
  menuId?: string;
  planDate?: string;
}

const patientLegacyIds = ["clinic-demo-maria", "clinic-demo-anna"];
const recipeLegacyIds = [
  "clinic-demo-haferbrei",
  "clinic-demo-linseneintopf",
  "clinic-demo-kartoffelsuppe",
];
const mealPlanLegacyId = "clinic-demo-plan-maria";
const menuName = "Klinik-Demo Stationsplan";

function requireEnv() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required. Use the Supabase service-role key; anon keys cannot seed protected demo data.",
    );
  }
  if (!DEMO_USER_EMAIL) {
    throw new Error(
      "DEMO_USER_EMAIL is required, for example `DEMO_USER_EMAIL=demo@example.com npm run seed:clinic-demo`.",
    );
  }
}

function assertNoError(error: { message: string } | null | undefined, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

function assertRow<T>(row: T | null, action: string): T {
  if (!row) {
    throw new Error(`${action}: Supabase returned no row.`);
  }
  return row;
}

async function findUserByEmail(supabase: AnySupabaseClient, email: string): Promise<DemoUser | null> {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    assertNoError(error, "Failed to list Supabase auth users");

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user?.email) {
      return { id: user.id, email: user.email };
    }

    if (data.users.length < perPage) {
      return null;
    }
    page += 1;
  }
}

async function getOrCreateDemoUser(supabase: AnySupabaseClient): Promise<DemoUser> {
  if (!DEMO_USER_EMAIL) {
    throw new Error("DEMO_USER_EMAIL is required.");
  }

  const existing = await findUserByEmail(supabase, DEMO_USER_EMAIL);
  if (existing) {
    return existing;
  }

  if (!DEMO_USER_PASSWORD) {
    throw new Error(
      `No auth user exists for ${DEMO_USER_EMAIL}. Set DEMO_USER_PASSWORD to create a confirmed demo user.`,
    );
  }

  if (DRY_RUN) {
    return { id: "dry-run-user-id", email: DEMO_USER_EMAIL };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "Klinik Demo",
      demoWorkspace: DEMO_TAG,
    },
  });
  assertNoError(error, `Failed to create demo user ${DEMO_USER_EMAIL}`);

  if (!data.user?.email) {
    throw new Error(`Supabase did not return the created user for ${DEMO_USER_EMAIL}.`);
  }

  return { id: data.user.id, email: data.user.email };
}

async function fetchDemoFoods(supabase: AnySupabaseClient): Promise<DemoFood[]> {
  const { data, error } = await supabase
    .from("foods")
    .select("id,name")
    .order("name", { ascending: true })
    .limit(4);
  assertNoError(error, "Failed to fetch foods for demo recipe ingredients");

  const foods = (data ?? []).filter((row) => row.id && row.name) as DemoFood[];
  if (foods.length === 0) {
    throw new Error("No foods found. Run a food ETL, such as `npm run etl:bls`, before seeding the clinic demo.");
  }

  return foods;
}

async function ensureOrganization(ctx: SeedContext): Promise<string> {
  const { supabase, user } = ctx;
  const { data: existingMembership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  assertNoError(membershipError, "Failed to check demo organization membership");

  if (existingMembership?.organization_id) {
    return existingMembership.organization_id;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: "Klinik-Demo Organisation",
      created_by: user.id,
    })
    .select("id")
    .single();
  assertNoError(organizationError, "Failed to create demo organization");

  const organizationId = assertRow(organization, "Failed to create demo organization").id as string;
  const { error: insertMembershipError } = await supabase.from("organization_memberships").insert({
    organization_id: organizationId,
    user_id: user.id,
    email: user.email,
    display_name: "Klinik Demo",
    role: "owner",
    status: "active",
    joined_at: new Date().toISOString(),
  });
  assertNoError(insertMembershipError, "Failed to create demo organization membership");

  return organizationId;
}

async function deletePatientReports(ctx: SeedContext, patientRefs: string[]) {
  if (patientRefs.length === 0) return;

  const { data: reports, error: reportLookupError } = await ctx.supabase
    .from("patient_reports")
    .select("id")
    .eq("user_id", ctx.user.id)
    .in("patient_ref", patientRefs);
  assertNoError(reportLookupError, "Failed to look up previous demo reports");

  const reportIds = (reports ?? []).map((report) => report.id as string);
  if (reportIds.length === 0) return;

  const { data: versions, error: versionLookupError } = await ctx.supabase
    .from("patient_report_versions")
    .select("storage_path")
    .in("patient_report_id", reportIds);
  assertNoError(versionLookupError, "Failed to look up previous demo report files");

  const storagePaths = (versions ?? [])
    .map((version) => version.storage_path as string | null)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length > 0) {
    const { error: removeError } = await ctx.supabase.storage.from(REPORT_BUCKET).remove(storagePaths);
    assertNoError(removeError, "Failed to remove previous demo report files");
  }

  const { error: clearLatestError } = await ctx.supabase
    .from("patient_reports")
    .update({ latest_version_id: null, latest_version_number: 0 })
    .in("id", reportIds);
  assertNoError(clearLatestError, "Failed to clear previous demo report latest-version pointers");

  const { error: deleteReportsError } = await ctx.supabase
    .from("patient_reports")
    .delete()
    .in("id", reportIds);
  assertNoError(deleteReportsError, "Failed to delete previous demo report rows");
}

async function cleanupDemoWorkspace(ctx: SeedContext) {
  const { supabase, user } = ctx;

  const { data: oldPatients, error: patientLookupError } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", user.id)
    .in("legacy_id", patientLegacyIds);
  assertNoError(patientLookupError, "Failed to look up previous demo patients");

  const oldPatientIds = (oldPatients ?? []).map((patient) => patient.id as string);
  await deletePatientReports(ctx, oldPatientIds);

  const { error: exportDeleteError } = await supabase
    .from("export_jobs")
    .delete()
    .eq("user_id", user.id)
    .contains("parameters", { demoWorkspace: DEMO_TAG });
  assertNoError(exportDeleteError, "Failed to delete previous demo export jobs");

  const { error: appointmentDeleteError } = await supabase
    .from("appointments")
    .delete()
    .eq("user_id", user.id)
    .eq("legacy_id", "clinic-demo-appointment-maria");
  assertNoError(appointmentDeleteError, "Failed to delete previous demo appointment");

  const { error: protocolDeleteError } = await supabase
    .from("nutrition_protocols")
    .delete()
    .eq("user_id", user.id)
    .eq("legacy_id", "clinic-demo-protocol-maria");
  assertNoError(protocolDeleteError, "Failed to delete previous demo protocol");

  const { data: oldMenus, error: menuLookupError } = await supabase
    .from("institution_menus")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", menuName);
  assertNoError(menuLookupError, "Failed to look up previous demo menus");

  const oldMenuIds = (oldMenus ?? []).map((menu) => menu.id as string);
  if (oldMenuIds.length > 0) {
    const { error: menuDeleteError } = await supabase
      .from("institution_menus")
      .delete()
      .in("id", oldMenuIds);
    assertNoError(menuDeleteError, "Failed to delete previous demo menus");
  }

  const { error: mealPlanDeleteError } = await supabase
    .from("daily_meal_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("legacy_id", mealPlanLegacyId);
  assertNoError(mealPlanDeleteError, "Failed to delete previous demo meal plan");

  if (oldPatientIds.length > 0) {
    const { error: patientDeleteError } = await supabase
      .from("patients")
      .delete()
      .in("id", oldPatientIds);
    assertNoError(patientDeleteError, "Failed to delete previous demo patients");
  }

  const { error: recipeDeleteError } = await supabase
    .from("recipes")
    .delete()
    .eq("user_id", user.id)
    .in("legacy_id", recipeLegacyIds);
  assertNoError(recipeDeleteError, "Failed to delete previous demo recipes");

  const { error: auditDeleteError } = await supabase
    .from("access_audit_logs")
    .delete()
    .eq("actor_user_id", user.id)
    .contains("metadata", { demoWorkspace: DEMO_TAG });
  assertNoError(auditDeleteError, "Failed to delete previous demo audit rows");
}

async function resolveDemoPlanDate(ctx: SeedContext): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("daily_meal_plans")
    .select("date,legacy_id")
    .eq("user_id", ctx.user.id)
    .in("date", PLAN_DATE_CANDIDATES);
  assertNoError(error, "Failed to inspect existing meal plan dates");

  const occupiedDates = new Set(
    (data ?? [])
      .filter((row) => row.legacy_id !== mealPlanLegacyId)
      .map((row) => row.date as string),
  );

  const planDate = PLAN_DATE_CANDIDATES.find((date) => !occupiedDates.has(date));
  if (!planDate) {
    throw new Error(
      `No free demo meal-plan date found in ${PLAN_DATE_CANDIDATES.join(", ")}. Move one existing plan or extend PLAN_DATE_CANDIDATES.`,
    );
  }

  return planDate;
}

async function upsertRecipes(ctx: SeedContext) {
  const [primaryFood, secondFood, thirdFood] = ctx.foods;
  const fallbackFood = primaryFood;
  const recipes: DemoRecipe[] = [
    {
      legacyId: "clinic-demo-haferbrei",
      name: "Klinik-Demo Haferbrei mit Beeren",
      description: "Fruehstueck fuer die digitale Protokoll- und Beratungsstrecke.",
      category: "Fruehstueck",
      allergens: ["gluten"],
      tags: ["clinic-demo", "milde Kost"],
      ingredients: [
        { foodId: primaryFood.id, amount: 80 },
        { foodId: secondFood?.id ?? fallbackFood.id, amount: 120 },
      ],
    },
    {
      legacyId: "clinic-demo-linseneintopf",
      name: "Klinik-Demo Linseneintopf",
      description: "Eiweissreicher Mittagsbaustein fuer Report und sichere Bestellung.",
      category: "Mittagessen",
      allergens: [],
      tags: ["clinic-demo", "vollwertig"],
      ingredients: [
        { foodId: secondFood?.id ?? fallbackFood.id, amount: 180 },
        { foodId: thirdFood?.id ?? fallbackFood.id, amount: 90 },
      ],
    },
    {
      legacyId: "clinic-demo-kartoffelsuppe",
      name: "Klinik-Demo Kartoffelsuppe mit Sellerie",
      description: "Absichtlich blockierbares Gericht fuer den Allergen-Override im Kuechenworkflow.",
      category: "Mittagessen",
      allergens: ["sellerie"],
      tags: ["clinic-demo", "station"],
      ingredients: [
        { foodId: thirdFood?.id ?? fallbackFood.id, amount: 220 },
        { foodId: primaryFood.id, amount: 60 },
      ],
    },
  ];

  const recipeRows = recipes.map((recipe) => ({
    legacy_id: recipe.legacyId,
    user_id: ctx.user.id,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    servings: 1,
    prep_time: 15,
    cook_time: 25,
    instructions: ["Zutaten vorbereiten", "Schonend garen", "Portionieren und dokumentieren"],
    allergens: recipe.allergens,
    additives: [],
    tags: recipe.tags,
    source_type: "institution",
    teaching_kitchen_notes: "Demo-Rezept fuer Klinikverkauf und Schulung.",
  }));

  const { error: recipeError } = await ctx.supabase
    .from("recipes")
    .upsert(recipeRows, { onConflict: "legacy_id" });
  assertNoError(recipeError, "Failed to upsert demo recipes");

  const { data: insertedRecipes, error: recipeIdError } = await ctx.supabase
    .from("recipes")
    .select("id,legacy_id")
    .in("legacy_id", recipeLegacyIds);
  assertNoError(recipeIdError, "Failed to fetch demo recipe IDs");

  ctx.recipeIds = new Map(
    (insertedRecipes ?? []).map((recipe) => [recipe.legacy_id as string, recipe.id as string]),
  );

  const recipeIds = Array.from(ctx.recipeIds.values());
  const { error: clearIngredientsError } = await ctx.supabase
    .from("recipe_ingredients")
    .delete()
    .in("recipe_id", recipeIds);
  assertNoError(clearIngredientsError, "Failed to clear demo recipe ingredients");

  const ingredientRows = recipes.flatMap((recipe) => {
    const recipeId = ctx.recipeIds.get(recipe.legacyId);
    if (!recipeId) return [];
    return recipe.ingredients.map((ingredient, index) => ({
      recipe_id: recipeId,
      food_id: ingredient.foodId,
      amount: ingredient.amount,
      sort_order: index,
    }));
  });

  const { error: ingredientError } = await ctx.supabase.from("recipe_ingredients").insert(ingredientRows);
  assertNoError(ingredientError, "Failed to insert demo recipe ingredients");
}

async function seedPatients(ctx: SeedContext) {
  const rows = [
    {
      legacy_id: "clinic-demo-maria",
      user_id: ctx.user.id,
      first_name: "Maria",
      last_name: "Schneider",
      date_of_birth: "1968-03-12",
      gender: "w",
      email: "maria.schneider@example.invalid",
      phone: "+49 221 5550101",
      street: "Klinikallee 12",
      zip: "50667",
      city: "Koeln",
      insurance_provider: "AOK Rheinland",
      insurance_number: "DEMO-112233",
      indication: "Diabetes mellitus Typ 2, Adipositas, stationaere Ernaehrungstherapie",
      notes: "Demo-Hauptpatientin fuer Intake, Beratung, Bericht und Stationsbestellung.",
      amputations: [],
    },
    {
      legacy_id: "clinic-demo-anna",
      user_id: ctx.user.id,
      first_name: "Anna",
      last_name: "Mueller",
      date_of_birth: "1949-11-02",
      gender: "w",
      email: "anna.mueller@example.invalid",
      phone: "+49 221 5550102",
      street: "Stationsweg 8",
      zip: "50668",
      city: "Koeln",
      insurance_provider: "TK",
      insurance_number: "DEMO-445566",
      indication: "Mangelernaehrungsrisiko, Sellerieallergie",
      notes: "Demo-Patientin fuer Allergenblockade und Override-Dokumentation.",
      amputations: [],
    },
  ];

  const { error } = await ctx.supabase.from("patients").upsert(rows, { onConflict: "legacy_id" });
  assertNoError(error, "Failed to upsert demo patients");

  const { data, error: patientIdError } = await ctx.supabase
    .from("patients")
    .select("id,legacy_id")
    .in("legacy_id", patientLegacyIds);
  assertNoError(patientIdError, "Failed to fetch demo patient IDs");

  ctx.patientIds = new Map((data ?? []).map((patient) => [patient.legacy_id as string, patient.id as string]));

  const mariaId = ctx.patientIds.get("clinic-demo-maria");
  const annaId = ctx.patientIds.get("clinic-demo-anna");
  if (!mariaId || !annaId) {
    throw new Error("Demo patient ID lookup incomplete.");
  }

  const { error: anthropometricsError } = await ctx.supabase.from("patient_anthropometrics").insert([
    {
      patient_id: mariaId,
      user_id: ctx.user.id,
      date: TODAY,
      weight: 92,
      height: 168,
      bmi: 32.6,
      waist_circumference: 108,
      notes: "Aufnahmegewicht fuer Demo-Bericht.",
    },
    {
      patient_id: annaId,
      user_id: ctx.user.id,
      date: TODAY,
      weight: 54,
      height: 162,
      bmi: 20.6,
      notes: "Mangelernaehrungsrisiko im Stationskontext.",
    },
  ]);
  assertNoError(anthropometricsError, "Failed to insert demo anthropometrics");

  const { error: screeningError } = await ctx.supabase.from("patient_screenings").insert([
    {
      patient_id: mariaId,
      user_id: ctx.user.id,
      tool: "NRS-2002",
      score: 3,
      risk_level: "medium",
      answers: [
        { item: "BMI/Verlauf", value: "auffaellig" },
        { item: "Erkrankungsschwere", value: "moderat" },
      ],
    },
    {
      patient_id: annaId,
      user_id: ctx.user.id,
      tool: "MNA",
      score: 10,
      risk_level: "high",
      answers: [{ item: "Appetit", value: "reduziert" }],
    },
  ]);
  assertNoError(screeningError, "Failed to insert demo screenings");

  const { error: allergenError } = await ctx.supabase.from("patient_allergens").upsert(
    {
      patient_id: annaId,
      user_id: ctx.user.id,
      allergen_id: "sellerie",
      type: "allergy",
      severity: "severe",
      diagnosed_date: "2025-10-12",
      notes: "Demo-Allergie fuer blockierte Stationsbestellung.",
    },
    { onConflict: "patient_id,user_id,allergen_id" },
  );
  assertNoError(allergenError, "Failed to insert demo allergen");
}

async function seedDigitalProtocol(ctx: SeedContext) {
  const mariaId = ctx.patientIds.get("clinic-demo-maria");
  const food = ctx.foods[0];
  if (!mariaId || !food) throw new Error("Digital protocol demo prerequisites missing.");

  const { data: link, error: linkError } = await ctx.supabase
    .from("patient_digital_protocol_links")
    .insert({
      patient_id: mariaId,
      user_id: ctx.user.id,
      method: "email",
      status: "received",
      url: `${APP_URL.replace(/\/$/, "")}/protokoll/clinic-demo-maria`,
      qr_code: "clinic-demo-qr",
      expires_at: "2026-06-04",
    })
    .select("id")
    .single();
  assertNoError(linkError, "Failed to insert demo digital protocol link");

  const { data: protocol, error: protocolError } = await ctx.supabase
    .from("nutrition_protocols")
    .insert({
      legacy_id: "clinic-demo-protocol-maria",
      user_id: ctx.user.id,
      patient_id: mariaId,
      title: "Klinik-Demo digitales 3-Tage-Protokoll",
      type: "ernaehrungsprotokoll",
      start_date: "2026-05-01",
      end_date: "2026-05-03",
      notes: "Aus digitaler Patienteneingabe konvertiert; Smart-Match Hinweise bleiben nachvollziehbar.",
      metadata: {
        demoWorkspace: DEMO_TAG,
        source: "digital_protocol_submission",
        unresolvedEntries: ["handvoll Beeren"],
      },
    })
    .select("id")
    .single();
  assertNoError(protocolError, "Failed to insert demo nutrition protocol");
  ctx.protocolId = assertRow(protocol, "Failed to insert demo nutrition protocol").id as string;

  const { error: entryError } = await ctx.supabase.from("nutrition_protocol_entries").insert([
    {
      protocol_id: ctx.protocolId,
      protocol_date: "2026-05-01",
      food_id: food.id,
      amount: 180,
      meal_slot: "fruehstueck",
      entry_time: "08:10",
      notes: "Patientinnenangabe: Haferbrei, Match auf Datenbanklebensmittel.",
      measurement_mode: "grams",
      sort_order: 0,
    },
  ]);
  assertNoError(entryError, "Failed to insert demo protocol entries");

  const { data: submission, error: submissionError } = await ctx.supabase
    .from("digital_protocol_submissions")
    .insert({
      link_id: assertRow(link, "Failed to insert demo digital protocol link").id,
      patient_id: mariaId,
      submitted_at: "2026-05-03T17:30:00+02:00",
      days: [
        {
          date: "2026-05-01",
          meals: [
            { slot: "fruehstueck", time: "08:10", text: "Haferbrei mit Beeren", amount: "1 Schale" },
            { slot: "mittagessen", time: "12:20", text: "Linseneintopf", amount: "1 Teller" },
          ],
        },
      ],
      notes: "Wenig Appetit am Abend, Getraenke unvollstaendig.",
      status: "converted",
      converted_protocol_id: ctx.protocolId,
    })
    .select("id")
    .single();
  assertNoError(submissionError, "Failed to insert demo digital protocol submission");

  const submissionId = assertRow(submission, "Failed to insert demo digital protocol submission").id as string;
  const linkId = assertRow(link, "Failed to insert demo digital protocol link").id as string;

  await insertAudit(ctx, "digital_protocol_submission_received", "digital_protocol_submission", submissionId, {
    patientId: mariaId,
    linkId,
  });
  await insertAudit(ctx, "digital_protocol_submission_converted", "nutrition_protocol", ctx.protocolId, {
    patientId: mariaId,
    submissionId,
  });
}

async function seedCounselingAndReport(ctx: SeedContext) {
  const mariaId = ctx.patientIds.get("clinic-demo-maria");
  const haferbreiId = ctx.recipeIds.get("clinic-demo-haferbrei");
  const linsenId = ctx.recipeIds.get("clinic-demo-linseneintopf");
  if (!mariaId || !haferbreiId || !linsenId || !ctx.protocolId) {
    throw new Error("Counseling/report demo prerequisites missing.");
  }

  const { error: sessionError } = await ctx.supabase.from("counseling_sessions").insert({
    legacy_id: "clinic-demo-counseling-maria",
    user_id: ctx.user.id,
    patient_id: mariaId,
    session_date: TODAY,
    duration_minutes: 45,
    session_type: "Erstberatung stationaer",
    indication: "Diabetes mellitus Typ 2, Gewichtsreduktion, OP-Vorbereitung",
    goals: "Stabile Kohlenhydratverteilung, eiweissreiches Mittagessen, sichere Stationskost.",
    content: "Digitales Protokoll besprochen, Portionsgroessen korrigiert, Stationsmenue abgestimmt.",
    recommendations: "Fruehstueck mit Eiweisskomponente, Mittagessen Vollkost diabetesgeeignet, Verlaufskontrolle.",
    next_appointment: "2026-05-11",
    timeline: [
      { date: TODAY, label: "Digitales Protokoll konvertiert" },
      { date: "2026-05-11", label: "Follow-up geplant" },
    ],
    materials: [{ title: "Patientenhandout Diabetes und Eiweiss", type: "handout" }],
    progress: [{ label: "Verstaendnis", value: "gut" }],
  });
  assertNoError(sessionError, "Failed to insert demo counseling session");

  const { error: appointmentError } = await ctx.supabase.from("appointments").insert({
    legacy_id: "clinic-demo-appointment-maria",
    user_id: ctx.user.id,
    title: "Follow-up Maria Schneider",
    date: "2026-05-11",
    start_time: "10:00",
    end_time: "10:30",
    patient_id: mariaId,
    location: "Station A3",
    type: "beratung",
    recurring: "none",
    reminder: "1 Tag vorher",
  });
  assertNoError(appointmentError, "Failed to insert demo appointment");

  const { data: plan, error: planError } = await ctx.supabase
    .from("daily_meal_plans")
    .insert({
      legacy_id: mealPlanLegacyId,
      user_id: ctx.user.id,
      date: ctx.planDate ?? TODAY,
    })
    .select("id")
    .single();
  assertNoError(planError, "Failed to insert demo daily meal plan");

  const planId = assertRow(plan, "Failed to insert demo daily meal plan").id as string;
  const { error: entriesError } = await ctx.supabase.from("meal_entries").insert([
    {
      meal_plan_id: planId,
      slot_type: "fruehstueck",
      entry_type: "recipe",
      reference_id: haferbreiId,
      amount: 1,
      sort_order: 0,
    },
    {
      meal_plan_id: planId,
      slot_type: "mittagessen",
      entry_type: "recipe",
      reference_id: linsenId,
      amount: 1,
      sort_order: 0,
    },
  ]);
  assertNoError(entriesError, "Failed to insert demo meal plan entries");

  await seedArchivedReport(ctx, mariaId, planId);
}

function buildReportSnapshot(
  mariaId: string,
  planId: string,
  protocolId: string,
  planDate: string,
): JsonRecord {
  const planDateLabel = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${planDate}T00:00:00Z`));

  return {
    format: "PDF",
    title: "Klinik-Demo Ernaehrungsbericht Maria Schneider",
    fileBaseName: "klinik-demo-ernaehrungsbericht-maria-schneider",
    patientId: mariaId,
    patientName: "Maria Schneider",
    patientIndication: "Diabetes mellitus Typ 2, Adipositas, stationaere Ernaehrungstherapie",
    planId,
    protocolId,
    planDateLabel,
    reportLength: "full",
    selectedSections: {
      summary: true,
      table: true,
      charts: true,
      meals: true,
      notes: true,
      lmiv: true,
    },
    activeSectionLabels: ["Zusammenfassung", "Naehrstofftabelle", "Mahlzeiten", "LMIV", "Hinweise"],
    summaryMetrics: [
      { label: "Energie", value: "1.720 kcal", reference: "1.650-1.850 kcal", coverage: "im Ziel" },
      { label: "Eiweiss", value: "82 g", reference: ">= 75 g", coverage: "109%" },
      { label: "Kohlenhydrate", value: "188 g", reference: "gleichmaessig verteilt", coverage: "geeignet" },
    ],
    nutrientRows: [
      { label: "Energie", value: "1.720 kcal", reference: "1.650-1.850 kcal", coverage: "im Ziel" },
      { label: "Eiweiss", value: "82 g", reference: ">= 75 g", coverage: "109%" },
      { label: "Fett", value: "58 g", reference: "50-70 g", coverage: "im Ziel" },
    ],
    vitaminRows: [{ label: "Vitamin D", value: "8 ug", reference: "20 ug", coverage: "niedrig" }],
    mineralRows: [{ label: "Calcium", value: "940 mg", reference: "1.000 mg", coverage: "94%" }],
    mealRows: [
      { slot: "Fruehstueck", summary: "Haferbrei mit Beeren, stabile KH-Portion." },
      { slot: "Mittagessen", summary: "Linseneintopf als eiweissreicher Stationsbaustein." },
    ],
    notes:
      "Demo-Bericht aus digitalem Protokoll und Beratungsziel. Archiviert mit privater Storage-Datei und Exportjournal.",
    narrative:
      "Die Patientin profitiert von regelmaessiger KH-Verteilung, eiweissreicher Mittagskomponente und dokumentierter Kuechenuebergabe.",
    badges: ["Patientengebunden", "Archiviert", "Station"],
    specialNotes: ["Follow-up am 11.05.2026", "Kuechenuebergabe fuer Station A3 vorbereitet"],
    lmivRows: [
      { label: "Energie", value: "620 kcal", reference: "pro Mittagessen" },
      { label: "Eiweiss", value: "31 g", reference: "pro Mittagessen" },
    ],
    allergenDeclaration: ["gluten"],
    additiveDeclaration: [],
    retentionPolicyLabel: "Klinik-Demo Archivierung: 10 Jahre",
    documentPackLabel: "Ernaehrungsbericht Klinik",
  };
}

async function seedArchivedReport(ctx: SeedContext, mariaId: string, planId: string) {
  if (!ctx.protocolId) throw new Error("Report protocol ID missing.");

  const snapshot = buildReportSnapshot(mariaId, planId, ctx.protocolId, ctx.planDate ?? TODAY);
  const fileName = "klinik-demo-ernaehrungsbericht-maria-schneider.pdf";
  const pdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 86 >>\nstream\nBT /F1 12 Tf 72 720 Td (Klinik-Demo Ernaehrungsbericht Maria Schneider) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000203 00000 n \ntrailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n339\n%%EOF\n",
    "utf8",
  );
  const storagePath = `${ctx.user.id}/${mariaId}/clinic-demo-report/${fileName}`;

  await ctx.supabase.storage.createBucket(REPORT_BUCKET, {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ["application/pdf", "text/csv", "text/csv;charset=utf-8"],
  });
  await ctx.supabase.storage.from(REPORT_BUCKET).remove([storagePath]);
  const { error: uploadError } = await ctx.supabase.storage
    .from(REPORT_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  assertNoError(uploadError, "Failed to upload demo report file");

  const { data: report, error: reportError } = await ctx.supabase
    .from("patient_reports")
    .insert({
      user_id: ctx.user.id,
      patient_ref: mariaId,
      patient_name: "Maria Schneider",
      patient_indication: "Diabetes mellitus Typ 2, Adipositas, stationaere Ernaehrungstherapie",
      title: snapshot.title,
      plan_id: planId,
      protocol_id: ctx.protocolId,
      plan_date_label: snapshot.planDateLabel,
      report_length: snapshot.reportLength,
      selected_sections: snapshot.selectedSections,
      active_section_labels: snapshot.activeSectionLabels,
      notes: snapshot.notes,
      last_format: "PDF",
      last_file_name: fileName,
      latest_version_number: 0,
      retention_until: "2036-05-04",
      retention_status: "active",
      retention_notes: snapshot.retentionPolicyLabel,
    })
    .select("id")
    .single();
  assertNoError(reportError, "Failed to insert demo patient report");
  ctx.reportId = assertRow(report, "Failed to insert demo patient report").id as string;

  const { data: version, error: versionError } = await ctx.supabase
    .from("patient_report_versions")
    .insert({
      patient_report_id: ctx.reportId,
      user_id: ctx.user.id,
      patient_ref: mariaId,
      patient_name: "Maria Schneider",
      patient_indication: "Diabetes mellitus Typ 2, Adipositas, stationaere Ernaehrungstherapie",
      title: snapshot.title,
      plan_id: planId,
      protocol_id: ctx.protocolId,
      version_number: 1,
      format: "PDF",
      file_name: fileName,
      file_size: pdfBuffer.length,
      content_type: "application/pdf",
      storage_bucket: REPORT_BUCKET,
      storage_path: storagePath,
      snapshot,
      retention_until: "2036-05-04",
      retention_status: "active",
      retention_notes: snapshot.retentionPolicyLabel,
    })
    .select("id")
    .single();
  assertNoError(versionError, "Failed to insert demo patient report version");
  ctx.reportVersionId = assertRow(version, "Failed to insert demo patient report version").id as string;

  const { error: reportUpdateError } = await ctx.supabase
    .from("patient_reports")
    .update({
      latest_version_id: ctx.reportVersionId,
      latest_version_number: 1,
    })
    .eq("id", ctx.reportId);
  assertNoError(reportUpdateError, "Failed to update demo report latest version");

  const { error: exportError } = await ctx.supabase.from("export_jobs").insert({
    user_id: ctx.user.id,
    type: "export",
    format: "PDF",
    scope: "Berichte",
    status: "abgeschlossen",
    file_size: `${Math.ceil(pdfBuffer.length / 1024)} KB`,
    created_by: ctx.user.email,
    file_name: fileName,
    parameters: {
      demoWorkspace: DEMO_TAG,
      patientId: mariaId,
      reportId: ctx.reportId,
      reportVersionId: ctx.reportVersionId,
    },
  });
  assertNoError(exportError, "Failed to insert demo report export job");

  await insertAudit(ctx, "report_export_created", "patient_report_version", ctx.reportVersionId, {
    patientId: mariaId,
    reportId: ctx.reportId,
    format: "PDF",
  });
}

async function seedInstitutionWorkflow(ctx: SeedContext) {
  const mariaId = ctx.patientIds.get("clinic-demo-maria");
  const annaId = ctx.patientIds.get("clinic-demo-anna");
  const haferbreiId = ctx.recipeIds.get("clinic-demo-haferbrei");
  const linsenId = ctx.recipeIds.get("clinic-demo-linseneintopf");
  const kartoffelId = ctx.recipeIds.get("clinic-demo-kartoffelsuppe");
  if (!mariaId || !annaId || !haferbreiId || !linsenId || !kartoffelId) {
    throw new Error("Institution demo prerequisites missing.");
  }

  const { data: menu, error: menuError } = await ctx.supabase
    .from("institution_menus")
    .insert({
      name: menuName,
      cycle_length: 1,
      start_date: TODAY,
      diet_form_ids: ["vollkost", "diabetes"],
      status: "active",
      user_id: ctx.user.id,
    })
    .select("id")
    .single();
  assertNoError(menuError, "Failed to insert demo institution menu");
  ctx.menuId = assertRow(menu, "Failed to insert demo institution menu").id as string;

  const { error: slotError } = await ctx.supabase.from("institution_menu_slots").insert([
    {
      menu_id: ctx.menuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diabetes",
      slot_type: "fruehstueck",
      recipe_id: haferbreiId,
      portion_count: 18,
    },
    {
      menu_id: ctx.menuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "diabetes",
      slot_type: "mittagessen",
      recipe_id: linsenId,
      portion_count: 24,
    },
    {
      menu_id: ctx.menuId,
      week_number: 1,
      day_of_week: 0,
      diet_form_id: "vollkost",
      slot_type: "mittagessen",
      recipe_id: kartoffelId,
      portion_count: 30,
    },
  ]);
  assertNoError(slotError, "Failed to insert demo menu slots");

  const { data: stays, error: stayError } = await ctx.supabase
    .from("inpatient_stays")
    .insert([
      {
        legacy_id: "clinic-demo-stay-maria",
        user_id: ctx.user.id,
        patient_id: mariaId,
        station: "A3",
        room: "312",
        bed: "1",
        status: "active",
        admission_date: TODAY,
        diet_form_ids: ["diabetes"],
        notes: "Demo: sichere Bestellung aus Beratungsziel.",
      },
      {
        legacy_id: "clinic-demo-stay-anna",
        user_id: ctx.user.id,
        patient_id: annaId,
        station: "A3",
        room: "314",
        bed: "2",
        status: "active",
        admission_date: TODAY,
        diet_form_ids: ["vollkost"],
        notes: "Demo: Sellerieallergie mit dokumentierter Blockade/Override.",
      },
    ])
    .select("id,legacy_id");
  assertNoError(stayError, "Failed to insert demo inpatient stays");

  const stayIdByLegacy = new Map((stays ?? []).map((stay) => [stay.legacy_id as string, stay.id as string]));
  const mariaStayId = stayIdByLegacy.get("clinic-demo-stay-maria");
  const annaStayId = stayIdByLegacy.get("clinic-demo-stay-anna");
  if (!mariaStayId || !annaStayId) throw new Error("Demo stay ID lookup incomplete.");

  const { error: orderError } = await ctx.supabase.from("meal_orders").insert([
    {
      legacy_id: "clinic-demo-order-maria-lunch",
      user_id: ctx.user.id,
      inpatient_stay_id: mariaStayId,
      patient_id: mariaId,
      patient_name: "Maria Schneider",
      station: "A3",
      room: "312",
      bed: "1",
      service_date: TOMORROW,
      meal_slot: "mittagessen",
      recipe_id: linsenId,
      recipe_name: "Klinik-Demo Linseneintopf",
      diet_form_ids_snapshot: ["diabetes"],
      allergen_ids_snapshot: [],
      restriction_summary: ["Diabetesgeeignet", "Eiweissreich"],
      special_instructions: "KH-Portion gleichmaessig verteilen; Beratungsziel beachten.",
      status: "confirmed",
    },
    {
      legacy_id: "clinic-demo-order-anna-lunch-override",
      user_id: ctx.user.id,
      inpatient_stay_id: annaStayId,
      patient_id: annaId,
      patient_name: "Anna Mueller",
      station: "A3",
      room: "314",
      bed: "2",
      service_date: TOMORROW,
      meal_slot: "mittagessen",
      recipe_id: kartoffelId,
      recipe_name: "Klinik-Demo Kartoffelsuppe mit Sellerie",
      diet_form_ids_snapshot: ["vollkost"],
      allergen_ids_snapshot: ["sellerie"],
      restriction_summary: ["BLOCKIERT: Sellerieallergie", "Override nur mit dokumentierter Freigabe"],
      special_instructions: "Demo-Override: Aerztlich freigegeben, Kueche ersetzt Selleriekomponente.",
      status: "pending",
    },
  ]);
  assertNoError(orderError, "Failed to insert demo meal orders");

  await insertAudit(ctx, "meal_order_override_logged", "meal_order", "clinic-demo-order-anna-lunch-override", {
    patientId: annaId,
    allergenIds: ["sellerie"],
    reason: "Demo-Override mit dokumentierter Freigabe",
  });
}

async function insertAudit(
  ctx: SeedContext,
  action: string,
  targetType: string,
  targetId: string,
  metadata: JsonRecord,
) {
  const { data: membership } = await ctx.supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", ctx.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("access_audit_logs").insert({
    organization_id: membership?.organization_id ?? null,
    actor_user_id: ctx.user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: {
      ...metadata,
      demoWorkspace: DEMO_TAG,
    },
  });
  assertNoError(error, `Failed to insert audit row ${action}`);
}

function printDryRunSummary(user: DemoUser, foods: DemoFood[]) {
  console.log("Clinic demo dry run OK.");
  console.log(`Target user: ${user.email} (${user.id})`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Foods available for demo recipes: ${foods.length}`);
  console.log("No database rows were written because --dry-run was provided.");
}

function printSeedSummary(ctx: SeedContext) {
  const mariaId = ctx.patientIds.get("clinic-demo-maria");
  console.log("Clinic demo workspace seeded.");
  console.log(`Target user: ${ctx.user.email}`);
  console.log(`Patients: ${Array.from(ctx.patientIds.values()).length}`);
  console.log(`Recipes: ${Array.from(ctx.recipeIds.values()).length}`);
  console.log(`Menu: ${ctx.menuId}`);
  console.log(`Report version: ${ctx.reportVersionId}`);
  console.log("Demo routes:");
  console.log(`- ${APP_URL.replace(/\/$/, "")}/patienten`);
  if (mariaId) console.log(`- ${APP_URL.replace(/\/$/, "")}/patienten/${mariaId}`);
  if (ctx.reportVersionId) {
    console.log(`- ${APP_URL.replace(/\/$/, "")}/berichte?reportVersionId=${ctx.reportVersionId}`);
  }
  console.log(`- ${APP_URL.replace(/\/$/, "")}/institution/krankenhaus`);
  console.log(
    `- ${APP_URL.replace(/\/$/, "")}/institution/krankenhaus/tablettenkarten?date=${TOMORROW}&mealSlot=mittagessen&station=A3`,
  );
}

async function main() {
  requireEnv();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ?? "") as AnySupabaseClient;
  const user = await getOrCreateDemoUser(supabase);
  const foods = await fetchDemoFoods(supabase);

  if (DRY_RUN) {
    printDryRunSummary(user, foods);
    return;
  }

  const ctx: SeedContext = {
    supabase,
    user,
    foods,
    recipeIds: new Map(),
    patientIds: new Map(),
  };

  await ensureOrganization(ctx);
  await cleanupDemoWorkspace(ctx);
  ctx.planDate = await resolveDemoPlanDate(ctx);
  await upsertRecipes(ctx);
  await seedPatients(ctx);
  await seedDigitalProtocol(ctx);
  await seedCounselingAndReport(ctx);
  await seedInstitutionWorkflow(ctx);

  printSeedSummary(ctx);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
