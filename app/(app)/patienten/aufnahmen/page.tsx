import { Suspense } from "react"

import { AufnahmenPageClient } from "./aufnahmen-client"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"
import { fetchPatientPlanSummaries } from "@/lib/data/meal-plans"
import { fetchPatients } from "@/lib/data/patients"
import { fetchPatientIntakeLinksServer } from "@/lib/data/patient-intake-server"
import { fetchPatientIntakeSubmissionsClient } from "@/lib/data/patient-intake-submissions-client"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedUser } from "@/lib/supabase/verified-user"
import type { PatientPlanSummary } from "@/lib/patient-journey"
import type {
  CounselingSession,
  Patient,
  PatientIntakeLink,
  PatientIntakeSubmission,
  PracticeAppointment,
} from "@/lib/types"

interface AufnahmenInitialData {
  patients: Patient[]
  sessions: CounselingSession[]
  planSummaries: PatientPlanSummary[]
  appointments: PracticeAppointment[]
  links: PatientIntakeLink[]
  submissions: PatientIntakeSubmission[]
}

async function loadInitialData(): Promise<AufnahmenInitialData | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return null
  }

  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)

  if (!user) {
    return null
  }

  try {
    const [patients, sessions, planSummaries, appointments, links, submissions] =
      await Promise.all([
        fetchPatients(supabase),
        fetchCounselingSessionsClient(supabase),
        fetchPatientPlanSummaries({ supabase, userId: user.id }),
        fetchAppointmentsClient(supabase),
        // Invitations and questionnaires decide which stage a card sits in, so
        // fetching them in the browser after hydration made the board pop in.
        fetchPatientIntakeLinksServer(supabase),
        fetchPatientIntakeSubmissionsClient(supabase),
      ])
    return { patients, sessions, planSummaries, appointments, links, submissions }
  } catch (fetchError) {
    console.warn("Failed to load initial Aufnahmen data:", fetchError)
    return null
  }
}

export default async function AufnahmenPage() {
  const initialData = await loadInitialData()

  return (
    // The client reads view and filters from the URL, which suspends on first
    // render; without this boundary the whole route would opt out of streaming.
    <Suspense fallback={null}>
      <AufnahmenPageClient
        initialPatients={initialData?.patients}
        initialSessions={initialData?.sessions}
        initialPlanSummaries={initialData?.planSummaries}
        initialAppointments={initialData?.appointments}
        initialLinks={initialData?.links}
        initialSubmissions={initialData?.submissions}
        // Every waiting time, deadline and timeline position is measured from
        // one clock. Letting the client call its own `new Date()` would make
        // the server and client markup disagree whenever a day boundary or a
        // slow hydration falls between the two renders.
        renderedAt={new Date().toISOString()}
      />
    </Suspense>
  )
}
