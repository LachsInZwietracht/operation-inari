import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function redirectWithError(request: Request) {
  const url = new URL("/passwort-vergessen", request.url);
  url.searchParams.set("error", "link_invalid");
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectWithError(request);
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return redirectWithError(request);
    return NextResponse.redirect(new URL(next, request.url));
  }

  return redirectWithError(request);
}
