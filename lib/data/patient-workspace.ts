import type {
  ActivityEntry,
  AnthropometricEntry,
  CounselingSession,
  DiagnosisEntry,
  DigitalProtocolLink,
  DigitalProtocolSubmission,
  InvoiceEntry,
  LabValueEntry,
  MedicationEntry,
  NutritionProtocol,
  Patient,
  PatientAllergenEntry,
  PatientReportRecord,
  PracticeAppointment,
  ProcamResult,
  Recipe,
  ScreeningResult,
  TherapyDeviceIntegration,
  TherapySetting,
  DailyMealPlan,
  Food,
} from "@/lib/types"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { fetchActivitiesClient } from "@/lib/data/patient-activities-client"
import { fetchAnthropometricEntriesClient } from "@/lib/data/patient-anthropometrics-client"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"
import { fetchDiagnosesClient } from "@/lib/data/patient-diagnoses-client"
import { fetchDigitalProtocolLinksClient } from "@/lib/data/patient-digital-protocol-links-client"
import { fetchInvoicesClient } from "@/lib/data/invoices-client"
import { fetchLabValuesClient } from "@/lib/data/patient-lab-values-client"
import { fetchMedicationsClient } from "@/lib/data/patient-medications-client"
import { fetchPatientAllergensClient } from "@/lib/data/patient-allergens-client"
import { fetchPatientReportsClient } from "@/lib/data/patient-reports-client"
import { fetchPatientByRef, fetchPatientByRefForUser } from "@/lib/data/patients"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { fetchFoodsByIds } from "@/lib/data/foods"
import { fetchRecipes } from "@/lib/data/recipes"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchProcamResultsClient } from "@/lib/data/patient-procam-client"
import { fetchProtocolsClient } from "@/lib/data/protocols-client"
import { fetchScreeningsClient } from "@/lib/data/patient-screenings-client"
import { fetchSubmissionsForPatientClient } from "@/lib/data/digital-protocol-submissions-client"
import { fetchTherapyIntegrationsClient } from "@/lib/data/patient-therapy-integrations-client"
import { fetchTherapySettingsClient } from "@/lib/data/patient-therapy-settings-client"
import { writeAccessAuditLog } from "@/lib/audit/access-audit"

export interface PatientWorkspaceData {
  patient: Patient | null
  patients: Patient[]
  activities: ActivityEntry[]
  anthropometrics: AnthropometricEntry[]
  appointments: PracticeAppointment[]
  counselingSessions: CounselingSession[]
  diagnoses: DiagnosisEntry[]
  digitalLinks: DigitalProtocolLink[]
  digitalSubmissions: DigitalProtocolSubmission[]
  invoices: InvoiceEntry[]
  labValues: LabValueEntry[]
  medications: MedicationEntry[]
  patientAllergens: PatientAllergenEntry[]
  patientReports: PatientReportRecord[]
  mealPlans: DailyMealPlan[]
  mealPlanFoods: Food[]
  recipes: Recipe[]
  procamResults: ProcamResult[]
  protocols: NutritionProtocol[]
  screenings: ScreeningResult[]
  therapyIntegrations: TherapyDeviceIntegration[]
  therapySettings: TherapySetting[]
}

