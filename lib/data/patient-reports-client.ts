import type { SupabaseClient } from "@supabase/supabase-js"

import type { PatientReportRecord, PatientReportSnapshot, PatientReportVersion } from "@/lib/types"
import { withTimeout } from "@/lib/data/utils"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client"

export const PATIENT_REPORT_FILES_BUCKET = "patient-report-files"

interface PatientReportRow {
  id: string
  user_id: string
  patient_ref: string
  patient_name: string
  patient_indication: string | null
  plan_id: string
  protocol_id: string | null
  plan_date_label: string
  notes: string | null
  last_format: PatientReportRecord["lastFormat"]
  last_file_name: string | null
  latest_version_id: string | null
  latest_version_number: number | null
  retention_policy_id: string | null
  retention_until: string | null
  retention_status: PatientReportRecord["retentionStatus"]
  retention_notes: string | null
  created_at: string
  updated_at: string
}

interface PatientReportVersionRow {
  id: string
  patient_report_id: string
  user_id: string
  patient_ref: string
  patient_name: string
  patient_indication: string | null
  plan_id: string
  protocol_id: string | null
  version_number: number
  format: "CSV" | "PDF"
  file_name: string
  file_size: number
  content_type: string
  storage_bucket: string
  storage_path: string
  snapshot: PatientReportSnapshot
  exported_at: string
  retention_policy_id: string | null
  retention_until: string | null
  retention_status: PatientReportVersion["retentionStatus"]
  retention_notes: string | null
  created_at: string
  updated_at: string
}

interface PersistPatientReportInput
  extends Omit<PatientReportRecord, "id" | "createdAt" | "updatedAt" | "versions"> {
  id?: string
}

interface PersistPatientReportVersionInput {
  patientReportId: string
  patientRef: string
  patientName: string
  patientIndication?: string
  planId: string
  protocolId?: string
  format: "CSV" | "PDF"
  fileName: string
  fileSize: number
  contentType: string
  storageBucket?: string
  storagePath: string
  snapshot: PatientReportSnapshot
  retentionPolicyId?: string
  retentionUntil?: string
  retentionStatus?: PatientReportVersion["retentionStatus"]
  retentionNotes?: string
}

function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase
  return createBrowserSupabaseClient()
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error) {
    throw new Error(error.message)
  }

  return data.user?.id ?? null
}

