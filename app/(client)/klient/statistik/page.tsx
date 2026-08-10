import { notFound, redirect } from "next/navigation"

import { ClientStatsView } from "@/components/client/client-stats-view"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ClientStatsPage() {
  if (!isClientModuleEnabled("statistik")) notFound()

  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authOptional || process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true") {
    return <ClientStatsView clientUserId={null} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Unlike the other modules this page fetches nothing server-side: the kcal
  // series needs the food catalog through an authenticated API route, so the
  // whole thing loads in one place on the client instead of half here.
  return <ClientStatsView clientUserId={user.id} />
}
