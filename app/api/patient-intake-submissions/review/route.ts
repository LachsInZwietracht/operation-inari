import { NextResponse } from "next/server"
import { z } from "zod"

import { writeAccessAuditLog } from "@/lib/audit/access-audit"
import { createClient } from "@/lib/supabase/server"

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  action: z.literal("discard"),
  reviewerNotes: z.string().trim().max(4_000).optional(),
})

export async function POST(request: Request) {
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const { data: submission, error: submissionError } = await supabase
    .from("patient_intake_submissions")
    .select("id, link_id, status")
    .eq("id", parsed.data.submissionId)
    .single()

  if (submissionError || !submission) {
    return NextResponse.json({ error: "Einreichung nicht gefunden" }, { status: 404 })
  }
  if (submission.status === "applied") {
    return NextResponse.json({ error: "Eine übernommene Einreichung kann nicht verworfen werden" }, { status: 409 })
  }

  const { data: link } = await supabase
    .from("patient_intake_links")
    .select("user_id")
    .eq("id", submission.link_id)
    .single()

  if (!link || link.user_id !== user.id) {
    return NextResponse.json({ error: "Kein Zugriff auf diese Einladung" }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from("patient_intake_submissions")
    .update({
      status: "discarded",
      reviewer_notes: parsed.data.reviewerNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", submission.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await writeAccessAuditLog(supabase, {
    action: "patient_intake_submission_discarded",
    targetType: "patient_intake_submission",
    targetId: submission.id,
    metadata: { linkId: submission.link_id },
  })

  return NextResponse.json({ success: true })
}
