import { redirect } from "next/navigation"

import { ClientSettingsView } from "@/components/client/client-settings-view"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedUser } from "@/lib/supabase/verified-user"

export const dynamic = "force-dynamic"

/**
 * Not gated by a module flag: settings are the surface itself, not one of the
 * things it can be configured to show.
 */
export default async function ClientSettingsPage() {
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authOptional || process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true") {
    return <ClientSettingsView clientUserId={null} />
  }

  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)

  if (!user) redirect("/login")

  return <ClientSettingsView clientUserId={user.id} />
}
