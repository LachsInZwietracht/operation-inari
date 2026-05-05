import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAccessAuditLog } from "@/lib/audit/access-audit";

type Hl7Segment = {
  name: string;
  fields: string[];
};

type Hl7ParsedMessage = {
  fieldSeparator: string;
  componentSeparator: string;
  repetitionSeparator: string;
  escapeCharacter: string;
  subcomponentSeparator: string;
  segments: Hl7Segment[];
};

type PatientImportInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "m" | "w" | "d";
  legacyId: string;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
};

type PatientResolution =
  | { status: "created" | "updated"; patientId: string; patient: PatientImportInput }
  | { status: "needs_review"; reason: string; patient?: Partial<PatientImportInput> };

type ImportContext = {
  supabase: SupabaseClient;
  organizationId: string;
  actorUserId: string;
  sourceSystem: string;
  allowCreatePatients: boolean;
};

type ImportCounts = {
  patientsCreated: number;
  patientsUpdated: number;
  labValuesCreated: number;
  needsReview: number;
  skipped: number;
  failed: number;
};

type ImportResultRow = {
  target_type: "patient" | "patient_lab_value";
  target_id?: string | null;
  status: "created" | "updated" | "skipped" | "needs_review" | "failed";
  metadata: Record<string, unknown>;
};

type LabMappingRow = {
  id: string;
  parameter_id: string;
  unit: string | null;
};

type ImportJobRow = {
  id: string;
  status: string;
  summary: Record<string, unknown>;
};

export type Hl7ImportSummary = {
  jobId: string;
  status: "received" | "parsed" | "needs_review" | "imported" | "failed";
  sourceSystem: string;
  messageControlId: string;
  messageType: string;
  duplicate: boolean;
  counts: ImportCounts;
  reviewItems: Array<Record<string, unknown>>;
};

function field(segment: Hl7Segment, index: number) {
  return segment.fields[index - 1] ?? "";
}

function component(value: string, index: number, separator: string) {
  return value.split(separator)[index - 1] ?? "";
}

