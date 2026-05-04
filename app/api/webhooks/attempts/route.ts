import { NextResponse } from "next/server";

import { listWebhookDeliveryAttempts } from "@/lib/data/webhooks";
import { createClient } from "@/lib/supabase/server";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const attempts = await listWebhookDeliveryAttempts(supabase);
    return NextResponse.json(attempts);
  } catch (error) {
    return toErrorResponse(error);
  }
}
