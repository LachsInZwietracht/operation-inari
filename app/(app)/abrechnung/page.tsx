import { AbrechnungPageClient } from "./abrechnung-client"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchInvoicesClient } from "@/lib/data/invoices-client"
import { fetchPatients } from "@/lib/data/patients"
import { createClient } from "@/lib/supabase/server"
import type { InvoiceEntry, Patient, PracticeAppointment } from "@/lib/types"

interface AbrechnungInitialData {
  invoices: InvoiceEntry[]
  appointments: PracticeAppointment[]
  patients: Patient[]
}

async function loadInitialData(): Promise<AbrechnungInitialData | null> {
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
    const [invoices, appointments, patients] = await Promise.all([
      fetchInvoicesClient(supabase),
      fetchAppointmentsClient(supabase),
      fetchPatients(supabase),
    ])
    return { invoices, appointments, patients }
  } catch (fetchError) {
    console.warn("Failed to load initial billing data:", fetchError)
    return null
  }
}

export default async function AbrechnungPage() {
  const initialData = await loadInitialData()

  return (
    <AbrechnungPageClient
      initialInvoices={initialData?.invoices}
      initialAppointments={initialData?.appointments}
      initialPatients={initialData?.patients}
    />
  )
}
