import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { countAnsweredSections, intakeSubmitRequestSchema } from "@/lib/intake/schema";

/**
 * Public, unauthenticated endpoint for the onboarding intake form.
 * Mirrors `app/api/protokoll/submit/route.ts`: the link id is the only
 * credential, writes go through the service role, and nothing is applied to a
 * patient record here.
 */
export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 200_000) {
    return NextResponse.json({ error: "Request zu groß" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = intakeSubmitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { linkId, payload } = parsed.data;

  const supabase = await createServiceClient();

  const { data: link, error: linkError } = await supabase
    .from("patient_intake_links")
    .select("*")
    .eq("id", linkId)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await supabase
      .from("patient_intake_links")
      .update({ status: "expired" })
      .eq("id", linkId);

    return NextResponse.json({ error: "Diese Einladung ist abgelaufen" }, { status: 410 });
  }

  if (link.status !== "pending") {
    return NextResponse.json(
      { error: "Diese Einladung wurde bereits ausgefüllt oder ist nicht mehr aktiv" },
      { status: 409 },
    );
  }

  const { data: submission, error: insertError } = await supabase
    .from("patient_intake_submissions")
    .insert({
      link_id: linkId,
      patient_id: link.patient_id,
      payload,
    })
    .select("id")
    .single();

  if (insertError || !submission) {
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "Diese Einladung wurde bereits ausgefüllt" },
        { status: 409 },
      );
    }

    console.error("Failed to insert intake submission:", insertError);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Angaben" },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("patient_intake_links")
    .update({ status: "received" })
    .eq("id", linkId);

  if (updateError) {
    console.error("Failed to update intake link status:", updateError);
  }

  // Metadata deliberately excludes payload contents — this is health data.
  await writeAccessAuditLog(
    supabase,
    {
      action: "patient_intake_submission_received",
      targetType: "patient_intake_submission",
      targetId: submission.id,
      metadata: {
        linkId,
        patientId: link.patient_id,
        sectionsAnswered: countAnsweredSections(payload),
        submittedBy: "patient_portal",
      },
    },
    { actorUserId: link.user_id },
  );

  return NextResponse.json({ success: true });
}
