import { createClient } from "@/lib/supabase/server"
import { getVerifiedUser } from "@/lib/supabase/verified-user"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { fetchPatients } from "@/lib/data/patients"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"
import { fetchPatientIntakeSubmissionsClient } from "@/lib/data/patient-intake-submissions-client"
import { fetchPracticeTasks } from "@/lib/data/practice-tasks-client"
import { DashboardOverviewClient } from "./dashboard-overview-client"

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)

  const [plans, patients, appointments, sessions, submissions, tasks] = await Promise.all([
    // Own plans only — system/template plans belong in the Bibliothek.
    fetchMealPlans({ supabase, userId: user?.id, includeSystem: false }),
    fetchPatients(supabase),
    fetchAppointmentsClient(supabase).catch((error) => {
      console.warn("Falling back to empty appointment list:", error)
      return []
    }),
    fetchCounselingSessionsClient(supabase).catch((error) => {
      console.warn("Falling back to empty counseling list:", error)
      return []
    }),
    fetchPatientIntakeSubmissionsClient(supabase).catch((error) => {
      console.warn("Falling back to empty intake list:", error)
      return []
    }),
    fetchPracticeTasks(supabase).catch((error) => {
      console.warn("Falling back to empty task board:", error)
      return []
    }),
  ])

  const metadataName = user?.user_metadata?.first_name
  const firstName = typeof metadataName === "string" && metadataName ? metadataName : null

  return (
    <DashboardOverviewClient
      firstName={firstName}
      plans={plans}
      patients={patients}
      appointments={appointments}
      sessions={sessions}
      submissions={submissions}
      tasks={tasks}
    />
  )
}
