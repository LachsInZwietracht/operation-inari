import { NextResponse } from "next/server";

import { createApiKey, listApiKeys } from "@/lib/data/api-keys";
import { createClient } from "@/lib/supabase/server";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (message === "API_KEY_NAME_REQUIRED") return NextResponse.json({ error: message }, { status: 400 });
  if (message === "API_KEY_EXPIRY_INVALID") return NextResponse.json({ error: message }, { status: 400 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const apiKeys = await listApiKeys(supabase);
    return NextResponse.json(apiKeys);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; scopes?: unknown; expiresAt?: string | null };
    const supabase = await createClient();
    const result = await createApiKey(
      {
        name: String(body.name ?? ""),
        scopes: body.scopes,
        expiresAt: body.expiresAt ?? null,
      },
      supabase,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
