import { cache } from "react"
import type { SupabaseClient, User } from "@supabase/supabase-js"

import { loadJwks } from "@/lib/supabase/jwks"

/**
 * The signed-in user, established by verifying the session JWT locally.
 *
 * `supabase.auth.getUser()` is a network round trip to the Supabase Auth server
 * — measured at 60-300ms from a German dev machine. The app shell and every
 * server page called it independently, so a single navigation paid that toll
 * two or three times over before rendering a byte.
 *
 * `getClaims()` verifies the same token against the project's public signing
 * keys using WebCrypto, with the key set cached in {@link loadJwks}. No network
 * call in the common case, and the signature is still checked every time.
 *
 * Tradeoff, matching the one already approved for the middleware: a revoked or
 * deleted user keeps access until their access token expires (one hour by
 * default) instead of being cut off on the next navigation. Access to *data*
 * is unaffected — that boundary is RLS, which validates the token server-side
 * on every query.
 *
 * Wrapped in React's `cache`, so the layout and the page it renders share one
 * verification per request instead of repeating it.
 */
export const getVerifiedUser = cache(
  async (supabase: SupabaseClient): Promise<User | null> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return null

    const jwks = await loadJwks(supabaseUrl)
    if (!jwks) return null

    const { data, error } = await supabase.auth.getClaims(
      undefined,
      { jwks },
    )

    const claims = data?.claims
    if (error || !claims?.sub) return null

    // Everything below is carried by the verified token itself. `created_at`
    // is not a JWT claim, so it is left empty rather than invented; nothing in
    // the app reads it, and the client-side AuthProvider replaces this object
    // with the full session user on its first auth event anyway.
    return {
      id: claims.sub,
      aud: typeof claims.aud === "string" ? claims.aud : "authenticated",
      role: claims.role,
      email: claims.email,
      phone: claims.phone,
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? {},
      is_anonymous: claims.is_anonymous,
      created_at: "",
    } satisfies User
  },
)
