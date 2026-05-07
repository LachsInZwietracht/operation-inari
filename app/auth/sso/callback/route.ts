import { NextResponse } from "next/server";

import { completeVerifiedSsoLogin } from "@/lib/data/sso";
import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function redirectToLogin(request: Request, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("sso_error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (!code) {
    return redirectToLogin(request, "missing_code");
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    await supabase.auth.signOut();
    return redirectToLogin(request, "code_exchange_failed");
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    await supabase.auth.signOut();
    return redirectToLogin(request, "user_verification_failed");
  }

  try {
    const result = await completeVerifiedSsoLogin(data.user);
    if (result.status === "applied" || result.status === "owner_preserved") {
      return NextResponse.redirect(new URL(next, request.url));
    }

    await supabase.auth.signOut();
    return redirectToLogin(request, result.reason ?? "role_mapping_failed");
  } catch {
    await supabase.auth.signOut();
    return redirectToLogin(request, "callback_failed");
  }
}
