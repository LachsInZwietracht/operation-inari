import { ReferenzwertePageClient } from "./referenzwerte-client"
import {
  fetchOfficialReferenceValues,
  fetchPatientReferenceAssignments,
  fetchReferenceProfiles,
  fetchUserReferencePreference,
} from "@/lib/data/reference-values-client"
import { createClient } from "@/lib/supabase/server"
import type { ReferenceStoreSeed } from "@/hooks/use-reference-profiles"

async function loadInitialData(): Promise<ReferenceStoreSeed | null> {
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
    const [officialRows, customProfiles, userPreference, patientAssignments] = await Promise.all([
      fetchOfficialReferenceValues(supabase),
      fetchReferenceProfiles(supabase),
      fetchUserReferencePreference(supabase),
      fetchPatientReferenceAssignments(supabase),
    ])
    return { officialRows, customProfiles, userPreference, patientAssignments }
  } catch (fetchError) {
    console.warn("Failed to load initial reference value data:", fetchError)
    return null
  }
}

export default async function ReferenzwertePage() {
  const initialData = await loadInitialData()

  return <ReferenzwertePageClient initialReferenceState={initialData ?? undefined} />
}
