import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCurrentMembership, requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ApiKeyRecord, ApiKeyScope } from "@/lib/types";

export const API_KEY_SCOPES = [
  "exports:datasets:read",
] as const satisfies readonly ApiKeyScope[];

type ApiKeyRow = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  scopes: ApiKeyScope[];
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApiKeyLookupRow = ApiKeyRow & {
  token_hash: string;
};

export interface VerifiedApiKey {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
}

export type ApiKeyVerificationResult =
  | { ok: true; key: VerifiedApiKey; serviceClient: SupabaseClient }
  | { ok: false; status: number; error: string };

function mapApiKey(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: row.scopes,
    expiresAt: row.expires_at ?? undefined,
    lastUsedAt: row.last_used_at ?? undefined,
    lastUsedIp: row.last_used_ip ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashApiKey(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateApiKeyToken() {
  return `prodi_${randomBytes(32).toString("base64url")}`;
}

function normalizeScopes(value: unknown): ApiKeyScope[] {
  if (!Array.isArray(value)) return ["exports:datasets:read"];
  const scopes = value.filter((scope): scope is ApiKeyScope =>
    API_KEY_SCOPES.includes(scope as ApiKeyScope),
  );
  return scopes.length > 0 ? Array.from(new Set(scopes)) : ["exports:datasets:read"];
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? undefined;
}

export function hasApiKeyAuthorization(request: Request) {
  return Boolean(getBearerToken(request));
}

export async function listApiKeys(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("api_keys")
    .select("id,organization_id,user_id,name,token_prefix,scopes,expires_at,last_used_at,last_used_ip,revoked_at,created_at,updated_at")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as ApiKeyRow[]).map(mapApiKey);
}

export async function createApiKey(
  input: { name: string; scopes?: unknown; expiresAt?: string | null },
  supabase?: SupabaseClient,
) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const name = input.name.trim();
  if (!name) throw new Error("API_KEY_NAME_REQUIRED");

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("API_KEY_EXPIRY_INVALID");

  const token = generateApiKeyToken();
  const payload = {
    organization_id: membership.organizationId,
    user_id: membership.userId,
    name,
    token_prefix: token.slice(0, 14),
    token_hash: hashApiKey(token),
    scopes: normalizeScopes(input.scopes),
    expires_at: expiresAt?.toISOString() ?? null,
  };

  const { data, error } = await client
    .from("api_keys")
    .insert(payload)
    .select("id,organization_id,user_id,name,token_prefix,scopes,expires_at,last_used_at,last_used_ip,revoked_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);

  await writeAccessAuditLog(client, {
    action: "api_key_created",
    targetType: "api_key",
    targetId: (data as ApiKeyRow).id,
    metadata: {
      name,
      scopes: payload.scopes,
      expiresAt: payload.expires_at,
    },
  });

  return { apiKey: mapApiKey(data as ApiKeyRow), token };
}

export async function revokeApiKey(keyId: string, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("api_keys")
    .update({ revoked_at: now })
    .eq("id", keyId)
    .eq("organization_id", membership.organizationId)
    .is("revoked_at", null)
    .select("id,organization_id,user_id,name,token_prefix,scopes,expires_at,last_used_at,last_used_ip,revoked_at,created_at,updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("API_KEY_NOT_FOUND");

  await writeAccessAuditLog(client, {
    action: "api_key_revoked",
    targetType: "api_key",
    targetId: keyId,
    metadata: {
      name: (data as ApiKeyRow).name,
      scopes: (data as ApiKeyRow).scopes,
    },
  });

  return mapApiKey(data as ApiKeyRow);
}

export async function verifyApiKeyRequest(
  request: Request,
  requiredScope: ApiKeyScope,
): Promise<ApiKeyVerificationResult> {
  const token = getBearerToken(request);
  if (!token) return { ok: false, status: 401, error: "AUTH_REQUIRED" };
  if (!token.startsWith("prodi_")) return { ok: false, status: 401, error: "API_KEY_INVALID" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 503, error: "API_KEY_SERVICE_UNAVAILABLE" };
  }

  const serviceClient = await createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await serviceClient
    .from("api_keys")
    .select("id,organization_id,user_id,name,token_prefix,token_hash,scopes,expires_at,last_used_at,last_used_ip,revoked_at,created_at,updated_at")
    .eq("token_hash", hashApiKey(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  const row = data as ApiKeyLookupRow | null;
  if (!row) return { ok: false, status: 401, error: "API_KEY_INVALID" };
  if (row.expires_at && row.expires_at <= now) return { ok: false, status: 401, error: "API_KEY_EXPIRED" };
  if (!row.scopes.includes(requiredScope)) return { ok: false, status: 403, error: "API_KEY_SCOPE_DENIED" };

  await serviceClient
    .from("api_keys")
    .update({ last_used_at: now, last_used_ip: getClientIp(request) ?? null })
    .eq("id", row.id);

  return {
    ok: true,
    serviceClient,
    key: {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      name: row.name,
      scopes: row.scopes,
    },
  };
}
