"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { ADMIN_ROLES, hasAnyRole } from "@/lib/auth/rbac"
import { ensureCurrentMembership, requireRole } from "@/lib/auth/access"
import { upsertReportRetentionPolicy } from "@/lib/data/report-retention"
import { disableSsoConfig, disableSsoRoleMapping, upsertSsoConfig, upsertSsoRoleMapping } from "@/lib/data/sso"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { AppRole, OrganizationMembership, SsoConfigStatus, SsoMappableRole, SsoProviderType, SsoRoleMappingStatus } from "@/lib/types"

const MEMBERSHIP_ROLES = ["owner", "admin", "dietitian", "assistant", "institution_admin"] as const satisfies readonly AppRole[]
const MEMBERSHIP_STATUSES = ["active", "invited", "disabled"] as const
const INVITABLE_ROLES = ["admin", "dietitian", "assistant", "institution_admin"] as const satisfies readonly AppRole[]
const INVITE_TTL_DAYS = 14
const SSO_PROVIDER_TYPES = ["oidc", "saml"] as const satisfies readonly SsoProviderType[]
const SSO_STATUSES = ["draft", "active", "disabled"] as const satisfies readonly SsoConfigStatus[]
const SSO_MAPPING_ROLES = ["admin", "dietitian", "assistant", "institution_admin"] as const satisfies readonly SsoMappableRole[]
const SSO_MAPPING_STATUSES = ["active", "disabled"] as const satisfies readonly SsoRoleMappingStatus[]

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

function parseMembershipRole(value: string): AppRole | null {
  return MEMBERSHIP_ROLES.includes(value as AppRole) ? value as AppRole : null
}

function parseMembershipStatus(value: string): OrganizationMembership["status"] | null {
  return MEMBERSHIP_STATUSES.includes(value as OrganizationMembership["status"])
    ? value as OrganizationMembership["status"]
    : null
}

function parseSsoProviderType(value: string): SsoProviderType | null {
  return SSO_PROVIDER_TYPES.includes(value as SsoProviderType) ? value as SsoProviderType : null
}

function parseSsoStatus(value: string): SsoConfigStatus | null {
  return SSO_STATUSES.includes(value as SsoConfigStatus) ? value as SsoConfigStatus : null
}

function parseSsoMappingRole(value: string): SsoMappableRole | null {
  return SSO_MAPPING_ROLES.includes(value as SsoMappableRole) ? value as SsoMappableRole : null
}

function parseSsoMappingStatus(value: string): SsoRoleMappingStatus | null {
  return SSO_MAPPING_STATUSES.includes(value as SsoRoleMappingStatus) ? value as SsoRoleMappingStatus : null
}