function mapPatientReportVersionRow(row: PatientReportVersionRow): PatientReportVersion {
  return {
    id: row.id,
    patientReportId: row.patient_report_id,
    userId: row.user_id,
    patientRef: row.patient_ref,
    patientName: row.patient_name,
    patientIndication: row.patient_indication ?? undefined,
    planId: row.plan_id,
    protocolId: row.protocol_id ?? undefined,
    versionNumber: row.version_number,
    format: row.format,
    fileName: row.file_name,
    fileSize: row.file_size,
    contentType: row.content_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    snapshot: row.snapshot,
    exportedAt: row.exported_at,
    retentionPolicyId: row.retention_policy_id ?? undefined,
    retentionUntil: row.retention_until ?? undefined,
    retentionStatus: row.retention_status ?? undefined,
    retentionNotes: row.retention_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPatientReportRow(
  row: PatientReportRow,
  versions: PatientReportVersion[] = [],
): PatientReportRecord {
  return {
    id: row.id,
    userId: row.user_id,
    patientRef: row.patient_ref,
    patientName: row.patient_name,
    patientIndication: row.patient_indication ?? undefined,
    planId: row.plan_id,
    protocolId: row.protocol_id ?? undefined,
    planDateLabel: row.plan_date_label,
    notes: row.notes ?? undefined,
    lastFormat: row.last_format,
    lastFileName: row.last_file_name ?? undefined,
    latestVersionId: row.latest_version_id ?? undefined,
    latestVersionNumber: row.latest_version_number ?? undefined,
    retentionPolicyId: row.retention_policy_id ?? undefined,
    retentionUntil: row.retention_until ?? undefined,
    retentionStatus: row.retention_status ?? undefined,
    retentionNotes: row.retention_notes ?? undefined,
    versions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchVersionsForReports(
  reportIds: string[],
  client: SupabaseClient,
): Promise<Map<string, PatientReportVersion[]>> {
  if (reportIds.length === 0) {
    return new Map()
  }

  const { data, error } = await withTimeout(
    client
      .from("patient_report_versions")
      .select("*")
      .in("patient_report_id", reportIds)
      .order("exported_at", { ascending: false }),
    5000,
    "Supabase patient report version request timed out",
  )

  if (error) {
    throw new Error(error.message)
  }

  const grouped = new Map<string, PatientReportVersion[]>()
  for (const row of (data ?? []) as PatientReportVersionRow[]) {
    const version = mapPatientReportVersionRow(row)
    grouped.set(version.patientReportId, [...(grouped.get(version.patientReportId) ?? []), version])
  }

  return grouped
}

export async function fetchPatientReportsClient(
  patientRef?: string,
  supabase?: SupabaseClient,
): Promise<PatientReportRecord[]> {
  const client = resolveClient(supabase)
  let query = client
    .from("patient_reports")
    .select("*")
    .order("updated_at", { ascending: false })

  if (patientRef) {
    query = query.eq("patient_ref", patientRef)
  }

  const { data, error } = await withTimeout(
    query,
    5000,
    "Supabase patient report request timed out",
  )

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as PatientReportRow[]
  const versionsByReportId = await fetchVersionsForReports(
    rows.map((row) => row.id),
    client,
  )

  return rows.map((row) => mapPatientReportRow(row, versionsByReportId.get(row.id) ?? []))
}

export async function fetchPatientReportByIdClient(
  reportId: string,
  supabase?: SupabaseClient,
): Promise<PatientReportRecord | null> {
  const client = resolveClient(supabase)
  const { data, error } = await withTimeout(
    client.from("patient_reports").select("*").eq("id", reportId).maybeSingle(),
    5000,
    "Supabase patient report lookup timed out",
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const versionsByReportId = await fetchVersionsForReports([reportId], client)
  return mapPatientReportRow(
    data as PatientReportRow,
    versionsByReportId.get(reportId) ?? [],
  )
}

export async function fetchPatientReportVersionByIdClient(
  versionId: string,
  supabase?: SupabaseClient,
): Promise<PatientReportVersion | null> {
  const client = resolveClient(supabase)
  const { data, error } = await withTimeout(
    client.from("patient_report_versions").select("*").eq("id", versionId).maybeSingle(),
    5000,
    "Supabase patient report version lookup timed out",
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return mapPatientReportVersionRow(data as PatientReportVersionRow)
}

export async function persistPatientReportRecord(
  report: PersistPatientReportInput,
  supabase?: SupabaseClient,
): Promise<PatientReportRecord> {
  const client = resolveClient(supabase)
  const userId = await getAuthenticatedUserId(client)

  if (!userId) {
    throw new Error("AUTH_REQUIRED")
  }

  const { data, error } = await client
    .from("patient_reports")
    .upsert(
      {
        user_id: userId,
        patient_ref: report.patientRef,
        patient_name: report.patientName,
        patient_indication: report.patientIndication ?? null,
        plan_id: report.planId,
        protocol_id: report.protocolId ?? null,
        plan_date_label: report.planDateLabel,
        notes: report.notes ?? null,
        last_format: report.lastFormat,
        last_file_name: report.lastFileName ?? null,
        latest_version_id: report.latestVersionId ?? null,
        latest_version_number: report.latestVersionNumber ?? 0,
        retention_policy_id: report.retentionPolicyId ?? null,
        retention_until: report.retentionUntil ?? null,
        retention_status: report.retentionStatus ?? "active",
        retention_notes: report.retentionNotes ?? null,
      },
      { onConflict: "user_id,patient_ref" },
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapPatientReportRow(data as PatientReportRow)
}

export async function persistPatientReportVersion(
  input: PersistPatientReportVersionInput,
  supabase?: SupabaseClient,
): Promise<PatientReportVersion> {
  const client = resolveClient(supabase)
  const userId = await getAuthenticatedUserId(client)

  if (!userId) {
    throw new Error("AUTH_REQUIRED")
  }

  const { data: latestVersionRow, error: latestVersionError } = await client
    .from("patient_report_versions")
    .select("version_number")
    .eq("patient_report_id", input.patientReportId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestVersionError) {
    throw new Error(latestVersionError.message)
  }

  const nextVersionNumber = (latestVersionRow?.version_number ?? 0) + 1
  const versionId = crypto.randomUUID()

  const { data, error } = await client
    .from("patient_report_versions")
    .insert({
      id: versionId,
      patient_report_id: input.patientReportId,
      user_id: userId,
      patient_ref: input.patientRef,
      patient_name: input.patientName,
      patient_indication: input.patientIndication ?? null,
      plan_id: input.planId,
      protocol_id: input.protocolId ?? null,
      version_number: nextVersionNumber,
      format: input.format,
      file_name: input.fileName,
      file_size: input.fileSize,
      content_type: input.contentType,
      storage_bucket: input.storageBucket ?? PATIENT_REPORT_FILES_BUCKET,
      storage_path: input.storagePath,
      snapshot: input.snapshot,
      retention_policy_id: input.retentionPolicyId ?? null,
      retention_until: input.retentionUntil ?? null,
      retention_status: input.retentionStatus ?? "active",
      retention_notes: input.retentionNotes ?? null,
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const version = mapPatientReportVersionRow(data as PatientReportVersionRow)

  const { error: updateError } = await client
    .from("patient_reports")
    .update({
      patient_name: input.patientName,
      patient_indication: input.patientIndication ?? null,
      plan_id: input.planId,
      protocol_id: input.protocolId ?? null,
      plan_date_label: input.snapshot.planDateLabel,
      notes: input.snapshot.notes,
      last_format: input.format,
      last_file_name: input.fileName,
      latest_version_id: version.id,
      latest_version_number: version.versionNumber,
      retention_policy_id: input.retentionPolicyId ?? null,
      retention_until: input.retentionUntil ?? null,
      retention_status: input.retentionStatus ?? "active",
      retention_notes: input.retentionNotes ?? null,
    })
    .eq("id", input.patientReportId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return version
}
