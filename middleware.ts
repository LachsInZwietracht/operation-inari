import { type NextRequest, NextResponse } from "next/server"

// TEMPORARY: local testing bypass so the app no longer forces login on every visit.
// Re-enable before staging/production by setting this back to false.
const DISABLE_AUTH_FOR_TESTING = true

export async function middleware(request: NextRequest) {
  if (DISABLE_AUTH_FOR_TESTING) {
    return NextResponse.next()
  }

  // Auth-optional mode: skip auth if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  const { updateSession } = await import("@/lib/supabase/middleware")
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
