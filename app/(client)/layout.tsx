import { AuthProvider } from "@/components/auth-provider"
import { ClientShell } from "@/components/client/client-shell"
import { FoodSearchProvider } from "@/components/foods-provider"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

async function resolveClientShellUser(): Promise<User | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export default async function ClientModeLayout({ children }: { children: React.ReactNode }) {
  const user = await resolveClientShellUser()

  return (
    <AuthProvider initialUser={user}>
      <FoodSearchProvider foods={[]}>
        <ClientShell>{children}</ClientShell>
      </FoodSearchProvider>
    </AuthProvider>
  )
}
