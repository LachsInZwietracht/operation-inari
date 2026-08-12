import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { buildIntakeApplyPlan, mergePatientUpdate } from "@/lib/intake/apply-submission";
import { intakePayloadSchema } from "@/lib/intake/schema";

const applySchema = z.object({
  submissionId: z.string().uuid(),
  payload: intakePayloadSchema.optional(),
  reviewerNotes: z.string().trim().max(4_000).optional(),
});

/**
 * Applies a reviewed intake submission: creates the patient when the invitation
 * was not bound to one, otherwise updates the existing record.
 *
 * PostgREST gives us no transaction, so the order is patient -> child rows ->
 * status flip. A failure part-way leaves the submission re-appliable, and every
 * child write is an upsert so a retry is idempotent.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
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

  const { submissionId } = parsed.data;

  const { data: submission, error: submissionError } = await supabase
    .from("patient_intake_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    return NextResponse.json({ error: "Einreichung nicht gefunden" }, { status: 404 });
  }

  if (submission.status === "applied") {
    return NextResponse.json(
      {
        error: "Einreichung wurde bereits übernommen",
        patientId: submission.applied_patient_id,
      },
      { status: 409 },
    );
  }
  if (submission.status === "discarded") {
    return NextResponse.json(
      { error: "Einreichung wurde verworfen" },
      { status: 409 },
    );
  }

  const { data: link, error: linkError } = await supabase
    .from("patient_intake_links")
    .select("id, user_id, patient_id")
    .eq("id", submission.link_id)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
  }

  if (link.user_id !== user.id) {
    return NextResponse.json({ error: "Kein Zugriff auf diese Einladung" }, { status: 403 });
  }

  // Re-validate: the payload was written by an unauthenticated caller, and the
  // catalog may have changed since it was submitted.
  const payloadResult = intakePayloadSchema.safeParse(
    parsed.data.payload ?? submission.payload,
  );
  if (!payloadResult.success) {
    return NextResponse.json(
      { error: "Die Angaben sind unvollständig und können nicht übernommen werden." },
      { status: 422 },
    );
  }

  const plan = buildIntakeApplyPlan(
    payloadResult.data,
    submission.submitted_at ?? new Date().toISOString(),
  );
  const reviewerNotes = parsed.data.reviewerNotes?.trim() || null;
  const reviewNoteBlock = reviewerNotes
    ? `Aufnahmeprüfung ${new Date().toLocaleDateString("de-DE")}: ${reviewerNotes}`
    : null;

  let patientId = link.patient_id as string | null;

  if (patientId) {
    const { data: existing, error: existingError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Patient nicht gefunden" }, { status: 404 });
    }

    const update = mergePatientUpdate(plan.patientFields, existing);
    if (reviewNoteBlock) {
      const previousNotes = typeof existing.admin_notes === "string"
        ? existing.admin_notes.trim()
        : "";
      update.admin_notes = previousNotes
        ? `${previousNotes}\n\n${reviewNoteBlock}`
        : reviewNoteBlock;
    }
    const { error: updateError } = await supabase
      .from("patients")
      .update(update)
      .eq("id", patientId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from("patients")
      .insert({
        ...plan.patientFields,
        user_id: user.id,
        status: "active",
        care_setting: "ambulatory",
        indications: [],
        admin_notes: reviewNoteBlock,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Patient konnte nicht angelegt werden" },
        { status: 500 },
      );
    }

    patientId = created.id;

    const { error: linkUpdateError } = await supabase
      .from("patient_intake_links")
      .update({ patient_id: patientId })
      .eq("id", link.id);

    if (linkUpdateError) {
      console.error("Failed to bind intake link to patient:", linkUpdateError);
    }
  }

  if (plan.allergens.length > 0) {
    const { error: allergenError } = await supabase.from("patient_allergens").upsert(
      plan.allergens.map((entry) => ({
        ...entry,
        patient_id: patientId,
        user_id: user.id,
      })),
      { onConflict: "patient_id,user_id,allergen_id" },
    );

    if (allergenError) {
      return NextResponse.json({ error: allergenError.message }, { status: 500 });
    }
  }

  if (plan.foodPreferences.length > 0) {
    const { error: preferenceError } = await supabase
      .from("patient_food_preferences")
      .upsert(
        plan.foodPreferences.map((entry) => ({
          ...entry,
          patient_id: patientId,
          user_id: user.id,
        })),
        { onConflict: "patient_id,user_id,food_key" },
      );

    if (preferenceError) {
      return NextResponse.json({ error: preferenceError.message }, { status: 500 });
    }
  }

  const { error: anthropometricError } = await supabase
    .from("patient_anthropometrics")
    .insert({
      ...plan.anthropometrics,
      patient_id: patientId,
      user_id: user.id,
    });

  if (anthropometricError) {
    // Non-fatal: the patient record is the deliverable, the measurement is a bonus.
    console.error("Failed to store intake anthropometrics:", anthropometricError);
  }

  const { error: statusError } = await supabase
    .from("patient_intake_submissions")
    .update({
      status: "applied",
      patient_id: patientId,
      applied_patient_id: patientId,
      payload: payloadResult.data,
      reviewer_notes: reviewerNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", submissionId);

  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  await writeAccessAuditLog(supabase, {
    action: "patient_intake_submission_applied",
    targetType: "patient_intake_submission",
    targetId: submissionId,
    metadata: {
      linkId: link.id,
      patientId,
      createdPatient: !link.patient_id,
      allergenCount: plan.allergens.length,
      foodPreferenceCount: plan.foodPreferences.length,
      correctedBeforeApply: Boolean(parsed.data.payload),
      hasReviewerNotes: Boolean(reviewerNotes),
    },
  });

  return NextResponse.json({ success: true, patientId });
}
