import { PatientenPageClient } from "./patienten-client"
import { fetchPatients } from "@/lib/data/patients"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"
import { createClient } from "@/lib/supabase/server"
import type { CounselingSession, Patient } from "@/lib/types"

interface PatientenInitialData {
  patients: Patient[]
  sessions: CounselingSession[]
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
    const [patients, sessions] = await Promise.all([
      fetchPatients(supabase),
      fetchCounselingSessionsClient(supabase),
    ])
    return { patients, sessions }
  } catch (fetchError) {
    console.warn("Failed to load initial patient data:", fetchError)
    return null
  }
}

export default async function PatientenPage() {
  const initialData = await loadInitialData()

  return (
    <PatientenPageClient
      initialPatients={initialData?.patients}
      initialSessions={initialData?.sessions}
    />
  )
}
