import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type ClinicDemoPatient = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

export type ClinicDemoDigitalProtocolLink = {
  id: string;
  patientId: string;
  url: string;
};

export type ClinicDemoFood = {
  id: string;
  name: string;
};

export type ClinicDemoReportPlan = {
  planId: string;
  planDate: string;
};

export type ClinicDemoInstitutionRecipeMap = {
  breakfastId: string;
  breakfastName: string;
  lunchSafeId: string;
  lunchSafeName: string;
  lunchBlockedId: string;
  lunchBlockedName: string;
};

export type ClinicDemoInstitutionFixture = {
  activeMenuId: string;
  activeMenuName: string;
  draftMenuName?: string;
  mariaName: string;
  annaName: string;
  station: string;
};

const PATIENT_REPORT_FILES_BUCKET = "patient-report-files";

export async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);

  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");

  return user.id;
}

export async function createClinicDemoPatient(
  input: {
    firstName?: string;
    lastName?: string;
    indications?: string[];
  } = {},
): Promise<ClinicDemoPatient> {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const firstName = input.firstName ?? "Demo";
  const lastName = `${input.lastName ?? "Patient"} ${suffix}`;

  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: "1988-01-01",
      gender: "w",
      indications: input.indications ?? ["Adipositas"],
      insurance_provider: "AOK Demo",
      insurance_number: `CLINIC-DEMO-${suffix}`,
    })
    .select("id, first_name, last_name")
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    userId,
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: `${data.first_name} ${data.last_name}`,
  };
}

export async function createClinicDemoDigitalProtocolLink(
  patient: ClinicDemoPatient,
): Promise<ClinicDemoDigitalProtocolLink> {
  const linkId = crypto.randomUUID();
  const url = `https://operation-inari.vercel.app/protokoll/${linkId}`;

  const { error } = await admin.from("patient_digital_protocol_links").insert({
    id: linkId,
    user_id: patient.userId,
    patient_id: patient.id,
    method: "Digitales 24h Recall",
    status: "pending",
    url,
    qr_code: "data:image/png;base64,demo",
    expires_at: "2026-12-31",
  });

  if (error) throw new Error(error.message);

  return {
    id: linkId,
    patientId: patient.id,
    url,
  };
}

export async function createClinicDemoProtocol(
  patient: ClinicDemoPatient,
  input: {
    submissionId?: string;
    title?: string;
  } = {},
) {
  const protocolId = crypto.randomUUID();

  const { error } = await admin.from("nutrition_protocols").insert({
    id: protocolId,
    user_id: patient.userId,
    patient_id: patient.id,
    title: input.title ?? "Digitales Protokoll aus Demo-Einreichung",
    type: "ernaehrungsprotokoll",
    start_date: "2026-04-19",
    end_date: "2026-04-19",
    notes: "Aus digitaler Patienteneinreichung uebernommen.",
    metadata: {
      source: "digital_protocol_submission",
      sourceSubmissionId: input.submissionId,
    },
  });

  if (error) throw new Error(error.message);

  return protocolId;
}

export async function fetchClinicDemoFoodForSmartMatch(): Promise<ClinicDemoFood> {
  const { data, error } = await admin
    .from("foods")
    .select("id,name")
    .order("name", { ascending: true })
    .limit(1)
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id || !data.name) throw new Error("No food available for Smart-Match fixture");

  return { id: data.id, name: data.name };
}

export async function fetchClinicDemoProtocol(protocolId: string) {
  const { data, error } = await admin
    .from("nutrition_protocols")
    .select(
      "id,patient_id,title,type,start_date,end_date,notes,metadata,nutrition_protocol_entries(id,food_id,amount,meal_slot,entry_time)",
    )
    .eq("id", protocolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteClinicDemoPatient(patientId: string) {
  const { data: reportVersions, error: reportVersionError } = await admin
    .from("patient_report_versions")
    .select("storage_bucket, storage_path")
    .eq("patient_ref", patientId);
  if (reportVersionError) throw new Error(reportVersionError.message);

  const pathsByBucket = new Map<string, string[]>();
  for (const version of reportVersions ?? []) {
    const bucket = version.storage_bucket as string;
    const path = version.storage_path as string;
    pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), path]);
  }

  for (const [bucket, paths] of pathsByBucket) {
    if (paths.length === 0) continue;
    const { error } = await admin.storage.from(bucket).remove(Array.from(new Set(paths)));
    if (error) throw new Error(error.message);
  }

  await admin.from("patient_reports").delete().eq("patient_ref", patientId);
  await admin.from("patients").delete().eq("id", patientId);
}

export async function removeStoredReportFiles(paths: string[]) {
  if (paths.length === 0) return;
  const uniquePaths = Array.from(new Set(paths));
  const { error } = await admin.storage.from(PATIENT_REPORT_FILES_BUCKET).remove(uniquePaths);
  if (error) throw new Error(error.message);
}

