import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";

const conversionSchema = z.object({
  submissionId: z.string().uuid(),
  protocolId: z.string().uuid(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body" }, { status: 400 });
  }

  const parsed = conversionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { submissionId, protocolId } = parsed.data;

  const { data: submission, error: submissionError } = await supabase
    .from("digital_protocol_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    return NextResponse.json({ error: "Einreichung nicht gefunden" }, { status: 404 });
  }

  if (submission.status === "converted") {
    if (submission.converted_protocol_id === protocolId) {
      return NextResponse.json({ submission });
    }

    return NextResponse.json({ error: "Einreichung wurde bereits uebernommen" }, { status: 409 });
  }

  const { data: protocol, error: protocolError } = await supabase
    .from("nutrition_protocols")
    .select("id, patient_id")
    .eq("id", protocolId)
    .single();

  if (protocolError || !protocol) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }

  if (protocol.patient_id !== submission.patient_id) {
    return NextResponse.json(
      { error: "Protokoll und Einreichung gehoeren nicht zum selben Patienten" },
      { status: 400 },
    );
  }

  const { data: updatedSubmission, error: updateError } = await supabase
    .from("digital_protocol_submissions")
    .update({
      status: "converted",
      converted_protocol_id: protocolId,
    })
    .eq("id", submissionId)
    .select("*")
    .single();

  if (updateError || !updatedSubmission) {
    return NextResponse.json(
      { error: updateError?.message ?? "Einreichung konnte nicht aktualisiert werden" },
      { status: 500 },
    );
  }

  await writeAccessAuditLog(supabase, {
    action: "digital_protocol_submission_converted",
    targetType: "digital_protocol_submission",
    targetId: updatedSubmission.id,
    metadata: {
      patientId: submission.patient_id,
      linkId: submission.link_id,
      protocolId,
    },
  });

  return NextResponse.json({ submission: updatedSubmission });
}
