import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_ROLES, INSTITUTION_ROLES, hasAnyRole, mapLegacyUserRole } from "@/lib/auth/rbac"
import type { AppRole } from "@/lib/types"

const PUBLIC_APP_PATHS = ["/login", "/registrieren", "/passwort-vergessen"]
const PUBLIC_PREFIXES = ["/_next", "/api", "/protokoll", "/auth"]

async function resolveRole(supabase: ReturnType<typeof createServerClient>, userId: string, legacyRole: unknown): Promise<AppRole> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn("Failed to resolve RBAC membership in middleware:", error.message)
  }

  return (data?.role as AppRole | undefined) ?? mapLegacyUserRole(legacyRole)
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_APP_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.includes(".")
  )
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Auth pages: redirect to dashboard if already authenticated
  if (user && (pathname === "/login" || pathname === "/registrieren")) {
    return redirectTo(request, "/dashboard")
  }

  // Protected pages: redirect to login if not authenticated
  if (!user && !isPublicPath(pathname)) {
    return redirectTo(request, "/login")
  }

  const needsRoleCheck = pathname.startsWith("/admin") || pathname.startsWith("/institution")

  if (user && needsRoleCheck) {
    const role = await resolveRole(supabase, user.id, user.user_metadata?.role)

    if (pathname.startsWith("/admin") && !hasAnyRole(role, ADMIN_ROLES)) {
      return redirectTo(request, "/dashboard")
    }

    if (pathname.startsWith("/institution") && !hasAnyRole(role, INSTITUTION_ROLES)) {
      return redirectTo(request, "/dashboard")
    }
  }

  return supabaseResponse
}
