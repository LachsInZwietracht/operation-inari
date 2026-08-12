import type { JWK } from "@supabase/supabase-js"

/**
 * Module-scoped JWKS cache so a session can be verified locally instead of
 * calling the Supabase Auth server on every navigation.
 *
 * The Supabase client is recreated per request, so its own in-memory JWKS cache
 * never survives — this one does, because module state outlives a request.
 * Each runtime (middleware/edge and the Node server) gets its own copy, which
 * is fine: both converge on the same keys after one fetch.
 *
 * On a signing-key rotation (kid miss) `getClaims` falls back to fetching the
 * well-known JWKS itself, so a stale cache degrades to a network hop, never to
 * a security gap — the signature is always verified.
 */
const JWKS_TTL_MS = 10 * 60 * 1000

let cachedJwks: { keys: JWK[] } | null = null
let jwksFetchedAt = 0

export async function loadJwks(supabaseUrl: string): Promise<{ keys: JWK[] } | undefined> {
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
    console.warn("Failed to refresh JWKS:", error)
  }

  return cachedJwks ?? undefined
}
