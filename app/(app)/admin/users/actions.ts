"use server"

import { revalidatePath } from "next/cache"

import { ADMIN_ROLES } from "@/lib/auth/rbac"
import { ensureCurrentMembership, requireRole } from "@/lib/auth/access"
import { upsertReportRetentionPolicy } from "@/lib/data/report-retention"
import { createClient } from "@/lib/supabase/server"

export async function updateReportRetentionPolicyAction(formData: FormData) {
  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const membership = await ensureCurrentMembership(supabase)

  const retentionYearsRaw = Number(formData.get("retentionYears") ?? 10)
  const retentionYears = Number.isFinite(retentionYearsRaw) ? retentionYearsRaw : 10

  await upsertReportRetentionPolicy(
    {
      id: String(formData.get("policyId") ?? "") || undefined,
      organizationId: membership.organizationId,
      name: String(formData.get("name") ?? "Standard-Aufbewahrung"),
      retentionYears,
      autoDeleteEnabled: formData.get("autoDeleteEnabled") === "on",
      requireAdminApproval: formData.get("requireAdminApproval") === "on",
      legalHoldEnabled: formData.get("legalHoldEnabled") === "on",
      notes: String(formData.get("notes") ?? ""),
    },
    supabase,
  )

  revalidatePath("/admin/users")
}
