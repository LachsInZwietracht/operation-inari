import { createServerClient } from "@supabase/ssr"
import type { JWK } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_ROLES, INSTITUTION_ROLES, hasAnyRole, mapLegacyUserRole } from "@/lib/auth/rbac"
import type { AppRole } from "@/lib/types"

const PUBLIC_APP_PATHS = ["/login", "/registrieren", "/passwort-vergessen"]
const PUBLIC_PREFIXES = ["/_next", "/api", "/protokoll", "/auth"]

/**
 * Module-scoped JWKS cache so getClaims() verifies the JWT locally on every
 * navigation instead of calling the Supabase Auth server. The Supabase client
 * is recreated per request, so its own in-memory JWKS cache never survives.
 * On a signing-key rotation (kid miss) getClaims falls back to fetching the
 * well-known JWKS itself, so a stale cache degrades to a network hop, never
 * to a security gap — the signature is always verified.
 */
const JWKS_TTL_MS = 10 * 60 * 1000
let cachedJwks: { keys: JWK[] } | null = null
let jwksFetchedAt = 0

async function loadJwks(supabaseUrl: string): Promise<{ keys: JWK[] } | undefined> {
  const now = Date.now()
  if (cachedJwks && now - jwksFetchedAt < JWKS_TTL_MS) return cachedJwks
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    if (response.ok) {
      const jwks = (await response.json()) as { keys: JWK[] }
      if (jwks.keys?.length > 0) {
        cachedJwks = jwks
        jwksFetchedAt = now
      }
    }
  } catch (error) {
    console.warn("Failed to refresh JWKS in middleware:", error)
  }
  return cachedJwks ?? undefined
}

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

  // Local JWT verification instead of a network getUser() per navigation.
  // getClaims() still refreshes an expired session via getSession(), so the
  // cookie-refresh behavior of the previous getUser() flow is preserved.
  // Tradeoff (approved): a revoked/deleted user keeps access until their
  // access token expires instead of being cut off on the next navigation.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const jwks = await loadJwks(supabaseUrl)
  const { data: claimsData } = await supabase.auth.getClaims(
    undefined,
    jwks ? { jwks } : undefined,
  )
  const claims = claimsData?.claims
  const userId = claims?.sub

  const { pathname } = request.nextUrl

  // Auth pages: redirect to dashboard if already authenticated
  if (userId && (pathname === "/login" || pathname === "/registrieren")) {
    return redirectTo(request, "/dashboard")
  }

  // Protected pages: redirect to login if not authenticated
  if (!userId && !isPublicPath(pathname)) {
    return redirectTo(request, "/login")
  }

  const needsRoleCheck = pathname.startsWith("/admin") || pathname.startsWith("/institution")

  if (userId && needsRoleCheck) {
    const legacyRole = (claims?.user_metadata as Record<string, unknown> | undefined)?.role
    const role = await resolveRole(supabase, userId, legacyRole)

    if (pathname.startsWith("/admin") && !hasAnyRole(role, ADMIN_ROLES)) {
      return redirectTo(request, "/dashboard")
    }

    if (pathname.startsWith("/institution") && !hasAnyRole(role, INSTITUTION_ROLES)) {
      return redirectTo(request, "/dashboard")
    }
  }

  return supabaseResponse
}
