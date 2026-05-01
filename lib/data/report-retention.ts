import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client"
import type { ReportRetentionPolicy } from "@/lib/types"

interface ReportRetentionPolicyRow {
  id: string
  user_id: string
  organization_id: string | null
  name: string
  retention_years: number
  auto_delete_enabled: boolean
  require_admin_approval: boolean
  legal_hold_enabled: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

interface UpsertReportRetentionPolicyInput {
  id?: string
  organizationId?: string
  name: string
  retentionYears: number
  autoDeleteEnabled: boolean
  requireAdminApproval: boolean
  legalHoldEnabled: boolean
  notes?: string
}

function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase
  return createBrowserSupabaseClient()
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error) throw new Error(error.message)
  return data.user?.id ?? null
}

function mapPolicy(row: ReportRetentionPolicyRow): ReportRetentionPolicy {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id ?? undefined,
    name: row.name,
    retentionYears: row.retention_years,
    autoDeleteEnabled: row.auto_delete_enabled,
    requireAdminApproval: row.require_admin_approval,
    legalHoldEnabled: row.legal_hold_enabled,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function calculateReportRetentionUntil(exportedAt: Date, retentionYears: number): string {
  const next = new Date(exportedAt)
  next.setFullYear(next.getFullYear() + retentionYears)
  return next.toISOString()
}

export function getReportRetentionLabel(policy: Pick<ReportRetentionPolicy, "retentionYears" | "autoDeleteEnabled" | "requireAdminApproval" | "legalHoldEnabled">) {
  const review = policy.requireAdminApproval ? "Admin-Freigabe vor Loeschung" : "keine Admin-Freigabe"
  const automation = policy.autoDeleteEnabled ? "automatische Loeschpruefung aktiv" : "keine automatische Loeschung"
  const hold = policy.legalHoldEnabled ? "Legal Hold aktivierbar" : "ohne Legal Hold"
  return `Aufbewahrung: ${policy.retentionYears} Jahre, ${review}, ${automation}, ${hold}`
}

export async function fetchReportRetentionPolicy(supabase?: SupabaseClient): Promise<ReportRetentionPolicy | null> {
  const client = resolveClient(supabase)
  const userId = await getAuthenticatedUserId(client)
  if (!userId) return null

  const { data, error } = await client
    .from("report_retention_policies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapPolicy(data as ReportRetentionPolicyRow) : null
}

export async function getOrCreateReportRetentionPolicy(
  supabase?: SupabaseClient,
  organizationId?: string,
): Promise<ReportRetentionPolicy> {
  const client = resolveClient(supabase)
  const userId = await getAuthenticatedUserId(client)
  if (!userId) throw new Error("AUTH_REQUIRED")

  const existing = await fetchReportRetentionPolicy(client)
  if (existing) return existing

  const { data, error } = await client
    .from("report_retention_policies")
    .insert({
      user_id: userId,
      organization_id: organizationId ?? null,
      name: "Standard-Aufbewahrung",
      retention_years: 10,
      auto_delete_enabled: false,
      require_admin_approval: true,
      legal_hold_enabled: false,
      notes: "Standard fuer patientengebundene Berichte.",
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapPolicy(data as ReportRetentionPolicyRow)
}

export async function upsertReportRetentionPolicy(
  input: UpsertReportRetentionPolicyInput,
  supabase?: SupabaseClient,
): Promise<ReportRetentionPolicy> {
  const client = resolveClient(supabase)
  const userId = await getAuthenticatedUserId(client)
  if (!userId) throw new Error("AUTH_REQUIRED")

  const retentionYears = Math.max(1, Math.min(30, Math.round(input.retentionYears)))

  const { data, error } = await client
    .from("report_retention_policies")
    .upsert(
      {
        ...(input.id ? { id: input.id } : {}),
        user_id: userId,
        organization_id: input.organizationId ?? null,
        name: input.name.trim() || "Standard-Aufbewahrung",
        retention_years: retentionYears,
        auto_delete_enabled: input.autoDeleteEnabled,
        require_admin_approval: input.requireAdminApproval,
        legal_hold_enabled: input.legalHoldEnabled,
        notes: input.notes?.trim() || null,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapPolicy(data as ReportRetentionPolicyRow)
}
