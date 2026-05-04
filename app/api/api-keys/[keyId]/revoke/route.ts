import { NextResponse } from "next/server";

import { revokeApiKey } from "@/lib/data/api-keys";
import { createClient } from "@/lib/supabase/server";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (message === "API_KEY_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const { keyId } = await params;
    const supabase = await createClient();
    const apiKey = await revokeApiKey(keyId, supabase);
    return NextResponse.json(apiKey);
  } catch (error) {
    return toErrorResponse(error);
  }
}
