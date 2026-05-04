import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCurrentMembership, requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  WebhookDeliveryAttemptRecord,
  WebhookEndpointRecord,
  WebhookEvent,
} from "@/lib/types";

export const WEBHOOK_EVENTS = [
  "dataset_export_created",
  "report_export_created",
  "digital_protocol_submission_received",
] as const satisfies readonly WebhookEvent[];

type WebhookEndpointRow = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  url: string;
  secret_prefix: string;
  events: WebhookEvent[];
  status: WebhookEndpointRecord["status"];
  last_success_at: string | null;
  last_failure_at: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

type WebhookDeliveryAttemptRow = {
  id: string;
  organization_id: string;
  webhook_endpoint_id: string;
  event: WebhookEvent;
  target_type: string;
  target_id: string | null;
  status: WebhookDeliveryAttemptRecord["status"];
  attempt_count: number;
  next_attempt_at: string | null;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  payload: Record<string, unknown>;
  queued_at: string;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  webhook_endpoints?: { name: string } | Array<{ name: string }> | null;
};

export interface QueueWebhookEventInput {
  event: WebhookEvent;
  targetType: string;
  targetId?: string;
  payload: Record<string, unknown>;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

function normalizeWebhookEvents(value: unknown): WebhookEvent[] {
  if (!Array.isArray(value)) return ["dataset_export_created"];
  const events = value.filter((event): event is WebhookEvent =>
    WEBHOOK_EVENTS.includes(event as WebhookEvent),
  );
  return events.length > 0 ? Array.from(new Set(events)) : ["dataset_export_created"];
}

function mapEndpoint(row: WebhookEndpointRow): WebhookEndpointRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    name: row.name,
    url: row.url,
    secretPrefix: row.secret_prefix,
    events: row.events,
    status: row.status,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastFailureAt: row.last_failure_at ?? undefined,
    disabledAt: row.disabled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttempt(row: WebhookDeliveryAttemptRow): WebhookDeliveryAttemptRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    webhookEndpointId: row.webhook_endpoint_id,
    webhookEndpointName: Array.isArray(row.webhook_endpoints)
      ? row.webhook_endpoints[0]?.name
      : row.webhook_endpoints?.name,
    event: row.event,
    targetType: row.target_type,
    targetId: row.target_id ?? undefined,
    status: row.status,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at ?? undefined,
    responseStatus: row.response_status ?? undefined,
    responseBody: row.response_body ?? undefined,
    errorMessage: row.error_message ?? undefined,
    payload: row.payload ?? {},
    queuedAt: row.queued_at,
    deliveredAt: row.delivered_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveOrganizationId(serviceClient: SupabaseClient, actorUserId: string) {
  const { data, error } = await serviceClient
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", actorUserId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { organization_id: string } | null)?.organization_id ?? null;
}

export async function listWebhookEndpoints(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("webhook_endpoints")
    .select("id,organization_id,user_id,name,url,secret_prefix,events,status,last_success_at,last_failure_at,disabled_at,created_at,updated_at")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as WebhookEndpointRow[]).map(mapEndpoint);
}

export async function listWebhookDeliveryAttempts(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("webhook_delivery_attempts")
    .select("id,organization_id,webhook_endpoint_id,event,target_type,target_id,status,attempt_count,next_attempt_at,response_status,response_body,error_message,payload,queued_at,delivered_at,created_at,updated_at,webhook_endpoints(name)")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as WebhookDeliveryAttemptRow[]).map(mapAttempt);
}

export async function createWebhookEndpoint(
  input: { name: string; url: string; events?: unknown },
  supabase?: SupabaseClient,
) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const name = input.name.trim();
  if (!name) throw new Error("WEBHOOK_NAME_REQUIRED");

  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error("WEBHOOK_URL_INVALID");
  }
  if (url.protocol !== "https:") throw new Error("WEBHOOK_URL_HTTPS_REQUIRED");

  const secret = generateWebhookSecret();
  const events = normalizeWebhookEvents(input.events);
  const { data, error } = await client
    .from("webhook_endpoints")
    .insert({
      organization_id: membership.organizationId,
      user_id: membership.userId,
      name,
      url: url.toString(),
      secret_prefix: secret.slice(0, 12),
      secret_hash: hashSecret(secret),
      events,
    })
    .select("id,organization_id,user_id,name,url,secret_prefix,events,status,last_success_at,last_failure_at,disabled_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);

  await writeAccessAuditLog(client, {
    action: "webhook_endpoint_created",
    targetType: "webhook_endpoint",
    targetId: (data as WebhookEndpointRow).id,
    metadata: { name, url: url.toString(), events },
  });

  return { endpoint: mapEndpoint(data as WebhookEndpointRow), secret };
}

export async function disableWebhookEndpoint(endpointId: string, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("webhook_endpoints")
    .update({ status: "disabled", disabled_at: now })
    .eq("id", endpointId)
    .eq("organization_id", membership.organizationId)
    .select("id,organization_id,user_id,name,url,secret_prefix,events,status,last_success_at,last_failure_at,disabled_at,created_at,updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("WEBHOOK_ENDPOINT_NOT_FOUND");

  await writeAccessAuditLog(client, {
    action: "webhook_endpoint_disabled",
    targetType: "webhook_endpoint",
    targetId: endpointId,
    metadata: {
      name: (data as WebhookEndpointRow).name,
      events: (data as WebhookEndpointRow).events,
    },
  });

  return mapEndpoint(data as WebhookEndpointRow);
}

export async function queueWebhookDeliveryAttempts(
  input: QueueWebhookEventInput,
  options: { actorUserId?: string } = {},
) {
  if (!options.actorUserId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const serviceClient = await createServiceClient();
    const organizationId = await resolveOrganizationId(serviceClient, options.actorUserId);
    if (!organizationId) return [];

    const { data: endpoints, error: endpointError } = await serviceClient
      .from("webhook_endpoints")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .contains("events", [input.event]);

    if (endpointError) throw new Error(endpointError.message);
    const rows = (endpoints ?? []) as Array<{ id: string }>;
    if (rows.length === 0) return [];

    const attemptRows = rows.map((endpoint) => ({
      organization_id: organizationId,
      webhook_endpoint_id: endpoint.id,
      event: input.event,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      status: "queued",
      next_attempt_at: new Date().toISOString(),
      payload: {
        event: input.event,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        data: input.payload,
      },
    }));

    const { data, error } = await serviceClient
      .from("webhook_delivery_attempts")
      .insert(attemptRows)
      .select("id");

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Webhook delivery queue skipped for ${input.event}:`, message);
    return [];
  }
}