export async function createClinicDemoReportPlanFixture(): Promise<ClinicDemoReportPlan> {
  const userId = await getTestUserId();
  const planId = crypto.randomUUID();
  const { data: food, error: foodError } = await admin.from("foods").select("id").limit(1).single();
  if (foodError) throw new Error(foodError.message);

  let planDate = "";
  let inserted = false;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const startOfYear = Date.UTC(2026, 0, 1);
    const randomOffsetDays = Math.floor(Math.random() * 365);
    planDate = new Date(startOfYear + randomOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { error: planError } = await admin.from("daily_meal_plans").insert({
      id: planId,
      user_id: userId,
      date: planDate,
      legacy_id: `fixture_${planId}`,
    });

    if (!planError) {
      inserted = true;
      break;
    }

    if (
      !planError.message.includes("daily_meal_plans_user_id_date_key") &&
      !planError.message.includes("daily_meal_plans_user_unassigned_date_unique_idx")
    ) {
      throw new Error(planError.message);
    }
  }

  if (!inserted) {
    throw new Error("Unable to create unique meal plan fixture");
  }

  const { error: entryError } = await admin.from("meal_entries").insert([
    {
      meal_plan_id: planId,
      slot_type: "fruehstueck",
      entry_type: "food",
      reference_id: food.id,
      amount: 180,
      sort_order: 0,
    },
  ]);
  if (entryError) throw new Error(entryError.message);

  return { planId, planDate };
}

export async function deleteClinicDemoReportPlanFixture(planId: string) {
  const { data: versions } = await admin
    .from("patient_report_versions")
    .select("storage_path")
    .eq("plan_id", planId);
  await removeStoredReportFiles((versions ?? []).map((version) => version.storage_path as string));
  await admin.from("patient_reports").delete().eq("plan_id", planId);
  await admin.from("meal_entries").delete().eq("meal_plan_id", planId);
  await admin.from("daily_meal_plans").delete().eq("id", planId);
}

export async function fetchPatientReportsForPatient(patientId: string) {
  const { data, error } = await admin
    .from("patient_reports")
    .select("*")
    .eq("patient_ref", patientId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchPatientReportVersionsForPatient(patientId: string) {
  const { data, error } = await admin
    .from("patient_report_versions")
    .select("*")
    .eq("patient_ref", patientId)
    .order("exported_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDigitalProtocolSubmissionByLink(linkId: string) {
  const { data, error } = await admin
    .from("digital_protocol_submissions")
    .select("*")
    .eq("link_id", linkId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDigitalProtocolLink(linkId: string) {
  const { data, error } = await admin
    .from("patient_digital_protocol_links")
    .select("*")
    .eq("id", linkId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchLatestAccessAuditLog(action: string, targetId?: string) {
  let query = admin
    .from("access_audit_logs")
    .select("action,target_type,target_id,metadata")
    .eq("action", action);

  if (targetId) {
    query = query.eq("target_id", targetId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function clearClinicDemoInstitutionData(userId: string) {
  await admin.from("kitchen_production_events").delete().eq("user_id", userId);
  await admin.from("kitchen_production_batches").delete().eq("user_id", userId);
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

async function getInstitutionRecipes(): Promise<ClinicDemoInstitutionRecipeMap> {
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

async function createInstitutionPatient(
  userId: string,
  input: {
    firstName: string;
    lastName: string;
    indications: string[];
    insuranceNumber: string;
  },
) {
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: "1988-01-01",
      gender: "w",
      indications: input.indications,
      insurance_provider: "AOK Test",
      insurance_number: input.insuranceNumber,
    })
    .select("id, first_name, last_name")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string; first_name: string; last_name: string };
}

export async function createClinicDemoInstitutionFixture(
  options: {
    includeDraftMenu?: boolean;
    includePendingOrder?: boolean;
  } = {},
): Promise<ClinicDemoInstitutionFixture> {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const prefix = `INST-${suffix}`;

  await clearClinicDemoInstitutionData(userId);
  await clearInstitutionPatientsByPrefix(userId, prefix);

  const recipes = await getInstitutionRecipes();
  const maria = await createInstitutionPatient(userId, {
    firstName: "Maria",
    lastName: `Schneider ${suffix}`,
    indications: ["Adipositas"],
    insuranceNumber: `${prefix}-MARIA`,
  });
  const anna = await createInstitutionPatient(userId, {
    firstName: "Anna",
    lastName: `Müller ${suffix}`,
    indications: ["Nahrungsmittelallergie"],
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

export async function cleanupClinicDemoInstitutionFixture() {
  const userId = await getTestUserId();
  await clearClinicDemoInstitutionData(userId);
}
