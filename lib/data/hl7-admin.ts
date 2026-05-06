import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCurrentMembership, requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient } from "@/lib/supabase/server";

export type Hl7ImportJobStatus = "received" | "parsed" | "needs_review" | "imported" | "failed";
export type Hl7ImportResultStatus = "created" | "updated" | "skipped" | "needs_review" | "failed";
export type Hl7LabMappingStatus = "active" | "disabled";

export type Hl7ImportJobAdminRecord = {
  id: string;
  organizationId: string;
  actorUserId: string;
  sourceSystem: string;
  messageControlId: string;
  messageType: string;
  status: Hl7ImportJobStatus;
  rawMessageSha256: string;
  summary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Hl7ImportResultAdminRecord = {
  id: string;
  jobId: string;
  targetType: "patient" | "patient_lab_value";
  targetId?: string;
  status: Hl7ImportResultStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type Hl7LabMappingAdminRecord = {
  id: string;
  organizationId: string;
  sourceSystem: string;
  hl7Identifier: string;
  hl7Text?: string;
  hl7CodingSystem: string;
  parameterId: string;
  unit?: string;
  status: Hl7LabMappingStatus;
  createdAt: string;
  updatedAt: string;
};

export type UpsertHl7LabMappingInput = {
  id?: string;
  sourceSystem: string;
  hl7Identifier: string;
  hl7Text?: string;
  hl7CodingSystem?: string;
  parameterId: string;
  unit?: string;
  status: Hl7LabMappingStatus;
};

type Hl7ImportJobRow = {
  id: string;
  organization_id: string;
  actor_user_id: string;
  source_system: string;
  message_control_id: string;
  message_type: string;
  status: Hl7ImportJobStatus;
  raw_message_sha256: string;
  summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type Hl7ImportResultRow = {
  id: string;
  job_id: string;
  target_type: "patient" | "patient_lab_value";
  target_id: string | null;
  status: Hl7ImportResultStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Hl7LabMappingRow = {
  id: string;
  organization_id: string;
  source_system: string;
  hl7_identifier: string;
  hl7_text: string | null;
  hl7_coding_system: string | null;
  parameter_id: string;
  unit: string | null;
  status: Hl7LabMappingStatus;
  created_at: string;
  updated_at: string;
};

const LAB_MAPPING_STATUSES = ["active", "disabled"] as const satisfies readonly Hl7LabMappingStatus[];

function mapJob(row: Hl7ImportJobRow): Hl7ImportJobAdminRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id,
    sourceSystem: row.source_system,
    messageControlId: row.message_control_id,
    messageType: row.message_type,
    status: row.status,
    rawMessageSha256: row.raw_message_sha256,
    summary: row.summary ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResult(row: Hl7ImportResultRow): Hl7ImportResultAdminRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    targetType: row.target_type,
    targetId: row.target_id ?? undefined,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapMapping(row: Hl7LabMappingRow): Hl7LabMappingAdminRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceSystem: row.source_system,
    hl7Identifier: row.hl7_identifier,
    hl7Text: row.hl7_text ?? undefined,
    hl7CodingSystem: row.hl7_coding_system ?? "",
    parameterId: row.parameter_id,
    unit: row.unit ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRequiredText(value: string | undefined, errorCode: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function assertValidLabMappingInput(input: UpsertHl7LabMappingInput) {
  if (!LAB_MAPPING_STATUSES.includes(input.status)) throw new Error("HL7_LAB_MAPPING_STATUS_INVALID");
  return {
    sourceSystem: normalizeRequiredText(input.sourceSystem, "HL7_LAB_MAPPING_SOURCE_REQUIRED"),
    hl7Identifier: normalizeRequiredText(input.hl7Identifier, "HL7_LAB_MAPPING_IDENTIFIER_REQUIRED"),
    hl7Text: normalizeOptionalText(input.hl7Text),
    hl7CodingSystem: normalizeOptionalText(input.hl7CodingSystem) ?? "",
    parameterId: normalizeRequiredText(input.parameterId, "HL7_LAB_MAPPING_PARAMETER_REQUIRED"),
    unit: normalizeOptionalText(input.unit),
    status: input.status,
  };
}

export async function listHl7ImportJobsForAdmin(supabase?: SupabaseClient, limit = 25) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("hl7_import_jobs")
    .select("id,organization_id,actor_user_id,source_system,message_control_id,message_type,status,raw_message_sha256,summary,created_at,updated_at")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Hl7ImportJobRow[]).map(mapJob);
}

export async function listHl7ReviewResultsForAdmin(supabase?: SupabaseClient, limit = 50) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data: jobs, error: jobsError } = await client
    .from("hl7_import_jobs")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (jobsError) throw new Error(jobsError.message);

  const jobIds = (jobs ?? []).map((job) => job.id as string);
  if (jobIds.length === 0) return [];

  const { data, error } = await client
    .from("hl7_import_results")
    .select("id,job_id,target_type,target_id,status,metadata,created_at")
    .in("job_id", jobIds)
    .in("status", ["needs_review", "failed"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Hl7ImportResultRow[]).map(mapResult);
}

export async function listHl7LabMappingsForAdmin(supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data, error } = await client
    .from("hl7_lab_parameter_mappings")
    .select("id,organization_id,source_system,hl7_identifier,hl7_text,hl7_coding_system,parameter_id,unit,status,created_at,updated_at")
    .eq("organization_id", membership.organizationId)
    .order("source_system", { ascending: true })
    .order("hl7_identifier", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Hl7LabMappingRow[]).map(mapMapping);
}

export async function upsertHl7LabMappingForAdmin(input: UpsertHl7LabMappingInput, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);
  const normalized = assertValidLabMappingInput(input);

  let previous: Hl7LabMappingRow | null = null;
  if (input.id) {
    const { data: previousData, error: previousError } = await client
      .from("hl7_lab_parameter_mappings")
      .select("id,organization_id,source_system,hl7_identifier,hl7_text,hl7_coding_system,parameter_id,unit,status,created_at,updated_at")
      .eq("id", input.id)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (previousError) throw new Error(previousError.message);
    if (!previousData) throw new Error("HL7_LAB_MAPPING_NOT_FOUND");
    previous = previousData as Hl7LabMappingRow;
  }

  const payload = {
    organization_id: membership.organizationId,
    source_system: normalized.sourceSystem,
    hl7_identifier: normalized.hl7Identifier,
    hl7_text: normalized.hl7Text,
    hl7_coding_system: normalized.hl7CodingSystem,
    parameter_id: normalized.parameterId,
    unit: normalized.unit,
    status: normalized.status,
  };

  const mutation = input.id
    ? client
        .from("hl7_lab_parameter_mappings")
        .update(payload)
        .eq("id", input.id)
        .eq("organization_id", membership.organizationId)
        .select("id,organization_id,source_system,hl7_identifier,hl7_text,hl7_coding_system,parameter_id,unit,status,created_at,updated_at")
        .single()
    : client
        .from("hl7_lab_parameter_mappings")
        .insert(payload)
        .select("id,organization_id,source_system,hl7_identifier,hl7_text,hl7_coding_system,parameter_id,unit,status,created_at,updated_at")
        .single();

  const { data, error } = await mutation;
  if (error) throw new Error(error.message);
  const row = data as Hl7LabMappingRow;

  await writeAccessAuditLog(client, {
    action: input.id ? "hl7_lab_mapping_updated" : "hl7_lab_mapping_created",
    targetType: "hl7_lab_parameter_mapping",
    targetId: row.id,
    metadata: {
      sourceSystem: row.source_system,
      hl7Identifier: row.hl7_identifier,
      hl7CodingSystem: row.hl7_coding_system,
      previousParameterId: previous?.parameter_id,
      nextParameterId: row.parameter_id,
      previousStatus: previous?.status,
      nextStatus: row.status,
    },
  });

  return mapMapping(row);
}

