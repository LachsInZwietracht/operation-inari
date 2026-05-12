import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ContextualFoodSearchTrigger } from "@/components/food-search-command"
import { Separator } from "@/components/ui/separator"
import { FoodSearchProvider } from "@/components/foods-provider"
import { AuthProvider } from "@/components/auth-provider"
import { INSTITUTION_ROLES, hasAnyRole, mapLegacyUserRole } from "@/lib/auth/rbac"
import { fetchCurrentMembership } from "@/lib/auth/access"
import { createClient } from "@/lib/supabase/server"
import type { AppRole } from "@/lib/types"
import type { User } from "@supabase/supabase-js"

export const dynamic = "force-dynamic";

async function resolveAppShellAuth(): Promise<{ user: User | null; role: AppRole | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, role: null }

  try {
    const membership = await fetchCurrentMembership(supabase, user.id)
    return {
      user,
      role: membership?.role ?? mapLegacyUserRole(user.user_metadata?.role),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("Failed to resolve RBAC membership for app shell:", message)
    return { user, role: mapLegacyUserRole(user.user_metadata?.role) }
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const shouldResolveRole = !authDisabled && !authOptional
  const appShellAuth = shouldResolveRole ? await resolveAppShellAuth() : { user: null, role: null }
  const canAccessInstitution =
    authDisabled || authOptional || hasAnyRole(appShellAuth.role, INSTITUTION_ROLES)

  return (
    <AuthProvider initialUser={appShellAuth.user}>
      <FoodSearchProvider foods={[]}>
        <SidebarProvider>
          <AppSidebar canAccessInstitution={canAccessInstitution} />
          <SidebarInset>
            <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4">
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator orientation="vertical" className="mr-1 h-4 shrink-0 sm:mr-2" />
              <div className="min-w-0 flex-1 sm:flex-none">
                <ContextualFoodSearchTrigger />
              </div>
            </header>
            <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </FoodSearchProvider>
    </AuthProvider>
  )
}
