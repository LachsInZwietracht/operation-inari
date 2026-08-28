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
const JWKS_FETCH_TIMEOUT_MS = 1_500
const JWKS_RETRY_DELAY_MS = 30_000

let cachedJwks: { keys: JWK[] } | null = null
let jwksFetchedAt = 0
let nextJwksAttemptAt = 0
let pendingJwksRequest: Promise<{ keys: JWK[] } | undefined> | null = null

export async function loadJwks(supabaseUrl: string): Promise<{ keys: JWK[] } | undefined> {
  const now = Date.now()
  if (cachedJwks && now - jwksFetchedAt < JWKS_TTL_MS) return cachedJwks
  if (now < nextJwksAttemptAt) return cachedJwks ?? undefined
  if (pendingJwksRequest) return pendingJwksRequest

  pendingJwksRequest = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
        signal: controller.signal,
      })
      if (response.ok) {
        const jwks = (await response.json()) as { keys: JWK[] }
        if (jwks.keys?.length > 0) {
          cachedJwks = jwks
          jwksFetchedAt = Date.now()
          nextJwksAttemptAt = 0
          return cachedJwks
        }
      }
      nextJwksAttemptAt = Date.now() + JWKS_RETRY_DELAY_MS
    } catch (error) {
      nextJwksAttemptAt = Date.now() + JWKS_RETRY_DELAY_MS
      console.warn("Failed to refresh JWKS:", error)
    } finally {
      clearTimeout(timeout)
    }

    return cachedJwks ?? undefined
  })()

  try {
    return await pendingJwksRequest
  } finally {
    pendingJwksRequest = null
  }
}
