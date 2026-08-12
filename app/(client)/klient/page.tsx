import { redirect } from "next/navigation"

import { ClientFoodLogView } from "@/components/client/client-food-log-view"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { isIsoDate, todayIsoDate } from "@/lib/client-mode"
import { fetchClientFoodLogDay } from "@/lib/data/client-food-log-client"
import { fetchClientPlanDay } from "@/lib/data/client-plan-client"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedUser } from "@/lib/supabase/verified-user"
import type { ClientFoodLogDay, ClientPlanDay } from "@/lib/types"

export const dynamic = "force-dynamic"

interface ClientDiaryPageProps {
  searchParams: Promise<{ datum?: string }>
}

export default async function ClientDiaryPage({ searchParams }: ClientDiaryPageProps) {
  const { datum } = await searchParams
  const date = isIsoDate(datum) ? datum : todayIsoDate()

  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authOptional || process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true") {
    return <ClientFoodLogView date={date} clientUserId={null} initialDay={null} plan={null} />
  }

  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)

  if (!user) redirect("/login")

  let initialDay: ClientFoodLogDay | null = null
  try {
    initialDay = await fetchClientFoodLogDay(user.id, date, supabase)
  } catch (error) {
    console.warn("Failed to load client food log day:", error)
  }

  // The diary reads the plan module, one way and guarded: with `plan` switched
  // off the planned rows disappear and the diary keeps working.
  let plan: ClientPlanDay | null = null
  if (isClientModuleEnabled("plan")) {
    try {
      plan = await fetchClientPlanDay(date, supabase)
    } catch (error) {
      console.warn("Failed to load client plan for the diary:", error)
    }
  }

  // Keyed by date so switching days remounts with fresh server data.
  return (
    <ClientFoodLogView
      key={date}
      date={date}
      clientUserId={user.id}
      initialDay={initialDay}
      plan={plan}
    />
  )
}
