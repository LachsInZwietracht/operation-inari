"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { ADMIN_ROLES } from "@/lib/auth/rbac"
import { ensureCurrentMembership, requireRole } from "@/lib/auth/access"
import { upsertReportRetentionPolicy } from "@/lib/data/report-retention"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { AppRole, OrganizationMembership } from "@/lib/types"

const INVITABLE_ROLES = ["admin", "dietitian", "assistant", "institution_admin"] as const satisfies readonly AppRole[]
const INVITE_TTL_DAYS = 14

function adminUsersRedirect(status: "success" | "error", message: string): never {
  redirect(`/admin/users?${status}=${encodeURIComponent(message)}`)
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function parseInviteRole(value: string): (typeof INVITABLE_ROLES)[number] | null {
  return INVITABLE_ROLES.includes(value as (typeof INVITABLE_ROLES)[number])
    ? value as (typeof INVITABLE_ROLES)[number]
    : null
}

async function getInviteRedirectTo() {
  const fallbackUrl = process.env.NEXT_PUBLIC_SITE_URL
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin") ?? fallbackUrl
  return origin ? `${origin}/login` : undefined
}

async function findAuthUserByEmail(serviceClient: Awaited<ReturnType<typeof createServiceClient>>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 1000) break
  }
  return null
}

async function getOrInviteAuthUser(serviceClient: Awaited<ReturnType<typeof createServiceClient>>, email: string, role: AppRole, organizationId: string) {
  const existingUser = await findAuthUserByEmail(serviceClient, email)
  if (existingUser) return { userId: existingUser.id, emailSent: false }

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: {
      organization_id: organizationId,
      role,
      invited_from: "operation-prodi",
    },
    redirectTo: await getInviteRedirectTo(),
  })

  if (error) {
    const userAfterInviteAttempt = await findAuthUserByEmail(serviceClient, email)
    if (userAfterInviteAttempt) return { userId: userAfterInviteAttempt.id, emailSent: false }
    throw new Error(error.message)
  }

  const userId = data.user?.id
  if (!userId) throw new Error("Supabase hat keinen Benutzer fuer die Einladung zurueckgegeben.")
  return { userId, emailSent: true }
}

async function writeAdminAudit(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  membership: OrganizationMembership,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await serviceClient.from("access_audit_logs").insert({
    organization_id: membership.organizationId,
    actor_user_id: membership.userId,
    action,
    target_type: "organization_membership",
    target_id: targetId,
    metadata,
  })
  if (error) throw new Error(error.message)
}

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

export async function inviteTeamMemberAction(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    adminUsersRedirect("error", "SUPABASE_SERVICE_ROLE_KEY fehlt. Einladungen benoetigen die Supabase Admin API.")
  }

  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const currentMembership = await ensureCurrentMembership(supabase)

  const email = normalizeEmail(getString(formData, "email"))
  const displayName = getString(formData, "displayName")
  const role = parseInviteRole(getString(formData, "role"))

  if (!email || !email.includes("@")) {
    adminUsersRedirect("error", "Bitte eine gueltige E-Mail-Adresse angeben.")
  }

  if (!role) {
    adminUsersRedirect("error", "Bitte eine gueltige Rolle fuer die Einladung waehlen.")
  }

  const serviceClient = await createServiceClient()
  const invite = await getOrInviteAuthUser(serviceClient, email, role, currentMembership.organizationId)

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: existingMembership, error: existingError } = await serviceClient
    .from("organization_memberships")
    .select("*")
    .eq("organization_id", currentMembership.organizationId)
    .eq("user_id", invite.userId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)

  if (existingMembership?.status === "active") {
    adminUsersRedirect("error", "Dieses Teammitglied ist bereits aktiv.")
  }

  const payload = {
    organization_id: currentMembership.organizationId,
    user_id: invite.userId,
    email,
    display_name: displayName || email,
    role,
    status: "invited" as const,
    invited_by: currentMembership.userId,
    invitation_sent_at: now,
    invitation_expires_at: expiresAt,
    revoked_at: null,
    joined_at: null,
  }

  const membershipMutation = existingMembership
    ? serviceClient
        .from("organization_memberships")
        .update(payload)
        .eq("id", existingMembership.id)
        .select("*")
        .single()
    : serviceClient
        .from("organization_memberships")
        .insert(payload)
        .select("*")
        .single()

  const { data: invitedMembership, error: membershipError } = await membershipMutation
  if (membershipError) throw new Error(membershipError.message)

  await writeAdminAudit(serviceClient, currentMembership, "team_invite_created", invitedMembership.id, {
    email,
    role,
    emailSent: invite.emailSent,
    invitationExpiresAt: expiresAt,
  })

  revalidatePath("/admin/users")
  adminUsersRedirect(
    "success",
    invite.emailSent
      ? `Einladung an ${email} wurde versendet.`
      : `${email} wurde als Einladung vorgemerkt; der Auth-Benutzer existierte bereits.`,
  )
}

