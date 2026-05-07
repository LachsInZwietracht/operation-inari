import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { markHl7ReviewResultReviewedForAdmin } from "@/lib/data/hl7-admin";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function respond(request: Request, status: "success" | "error", message: string, httpStatus = 200) {
  if (wantsJson(request)) {
    return NextResponse.json(status === "success" ? { ok: true, message } : { error: message }, { status: httpStatus });
  }

  const url = new URL("/admin/integrationen", request.url);
  url.searchParams.set(status, message);
  return NextResponse.redirect(url, { status: 303 });
}

function translateReviewError(message: string) {
  if (message === "HL7_REVIEW_RESULT_NOT_FOUND") return "HL7-Review-Ergebnis wurde nicht gefunden.";
  if (message === "HL7_IMPORT_JOB_NOT_FOUND") return "Zugehoeriger HL7-Importjob wurde nicht gefunden.";
  if (message === "HL7_REVIEW_RESULT_ALREADY_CLOSED") return "Dieses HL7-Review-Ergebnis ist bereits abgeschlossen.";
  return message;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const membership = await requireRole(ADMIN_ROLES, supabase);
  const formData = await request.formData();
  const resultId = String(formData.get("resultId") ?? "").trim();
  const note = String(formData.get("reviewNote") ?? "").trim();

  if (!resultId) {
    return respond(request, "error", "HL7-Review-Ergebnis wurde nicht angegeben.", 400);
  }

  try {
    const serviceClient = await createServiceClient();
    await markHl7ReviewResultReviewedForAdmin(resultId, note, serviceClient, {
      userId: membership.userId,
      organizationId: membership.organizationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return respond(request, "error", translateReviewError(message), 400);
  }

  return respond(request, "success", "HL7-Review-Ergebnis wurde als geprueft markiert.");
}
