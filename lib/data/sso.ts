import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ensureCurrentMembership, requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  AppRole,
  OrganizationSsoConfigRecord,
  SsoMappableRole,
  SsoConfigStatus,
  SsoDomainResolution,
  SsoProviderType,
  SsoRoleMappingRecord,
  SsoRoleMappingStatus,
  SsoRoleResolution,
} from "@/lib/types";

type SsoConfigRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  provider_type: SsoProviderType;
  status: SsoConfigStatus;
  display_name: string;
  domains: string[];
  issuer_url: string | null;
  metadata_url: string | null;
  metadata_xml: string | null;
  client_id: string | null;
  entity_id: string | null;
  sso_url: string | null;
  login_hint_parameter: string;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
  organizations?: { name: string } | Array<{ name: string }> | null;
};

type SsoRoleMappingRow = {
  id: string;
  organization_id: string;
  sso_config_id: string;
  claim_name: string;
  claim_value: string;
  role: SsoMappableRole;
  priority: number;
  status: SsoRoleMappingStatus;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface UpsertSsoConfigInput {
  id?: string;
  providerType: SsoProviderType;
  status: SsoConfigStatus;
  displayName: string;
  domains: string[];
  issuerUrl?: string;
  metadataUrl?: string;
  metadataXml?: string;
  clientId?: string;
  entityId?: string;
  ssoUrl?: string;
  loginHintParameter?: string;
}

export interface UpsertSsoRoleMappingInput {
  id?: string;
  ssoConfigId: string;
  claimName: string;
  claimValue: string;
  role: SsoMappableRole;
  priority: number;
  status: SsoRoleMappingStatus;
}

export interface ResolveSsoRoleInput {
  organizationId: string;
  ssoConfigId: string;
  claims: Record<string, unknown>;
  existingRole?: AppRole | null;
}

export interface CompleteVerifiedSsoLoginResult {
  status: "applied" | "owner_preserved" | "rejected";
  organizationId?: string;
  role?: AppRole;
  reason?: string;
  resolution?: SsoRoleResolution;
}

const PROVIDER_TYPES = ["oidc", "saml"] as const satisfies readonly SsoProviderType[];
const STATUSES = ["draft", "active", "disabled"] as const satisfies readonly SsoConfigStatus[];
const MAPPABLE_ROLES = ["admin", "dietitian", "assistant", "institution_admin"] as const satisfies readonly SsoMappableRole[];
const MAPPING_STATUSES = ["active", "disabled"] as const satisfies readonly SsoRoleMappingStatus[];

function mapConfig(row: SsoConfigRow): OrganizationSsoConfigRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by ?? undefined,
    providerType: row.provider_type,
    status: row.status,
    displayName: row.display_name,
    domains: row.domains,
    issuerUrl: row.issuer_url ?? undefined,
    metadataUrl: row.metadata_url ?? undefined,
    metadataXml: row.metadata_xml ?? undefined,
    clientId: row.client_id ?? undefined,
    entityId: row.entity_id ?? undefined,
    ssoUrl: row.sso_url ?? undefined,
    loginHintParameter: row.login_hint_parameter,
    disabledAt: row.disabled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoleMapping(row: SsoRoleMappingRow): SsoRoleMappingRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ssoConfigId: row.sso_config_id,
    claimName: row.claim_name,
    claimValue: row.claim_value,
    role: row.role,
    priority: row.priority,
    status: row.status,
    disabledAt: row.disabled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getOrganizationName(row: SsoConfigRow) {
  if (Array.isArray(row.organizations)) return row.organizations[0]?.name;
  return row.organizations?.name;
}

function normalizeOptionalText(value: string | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function normalizeDomains(domains: string[]) {
  const normalized = domains
    .flatMap((value) => value.split(/[\s,;]+/))
    .map((value) => value.trim().toLowerCase())
    .map((value) => value.replace(/^@/, ""))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function assertValidInput(input: UpsertSsoConfigInput) {
  if (!PROVIDER_TYPES.includes(input.providerType)) throw new Error("SSO_PROVIDER_INVALID");
  if (!STATUSES.includes(input.status)) throw new Error("SSO_STATUS_INVALID");
  if (!input.displayName.trim()) throw new Error("SSO_DISPLAY_NAME_REQUIRED");

  const domains = normalizeDomains(input.domains);
  if (domains.length === 0) throw new Error("SSO_DOMAIN_REQUIRED");

  const issuerUrl = normalizeOptionalText(input.issuerUrl);
  const metadataUrl = normalizeOptionalText(input.metadataUrl);
  const metadataXml = normalizeOptionalText(input.metadataXml);
  const ssoUrl = normalizeOptionalText(input.ssoUrl);

  if (input.providerType === "oidc" && !issuerUrl && !metadataUrl) {
    throw new Error("SSO_OIDC_ISSUER_REQUIRED");
  }
  if (input.providerType === "saml" && !metadataUrl && !metadataXml && !ssoUrl) {
    throw new Error("SSO_SAML_METADATA_REQUIRED");
  }

  return {
    domains,
    issuerUrl,
    metadataUrl,
    metadataXml,
    ssoUrl,
  };
}

function normalizeClaimText(value: string) {
  return value.trim();
}

function normalizeClaimValue(value: string) {
  return value.trim();
}

function assertValidMappingInput(input: UpsertSsoRoleMappingInput) {
  const claimName = normalizeClaimText(input.claimName);
  const claimValue = normalizeClaimValue(input.claimValue);
  if (!input.ssoConfigId) throw new Error("SSO_CONFIG_REQUIRED");
  if (!claimName) throw new Error("SSO_MAPPING_CLAIM_NAME_REQUIRED");
  if (!claimValue) throw new Error("SSO_MAPPING_CLAIM_VALUE_REQUIRED");
  if (!MAPPABLE_ROLES.includes(input.role)) throw new Error("SSO_MAPPING_ROLE_INVALID");
  if (!MAPPING_STATUSES.includes(input.status)) throw new Error("SSO_MAPPING_STATUS_INVALID");
  const priority = Math.trunc(Number(input.priority));
  if (!Number.isFinite(priority) || priority < 0 || priority > 10_000) {
    throw new Error("SSO_MAPPING_PRIORITY_INVALID");
  }
  return { claimName, claimValue, priority };
}

function claimValueMatches(actual: unknown, expected: string): boolean {
  if (Array.isArray(actual)) {
    return actual.some((entry) => claimValueMatches(entry, expected));
  }
  if (actual && typeof actual === "object") {
    return false;
  }
  return String(actual ?? "").trim() === expected;
}

function getEmailDomain(email: string | undefined) {
  return email?.trim().toLowerCase().split("@")[1] || "";
}

function getUserDisplayName(user: User) {
  const identityData = user.identities?.find((identity) => identity.identity_data)?.identity_data;
  const fullName = identityData?.full_name ?? identityData?.name ?? user.app_metadata?.full_name ?? user.app_metadata?.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  const firstName = identityData?.first_name ?? user.app_metadata?.first_name;
  const lastName = identityData?.last_name ?? user.app_metadata?.last_name;
  const displayName = [firstName, lastName]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  return displayName || user.email || "SSO Benutzer";
}

function mergeClaimValue(previous: unknown, next: unknown) {
  if (previous === undefined) return next;
  const previousValues = Array.isArray(previous) ? previous : [previous];
  const nextValues = Array.isArray(next) ? next : [next];
  return Array.from(new Set([...previousValues, ...nextValues].map((value) => String(value))));
}

export function extractVerifiedSsoClaims(user: User): Record<string, unknown> {
  const claims: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(user.app_metadata ?? {})) {
    if (value !== undefined && value !== null) claims[key] = value;
  }

  for (const identity of user.identities ?? []) {
    if (!identity.identity_data) continue;
    claims.provider = mergeClaimValue(claims.provider, identity.provider);
    for (const [key, value] of Object.entries(identity.identity_data)) {
      if (value !== undefined && value !== null) {
        claims[key] = mergeClaimValue(claims[key], value);
      }
    }
  }

  if (user.email) claims.email = user.email;
  return claims;
}

function hasVerifiedSsoIdentity(user: User) {
  if (user.is_sso_user) return true;
  return (user.identities ?? []).some((identity) => identity.provider === "sso" || identity.provider === "saml");
}

async function findActiveSsoConfigForEmail(email: string, supabase: SupabaseClient) {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  const { data, error } = await supabase
    .from("organization_sso_configs")
    .select("id,organization_id,created_by,provider_type,status,display_name,domains,issuer_url,metadata_url,metadata_xml,client_id,entity_id,sso_url,login_hint_parameter,disabled_at,created_at,updated_at")
    .eq("status", "active")
    .contains("domains", [domain])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? data as SsoConfigRow : null;
}

export async function listSsoConfigs(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("organization_sso_configs")
    .select("id,organization_id,created_by,provider_type,status,display_name,domains,issuer_url,metadata_url,metadata_xml,client_id,entity_id,sso_url,login_hint_parameter,disabled_at,created_at,updated_at")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SsoConfigRow[]).map(mapConfig);
}

export async function listSsoRoleMappings(ssoConfigId: string, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("sso_group_role_mappings")
    .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
    .eq("organization_id", membership.organizationId)
    .eq("sso_config_id", ssoConfigId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SsoRoleMappingRow[]).map(mapRoleMapping);
}

export async function upsertSsoRoleMapping(input: UpsertSsoRoleMappingInput, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);
  const normalized = assertValidMappingInput(input);

  const { data: config, error: configError } = await client
    .from("organization_sso_configs")
    .select("id,organization_id")
    .eq("id", input.ssoConfigId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (configError) throw new Error(configError.message);
  if (!config) throw new Error("SSO_CONFIG_NOT_FOUND");

  let previous: SsoRoleMappingRow | null = null;
  if (input.id) {
    const { data: previousData, error: previousError } = await client
      .from("sso_group_role_mappings")
      .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
      .eq("id", input.id)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (previousError) throw new Error(previousError.message);
    if (!previousData) throw new Error("SSO_MAPPING_NOT_FOUND");
    previous = previousData as SsoRoleMappingRow;
  }

  const payload = {
    organization_id: membership.organizationId,
    sso_config_id: input.ssoConfigId,
    claim_name: normalized.claimName,
    claim_value: normalized.claimValue,
    role: input.role,
    priority: normalized.priority,
    status: input.status,
    disabled_at: input.status === "disabled" ? new Date().toISOString() : null,
  };

  const mutation = input.id
    ? client
        .from("sso_group_role_mappings")
        .update(payload)
        .eq("id", input.id)
        .eq("organization_id", membership.organizationId)
        .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
        .single()
    : client
        .from("sso_group_role_mappings")
        .insert(payload)
        .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
        .single();

  const { data, error } = await mutation;
  if (error) throw new Error(error.message);
  const row = data as SsoRoleMappingRow;

  await writeAccessAuditLog(client, {
    action: input.id ? "sso_mapping_updated" : "sso_mapping_created",
    targetType: "sso_group_role_mapping",
    targetId: row.id,
    metadata: {
      ssoConfigId: row.sso_config_id,
      claimName: row.claim_name,
      claimValue: row.claim_value,
      previousRole: previous?.role,
      nextRole: row.role,
      previousStatus: previous?.status,
      nextStatus: row.status,
      previousPriority: previous?.priority,
      nextPriority: row.priority,
    },
  });

  return mapRoleMapping(row);
}

export async function disableSsoRoleMapping(mappingId: string, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);
  const now = new Date().toISOString();

  const { data: previous, error: previousError } = await client
    .from("sso_group_role_mappings")
    .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
    .eq("id", mappingId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (previousError) throw new Error(previousError.message);
  if (!previous) throw new Error("SSO_MAPPING_NOT_FOUND");

  const { data, error } = await client
    .from("sso_group_role_mappings")
    .update({ status: "disabled", disabled_at: now })
    .eq("id", mappingId)
    .eq("organization_id", membership.organizationId)
    .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  const row = data as SsoRoleMappingRow;

  await writeAccessAuditLog(client, {
    action: "sso_mapping_disabled",
    targetType: "sso_group_role_mapping",
    targetId: row.id,
    metadata: {
      ssoConfigId: row.sso_config_id,
      claimName: row.claim_name,
      claimValue: row.claim_value,
      previousRole: (previous as SsoRoleMappingRow).role,
      nextRole: row.role,
      previousStatus: (previous as SsoRoleMappingRow).status,
      nextStatus: row.status,
    },
  });

  return mapRoleMapping(row);
}

export async function resolveSsoRoleFromClaims(
  input: ResolveSsoRoleInput,
  supabase?: SupabaseClient,
): Promise<SsoRoleResolution> {
  if (input.existingRole === "owner") {
    return {
      status: "owner_preserved",
      role: "owner",
      matchedMappingIds: [],
      reason: "ACTIVE_OWNER_NOT_CHANGED_BY_SSO",
    };
  }

  const client = supabase ?? await createServiceClient();
  const { data: config, error: configError } = await client
    .from("organization_sso_configs")
    .select("id,status,organization_id")
    .eq("id", input.ssoConfigId)
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .maybeSingle();
  if (configError) throw new Error(configError.message);
  if (!config) return { status: "no_match", matchedMappingIds: [], reason: "SSO_CONFIG_NOT_ACTIVE" };

  const { data, error } = await client
    .from("sso_group_role_mappings")
    .select("id,organization_id,sso_config_id,claim_name,claim_value,role,priority,status,disabled_at,created_at,updated_at")
    .eq("organization_id", input.organizationId)
    .eq("sso_config_id", input.ssoConfigId)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const matches = ((data ?? []) as SsoRoleMappingRow[])
    .filter((mapping) => claimValueMatches(input.claims[mapping.claim_name], mapping.claim_value));

  if (matches.length === 0) {
    return { status: "no_match", matchedMappingIds: [] };
  }

  const highestPriority = matches[0].priority;
  const topMatches = matches.filter((mapping) => mapping.priority === highestPriority);
  if (topMatches.length > 1) {
    return {
      status: "ambiguous",
      matchedMappingIds: topMatches.map((mapping) => mapping.id),
      reason: "MULTIPLE_SSO_MAPPINGS_WITH_SAME_PRIORITY",
    };
  }

  return {
    status: "matched",
    role: topMatches[0].role,
    mappingId: topMatches[0].id,
    matchedMappingIds: matches.map((mapping) => mapping.id),
  };
}

export async function completeVerifiedSsoLogin(
  user: User,
  supabase?: SupabaseClient,
): Promise<CompleteVerifiedSsoLoginResult> {
  if (!user.email) return { status: "rejected", reason: "SSO_USER_EMAIL_REQUIRED" };
  if (!hasVerifiedSsoIdentity(user)) return { status: "rejected", reason: "SSO_VERIFIED_IDENTITY_REQUIRED" };

  const client = supabase ?? await createServiceClient();
  const config = await findActiveSsoConfigForEmail(user.email, client);
  if (!config) return { status: "rejected", reason: "SSO_CONFIG_NOT_FOUND_FOR_EMAIL" };

  const { data: existingMembership, error: membershipError } = await client
    .from("organization_memberships")
    .select("id,organization_id,user_id,email,display_name,role,status,invited_by,invitation_sent_at,invitation_expires_at,revoked_at,joined_at,created_at,updated_at")
    .eq("organization_id", config.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  const existing = existingMembership as { id: string; role: AppRole; status: string; joined_at: string | null } | null;
  const claims = extractVerifiedSsoClaims(user);
  const resolution = await resolveSsoRoleFromClaims(
    {
      organizationId: config.organization_id,
      ssoConfigId: config.id,
      claims,
      existingRole: existing?.status === "active" ? existing.role : null,
    },
    client,
  );

  if (resolution.status === "owner_preserved") {
    await writeAccessAuditLog(client, {
      action: "sso_callback_owner_preserved",
      targetType: "organization_membership",
      targetId: existing?.id,
      metadata: {
        ssoConfigId: config.id,
        matchedMappingIds: resolution.matchedMappingIds,
        reason: resolution.reason,
      },
    }, { actorUserId: user.id });

    return {
      status: "owner_preserved",
      organizationId: config.organization_id,
      role: "owner",
      resolution,
    };
  }

  if (resolution.status !== "matched" || !resolution.role) {
    return {
      status: "rejected",
      organizationId: config.organization_id,
      reason: resolution.reason ?? resolution.status,
      resolution,
    };
  }

  const now = new Date().toISOString();
  const payload = {
    organization_id: config.organization_id,
    user_id: user.id,
    email: user.email,
    display_name: getUserDisplayName(user),
    role: resolution.role,
    status: "active",
    joined_at: existing?.joined_at ?? now,
  };

  const mutation = existing
    ? client
        .from("organization_memberships")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single()
    : client
        .from("organization_memberships")
        .insert(payload)
        .select("id")
        .single();

  const { data: membership, error: mutationError } = await mutation;
  if (mutationError) throw new Error(mutationError.message);

  await writeAccessAuditLog(client, {
    action: existing ? "sso_callback_membership_updated" : "sso_callback_membership_created",
    targetType: "organization_membership",
    targetId: (membership as { id: string }).id,
    metadata: {
      ssoConfigId: config.id,
      mappingId: resolution.mappingId,
      matchedMappingIds: resolution.matchedMappingIds,
      previousRole: existing?.role,
      nextRole: resolution.role,
      previousStatus: existing?.status,
      nextStatus: "active",
    },
  }, { actorUserId: user.id });

  return {
    status: "applied",
    organizationId: config.organization_id,
    role: resolution.role,
    resolution,
  };
}

export async function upsertSsoConfig(input: UpsertSsoConfigInput, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);
  const normalized = assertValidInput(input);

  const payload = {
    organization_id: membership.organizationId,
    created_by: membership.userId,
    provider_type: input.providerType,
    status: input.status,
    display_name: input.displayName.trim(),
    domains: normalized.domains,
    issuer_url: normalized.issuerUrl,
    metadata_url: normalized.metadataUrl,
    metadata_xml: normalized.metadataXml,
    client_id: normalizeOptionalText(input.clientId),
    entity_id: normalizeOptionalText(input.entityId),
    sso_url: normalized.ssoUrl,
    login_hint_parameter: normalizeOptionalText(input.loginHintParameter) ?? "login_hint",
    disabled_at: input.status === "disabled" ? new Date().toISOString() : null,
  };

  const mutation = input.id
    ? client
        .from("organization_sso_configs")
        .update(payload)
        .eq("id", input.id)
        .eq("organization_id", membership.organizationId)
        .select("id,organization_id,created_by,provider_type,status,display_name,domains,issuer_url,metadata_url,metadata_xml,client_id,entity_id,sso_url,login_hint_parameter,disabled_at,created_at,updated_at")
        .single()
    : client
        .from("organization_sso_configs")
        .insert(payload)
        .select("id,organization_id,created_by,provider_type,status,display_name,domains,issuer_url,metadata_url,metadata_xml,client_id,entity_id,sso_url,login_hint_parameter,disabled_at,created_at,updated_at")
        .single();

  const { data, error } = await mutation;
  if (error) throw new Error(error.message);

  await writeAccessAuditLog(client, {
    action: input.id ? "sso_config_updated" : "sso_config_created",
    targetType: "organization_sso_config",
    targetId: (data as SsoConfigRow).id,
    metadata: {
      providerType: input.providerType,
      status: input.status,
      domains: normalized.domains,
      displayName: input.displayName.trim(),
    },
  });

  return mapConfig(data as SsoConfigRow);
}

export async function disableSsoConfig(configId: string, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("organization_sso_configs")
    .update({ status: "disabled", disabled_at: now })
    .eq("id", configId)
    .eq("organization_id", membership.organizationId)
    .select("id,organization_id,created_by,provider_type,status,display_name,domains,issuer_url,metadata_url,metadata_xml,client_id,entity_id,sso_url,login_hint_parameter,disabled_at,created_at,updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("SSO_CONFIG_NOT_FOUND");

  await writeAccessAuditLog(client, {
    action: "sso_config_disabled",
    targetType: "organization_sso_config",
    targetId: configId,
    metadata: {
      providerType: (data as SsoConfigRow).provider_type,
      domains: (data as SsoConfigRow).domains,
      displayName: (data as SsoConfigRow).display_name,
    },
  });

  return mapConfig(data as SsoConfigRow);
}

export async function resolveSsoByEmail(email: string): Promise<SsoDomainResolution> {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return { matched: false };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { matched: false, domain };

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("organization_sso_configs")
    .select("id,organization_id,provider_type,status,display_name,domains,login_hint_parameter,organizations(name)")
    .eq("status", "active")
    .contains("domains", [domain])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as unknown as SsoConfigRow | null;
  if (!row) return { matched: false, domain };

  return {
    matched: true,
    domain,
    organizationId: row.organization_id,
    organizationName: getOrganizationName(row),
    providerType: row.provider_type,
    displayName: row.display_name,
    status: row.status,
    loginHintParameter: row.login_hint_parameter,
  };
}
