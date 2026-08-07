import { notFound, redirect } from "next/navigation"

import { ClientTrainingView } from "@/components/client/client-training-view"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { fetchClientWorkoutSessions } from "@/lib/data/client-training-client"
import { createClient } from "@/lib/supabase/server"
import type { ClientWorkoutSession } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function ClientTrainingPage() {
  if (!isClientModuleEnabled("training")) notFound()

  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authOptional || process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true") {
    return <ClientTrainingView clientUserId={null} initialSessions={[]} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  let sessions: ClientWorkoutSession[] = []
  try {
    sessions = await fetchClientWorkoutSessions(user.id, 20, supabase)
  } catch (error) {
    console.warn("Failed to load workout sessions:", error)
  }

  return <ClientTrainingView clientUserId={user.id} initialSessions={sessions} />
}
