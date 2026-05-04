import { NextResponse } from "next/server";

import { disableWebhookEndpoint } from "@/lib/data/webhooks";
import { createClient } from "@/lib/supabase/server";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (message === "WEBHOOK_ENDPOINT_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(_request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  try {
    const { endpointId } = await params;
    const supabase = await createClient();
    const endpoint = await disableWebhookEndpoint(endpointId, supabase);
    return NextResponse.json(endpoint);
  } catch (error) {
    return toErrorResponse(error);
  }
}
