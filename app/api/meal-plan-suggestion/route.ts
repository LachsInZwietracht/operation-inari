import { NextResponse } from "next/server"
import { z } from "zod"

import { requireRole } from "@/lib/auth/access"
import { createClient } from "@/lib/supabase/server"
import { fetchPatientByRef } from "@/lib/data/patients"
import { fetchRecipes } from "@/lib/data/recipes"
import { buildSafePlanSuggestion } from "@/lib/nutrition/plan-suggestion"
import { writeAccessAuditLog } from "@/lib/audit/access-audit"

const requestSchema = z.object({ patientId: z.string().uuid() })

/** Returns a review-only diet-plan draft. It never writes a plan itself. */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Patientenakte" }, { status: 400 })

  const supabase = await createClient()
  try {
    const membership = await requireRole(["owner", "admin", "dietitian"], supabase)
    const patient = await fetchPatientByRef(parsed.data.patientId, supabase)
    if (!patient) return NextResponse.json({ error: "Patient nicht gefunden" }, { status: 404 })

    const [{ data: allergenRows, error: allergenError }, recipes] = await Promise.all([
      supabase.from("patient_allergens").select("*").eq("patient_id", patient.id),
      fetchRecipes({ supabase }),
    ])
    if (allergenError) return NextResponse.json({ error: allergenError.message }, { status: 500 })

    const patientAllergens = (allergenRows ?? []).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      allergenId: row.allergen_id,
      type: row.type,
      severity: row.severity,
      diagnosedDate: row.diagnosed_date ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    const suggestion = buildSafePlanSuggestion({ patient, recipes, patientAllergens })

    await writeAccessAuditLog(supabase, {
      action: "meal_plan_suggestion_created",
      targetType: "patient",
      targetId: patient.id,
      metadata: { role: membership.role, blocked: suggestion.blockedReasons.length > 0 },
    })
    return NextResponse.json(suggestion)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vorschlag konnte nicht erstellt werden"
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