async function orEmpty<T>(promise: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await promise
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Failed to load ${label} for patient workspace:`, message)
    return []
  }
}

function matchesPatientRef(patient: Patient, value?: string | null) {
  return Boolean(value && (value === patient.id || value === patient.legacyId))
}

function filterForPatient<T extends { patientId?: string; patientRef?: string }>(
  rows: T[],
  patient: Patient,
) {
  return rows.filter(
    (row) => matchesPatientRef(patient, row.patientId) || matchesPatientRef(patient, row.patientRef),
  )
}

export async function fetchPatientWorkspaceData(
  patientRef: string,
): Promise<PatientWorkspaceData | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.warn("Failed to resolve user for patient workspace:", error.message)
    return null
  }

  if (!user) {
    return null
  }

  let patient = await fetchPatientByRef(patientRef, supabase)
  if (!patient) {
    try {
      const serviceClient = await createServiceClient()
      patient = await fetchPatientByRefForUser(patientRef, user.id, serviceClient)
    } catch (fallbackError) {
      console.warn("Failed to resolve patient workspace through service fallback:", fallbackError)
    }
  }

  if (!patient) {
    return {
      patient: null,
      patients: [],
      activities: [],
      anthropometrics: [],
      appointments: [],
      counselingSessions: [],
      diagnoses: [],
      digitalLinks: [],
      digitalSubmissions: [],
      invoices: [],
      labValues: [],
      medications: [],
      patientAllergens: [],
      patientReports: [],
      mealPlans: [],
      mealPlanFoods: [],
      recipes: [],
      procamResults: [],
      protocols: [],
      screenings: [],
      therapyIntegrations: [],
      therapySettings: [],
    }
  }

  const patientRefs = [patient.id, patient.legacyId].filter(Boolean) as string[]

  await writeAccessAuditLog(supabase, {
    action: "patient_record_accessed",
    targetType: "patient",
    targetId: patient.id,
    metadata: {
      patientRef,
      sections: [
        "activities",
        "anthropometrics",
        "appointments",
        "counseling",
        "diagnoses",
        "labs",
        "mealPlans",
        "medications",
        "protocols",
        "reports",
        "screenings",
      ],
    },
  })

  const [
    activities,
    anthropometrics,
    appointments,
    counselingSessions,
    diagnoses,
    digitalLinks,
    digitalSubmissions,
    invoices,
    labValues,
    medications,
    patientAllergens,
    patientReports,
    mealPlans,
    recipes,
    procamResults,
    protocols,
    screenings,
    therapyIntegrations,
    therapySettings,
  ] = await Promise.all([
    orEmpty(fetchActivitiesClient(supabase), "activities"),
    orEmpty(fetchAnthropometricEntriesClient(supabase), "anthropometrics"),
    orEmpty(fetchAppointmentsClient(supabase, { patientRefs }), "appointments"),
    orEmpty(fetchCounselingSessionsClient(supabase, { patientId: patient.id }), "counseling sessions"),
    orEmpty(fetchDiagnosesClient(supabase), "diagnoses"),
    orEmpty(fetchDigitalProtocolLinksClient(supabase), "digital protocol links"),
    orEmpty(fetchSubmissionsForPatientClient(patient.id, supabase), "digital submissions"),
    orEmpty(fetchInvoicesClient(supabase, { patientRefs }), "invoices"),
    orEmpty(fetchLabValuesClient(supabase), "lab values"),
    orEmpty(fetchMedicationsClient(supabase), "medications"),
    orEmpty(fetchPatientAllergensClient(supabase), "patient allergens"),
    orEmpty(fetchPatientReportsClient(patient.id, supabase), "patient reports"),
    orEmpty(fetchMealPlans({ supabase, userId: user.id, includeSystem: false }), "meal plans"),
    orEmpty(fetchRecipes({ supabase }), "recipes"),
    orEmpty(fetchProcamResultsClient(supabase), "PROCAM results"),
    orEmpty(fetchProtocolsClient(supabase, { patientRefs }), "protocols"),
    orEmpty(fetchScreeningsClient(supabase), "screenings"),
    orEmpty(fetchTherapyIntegrationsClient(supabase), "therapy integrations"),
    orEmpty(fetchTherapySettingsClient(supabase), "therapy settings"),
  ])

  const patientMealPlans = filterForPatient(mealPlans, patient)
  const referencedRecipeIds = new Set<string>()
  const referencedFoodIds = new Set<string>()

  for (const plan of patientMealPlans) {
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          referencedFoodIds.add(entry.referenceId)
        } else {
          referencedRecipeIds.add(entry.referenceId)
        }
      }
    }
  }

  const mealPlanRecipes = recipes.filter(
    (recipe) =>
      referencedRecipeIds.has(recipe.id) ||
      Boolean(recipe.legacyId && referencedRecipeIds.has(recipe.legacyId)),
  )

  for (const recipe of mealPlanRecipes) {
    for (const ingredient of recipe.ingredients) {
      referencedFoodIds.add(ingredient.foodId)
    }
  }

  const mealPlanFoods = await fetchFoodsByIds(Array.from(referencedFoodIds), supabase, {
    nutrientIds: ["energie", "eiweiss", "fett", "kohlenhydrate"],
    includePortions: false,
  })

  return {
    patient,
    patients: [patient],
    activities: filterForPatient(activities, patient),
    anthropometrics: filterForPatient(anthropometrics, patient),
    appointments: filterForPatient(appointments, patient),
    counselingSessions: filterForPatient(counselingSessions, patient),
    diagnoses: filterForPatient(diagnoses, patient),
    digitalLinks: filterForPatient(digitalLinks, patient),
    digitalSubmissions,
    invoices: filterForPatient(invoices, patient),
    labValues: filterForPatient(labValues, patient),
    medications: filterForPatient(medications, patient),
    patientAllergens: filterForPatient(patientAllergens, patient),
    patientReports,
    mealPlans: patientMealPlans,
    mealPlanFoods,
    recipes: mealPlanRecipes,
    procamResults: filterForPatient(procamResults, patient),
    protocols: filterForPatient(protocols, patient),
    screenings: filterForPatient(screenings, patient),
    therapyIntegrations: filterForPatient(therapyIntegrations, patient),
    therapySettings: filterForPatient(therapySettings, patient),
  }
}