function normalizeDate(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function normalizeSex(value: string): "m" | "w" | "d" {
  const upper = value.trim().toUpperCase();
  if (upper === "M") return "m";
  if (upper === "F") return "w";
  return "d";
}

function normalizeSourceSystem(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || "unknown-hl7";
}

function hashMessage(message: string) {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

export function parseHl7Message(message: string): Hl7ParsedMessage {
  const normalized = message.replace(/\r\n/g, "\r").replace(/\n/g, "\r").trim();
  const rawSegments = normalized.split(/\r+/).filter(Boolean);
  if (rawSegments.length === 0 || !rawSegments[0].startsWith("MSH")) {
    throw new Error("HL7_MSH_REQUIRED");
  }

  const fieldSeparator = rawSegments[0][3] || "|";
  const encoding = rawSegments[0].split(fieldSeparator)[1] ?? "^~\\&";
  const componentSeparator = encoding[0] || "^";
  const repetitionSeparator = encoding[1] || "~";
  const escapeCharacter = encoding[2] || "\\";
  const subcomponentSeparator = encoding[3] || "&";

  const segments = rawSegments.map((raw) => {
    const parts = raw.split(fieldSeparator);
    return { name: parts[0], fields: parts.slice(1) };
  });

  return {
    fieldSeparator,
    componentSeparator,
    repetitionSeparator,
    escapeCharacter,
    subcomponentSeparator,
    segments,
  };
}

function mshField(segment: Hl7Segment, index: number) {
  if (index === 1) return "|";
  return segment.fields[index - 2] ?? "";
}

function getMsh(parsed: Hl7ParsedMessage) {
  const msh = parsed.segments.find((segment) => segment.name === "MSH");
  if (!msh) throw new Error("HL7_MSH_REQUIRED");
  const messageType = mshField(msh, 9).replace(/\^/g, "^");
  const messageControlId = mshField(msh, 10);
  if (!messageType || !messageControlId) {
    throw new Error("HL7_MSH_METADATA_REQUIRED");
  }
  return { messageType, messageControlId };
}

function parsePid(parsed: Hl7ParsedMessage, sourceSystem: string): PatientImportInput | null {
  const pid = parsed.segments.find((segment) => segment.name === "PID");
  if (!pid) return null;

  const pid3 = field(pid, 3).split(parsed.repetitionSeparator)[0] ?? "";
  const externalId = component(pid3, 1, parsed.componentSeparator);
  const assigningAuthority = component(pid3, 4, parsed.componentSeparator) || sourceSystem;
  const nameField = field(pid, 5).split(parsed.repetitionSeparator)[0] ?? "";
  const lastName = component(nameField, 1, parsed.componentSeparator).trim();
  const firstName = component(nameField, 2, parsed.componentSeparator).trim();
  const dateOfBirth = normalizeDate(field(pid, 7));

  if (!externalId || !firstName || !lastName || !dateOfBirth) return null;

  const addressField = field(pid, 11).split(parsed.repetitionSeparator)[0] ?? "";
  return {
    firstName,
    lastName,
    dateOfBirth,
    gender: normalizeSex(field(pid, 8)),
    legacyId: `${sourceSystem}:${assigningAuthority}:${externalId}`,
    street: component(addressField, 1, parsed.componentSeparator) || undefined,
    city: component(addressField, 3, parsed.componentSeparator) || undefined,
    zip: component(addressField, 5, parsed.componentSeparator) || undefined,
    phone: field(pid, 13).split(parsed.repetitionSeparator)[0] || undefined,
  };
}

function parseObxSegments(parsed: Hl7ParsedMessage) {
  return parsed.segments
    .filter((segment) => segment.name === "OBX")
    .map((segment, index) => {
      const identifier = field(segment, 3);
      return {
        segmentIndex: index + 1,
        valueType: field(segment, 2),
        identifier: component(identifier, 1, parsed.componentSeparator),
        text: component(identifier, 2, parsed.componentSeparator),
        codingSystem: component(identifier, 3, parsed.componentSeparator),
        value: field(segment, 5),
        unit: component(field(segment, 6), 1, parsed.componentSeparator) || field(segment, 6),
        referenceRange: field(segment, 7),
        abnormalFlags: field(segment, 8)
          .split(parsed.repetitionSeparator)
          .filter(Boolean),
        resultStatus: field(segment, 11),
        observedAt: normalizeDate(field(segment, 14)),
      };
    });
}

async function resolvePatient(ctx: ImportContext, patient: PatientImportInput): Promise<PatientResolution> {
  const { data: legacyMatch, error: legacyError } = await ctx.supabase
    .from("patients")
    .select("id")
    .eq("user_id", ctx.actorUserId)
    .eq("legacy_id", patient.legacyId)
    .maybeSingle();
  if (legacyError) throw new Error(legacyError.message);

  if (legacyMatch?.id) {
    const { error } = await ctx.supabase
      .from("patients")
      .update({
        first_name: patient.firstName,
        last_name: patient.lastName,
        date_of_birth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone ?? null,
        street: patient.street ?? null,
        zip: patient.zip ?? null,
        city: patient.city ?? null,
        notes: "HL7 Import aktualisiert",
      })
      .eq("id", legacyMatch.id);
    if (error) throw new Error(error.message);
    return { status: "updated", patientId: legacyMatch.id as string, patient };
  }

  const { data: nameMatches, error: nameError } = await ctx.supabase
    .from("patients")
    .select("id")
    .eq("user_id", ctx.actorUserId)
    .eq("first_name", patient.firstName)
    .eq("last_name", patient.lastName)
    .eq("date_of_birth", patient.dateOfBirth);
  if (nameError) throw new Error(nameError.message);

  if ((nameMatches ?? []).length > 1) {
    return { status: "needs_review", reason: "AMBIGUOUS_PATIENT_MATCH", patient };
  }

  if ((nameMatches ?? []).length === 1) {
    const patientId = nameMatches![0].id as string;
    const { error } = await ctx.supabase
      .from("patients")
      .update({
        legacy_id: patient.legacyId,
        gender: patient.gender,
        phone: patient.phone ?? null,
        street: patient.street ?? null,
        zip: patient.zip ?? null,
        city: patient.city ?? null,
        notes: "HL7 Import zugeordnet",
      })
      .eq("id", patientId);
    if (error) throw new Error(error.message);
    return { status: "updated", patientId, patient };
  }

  if (!ctx.allowCreatePatients) {
    return { status: "needs_review", reason: "PATIENT_CREATE_DISABLED", patient };
  }

  const { data: created, error } = await ctx.supabase
    .from("patients")
    .insert({
      legacy_id: patient.legacyId,
      user_id: ctx.actorUserId,
      first_name: patient.firstName,
      last_name: patient.lastName,
      date_of_birth: patient.dateOfBirth,
      gender: patient.gender,
      phone: patient.phone ?? null,
      street: patient.street ?? null,
      zip: patient.zip ?? null,
      city: patient.city ?? null,
      insurance_provider: "HL7 Import",
      indication: "HL7 Import",
      notes: "Aus HL7 v2 Import angelegt",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { status: "created", patientId: created.id as string, patient };
}

async function findLabMapping(
  ctx: ImportContext,
  identifier: string,
  codingSystem: string,
): Promise<LabMappingRow | null> {
  const { data, error } = await ctx.supabase
    .from("hl7_lab_parameter_mappings")
    .select("id,parameter_id,unit")
    .eq("organization_id", ctx.organizationId)
    .eq("source_system", ctx.sourceSystem)
    .eq("hl7_identifier", identifier)
    .eq("hl7_coding_system", codingSystem || "")
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as LabMappingRow | null;
}

function increment(counts: ImportCounts, status: ImportResultRow["status"], targetType: ImportResultRow["target_type"]) {
  if (targetType === "patient" && status === "created") counts.patientsCreated += 1;
  else if (targetType === "patient" && status === "updated") counts.patientsUpdated += 1;
  else if (targetType === "patient_lab_value" && status === "created") counts.labValuesCreated += 1;
  else if (status === "needs_review") counts.needsReview += 1;
  else if (status === "skipped") counts.skipped += 1;
  else if (status === "failed") counts.failed += 1;
}

function summarize(
  jobId: string,
  status: Hl7ImportSummary["status"],
  sourceSystem: string,
  messageControlId: string,
  messageType: string,
  duplicate: boolean,
  counts: ImportCounts,
  results: ImportResultRow[],
): Hl7ImportSummary {
  return {
    jobId,
    status,
    sourceSystem,
    messageControlId,
    messageType,
    duplicate,
    counts,
    reviewItems: results
      .filter((result) => result.status === "needs_review" || result.status === "failed")
      .map((result) => ({
        targetType: result.target_type,
        status: result.status,
        ...result.metadata,
      })),
  };
}

async function createResults(
  supabase: SupabaseClient,
  jobId: string,
  results: ImportResultRow[],
) {
  if (results.length === 0) return;
  const { error } = await supabase.from("hl7_import_results").insert(
    results.map((result) => ({
      job_id: jobId,
      target_type: result.target_type,
      target_id: result.target_id ?? null,
      status: result.status,
      metadata: result.metadata,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function importHl7Message(
  input: {
    supabase: SupabaseClient;
    organizationId: string;
    actorUserId: string;
    sourceSystem?: string;
    message: string;
    allowCreatePatients?: boolean;
  },
): Promise<Hl7ImportSummary> {
  const parsed = parseHl7Message(input.message);
  const msh = getMsh(parsed);
  const sourceSystem = normalizeSourceSystem(input.sourceSystem);
  const ctx: ImportContext = {
    supabase: input.supabase,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    sourceSystem,
    allowCreatePatients: input.allowCreatePatients ?? true,
  };

  const { data: existingJob, error: existingError } = await input.supabase
    .from("hl7_import_jobs")
    .select("id,status,summary")
    .eq("organization_id", input.organizationId)
    .eq("source_system", sourceSystem)
    .eq("message_control_id", msh.messageControlId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existingJob) {
    const summary = ((existingJob as ImportJobRow).summary ?? {}) as Partial<Hl7ImportSummary>;
    return {
      jobId: (existingJob as ImportJobRow).id,
      status: (existingJob as ImportJobRow).status as Hl7ImportSummary["status"],
      sourceSystem,
      messageControlId: msh.messageControlId,
      messageType: msh.messageType,
      duplicate: true,
      counts: summary.counts ?? {
        patientsCreated: 0,
        patientsUpdated: 0,
        labValuesCreated: 0,
        needsReview: 0,
        skipped: 0,
        failed: 0,
      },
      reviewItems: summary.reviewItems ?? [],
    };
  }

  const { data: job, error: jobError } = await input.supabase
    .from("hl7_import_jobs")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      source_system: sourceSystem,
      message_control_id: msh.messageControlId,
      message_type: msh.messageType,
      status: "received",
      raw_message_sha256: hashMessage(input.message),
      summary: { messageType: msh.messageType },
    })
    .select("id")
    .single();
  if (jobError) throw new Error(jobError.message);

  const jobId = job.id as string;
  await writeAccessAuditLog(input.supabase, {
    action: "hl7_import_received",
    targetType: "hl7_import_job",
    targetId: jobId,
    metadata: {
      sourceSystem,
      messageControlId: msh.messageControlId,
      messageType: msh.messageType,
    },
  }, { actorUserId: input.actorUserId });

  const results: ImportResultRow[] = [];
  const counts: ImportCounts = {
    patientsCreated: 0,
    patientsUpdated: 0,
    labValuesCreated: 0,
    needsReview: 0,
    skipped: 0,
    failed: 0,
  };

  const patientInput = parsePid(parsed, sourceSystem);
  if (!patientInput) {
    results.push({
      target_type: "patient",
      status: "needs_review",
      metadata: { reason: "PID_INCOMPLETE_OR_MISSING" },
    });
  } else {
    const patientResolution = await resolvePatient(ctx, patientInput);
    if (patientResolution.status === "needs_review") {
      results.push({
        target_type: "patient",
        status: "needs_review",
        metadata: { reason: patientResolution.reason, legacyId: patientInput.legacyId },
      });
    } else {
      results.push({
        target_type: "patient",
        target_id: patientResolution.patientId,
        status: patientResolution.status,
        metadata: {
          legacyId: patientInput.legacyId,
          sourceSystem,
        },
      });
      await writeAccessAuditLog(input.supabase, {
        action: "hl7_patient_upserted",
        targetType: "patient",
        targetId: patientResolution.patientId,
        metadata: {
          sourceSystem,
          messageControlId: msh.messageControlId,
          resultStatus: patientResolution.status,
        },
      }, { actorUserId: input.actorUserId });

      for (const obx of parseObxSegments(parsed)) {
        const mapping = await findLabMapping(ctx, obx.identifier, obx.codingSystem);
        if (!mapping) {
          results.push({
            target_type: "patient_lab_value",
            status: "needs_review",
            metadata: {
              reason: "UNKNOWN_LAB_MAPPING",
              hl7Identifier: obx.identifier,
              hl7Text: obx.text,
              hl7CodingSystem: obx.codingSystem,
              segment: `OBX-${obx.segmentIndex}`,
            },
          });
          continue;
        }

        const numericValue = Number(String(obx.value).replace(",", "."));
        if (!Number.isFinite(numericValue)) {
          results.push({
            target_type: "patient_lab_value",
            status: "needs_review",
            metadata: {
              reason: "NON_NUMERIC_OBX_VALUE",
              hl7Identifier: obx.identifier,
              segment: `OBX-${obx.segmentIndex}`,
            },
          });
          continue;
        }

        const observedDate = obx.observedAt ?? new Date().toISOString().slice(0, 10);
        const { data: labValue, error: labError } = await input.supabase
          .from("patient_lab_values")
          .insert({
            patient_id: patientResolution.patientId,
            user_id: input.actorUserId,
            parameter_id: mapping.parameter_id,
            date: observedDate,
            value: numericValue,
            notes: "HL7 Import",
            metadata: {
              source: "hl7",
              sourceSystem,
              messageControlId: msh.messageControlId,
              hl7Identifier: obx.identifier,
              hl7Text: obx.text,
              hl7CodingSystem: obx.codingSystem,
              unit: obx.unit || mapping.unit,
              referenceRange: obx.referenceRange || undefined,
              abnormalFlags: obx.abnormalFlags,
              resultStatus: obx.resultStatus || undefined,
            },
          })
          .select("id")
          .single();
        if (labError) throw new Error(labError.message);

        results.push({
          target_type: "patient_lab_value",
          target_id: labValue.id as string,
          status: "created",
          metadata: {
            patientId: patientResolution.patientId,
            parameterId: mapping.parameter_id,
            hl7Identifier: obx.identifier,
            segment: `OBX-${obx.segmentIndex}`,
          },
        });
        await writeAccessAuditLog(input.supabase, {
          action: "hl7_lab_value_upserted",
          targetType: "patient_lab_value",
          targetId: labValue.id as string,
          metadata: {
            patientId: patientResolution.patientId,
            parameterId: mapping.parameter_id,
            sourceSystem,
            messageControlId: msh.messageControlId,
          },
        }, { actorUserId: input.actorUserId });
      }
    }
  }

  for (const result of results) {
    increment(counts, result.status, result.target_type);
  }

  const status: Hl7ImportSummary["status"] = counts.failed > 0
    ? "failed"
    : counts.needsReview > 0
      ? "needs_review"
      : "imported";
  const summary = summarize(
    jobId,
    status,
    sourceSystem,
    msh.messageControlId,
    msh.messageType,
    false,
    counts,
    results,
  );

  await createResults(input.supabase, jobId, results);
  const { error: updateJobError } = await input.supabase
    .from("hl7_import_jobs")
    .update({ status, summary })
    .eq("id", jobId);
  if (updateJobError) throw new Error(updateJobError.message);

  return summary;
}
