import { createClient } from "@/lib/supabase/server"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { fetchPatients } from "@/lib/data/patients"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { DashboardOverviewClient } from "./dashboard-overview-client"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [plans, patients, appointments] = await Promise.all([
    // Own plans only — system/template plans belong in the Bibliothek.
    fetchMealPlans({ supabase, userId: user?.id, includeSystem: false }),
    fetchPatients(supabase),
    fetchAppointmentsClient(supabase).catch((error) => {
      console.warn("Falling back to empty appointment list:", error)
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
    />
  )
}
