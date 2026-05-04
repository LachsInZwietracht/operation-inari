import { NextResponse } from "next/server";

import { createWebhookEndpoint, listWebhookEndpoints } from "@/lib/data/webhooks";
import { createClient } from "@/lib/supabase/server";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (message === "WEBHOOK_NAME_REQUIRED") return NextResponse.json({ error: message }, { status: 400 });
  if (message === "WEBHOOK_URL_INVALID") return NextResponse.json({ error: message }, { status: 400 });
  if (message === "WEBHOOK_URL_HTTPS_REQUIRED") return NextResponse.json({ error: message }, { status: 400 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const endpoints = await listWebhookEndpoints(supabase);
    return NextResponse.json(endpoints);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; url?: string; events?: unknown };
    const supabase = await createClient();
    const result = await createWebhookEndpoint(
      {
        name: String(body.name ?? ""),
        url: String(body.url ?? ""),
        events: body.events,
      },
      supabase,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
