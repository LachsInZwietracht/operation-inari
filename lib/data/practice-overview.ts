import type { CounselingSession, InvoiceEntry, Patient, PracticeAppointment } from "@/lib/types"
import { createClient } from "@/lib/supabase/server"
import { fetchPatients } from "@/lib/data/patients"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchInvoicesClient } from "@/lib/data/invoices-client"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"

export interface PracticeOverviewData {
  patients: Patient[]
  appointments: PracticeAppointment[]
  invoices: InvoiceEntry[]
  counselingSessions: CounselingSession[]
}

async function orEmpty<T>(promise: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await promise
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Failed to load ${label} for practice overview:`, message)
    return []
  }
}

export async function fetchPracticeOverviewData(): Promise<PracticeOverviewData | null> {
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
    console.warn("Failed to resolve user for practice overview:", error.message)
    return null
  }

  if (!user) {
    return null
  }

  const [patients, appointments, invoices, counselingSessions] = await Promise.all([
    fetchPatients(supabase),
    orEmpty(fetchAppointmentsClient(supabase), "appointments"),
    orEmpty(fetchInvoicesClient(supabase), "invoices"),
    orEmpty(fetchCounselingSessionsClient(supabase), "counseling sessions"),
  ])

  return {
    patients,
    appointments,
    invoices,
    counselingSessions,
  }
}