export async function disableHl7LabMappingForAdmin(mappingId: string, supabase?: SupabaseClient) {
  const client = supabase ?? await createClient();
  await requireRole(ADMIN_ROLES, client);
  const membership = await ensureCurrentMembership(client);

  const { data: previous, error: previousError } = await client
    .from("hl7_lab_parameter_mappings")
    .select("id,organization_id,source_system,hl7_identifier,hl7_text,hl7_coding_system,parameter_id,unit,status,created_at,updated_at")
    .eq("id", mappingId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (previousError) throw new Error(previousError.message);
  if (!previous) throw new Error("HL7_LAB_MAPPING_NOT_FOUND");

  const { data, error } = await client
    .from("hl7_lab_parameter_mappings")
    .update({ status: "disabled" })
    .eq("id", mappingId)
    .eq("organization_id", membership.organizationId)
    .select("id,organization_id,source_system,hl7_identifier,hl7_text,hl7_coding_system,parameter_id,unit,status,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  const row = data as Hl7LabMappingRow;

  await writeAccessAuditLog(client, {
    action: "hl7_lab_mapping_disabled",
    targetType: "hl7_lab_parameter_mapping",
    targetId: row.id,
    metadata: {
      sourceSystem: row.source_system,
      hl7Identifier: row.hl7_identifier,
      hl7CodingSystem: row.hl7_coding_system,
      parameterId: row.parameter_id,
      previousStatus: (previous as Hl7LabMappingRow).status,
      nextStatus: row.status,
    },
  });

  return mapMapping(row);
}
