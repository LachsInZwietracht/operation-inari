import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { AppRole, Organization, OrganizationMembership } from "@/lib/types";

type MembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  status: OrganizationMembership["status"];
  invited_by: string | null;
  invitation_sent_at: string | null;
  invitation_expires_at: string | null;
  revoked_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
  }
}

function mapMembership(row: MembershipRow): OrganizationMembership {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by ?? undefined,
    invitationSentAt: row.invitation_sent_at ?? undefined,
    invitationExpiresAt: row.invitation_expires_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    joinedAt: row.joined_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDisplayName(user: User) {
  const firstName = typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : "";
  const lastName = typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : "";
  return [firstName, lastName].filter(Boolean).join(" ") || user.email || "Unbekannter Benutzer";
}

export async function getCurrentUser(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user;
}

export async function requireUser(supabase?: SupabaseClient) {
  const user = await getCurrentUser(supabase);
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function fetchCurrentMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizationMembership | null> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapMembership(data as MembershipRow) : null;
}

export async function ensureCurrentMembership(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  const user = await requireUser(client);
  const existingMembership = await fetchCurrentMembership(client, user.id);
  if (existingMembership) return existingMembership;

  const displayName = getDisplayName(user);
  const organizationName = displayName === user.email ? "Meine Organisation" : `${displayName} Organisation`;

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .insert({
      name: organizationName,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (organizationError) throw new Error(organizationError.message);

  const { data: membership, error: membershipError } = await client
    .from("organization_memberships")
    .insert({
      organization_id: (organization as OrganizationRow).id,
      user_id: user.id,
      email: user.email ?? "unbekannt",
      display_name: displayName,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (membershipError) throw new Error(membershipError.message);
  return mapMembership(membership as MembershipRow);
}

export async function requireRole(allowedRoles: readonly AppRole[], supabase?: SupabaseClient) {
  const membership = await ensureCurrentMembership(supabase);
  if (!allowedRoles.includes(membership.role)) throw new ForbiddenError();
  return membership;
}

export async function fetchCurrentOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapOrganization(data as OrganizationRow) : null;
}

export async function fetchOrganizationMemberships(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationMembership[]> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as MembershipRow[]).map(mapMembership);
}
