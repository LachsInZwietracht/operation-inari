import { TerminePageClient } from "./termine-client"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchPatients } from "@/lib/data/patients"
import { createClient } from "@/lib/supabase/server"
import type { Patient, PracticeAppointment } from "@/lib/types"

interface TermineInitialData {
  appointments: PracticeAppointment[]
  patients: Patient[]
}

async function loadInitialData(): Promise<TermineInitialData | null> {
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
    const [appointments, patients] = await Promise.all([
      fetchAppointmentsClient(supabase),
      fetchPatients(supabase),
    ])
    return { appointments, patients }
  } catch (fetchError) {
    console.warn("Failed to load initial appointment data:", fetchError)
    return null
  }
}

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>
}) {
  const [{ patientId }, initialData] = await Promise.all([searchParams, loadInitialData()])

  return (
    <TerminePageClient
      initialAppointments={initialData?.appointments}
      initialPatients={initialData?.patients}
      initialPatientFilter={patientId}
    />
  )
}
