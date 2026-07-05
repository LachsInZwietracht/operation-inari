import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/errors";
import { revokeApiKey } from "@/lib/data/api-keys";
import { createClient } from "@/lib/supabase/server";

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
