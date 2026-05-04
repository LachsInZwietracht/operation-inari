import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCurrentMembership, requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  OrganizationSsoConfigRecord,
  SsoConfigStatus,
  SsoDomainResolution,
  SsoProviderType,
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

const PROVIDER_TYPES = ["oidc", "saml"] as const satisfies readonly SsoProviderType[];
const STATUSES = ["draft", "active", "disabled"] as const satisfies readonly SsoConfigStatus[];

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
