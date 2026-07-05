import { AuthRequiredError } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

/**
 * Mirrors the middleware bypass semantics (middleware.ts): the local-only
 * testing flag and the auth-optional mode without Supabase env vars. No new
 * bypass class — API routes behave exactly like page navigation.
 */
function isAuthBypassed() {
  return (
    process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Auth guard for API route handlers. Throws AuthRequiredError (message
 * "AUTH_REQUIRED") when no session exists; returns null when auth is bypassed.
 * A missing session makes supabase.auth.getUser() error, so any error here is
 * treated as "not authenticated" rather than an internal failure.
 */
export async function requireApiUser() {
  if (isAuthBypassed()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthRequiredError();
  }
  return data.user;
}
