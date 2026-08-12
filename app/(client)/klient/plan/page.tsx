import { notFound, redirect } from "next/navigation"

import { ClientPlanView } from "@/components/client/client-plan-view"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { isIsoDate, todayIsoDate } from "@/lib/client-mode"
import { fetchClientPlanDay } from "@/lib/data/client-plan-client"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedUser } from "@/lib/supabase/verified-user"
import type { ClientPlanDay } from "@/lib/types"

export const dynamic = "force-dynamic"

interface ClientPlanPageProps {
  searchParams: Promise<{ datum?: string }>
}

export default async function ClientPlanPage({ searchParams }: ClientPlanPageProps) {
  // A disabled module must not stay reachable by URL.
  if (!isClientModuleEnabled("plan")) notFound()

  const { datum } = await searchParams
  const date = isIsoDate(datum) ? datum : todayIsoDate()

  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authOptional || process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true") {
    return <ClientPlanView date={date} clientUserId={null} plan={null} />
  }

  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)

  if (!user) redirect("/login")

  let plan: ClientPlanDay | null = null
  try {
    plan = await fetchClientPlanDay(date, supabase)
  } catch (error) {
    console.warn("Failed to load client plan:", error)
  }

  return <ClientPlanView key={date} date={date} clientUserId={user.id} plan={plan} />
}
