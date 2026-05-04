import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { queueWebhookDeliveryAttempts } from "@/lib/data/webhooks";

const submissionSchema = z.object({
  linkId: z.string().uuid(),
  patientId: z.string().uuid(),
  days: z.array(
    z.object({
      date: z.string(),
      entries: z.array(
        z.object({
          mealSlot: z.string(),
          freeText: z.string().min(1),
          time: z.string().optional(),
        })
      ),
    })
  ),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { linkId, patientId, days, notes } = parsed.data;

  const supabase = await createServiceClient();

  // Verify link exists, is pending, and not expired
  const { data: link, error: linkError } = await supabase
    .from("patient_digital_protocol_links")
    .select("*")
    .eq("id", linkId)
    .single();

  if (linkError || !link) {
    return NextResponse.json(
      { error: "Protokoll-Link nicht gefunden" },
      { status: 404 }
    );
  }

  // Auto-expire if past expires_at
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await supabase
      .from("patient_digital_protocol_links")
      .update({ status: "expired" })
      .eq("id", linkId);

    return NextResponse.json(
      { error: "Dieser Link ist abgelaufen" },
      { status: 410 }
    );
  }

  if (link.status !== "pending") {
    return NextResponse.json(
      { error: "Dieses Protokoll wurde bereits eingereicht oder ist nicht mehr aktiv" },
      { status: 409 }
    );
  }

  if (link.patient_id !== patientId) {
    return NextResponse.json(
      { error: "Patienten-ID stimmt nicht überein" },
      { status: 400 }
    );
  }

  // Insert submission
  const { data: submission, error: insertError } = await supabase
    .from("digital_protocol_submissions")
    .insert({
      link_id: linkId,
      patient_id: patientId,
      days,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (insertError || !submission) {
    console.error("Failed to insert protocol submission:", insertError);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Einreichung" },
      { status: 500 }
    );
  }

  // Update link status to "received"
  const { error: updateError } = await supabase
    .from("patient_digital_protocol_links")
    .update({ status: "received" })
    .eq("id", linkId);

  if (updateError) {
    console.error("Failed to update link status:", updateError);
  }

  await writeAccessAuditLog(
    supabase,
    {
      action: "digital_protocol_submission_received",
      targetType: "digital_protocol_submission",
      targetId: submission.id,
      metadata: {
        patientId,
        linkId,
        dayCount: days.length,
        entryCount: days.reduce((total, day) => total + day.entries.length, 0),
        submittedBy: "patient_portal",
      },
    },
    { actorUserId: link.user_id },
  );

  await queueWebhookDeliveryAttempts(
    {
      event: "digital_protocol_submission_received",
      targetType: "digital_protocol_submission",
      targetId: submission.id,
      payload: {
        patientId,
        linkId,
        dayCount: days.length,
        entryCount: days.reduce((total, day) => total + day.entries.length, 0),
        submittedBy: "patient_portal",
      },
    },
    { actorUserId: link.user_id },
  );

  return NextResponse.json({ success: true });
}
