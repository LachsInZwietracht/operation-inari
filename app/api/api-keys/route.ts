import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/errors";
import { createApiKey, listApiKeys } from "@/lib/data/api-keys";
import { createClient } from "@/lib/supabase/server";

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
