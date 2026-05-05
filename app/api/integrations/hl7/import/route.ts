import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/access";
import { INSTITUTION_ROLES } from "@/lib/auth/rbac";
import { hasApiKeyAuthorization, verifyApiKeyRequest } from "@/lib/data/api-keys";
import { importHl7Message } from "@/lib/integrations/hl7";
import { createClient } from "@/lib/supabase/server";

type JsonHl7ImportBody = {
  sourceSystem?: string;
  message?: string;
  allowCreatePatients?: boolean;
};

async function parseRequestBody(request: Request): Promise<JsonHl7ImportBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as JsonHl7ImportBody;
    return {
      sourceSystem: body.sourceSystem,
      message: typeof body.message === "string" ? body.message : "",
      allowCreatePatients: body.allowCreatePatients,
    };
  }

  return {
    sourceSystem: request.headers.get("x-hl7-source-system") ?? undefined,
    message: await request.text(),
  };
}

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (message.startsWith("HL7_")) return NextResponse.json({ error: message }, { status: 400 });
  return NextResponse.json({ error: "HL7_IMPORT_FAILED" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await parseRequestBody(request);
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "HL7_MESSAGE_REQUIRED" }, { status: 400 });
    }

    if (hasApiKeyAuthorization(request)) {
      const apiKey = await verifyApiKeyRequest(request, "integrations:hl7:write");
      if (!apiKey.ok) {
        return NextResponse.json({ error: apiKey.error }, { status: apiKey.status });
      }

      const summary = await importHl7Message({
        supabase: apiKey.serviceClient,
        organizationId: apiKey.key.organizationId,
        actorUserId: apiKey.key.userId,
        sourceSystem: body.sourceSystem,
        message: body.message,
        allowCreatePatients: body.allowCreatePatients,
      });
      return NextResponse.json(summary, { status: summary.duplicate ? 200 : 201 });
    }

    const supabase = await createClient();
    const membership = await requireRole(INSTITUTION_ROLES, supabase);
    const summary = await importHl7Message({
      supabase,
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      sourceSystem: body.sourceSystem,
      message: body.message,
      allowCreatePatients: body.allowCreatePatients,
    });

    return NextResponse.json(summary, { status: summary.duplicate ? 200 : 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
