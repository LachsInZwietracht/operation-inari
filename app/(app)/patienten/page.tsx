import { Suspense } from "react"

import { PatientenPageClient } from "./patienten-client"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"
import { fetchPatientPlanSummaries } from "@/lib/data/meal-plans"
import { fetchPatients } from "@/lib/data/patients"
import { createClient } from "@/lib/supabase/server"
import type { PatientPlanSummary } from "@/lib/patient-journey"
import type { CounselingSession, Patient, PracticeAppointment } from "@/lib/types"

interface PatientenInitialData {
  patients: Patient[]
  sessions: CounselingSession[]
  planSummaries: PatientPlanSummary[]
  appointments: PracticeAppointment[]
}

async function loadInitialData(): Promise<PatientenInitialData | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  try {
    const [patients, sessions, planSummaries, appointments] = await Promise.all([
      fetchPatients(supabase),
      fetchCounselingSessionsClient(supabase),
      fetchPatientPlanSummaries({ supabase, userId: user.id }),
      fetchAppointmentsClient(supabase),
    ])
    return { patients, sessions, planSummaries, appointments }
  } catch (fetchError) {
    console.warn("Failed to load initial patient data:", fetchError)
    return null
  }
}

export default async function PatientenPage() {
  const initialData = await loadInitialData()

  return (
    // The client reads view and filters from the URL, which suspends on first
    // render; without this boundary the whole route would opt out of streaming.
    <Suspense fallback={null}>
      <PatientenPageClient
        initialPatients={initialData?.patients}
        initialSessions={initialData?.sessions}
        initialPlanSummaries={initialData?.planSummaries}
        initialAppointments={initialData?.appointments}
        renderedAt={new Date().toISOString()}
      />
    </Suspense>
  )
}
