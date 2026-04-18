import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables are missing. Using fallback mode.")
  }

  return createServerClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    },
  )
}

/**
 * Creates a Supabase client using the Service Role Key.
 * This client bypasses RLS and does NOT use cookies, making it safe for unstable_cache.
 */
export async function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    // If we're in a build environment (CI/Vercel build), we might want to fail gracefully
    // to allow the build to complete, but logging a loud warning.
    const isBuild = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build";
    
    if (isBuild) {
      console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY is missing during build. This may cause issues if pages are pre-rendered.");
      // Return a placeholder client that will fail at runtime if actually used
      return createServerClient(supabaseUrl || "https://placeholder.supabase.co", "placeholder", {
        cookies: { getAll() { return [] }, setAll() { } },
      });
    }
    
    throw new Error("Missing Supabase Service Role configuration for server-side cache.");
  }

  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() { return [] },
      setAll() { },
    },
  });
}