function parseDomainList(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((domain) => domain.trim())
    .filter(Boolean)
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

export async function upsertSsoConfigAction(formData: FormData) {
  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)

  const providerType = parseSsoProviderType(getString(formData, "providerType"))
  const status = parseSsoStatus(getString(formData, "status"))

  if (!providerType) adminUsersRedirect("error", "Bitte einen gueltigen SSO-Provider waehlen.")
  if (!status) adminUsersRedirect("error", "Bitte einen gueltigen SSO-Status waehlen.")

  try {
    await upsertSsoConfig(
      {
        id: getString(formData, "configId") || undefined,
        providerType,
        status,
        displayName: getString(formData, "displayName"),
        domains: parseDomainList(getString(formData, "domains")),
        issuerUrl: getString(formData, "issuerUrl"),
        metadataUrl: getString(formData, "metadataUrl"),
        metadataXml: getString(formData, "metadataXml"),
        clientId: getString(formData, "clientId"),
        entityId: getString(formData, "entityId"),
        ssoUrl: getString(formData, "ssoUrl"),
        loginHintParameter: getString(formData, "loginHintParameter") || "login_hint",
      },
      supabase,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const translated = message === "SSO_DISPLAY_NAME_REQUIRED"
      ? "Bitte einen Namen fuer die SSO-Konfiguration angeben."
      : message === "SSO_DOMAIN_REQUIRED"
        ? "Bitte mindestens eine E-Mail-Domain angeben."
        : message === "SSO_OIDC_ISSUER_REQUIRED"
          ? "OIDC benoetigt mindestens Issuer URL oder Metadata URL."
          : message === "SSO_SAML_METADATA_REQUIRED"
            ? "SAML benoetigt Metadata URL, Metadata XML oder SSO URL."
            : message
    adminUsersRedirect("error", translated)
  }

  revalidatePath("/admin/users")
  adminUsersRedirect("success", "SSO-Konfiguration wurde gespeichert.")
}

export async function disableSsoConfigAction(formData: FormData) {
  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const configId = getString(formData, "configId")
  if (!configId) adminUsersRedirect("error", "SSO-Konfiguration wurde nicht angegeben.")

  await disableSsoConfig(configId, supabase)

  revalidatePath("/admin/users")
  adminUsersRedirect("success", "SSO-Konfiguration wurde deaktiviert.")
}

export async function upsertSsoRoleMappingAction(formData: FormData) {
  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)

  const role = parseSsoMappingRole(getString(formData, "role"))
  const status = parseSsoMappingStatus(getString(formData, "status"))
  if (!role) adminUsersRedirect("error", "Bitte eine gueltige Zielrolle fuer die SSO-Zuordnung waehlen.")
  if (!status) adminUsersRedirect("error", "Bitte einen gueltigen Status fuer die SSO-Zuordnung waehlen.")

  const priorityRaw = Number(getString(formData, "priority") || 100)
  try {
    await upsertSsoRoleMapping(
      {
        id: getString(formData, "mappingId") || undefined,
        ssoConfigId: getString(formData, "ssoConfigId"),
        claimName: getString(formData, "claimName"),
        claimValue: getString(formData, "claimValue"),
        role,
        priority: Number.isFinite(priorityRaw) ? priorityRaw : 100,
        status,
      },
      supabase,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const translated = message === "SSO_CONFIG_REQUIRED"
      ? "Bitte zuerst eine SSO-Konfiguration speichern."
      : message === "SSO_MAPPING_CLAIM_NAME_REQUIRED"
        ? "Bitte einen Claim-Namen angeben."
        : message === "SSO_MAPPING_CLAIM_VALUE_REQUIRED"
          ? "Bitte einen Claim-Wert angeben."
          : message === "SSO_MAPPING_PRIORITY_INVALID"
            ? "Prioritaet muss zwischen 0 und 10000 liegen."
            : message === "SSO_MAPPING_ROLE_INVALID"
              ? "Diese Rolle kann nicht automatisch per SSO vergeben werden."
              : message
    adminUsersRedirect("error", translated)
  }

  revalidatePath("/admin/users")
  adminUsersRedirect("success", "SSO-Rollenzuordnung wurde gespeichert.")
}

export async function disableSsoRoleMappingAction(formData: FormData) {
  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const mappingId = getString(formData, "mappingId")
  if (!mappingId) adminUsersRedirect("error", "SSO-Rollenzuordnung wurde nicht angegeben.")

  await disableSsoRoleMapping(mappingId, supabase)

  revalidatePath("/admin/users")
  adminUsersRedirect("success", "SSO-Rollenzuordnung wurde deaktiviert.")
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

export async function updateTeamMemberAccessAction(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    adminUsersRedirect("error", "SUPABASE_SERVICE_ROLE_KEY fehlt. Rollenwechsel benoetigen serverseitige Admin-Rechte.")
  }

  const supabase = await createClient()
  await requireRole(ADMIN_ROLES, supabase)
  const currentMembership = await ensureCurrentMembership(supabase)

  const membershipId = getString(formData, "membershipId")
  const nextRole = parseMembershipRole(getString(formData, "role"))
  const nextStatus = parseMembershipStatus(getString(formData, "status"))

  if (!membershipId) adminUsersRedirect("error", "Teammitglied wurde nicht angegeben.")
  if (!nextRole) adminUsersRedirect("error", "Bitte eine gueltige Rolle waehlen.")
  if (!nextStatus) adminUsersRedirect("error", "Bitte einen gueltigen Status waehlen.")

  const serviceClient = await createServiceClient()
  const { data: membership, error } = await serviceClient
    .from("organization_memberships")
    .select("*")
    .eq("id", membershipId)
    .eq("organization_id", currentMembership.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!membership) adminUsersRedirect("error", "Teammitglied wurde nicht gefunden.")

  const previousRole = parseMembershipRole(String(membership.role))
  const previousStatus = parseMembershipStatus(String(membership.status))
  if (!previousRole || !previousStatus) {
    adminUsersRedirect("error", "Die bestehende Mitgliedschaft enthaelt eine unbekannte Rolle oder einen unbekannten Status.")
  }

  if (nextStatus === "invited" && previousStatus !== "invited") {
    adminUsersRedirect("error", "Aktive oder deaktivierte Teammitglieder koennen nicht ohne neue Einladung auf eingeladen gesetzt werden.")
  }

  const isOwnerActor = currentMembership.role === "owner"
  const touchesOwnerRole = previousRole === "owner" || nextRole === "owner"
  if (touchesOwnerRole && !isOwnerActor) {
    adminUsersRedirect("error", "Nur Owner koennen Owner-Mitgliedschaften aendern.")
  }

  const targetIsCurrentUser = String(membership.user_id) === currentMembership.userId
  if (targetIsCurrentUser && (!hasAnyRole(nextRole, ADMIN_ROLES) || nextStatus !== "active")) {
    adminUsersRedirect("error", "Die eigene Admin-Berechtigung kann nicht entzogen oder deaktiviert werden.")
  }

  if (previousRole === "owner" && previousStatus === "active" && (nextRole !== "owner" || nextStatus !== "active")) {
    const { count, error: countError } = await serviceClient
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", currentMembership.organizationId)
      .eq("role", "owner")
      .eq("status", "active")

    if (countError) throw new Error(countError.message)
    if ((count ?? 0) <= 1) {
      adminUsersRedirect("error", "Der letzte aktive Owner kann nicht herabgestuft oder deaktiviert werden.")
    }
  }

  if (previousRole === nextRole && previousStatus === nextStatus) {
    adminUsersRedirect("success", "Keine Aenderung notwendig.")
  }

  const now = new Date().toISOString()
  const membershipUpdate: Record<string, unknown> = {
    role: nextRole,
    status: nextStatus,
    joined_at: nextStatus === "active" ? membership.joined_at ?? now : membership.joined_at,
  }

  if (nextStatus === "disabled") {
    membershipUpdate.revoked_at = now
  } else if (Object.prototype.hasOwnProperty.call(membership, "revoked_at")) {
    membershipUpdate.revoked_at = null
  }

  const { error: updateError } = await serviceClient
    .from("organization_memberships")
    .update(membershipUpdate)
    .eq("id", membership.id)

  if (updateError) throw new Error(updateError.message)

  await writeAdminAudit(serviceClient, currentMembership, "team_membership_updated", membership.id, {
    email: membership.email,
    previousRole,
    nextRole,
    previousStatus,
    nextStatus,
  })

  revalidatePath("/admin/users")
  adminUsersRedirect("success", `Zugriff fuer ${membership.email} wurde aktualisiert.`)
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