export async function resendTeamInvitationAction(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    adminUsersRedirect("error", "SUPABASE_SERVICE_ROLE_KEY fehlt. Einladungen benoetigen die Supabase Admin API.")
  }

  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const currentMembership = await ensureCurrentMembership(supabase)
  const membershipId = getString(formData, "membershipId")
  const serviceClient = await createServiceClient()

  const { data: membership, error } = await serviceClient
    .from("organization_memberships")
    .select("*")
    .eq("id", membershipId)
    .eq("organization_id", currentMembership.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!membership) adminUsersRedirect("error", "Einladung wurde nicht gefunden.")

  const role = parseInviteRole(String(membership.role))
  if (!role) adminUsersRedirect("error", "Diese Rolle kann nicht erneut eingeladen werden.")

  let emailSent = false
  try {
    const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(String(membership.email), {
      data: {
        organization_id: currentMembership.organizationId,
        role,
        invited_from: "operation-prodi",
      },
      redirectTo: await getInviteRedirectTo(),
    })
    if (inviteError) throw inviteError
    emailSent = true
  } catch {
    emailSent = false
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error: updateError } = await serviceClient
    .from("organization_memberships")
    .update({
      status: "invited",
      invited_by: currentMembership.userId,
      invitation_sent_at: new Date().toISOString(),
      invitation_expires_at: expiresAt,
      revoked_at: null,
    })
    .eq("id", membership.id)

  if (updateError) throw new Error(updateError.message)

  await writeAdminAudit(serviceClient, currentMembership, "team_invite_resent", membership.id, {
    email: membership.email,
    role,
    emailSent,
    invitationExpiresAt: expiresAt,
  })

  revalidatePath("/admin/users")
  adminUsersRedirect(
    "success",
    emailSent
      ? `Einladung an ${membership.email} wurde erneut versendet.`
      : `${membership.email} bleibt eingeladen; Supabase hat keine neue Mail versendet.`,
  )
}

export async function revokeTeamInvitationAction(formData: FormData) {
  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const currentMembership = await ensureCurrentMembership(supabase)
  const membershipId = getString(formData, "membershipId")
  const serviceClient = await createServiceClient()

  const { data: membership, error } = await serviceClient
    .from("organization_memberships")
    .select("*")
    .eq("id", membershipId)
    .eq("organization_id", currentMembership.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!membership) adminUsersRedirect("error", "Einladung wurde nicht gefunden.")
  if (membership.user_id === currentMembership.userId) {
    adminUsersRedirect("error", "Die eigene Mitgliedschaft kann nicht widerrufen werden.")
  }

  const { error: updateError } = await serviceClient
    .from("organization_memberships")
    .update({
      status: "disabled",
      revoked_at: new Date().toISOString(),
    })
    .eq("id", membership.id)

  if (updateError) throw new Error(updateError.message)

  await writeAdminAudit(serviceClient, currentMembership, "team_invite_revoked", membership.id, {
    email: membership.email,
    previousStatus: membership.status,
  })

  revalidatePath("/admin/users")
  adminUsersRedirect("success", `Einladung fuer ${membership.email} wurde widerrufen.`)
}
